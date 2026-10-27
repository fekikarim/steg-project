package tn.steg.backend.ai.domain.client;

import java.util.List;
import java.util.Optional;

/**
 * Document-intelligence port (domain, E2/E5). Implemented by the Python FastAPI
 * adapter in infrastructure. All results are advisory; humans decide.
 */
public interface DocIntelClient {

    record DocumentValidation(boolean valid, boolean documentTypeValid, boolean candidateNameValid,
            double confidence, String reason) {}

    record ReportAnalysis(double relevanceScore, String detectedStegContent,
            String detectedActivities, String missingElements, String summary, String explanation,
            double confidence) {}

    record FinanceVerification(String verdict, String reasons, double confidence) {}

    /**
     * S7 structured verification (§7.3): one check per contract row, each
     * PASSED / FAILED / INCONCLUSIVE with expected / found / evidence.
     * {@code overall} is informational (PASS / FAIL / INCONCLUSIVE).
     */
    record VerificationCheck(String key, String label, String status,
            String expected, String found, String evidence) {}

    record VerificationResult(String overall, java.util.List<VerificationCheck> checks) {}

    record ReportExpected(String candidateName, String supervisorName, String internshipType,
            String startDate, String endDate, String universityName) {}

    record JournalExpected(String startDate, String endDate,
            int completedApprovedTasks, int totalTasks) {}

    /**
     * One persisted journal entry, exactly as the backend read it. The PDF
     * service never queries the database: the rows are handed over here,
     * already filtered to the authenticated student.
     */
    record JournalEntryData(String id, String entryDate, String title,
            String description, String status, String createdAt) {}

    /**
     * Everything the journal PDF needs: header facts plus the student's
     * entries. Rendering is deterministic — the service lays out the rows it
     * is given and never calls a model, so a recorded task can neither be
     * invented, reworded nor dropped.
     */
    record JournalRenderRequest(String documentTitle, String internFullName,
            String internshipReference, String internshipType, String supervisorName,
            String startDate, String endDate, List<JournalEntryData> entries) {}

    /**
     * Result of the {@code /ready} probe. The backend and the Python service
     * each hold the shared service token independently (two .env files, two
     * containers), so the two sides CAN drift apart. When they do, every
     * {@code /api/*} call answers 401 and the feature looks "unavailable" with
     * no actionable cause.
     *
     * @param ready            whether the service can actually serve
     * @param tokenFingerprint non-secret fingerprint of the token the service
     *                         holds, so the two sides can be compared without
     *                         the secret leaving the service
     */
    record ReadinessProbe(boolean ready, String tokenFingerprint) {}

    /** Rendered PDF plus the counts the mobile app reports back to the student. */
    record JournalRenderResult(byte[] pdf, int entryCount, int dayCount,
            String firstDate, String lastDate, int pageCount) {}

    Optional<DocumentValidation> validateDocument(byte[] pdf, String expectedType, String fullName);

    Optional<ReportAnalysis> analyzeReport(byte[] pdf, String applicationReference);

    Optional<FinanceVerification> verifyFinance(byte[] certificatePdf, byte[] reportPdf,
            String internFullName, String period, String internshipType);

    /**
     * S7 report verification (§7.1): the PDF plus the expected values read from
     * the database (python-ai never queries the DB). Empty when the service is
     * unconfigured, unreachable, or returns a non-conforming payload — callers
     * degrade to "AI unavailable", never block.
     */
    Optional<VerificationResult> verifyReport(byte[] pdf, ReportExpected expected);

    /**
     * S7 journal verification (§7.2): the PDF plus the period and the shared
     * task-completion ratio inputs (done = completed AND approved, denominator
     * excludes cancelled/deleted — one shared function).
     */
    Optional<VerificationResult> verifyJournal(byte[] pdf, JournalExpected expected);

    /**
     * S8 journal PDF: renders the student's own entries into the official
     * document through the Python service. The database is never reachable
     * from Python — the caller passes the rows it already authorised.
     *
     * <p>Empty when the service is unconfigured, unreachable, or returns a
     * non-conforming payload; unlike the advisory verification calls, the
     * caller must NOT proceed without a PDF — it surfaces the failure instead.
     */
    Optional<JournalRenderResult> renderJournalPdf(JournalRenderRequest request);

    /**
     * Liveness + capability probe of the Python service ({@code /ready}).
     *
     * <p>Answers "can it actually serve us right now?", not "is the process
     * up?". Empty means unreachable/not ready. Implementations MUST NOT count
     * this call against the outage circuit: probing must not be what opens it.
     *
     * <p>The returned {@link ReadinessProbe} also carries the service's token
     * fingerprint so a mismatched shared secret is diagnosed explicitly instead
     * of being reported as an unexplained outage.
     */
    default java.util.Optional<ReadinessProbe> probeReadiness() {
        return java.util.Optional.empty();
    }

    /** Whether the underlying provider is configured (non-empty baseUrl + token). */
    default boolean isConfigured() { return true; }

    /** Whether the circuit is open and calls should be short-circuited. */
    default boolean circuitOpen() { return false; }

    /**
     * True when the service is reachable but holds a DIFFERENT shared token.
     *
     * <p>Both processes can be healthy and still disagree on the secret, in
     * which case every call is refused with 401. Callers use this to name that
     * cause instead of reporting an unexplained outage. Implementations that
     * cannot determine it (no probe support) answer {@code false} so the
     * failure stays classified as a plain unavailability.
     */
    default boolean tokenMismatch() { return false; }
}
