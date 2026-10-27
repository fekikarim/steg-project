package tn.steg.backend.ai.infrastructure.python;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import tn.steg.backend.ai.domain.client.DocIntelClient;

/**
 * Resilient client for the Python FastAPI document-intelligence service.
 *
 * <p>Guarantees: shared-token auth, strict timeouts, bounded retries with backoff,
 * circuit-breaking (fast-degrade after consecutive failures), strict response
 * validation (non-conforming JSON rejected, never rendered raw), field-level audit
 * logging only (never document content). Never throws to business callers — every
 * method returns {@code Optional.empty()} on degraded paths so workflows continue
 * with a clear "AI analysis unavailable" state.
 */
@Slf4j
@Component
public class PythonDocIntelClient implements DocIntelClient {

    static final String SERVICE_VERSION = "1";

    /** The journal PDF capability; a 404 here means a stale ai-services image. */
    static final String JOURNAL_RENDER_PATH = "/api/journal/render";

    /**
     * Upper bound on a rendered journal: 64 MB of PDF (~48 MB base64). Far
     * above any real internship journal (the PDF is text), so this only ever
     * rejects a runaway or hostile response.
     */
    static final int MAX_JOURNAL_PDF_BASE64 = 48 * 1024 * 1024;
    /** "%PDF-" is 5 bytes; anything shorter is not a document. */
    private static final int PDF_MAGIC_MIN_BYTES = 5;

    private final PythonProperties props;
    private final RestClient restClient;
    /** Short-timeout client dedicated to the readiness probe. */
    private final RestClient readyRestClient;
    private final ObjectMapper objectMapper;
    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
    private volatile long lastFailureMillis = 0;
    private static final long CIRCUIT_RESET_MILLIS = 60_000; // 60s half-open: try again after 1 minute

    public PythonDocIntelClient(PythonProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        int timeout = props.getTimeoutMs() > 0 ? props.getTimeoutMs() : 15000;
        rf.setConnectTimeout(Duration.ofMillis(timeout));
        rf.setReadTimeout(Duration.ofMillis(timeout));
        RestClient.Builder builder = RestClient.builder()
                .requestFactory(rf)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
        if (!props.getBaseUrl().isBlank()) {
            builder = builder.baseUrl(props.getBaseUrl());
        }
        this.restClient = builder.build();

        // The probe must be quick: it runs inside a health endpoint.
        SimpleClientHttpRequestFactory readyFactory = new SimpleClientHttpRequestFactory();
        readyFactory.setConnectTimeout(Duration.ofSeconds(2));
        readyFactory.setReadTimeout(Duration.ofSeconds(3));
        this.readyRestClient = RestClient.builder()
                .baseUrl(props.getBaseUrl())
                .requestFactory(readyFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public boolean isConfigured() {
        return !props.getBaseUrl().isBlank() && !props.getServiceToken().isBlank();
    }

    /**
     * Readiness probe against {@code /ready}.
     *
     * <p>Uses a short, separate timeout and deliberately does NOT go through
     * {@link #post(String, String)} or {@link #fail(String, Exception)}: a
     * health probe that counted as an outage would open the very circuit it is
     * checking, and a slow probe would add its timeout to every caller's wait.
     */
    @Override
    public Optional<ReadinessProbe> probeReadiness() {
        if (!isConfigured()) {
            return Optional.of(new ReadinessProbe(false, ""));
        }
        try {
            String body = readyRestClient.get()
                    .uri("/ready")
                    .header("X-Service-Token", props.getServiceToken())
                    .retrieve()
                    .body(String.class);
            if (body == null || body.isBlank()) {
                return Optional.of(new ReadinessProbe(false, ""));
            }
            JsonNode root = objectMapper.readTree(body);
            boolean up = "UP".equals(root.path("status").asText(""))
                    && root.path("configured").asBoolean(false);
            String fingerprint = root.path("tokenFingerprint").asText("");
            return Optional.of(new ReadinessProbe(up, fingerprint));
        } catch (Exception ex) {
            // Deliberately NOT counted against the circuit: probing must not be
            // what opens it, or health checks would cause the outage.
            log.debug("Python AI readiness probe failed: {}", ex.getMessage());
            return Optional.of(new ReadinessProbe(false, ""));
        }
    }

    /**
     * Fingerprint of the token THIS backend holds, comparable against the
     * service's own fingerprint. Uses the same scheme (SHA-256, 8 hex chars)
     * so a mismatch is detectable without either secret being disclosed.
     */
    private String ownTokenFingerprint() {
        String token = props.getServiceToken();
        if (token == null || token.isBlank()) {
            return "";
        }
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                sb.append(String.format("%02x", digest[i]));
            }
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            return "";
        }
    }

    /**
     * True when the service is reachable and holds a DIFFERENT shared secret.
     *
     * <p>This is the state that used to surface as a flat "AI unavailable":
     * both processes were perfectly healthy, they simply did not agree on the
     * token, so every call answered 401. Callers use it to name the real cause.
     */
    @Override
    public boolean tokenMismatch() {
        if (!isConfigured()) {
            return false;
        }
        return probeReadiness().map(probe -> {
            String serviceFingerprint = probe.tokenFingerprint();
            // A service with no token cannot be "mismatched" — it is
            // unconfigured, a different (already reported) problem.
            if (serviceFingerprint == null || serviceFingerprint.isBlank()) {
                return false;
            }
            return !serviceFingerprint.equals(ownTokenFingerprint());
        }).orElse(false);
    }

    @Override
    public boolean circuitOpen() {
        int failures = consecutiveFailures.get();
        if (failures < props.getCircuitBreakerThreshold()) {
            return false;
        }
        // Half-open after reset interval: allow a trial call to probe recovery
        long elapsed = System.currentTimeMillis() - lastFailureMillis;
        if (elapsed > CIRCUIT_RESET_MILLIS) {
            log.info("Python AI circuit half-open after {}ms (failures={}), allowing trial", elapsed, failures);
            // Don't reset count yet — if trial succeeds, ok() will clear it; if fails, fail() will bump and stay open
            return false;
        }
        return true;
    }

    /** Smart document detector: type keywords + candidate-name match (+ OCR fallback server-side). */
        @Override
    public Optional<DocIntelClient.DocumentValidation> validateDocument(byte[] pdf, String expectedType, String fullName) {
        if (!guard("validateDocument")) {
            return Optional.empty();
        }
        try {
            String body = objectMapper.writeValueAsString(new ValidationPayload(
                    Base64.getEncoder().encodeToString(pdf), expectedType, fullName, SERVICE_VERSION));
            JsonNode root = post("/api/doc-intel/validate", body);
            if (root == null || !root.has("valid") || !root.hasNonNull("documentTypeValid")
                    || !root.hasNonNull("candidateNameValid") || !root.hasNonNull("confidence")
                    || !root.hasNonNull("reason")
                    || !"1".equals(root.path("version").asText("1"))) {
                log.warn("Python doc-intel rejected: non-conforming response (field-level only)");
                return Optional.empty();
            }
            ok();
            // `valid` is a JSON boolean in the Python contract — parse tolerantly
            // (boolean or "true"/"valid" strings) so contract drift degrades loudly, not silently.
            JsonNode validNode = root.path("valid");
            boolean valid = validNode.isBoolean() ? validNode.asBoolean(false)
                    : "true".equalsIgnoreCase(validNode.asText("")) || "valid".equalsIgnoreCase(validNode.asText(""));
            return Optional.of(new DocIntelClient.DocumentValidation(
                    valid, root.path("documentTypeValid").asBoolean(),
                    root.path("candidateNameValid").asBoolean(), root.path("confidence").asDouble(),
                    root.path("reason").asText()));
        } catch (tn.steg.backend.common.domain.exception.BusinessRuleException bre) {
            // Client errors from Python (413/422 invalid document, 401 token misconfig):
            // deterministic, NOT a service outage — propagate without tripping the circuit.
            throw bre;
        } catch (Exception ex) {
            fail("validateDocument", ex);
            return Optional.empty();
        }
    }

    /** Advisory report analysis: STEG-focus relevance, never an acceptance decision. */
        @Override
    public Optional<DocIntelClient.ReportAnalysis> analyzeReport(byte[] pdf, String applicationReference) {
        if (!guard("analyzeReport")) {
            return Optional.empty();
        }
        try {
            String body = objectMapper.writeValueAsString(new ReportPayload(
                    Base64.getEncoder().encodeToString(pdf), applicationReference, SERVICE_VERSION));
            JsonNode root = post("/api/report/analyze", body);
            if (root == null || !root.hasNonNull("relevanceScore") || !root.hasNonNull("summary")
                    || !"1".equals(root.path("version").asText("1"))) {
                log.warn("Python report analysis rejected: non-conforming response");
                return Optional.empty();
            }
            ok();
            return Optional.of(new DocIntelClient.ReportAnalysis(root.path("relevanceScore").asDouble(),
                    root.path("detectedStegContent").asText(""), root.path("detectedActivities").asText(""),
                    root.path("missingElements").asText(""), root.path("summary").asText(""),
                    root.path("explanation").asText(""), root.path("confidence").asDouble(0)));
        } catch (Exception ex) {
            fail("analyzeReport", ex);
            return Optional.empty();
        }
    }

    /** Advisory finance verification: VERIFIED / NEEDS_REVIEW / INVALID + reasons. */
        @Override
    public Optional<DocIntelClient.FinanceVerification> verifyFinance(byte[] certificatePdf, byte[] reportPdf,
            String internFullName, String period, String internshipType) {
        if (!guard("verifyFinance")) {
            return Optional.empty();
        }
        try {
            String body = objectMapper.writeValueAsString(new FinancePayload(
                    certificatePdf == null ? null : Base64.getEncoder().encodeToString(certificatePdf),
                    reportPdf == null ? null : Base64.getEncoder().encodeToString(reportPdf),
                    internFullName, period, internshipType, SERVICE_VERSION));
            JsonNode root = post("/api/finance/verify", body);
            if (root == null || !root.hasNonNull("verdict") || !root.hasNonNull("reasons")
                    || !"1".equals(root.path("version").asText("1"))) {
                log.warn("Python finance verification rejected: non-conforming response");
                return Optional.empty();
            }
            String verdict = root.path("verdict").asText("");
            if (!verdict.equals("VERIFIED") && !verdict.equals("NEEDS_REVIEW") && !verdict.equals("INVALID")) {
                log.warn("Python finance verification rejected: unknown verdict");
                return Optional.empty();
            }
            ok();
            return Optional.of(new DocIntelClient.FinanceVerification(verdict, root.path("reasons").asText(""),
                    root.path("confidence").asDouble(0)));
        } catch (Exception ex) {
            fail("verifyFinance", ex);
            return Optional.empty();
        }
    }

    /**
     * S7 report verification (§7.1): PDF + database expected values against
     * {@code POST /api/verification/report}. Strict contract check on the
     * structured {@code {overall, checks[]}} payload — non-conforming JSON is
     * rejected (degraded), never rendered raw. Deterministic 4xx (bad token,
     * oversized/unparsable PDF) propagates as a business error without
     * tripping the outage circuit; anything transient degrades to empty.
     */
        @Override
    public Optional<DocIntelClient.VerificationResult> verifyReport(
            byte[] pdf, DocIntelClient.ReportExpected expected) {
        if (!guard("verifyReport")) {
            return Optional.empty();
        }
        try {
            String body = objectMapper.writeValueAsString(new ReportVerificationPayload(
                    Base64.getEncoder().encodeToString(pdf),
                    expected.candidateName(), expected.supervisorName(), expected.internshipType(),
                    expected.startDate(), expected.endDate(), expected.universityName()));
            JsonNode root = post("/api/verification/report", body);
            DocIntelClient.VerificationResult parsed = parseVerificationResult(root);
            if (parsed == null) {
                log.warn("Python report verification rejected: non-conforming response (field-level only)");
                return Optional.empty();
            }
            ok();
            return Optional.of(parsed);
        } catch (tn.steg.backend.common.domain.exception.BusinessRuleException bre) {
            throw bre;
        } catch (Exception ex) {
            fail("verifyReport", ex);
            return Optional.empty();
        }
    }

    /**
     * S7 journal verification (§7.2): PDF + period + the shared
     * task-completion ratio inputs against {@code POST /api/verification/journal}.
     * Same strictness and degradation contract as {@link #verifyReport}.
     */
        @Override
    public Optional<DocIntelClient.VerificationResult> verifyJournal(
            byte[] pdf, DocIntelClient.JournalExpected expected) {
        if (!guard("verifyJournal")) {
            return Optional.empty();
        }
        try {
            String body = objectMapper.writeValueAsString(new JournalVerificationPayload(
                    Base64.getEncoder().encodeToString(pdf),
                    expected.startDate(), expected.endDate(),
                    expected.completedApprovedTasks(), expected.totalTasks()));
            JsonNode root = post("/api/verification/journal", body);
            DocIntelClient.VerificationResult parsed = parseVerificationResult(root);
            if (parsed == null) {
                log.warn("Python journal verification rejected: non-conforming response (field-level only)");
                return Optional.empty();
            }
            ok();
            return Optional.of(parsed);
        } catch (tn.steg.backend.common.domain.exception.BusinessRuleException bre) {
            throw bre;
        } catch (Exception ex) {
            fail("verifyJournal", ex);
            return Optional.empty();
        }
    }

    /**
     * S8 journal PDF: the student's persisted entries, rendered by the Python
     * service. Same auth, timeout, retry and circuit contract as the advisory
     * calls; the response is parsed strictly (a PDF we cannot decode is a
     * failure, never a half-trusted document).
     */
    @Override
    public Optional<DocIntelClient.JournalRenderResult> renderJournalPdf(
            DocIntelClient.JournalRenderRequest request) {
        if (!guard("renderJournalPdf")) {
            return Optional.empty();
        }
        try {
            String body = objectMapper.writeValueAsString(new JournalRenderPayload(
                    request.documentTitle(), request.internFullName(),
                    request.internshipReference(), request.internshipType(),
                    request.supervisorName(), request.startDate(), request.endDate(),
                    request.entries(), SERVICE_VERSION));
            DocIntelClient.JournalRenderResult parsed = parseJournalRenderResult(post("/api/journal/render", body));
            if (parsed == null) {
                log.warn("Python journal render rejected: non-conforming response (field-level only)");
                return Optional.empty();
            }
            ok();
            return Optional.of(parsed);
        } catch (tn.steg.backend.common.domain.exception.BusinessRuleException bre) {
            throw bre;
        } catch (Exception ex) {
            fail("renderJournalPdf", ex);
            return Optional.empty();
        }
    }

    /** Strict parse: a PDF that will not decode is a failure, not a document. */
    static DocIntelClient.JournalRenderResult parseJournalRenderResult(JsonNode root) {
        if (root == null || !root.isObject()) {
            return null;
        }
        String encoded = root.path("pdfBase64").asText("");
        if (encoded.isBlank()) {
            return null;
        }
        // Bounded: a base64 payload is already fully materialised in the JSON
        // tree, so an unbounded one is a memory risk rather than a document.
        if (encoded.length() > MAX_JOURNAL_PDF_BASE64) {
            log.warn("Python journal render response too large ({} chars) — refusing it",
                    encoded.length());
            return null;
        }
        byte[] pdf;
        try {
            pdf = Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException ex) {
            return null;
        }
        if (pdf.length < PDF_MAGIC_MIN_BYTES) {
            return null;
        }
        return new DocIntelClient.JournalRenderResult(
                pdf,
                root.path("entryCount").asInt(0),
                root.path("dayCount").asInt(0),
                root.path("firstDate").asText(null),
                root.path("lastDate").asText(null),
                root.path("pageCount").asInt(0));
    }

    /**
     * Deterministic §7.3 contract parse: {@code overall} must be PASS/FAIL/INCONCLUSIVE
     * and {@code checks} a list of {@code {key,label,status,expected,found,
     * evidence}} with PASSED/FAILED/INCONCLUSIVE statuses. Returns null on any
     * deviation (degrade, never trust).
     */
    static DocIntelClient.VerificationResult parseVerificationResult(JsonNode root) {
        if (root == null || !root.isObject()) {
            return null;
        }
        String overall = root.path("overall").asText("");
        if (!overall.equals("PASS") && !overall.equals("FAIL") && !overall.equals("INCONCLUSIVE")) {
            return null;
        }
        JsonNode checks = root.path("checks");
        if (!checks.isArray()) {
            return null;
        }
        java.util.List<DocIntelClient.VerificationCheck> parsed = new java.util.ArrayList<>();
        for (JsonNode c : checks) {
            if (!c.isObject()) {
                return null;
            }
            String status = c.path("status").asText("");
            if (!status.equals("PASSED") && !status.equals("FAILED") && !status.equals("INCONCLUSIVE")) {
                return null;
            }
            String key = c.path("key").asText("");
            String label = c.path("label").asText("");
            if (key.isBlank() || label.isBlank()) {
                return null;
            }
            parsed.add(new DocIntelClient.VerificationCheck(key, label, status,
                    c.path("expected").asText(""), c.path("found").asText(""),
                    c.path("evidence").asText("")));
        }
        return new DocIntelClient.VerificationResult(overall, List.copyOf(parsed));
    }

    private boolean guard(String op) {
        if (!isConfigured()) {
            log.debug("Python AI service not configured; degrading {} (no call)", op);
            return false;
        }
        if (circuitOpen()) {
            log.warn("Python AI circuit open; degrading {} (failures={})", op, consecutiveFailures.get());
            return false;
        }
        return true;
    }

    private JsonNode post(String path, String json) throws Exception {
        Exception last = null;
        int attempts = Math.max(1, props.getMaxAttempts());
        for (int i = 1; i <= attempts; i++) {
            try {
                String response = restClient.post().uri(path)
                        .header("X-Service-Token", props.getServiceToken())
                        .body(json).retrieve().body(String.class);
                if (response == null || response.isBlank()) {
                    throw new IllegalStateException("empty response");
                }
                return objectMapper.readTree(response);
            } catch (HttpStatusCodeException httpEx) {
                int status = httpEx.getStatusCode().value();
                if (isDeterministicClientError(status)) {
                    // 400/401/403/404/413/422: deterministic client or config error,
                    // retrying the identical payload can never succeed — fail fast
                    // without burning retry budget or tripping the outage circuit.
                    throw mapDeterministicError(status, httpEx, path);
                }
                // 408/429/5xx: transient — retry with backoff, then let fail() count it.
                last = httpEx;
                if (i < attempts) {
                    Thread.sleep(300L * (1L << (i - 1)));
                }
            } catch (Exception ex) {
                last = ex;
                if (i < attempts) {
                    Thread.sleep(300L * (1L << (i - 1)));
                }
            }
        }
        throw last != null ? last : new IllegalStateException("python call failed");
    }

    /**
     * Deterministic 4xx from Python that must NOT count as a service outage:
     * invalid payload, auth misconfiguration, oversized or unparsable PDF.
     * 408/429 are transient (timeout/rate-limit) and DO count toward the circuit.
     */
    private boolean isDeterministicClientError(int status) {
        return (status >= 400 && status < 500) && status != 408 && status != 429;
    }

    /**
     * Map Python 4xx to precise business codes so callers surface a truthful
     * message (replace the file) instead of a false "service unavailable".
     */
    private tn.steg.backend.common.domain.exception.BusinessRuleException mapDeterministicError(
            int status, HttpStatusCodeException httpEx, String path) {
        String detail = null;
        try {
            JsonNode err = objectMapper.readTree(httpEx.getResponseBodyAsString());
            detail = err.path("error").asText(null);
        } catch (Exception ignored) {
            // fall through to generic messages below
        }
        return switch (status) {
            case 401 -> {
                // A 401 here is almost never "the AI is down": it is this
                // backend and the Python service disagreeing on the shared
                // secret. Both processes are healthy. Saying "AI unavailable"
                // sends an operator looking for a crashed service that does not
                // exist, so name the actual cause and the actual fix.
                log.error("Python AI auth rejected (401): PYTHON_AI_SERVICE_TOKEN differs "
                        + "between this backend and ai-services. The repo-root .env is the "
                        + "canonical source. Not tripping circuit.");
                yield new tn.steg.backend.common.domain.exception.BusinessRuleException(
                        "AI_SERVICE_TOKEN_MISMATCH",
                        "The backend and the AI service do not share the same service token, "
                                + "so the AI service refused the call. Set the identical "
                                + "PYTHON_AI_SERVICE_TOKEN value in both .env files and restart "
                                + "both services. Your journal entries are unaffected.");
            }
            // A missing journal endpoint is a DEPLOYMENT fault, not a bad
            // document: the deployed ai-services image predates the feature.
            // Saying "invalid document" would send an operator hunting through
            // the student's journal instead of at the stale image.
            case 404 -> JOURNAL_RENDER_PATH.equals(path)
                    ? new tn.steg.backend.common.domain.exception.BusinessRuleException(
                            "AI_SERVICE_OUTDATED",
                            "The AI service does not expose the journal PDF endpoint. "
                                    + "It must be rebuilt and redeployed "
                                    + "(docker compose up -d --build in steg-backend).")
                    : new tn.steg.backend.common.domain.exception.BusinessRuleException("INVALID_DOCUMENT",
                            "Document rejected by the analysis service (status 404). Please replace the file.");
            case 413 -> new tn.steg.backend.common.domain.exception.BusinessRuleException("FILE_TOO_LARGE",
                    "Document exceeds the AI analysis size limit" + (detail != null ? ": " + detail : ".")
                            + " Please upload a smaller PDF.");
            case 422 -> new tn.steg.backend.common.domain.exception.BusinessRuleException("INVALID_DOCUMENT",
                    detail != null && !detail.isBlank() ? detail
                            : "Document could not be analysed (not a valid PDF). Please replace the file.");
            default -> new tn.steg.backend.common.domain.exception.BusinessRuleException("INVALID_DOCUMENT",
                    "Document rejected by the analysis service (status " + status + "). Please replace the file.");
        };
    }

    private void ok() {
        consecutiveFailures.set(0);
        lastFailureMillis = 0;
    }

    private void fail(String op, Exception ex) {
        // Defensive: 4xx that slipped through post() must never open the outage circuit.
        if (ex instanceof HttpStatusCodeException h && isDeterministicClientError(h.getStatusCode().value())) {
            log.debug("Python AI deterministic client error on {}: status={} (circuit untouched)",
                    op, h.getStatusCode().value());
            return;
        }
        int n = consecutiveFailures.incrementAndGet();
        lastFailureMillis = System.currentTimeMillis();
        String status = (ex instanceof HttpStatusCodeException h) ? String.valueOf(h.getStatusCode().value()) : "n/a";
        log.warn("Python AI call degraded: op={} errorClass={} httpStatus={} failures={}", op,
                ex.getClass().getSimpleName(), status, n);
    }

    private record ValidationPayload(String pdfBase64, String expectedType, String fullName, String version) {}

    private record ReportPayload(String pdfBase64, String applicationReference, String version) {}

    private record FinancePayload(String certificatePdfBase64, String reportPdfBase64, String internFullName,
            String period, String internshipType, String version) {}

    private record ReportVerificationPayload(String pdfBase64, String candidateName, String supervisorName,
            String internshipType, String startDate, String endDate, String universityName) {}

    private record JournalVerificationPayload(String pdfBase64, String startDate, String endDate,
            int completedApprovedTasks, int totalTasks) {}

    /** Mirrors the Python {@code JournalRenderRequest} field names exactly. */
    private record JournalRenderPayload(String documentTitle, String internFullName,
            String internshipReference, String internshipType, String supervisorName,
            String startDate, String endDate, List<DocIntelClient.JournalEntryData> entries,
            String version) {}
}
