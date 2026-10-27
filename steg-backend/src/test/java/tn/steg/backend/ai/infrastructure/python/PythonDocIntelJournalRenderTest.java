package tn.steg.backend.ai.infrastructure.python;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * S8 journal-PDF contract against a JDK-local stub (no Spring, no network, no
 * credentials).
 *
 * <p>Pins the parts the journal workflow depends on: the request carries the
 * shared {@code X-Service-Token} and the student's entries under the exact
 * field names the Python model binds, the PDF response is parsed strictly (an
 * undecodable payload is a failure, never a half-trusted document), and an
 * unreachable service degrades to empty so the caller can surface an honest
 * error instead of pretending the document exists.
 */
@DisplayName("PythonDocIntelClient — S8 journal PDF contract")
class PythonDocIntelJournalRenderTest {

    private static final String PDF_BASE64 = Base64.getEncoder()
            .encodeToString("%PDF-1.4 journal".getBytes(StandardCharsets.UTF_8));

    private HttpServer stubServer;
    private final List<String> receivedTokens = new CopyOnWriteArrayList<>();
    private final List<String> receivedBodies = new CopyOnWriteArrayList<>();
    private volatile byte[] nextResponseBody = "{}".getBytes(StandardCharsets.UTF_8);
    private volatile int nextStatus = 200;

    @BeforeEach
    void setUp() throws IOException {
        stubServer = HttpServer.create(new InetSocketAddress(0), 0);
        stubServer.createContext("/", exchange -> {
            List<String> tokens = exchange.getRequestHeaders().get("X-Service-Token");
            receivedTokens.add(tokens == null || tokens.isEmpty() ? "" : tokens.get(0));
            receivedBodies.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = nextResponseBody;
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(nextStatus, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        stubServer.setExecutor(Executors.newSingleThreadExecutor());
        stubServer.start();
    }

    @AfterEach
    void tearDown() {
        stubServer.stop(0);
    }

    private PythonDocIntelClient client(String token) {
        PythonProperties props = new PythonProperties();
        props.setBaseUrl("http://localhost:" + stubServer.getAddress().getPort());
        props.setServiceToken(token);
        props.setTimeoutMs(5000);
        props.setMaxAttempts(1);
        return new PythonDocIntelClient(props, new ObjectMapper());
    }

    private static DocIntelClient.JournalRenderRequest request() {
        return new DocIntelClient.JournalRenderRequest(
                "Journal de stage — INT-2026-00001",
                "Amine Trabelsi",
                "INT-2026-00001",
                "PFE",
                "supervisor@steg.com",
                "2026-01-05",
                "2026-04-30",
                List.of(new DocIntelClient.JournalEntryData(
                        "e1", "2026-01-05", "Accueil", "Visite du site", "SUBMITTED", "2026-01-05T08:00:00Z")));
    }

    private static String okJson() {
        return """
                {"version":"1","pdfBase64":"%s","entryCount":12,"dayCount":5,
                 "firstDate":"2026-01-05","lastDate":"2026-04-30","pageCount":3}"""
                .formatted(PDF_BASE64);
    }

    @Test
    @DisplayName("render: shared token sent, entries carried, PDF and counts returned")
    void renderParsed() {
        nextResponseBody = okJson().getBytes(StandardCharsets.UTF_8);
        Optional<DocIntelClient.JournalRenderResult> result =
                client("test-token").renderJournalPdf(request());

        assertThat(result).isPresent();
        assertThat(new String(result.get().pdf(), StandardCharsets.UTF_8)).startsWith("%PDF-");
        assertThat(result.get().entryCount()).isEqualTo(12);
        assertThat(result.get().dayCount()).isEqualTo(5);
        assertThat(result.get().firstDate()).isEqualTo("2026-01-05");
        assertThat(result.get().lastDate()).isEqualTo("2026-04-30");
        assertThat(result.get().pageCount()).isEqualTo(3);

        assertThat(receivedTokens).containsExactly("test-token");
        String body = receivedBodies.get(0);
        assertThat(body).contains("\"entryDate\":\"2026-01-05\"");
        assertThat(body).contains("\"title\":\"Accueil\"");
        assertThat(body).contains("\"description\":\"Visite du site\"");
        assertThat(body).contains("\"internFullName\":\"Amine Trabelsi\"");
        assertThat(body).contains("\"startDate\":\"2026-01-05\"");
    }

    @Test
    @DisplayName("render: a response without a PDF degrades to empty, never trusted")
    void missingPdfDegrades() {
        nextResponseBody = "{\"entryCount\":3}".getBytes(StandardCharsets.UTF_8);
        assertThat(client("test-token").renderJournalPdf(request())).isEmpty();
    }

    @Test
    @DisplayName("render: an undecodable PDF payload degrades to empty")
    void undecodablePdfDegrades() {
        nextResponseBody = "{\"pdfBase64\":\"not-base-64!!\"}".getBytes(StandardCharsets.UTF_8);
        assertThat(client("test-token").renderJournalPdf(request())).isEmpty();
    }

    @Test
    @DisplayName("render: a truncated payload is not treated as a document")
    void truncatedPdfDegrades() {
        nextResponseBody = ("{\"pdfBase64\":\""
                + Base64.getEncoder().encodeToString("ab".getBytes(StandardCharsets.UTF_8))
                + "\"}").getBytes(StandardCharsets.UTF_8);
        assertThat(client("test-token").renderJournalPdf(request())).isEmpty();
    }

    @Test
    @DisplayName("render: an unconfigured service makes no call at all")
    void unconfiguredMakesNoCall() {
        PythonProperties props = new PythonProperties();
        props.setServiceToken("");
        PythonDocIntelClient client = new PythonDocIntelClient(props, new ObjectMapper());

        assertThat(client.renderJournalPdf(request())).isEmpty();
        assertThat(receivedBodies).isEmpty();
    }

    @Test
    @DisplayName("render: a bad service token is a mismatch with a real cause, not a PDF")
    void badTokenSurfacesAuthError() {
        stubServer.createContext("/api/journal/render", exchange -> {
            byte[] body = "{\"error\":\"unauthorized caller\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(401, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        assertThatThrownBy(() -> client("wrong-token").renderJournalPdf(request()))
                .isInstanceOf(tn.steg.backend.common.domain.exception.BusinessRuleException.class)
                .hasMessageContaining("PYTHON_AI_SERVICE_TOKEN");
    }
}
