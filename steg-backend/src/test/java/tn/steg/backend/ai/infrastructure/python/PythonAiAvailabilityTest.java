package tn.steg.backend.ai.infrastructure.python;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.health.contributor.Health;
import tn.steg.backend.common.domain.exception.BusinessRuleException;
import tn.steg.backend.ai.domain.client.DocIntelClient;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The startup-availability contract for the Python AI service.
 *
 * <p>"Generate Journal with AI" was unusable because the service looked
 * healthy while it could not do the job, and because a stale image answered 404
 * on the journal route while reporting UP. These tests pin the honest
 * behaviour: a real readiness probe, and a deployment fault reported as a
 * deployment fault instead of "invalid document".
 */
@DisplayName("Python AI service availability")
class PythonAiAvailabilityTest {

    private static final String PDF_B64 =
            Base64.getEncoder().encodeToString("%PDF-1.4 probe".getBytes(StandardCharsets.UTF_8));

    private HttpServer server;
    private final List<String> probedPaths = new CopyOnWriteArrayList<>();
    private final List<String> tokens = new CopyOnWriteArrayList<>();
    private final AtomicInteger journalCalls = new AtomicInteger();
    private volatile int journalStatus = 200;
    private volatile String journalBody =
            "{\"pdfBase64\":\"" + PDF_B64 + "\",\"entryCount\":2,\"dayCount\":1,"
                    + "\"firstDate\":\"2026-01-05\",\"lastDate\":\"2026-01-05\",\"pageCount\":1}";
    private volatile boolean readyOk = true;
    /** What the service claims its token is. Matches props().serviceToken by default. */
    private volatile String readyFingerprint = "";

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            probedPaths.add(path);
            List<String> auth = exchange.getRequestHeaders().get("X-Service-Token");
            tokens.add(auth == null || auth.isEmpty() ? "" : auth.get(0));
            byte[] body;
            int status;
            if (path.equals("/ready")) {
                status = readyOk ? 200 : 503;
                body = (readyOk
                        ? ("{\"status\":\"UP\",\"configured\":true,\"tokenFingerprint\":\""
                                + readyFingerprint + "\"}")
                        : "{\"status\":\"DOWN\",\"configured\":false}").getBytes(StandardCharsets.UTF_8);
            } else if (path.equals(PythonDocIntelClient.JOURNAL_RENDER_PATH)) {
                journalCalls.incrementAndGet();
                status = journalStatus;
                body = journalBody.getBytes(StandardCharsets.UTF_8);
            } else {
                status = 404;
                body = "{\"detail\":\"Not Found\"}".getBytes(StandardCharsets.UTF_8);
            }
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.setExecutor(Executors.newSingleThreadExecutor());
        server.start();
    }

    @BeforeEach
    void alignFingerprint() {        // The healthy case: the service holds the same secret as the client.
        readyFingerprint = fingerprint("shared-token");
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    private PythonProperties props() {
        PythonProperties p = new PythonProperties();
        p.setBaseUrl("http://localhost:" + server.getAddress().getPort());
        p.setServiceToken("shared-token");
        p.setTimeoutMs(4000);
        p.setMaxAttempts(1);
        return p;
    }

    /** Same scheme the service uses: 8 hex chars of a SHA-256. */
    private String fingerprint(String secret) {
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(secret.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                sb.append(String.format("%02x", digest[i]));
            }
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private PythonDocIntelClient client() {
        return new PythonDocIntelClient(props(), new ObjectMapper());
    }

    private Health health(PythonDocIntelClient client) {
        return new PythonAiServiceHealthIndicator(props(), client).health();
    }

    // ------------------------------------------------------------ readiness

    @Test
    @DisplayName("health is UP only when the service reports real readiness")
    void healthProbesReadiness() {
        Health h = health(client());
        assertThat(h.getStatus().getCode()).isEqualTo("UP");
        // A real probe, not a config check.
        assertThat(probedPaths).contains("/ready");
        assertThat(tokens).contains("shared-token");
    }

    @Test
    @DisplayName("health is DEGRADED when the service cannot render a PDF")
    void healthIsDownWhenNotReady() {
        readyOk = false;
        Health h = health(client());
        assertThat(h.getStatus().getCode()).isEqualTo("DEGRADED");
        assertThat(h.getDetails().toString()).contains("journal PDF");
    }

    @Test
    @DisplayName("health is DEGRADED when the service is unreachable")
    void healthIsDownWhenUnreachable() {
        PythonProperties p = props();
        p.setBaseUrl("http://localhost:1"); // nothing listens here
        Health h = new PythonAiServiceHealthIndicator(p, new PythonDocIntelClient(p, new ObjectMapper()))
                .health();
        assertThat(h.getStatus().getCode()).isEqualTo("DEGRADED");
    }

    @Test
    @DisplayName("health is DEGRADED and explains itself when nothing is configured")
    void healthIsDownWhenUnconfigured() {
        PythonProperties p = new PythonProperties(); // no base URL, no token
        DocIntelClient client = new PythonDocIntelClient(p, new ObjectMapper());
        Health h = new PythonAiServiceHealthIndicator(p, client).health();
        assertThat(h.getStatus().getCode()).isEqualTo("DEGRADED");
        assertThat(h.getDetails().toString()).contains("disabled");
    }

    @Test
    @DisplayName("the readiness probe never counts as an outage")
    void probeDoesNotTripTheCircuit() {
        PythonDocIntelClient c = client();
        readyOk = false;
        for (int i = 0; i < 10; i++) {
            c.probeReadiness();
        }
        // Failing probes must not fake an outage the circuit then reports.
        assertThat(c.circuitOpen()).isFalse();
    }

    @Test
    @DisplayName("readiness reports not-ready when the backend has no token")
    void probeFalseWhenUnconfigured() {
        PythonProperties p = new PythonProperties();
        Optional<DocIntelClient.ReadinessProbe> probe =
                new PythonDocIntelClient(p, new ObjectMapper()).probeReadiness();
        assertThat(probe).isPresent();
        assertThat(probe.get().ready()).isFalse();
        // An unconfigured backend cannot be "mismatched" — that needs a
        // reachable service holding a different secret.
        assertThat(new PythonDocIntelClient(p, new ObjectMapper()).tokenMismatch()).isFalse();
    }

    // ------------------------------------------------- shared-token drift

    @Test
    @DisplayName("a service holding a DIFFERENT token is detected as a mismatch")
    void tokenMismatchIsDetected() {
        // The stack is healthy on both sides; only the secret differs. This is
        // the state that used to be reported as "the AI is unavailable".
        readyFingerprint = fingerprint("some-other-token");
        assertThat(client().tokenMismatch()).isTrue();
    }

    @Test
    @DisplayName("no mismatch when both sides hold the same token")
    void tokenMismatchIsFalseWhenInSync() {
        readyFingerprint = fingerprint("shared-token");
        assertThat(client().tokenMismatch()).isFalse();
    }

    @Test
    @DisplayName("a service that publishes no fingerprint is not a mismatch")
    void tokenMismatchIsFalseWithoutFingerprint() {
        // An older service that does not report a fingerprint must not be
        // misdiagnosed as a mismatch — it is simply unverifiable.
        readyFingerprint = "";
        assertThat(client().tokenMismatch()).isFalse();
    }

    @Test
    @DisplayName("a token mismatch is reported as its own health problem, not 'not ready'")
    void tokenMismatchIsNamedInHealth() {
        readyFingerprint = fingerprint("some-other-token");
        Health h = health(client());
        assertThat(h.getStatus().getCode()).isEqualTo("DEGRADED");
        assertThat(h.getDetails().toString())
                .contains("token-mismatch")
                .contains("PYTHON_AI_SERVICE_TOKEN");
    }

    // ------------------------------------------------------- stale deployment

    @Test
    @DisplayName("a stale image (404 on the journal route) is a DEPLOYMENT fault, not a bad document")
    void staleImageIsReportedAsDeploymentFault() {
        journalStatus = 404;
        journalBody = "{\"detail\":\"Not Found\"}";

        // Before the fix this surfaced as INVALID_DOCUMENT, which sent an
        // operator hunting through the student's journal instead of at the
        // stale ai-services image.
        assertThatThrownBy(() -> client().renderJournalPdf(request()))
                .isInstanceOf(BusinessRuleException.class)
                .satisfies(ex -> assertThat(((BusinessRuleException) ex).getErrorCode())
                        .isEqualTo("AI_SERVICE_OUTDATED"));
        // A deterministic 404 is not retried and does not open the circuit.
        assertThat(journalCalls.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("a healthy render returns the PDF and its counts")
    void healthyRender() {
        Optional<DocIntelClient.JournalRenderResult> result =
                client().renderJournalPdf(request());
        assertThat(result).isPresent();
        assertThat(result.get().entryCount()).isEqualTo(2);
        assertThat(result.get().dayCount()).isEqualTo(1);
        assertThat(result.get().firstDate()).isEqualTo("2026-01-05");
        assertThat(new String(result.get().pdf(), StandardCharsets.UTF_8))
                .startsWith("%PDF-");
    }

    @Test
    @DisplayName("a 404 on ANOTHER route stays a document problem")
    void otherRoute404IsNotMisreported() {
        journalStatus = 200;
        // /api/validation/... answering 404 must keep the document wording;
        // only the journal endpoint means "stale image".
        assertThatThrownBy(() -> client().verifyReport(
                "%PDF-1.4".getBytes(StandardCharsets.UTF_8),
                new DocIntelClient.ReportExpected("a", "b", "c", "d", "e", "f")))
                .satisfies(ex -> assertThat(ex).hasMessageContaining("rejected"));
    }

    @Test
    @DisplayName("an unconfigured service degrades instead of throwing")
    void unconfiguredDegrades() {
        PythonProperties p = new PythonProperties();
        DocIntelClient c = new PythonDocIntelClient(p, new ObjectMapper());
        assertThat(c.isConfigured()).isFalse();
        assertThat(c.renderJournalPdf(request())).isEmpty();
    }

    private DocIntelClient.JournalRenderRequest request() {
        return new DocIntelClient.JournalRenderRequest(
                "Journal", "Amine", "INT-1", "PFE", "sup", "2026-01-05", "2026-04-30",
                List.of(new DocIntelClient.JournalEntryData(
                        "e1", "2026-01-05", "Accueil", "Visite", "SUBMITTED", "")));
    }
}
