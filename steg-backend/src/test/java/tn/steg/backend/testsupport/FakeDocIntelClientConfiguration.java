package tn.steg.backend.testsupport;

import org.mockito.Mockito;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import tn.steg.backend.ai.domain.client.DocIntelClient;

/**
 * Fake document/PDF intelligence port for the journal tests.
 *
 * <p>The journal PDF is rendered by the Python service, which is a separate
 * process and therefore absent from the Testcontainers suite. This fake keeps
 * the integration tests hermetic and deterministic while still exercising the
 * real service logic (authorization, entry filtering, ordering, storage) —
 * only the last mile (HTTP + ReportLab) is substituted, and that mile has its
 * own tests: {@code PythonDocIntelJournalRenderTest} on the client contract and
 * {@code tests/test_journal_pdf.py} on the renderer itself.
 *
 * <p>Returns a minimal but structurally valid PDF carrying a text layer, so the
 * back-office text extractor still works on the stored deliverable.
 */
@TestConfiguration
public class FakeDocIntelClientConfiguration {

    /** A one-page PDF with a text layer, built once and shared. */
    private static final byte[] PDF = minimalPdf("Journal de stage");

    @Bean
    @Primary
    public DocIntelClient docIntelClient() {
        return stubRender(Mockito.mock(DocIntelClient.class));
    }

    /**
     * Installs the default rendering behaviour and returns the mock.
     *
     * <p>Public and reusable because the bean lives in a shared Spring context:
     * a test that overrides it (to simulate a degraded service) must restore it
     * afterwards or every later test inherits the override.
     */
    public static DocIntelClient stubRender(DocIntelClient mock) {
        Mockito.lenient()
                .when(mock.renderJournalPdf(Mockito.any()))
                .thenAnswer(invocation -> {
                    DocIntelClient.JournalRenderRequest request =
                            invocation.getArgument(0);
                    if (request == null || request.entries() == null) {
                        return java.util.Optional.of(new DocIntelClient.JournalRenderResult(
                                PDF, 0, 0, null, null, 1));
                    }
                    int entries = request.entries().size();
                    long days = request.entries().stream()
                            .map(DocIntelClient.JournalEntryData::entryDate)
                            .distinct()
                            .count();
                    String first = entries == 0 ? null : request.entries().get(0).entryDate();
                    String last = entries == 0 ? null
                            : request.entries().get(entries - 1).entryDate();
                    return java.util.Optional.of(new DocIntelClient.JournalRenderResult(
                            PDF, entries, (int) days, first, last, 1));
                });
        return mock;
    }

    /** Raw PDF bytes with a readable text object — no external fixture needed. */
    private static byte[] minimalPdf(String text) {
        String content = "BT /F1 12 Tf 72 720 Td (" + text + ") Tj ET";
        StringBuilder pdf = new StringBuilder("%PDF-1.4\n");
        pdf.append("1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n");
        pdf.append("2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n");
        pdf.append("3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]")
                .append("/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n");
        pdf.append("4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n");
        pdf.append("5 0 obj<</Length ").append(content.length())
                .append(">>stream\n").append(content).append("\nendstream endobj\n");
        pdf.append("trailer<</Root 1 0 R>>");
        return pdf.toString().getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
    }
}
