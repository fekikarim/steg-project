package tn.steg.backend.companion.interfaces.rest;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MvcResult;
import tn.steg.backend.TestcontainersConfiguration;
import tn.steg.backend.ai.domain.client.DocIntelClient;
import tn.steg.backend.testsupport.FakeAiCompletionClientConfiguration;
import tn.steg.backend.testsupport.FakeDocIntelClientConfiguration;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * S8 — journal generation from the student's own entries (Testcontainers).
 *
 * <p>Replaces the former task-sourced flow: the document is compiled from
 * submitted {@code journal_entries}, never from the task-management list and
 * never from a model, so there is no prompt to scope and no invented content to
 * defend against. What this class still guards is everything that matters about
 * that switch:
 *
 * <ul>
 *   <li>the entries of the right student reach the renderer, in order, once;</li>
 *   <li>a degraded PDF service creates nothing;</li>
 *   <li>an empty journal is refused with an actionable code;</li>
 *   <li>the eligibility window is enforced before any rendering;</li>
 *   <li>IDOR: another student, a supervisor or an anonymous caller gets
 *       nothing, and an Admin gets the intern's journal — not their own;</li>
 *   <li>the audit row stays metadata-only.</li>
 * </ul>
 *
 * <p>The PDF bytes come from a fake port (the Python service is a separate
 * process); its own contract is covered by {@code PythonDocIntelJournalRenderTest}
 * and {@code tests/test_journal_pdf.py}.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import({TestcontainersConfiguration.class, FakeAiCompletionClientConfiguration.class,
        FakeDocIntelClientConfiguration.class})
@DisplayName("S8 — journal generation from the student's entries (Testcontainers)")
class JournalGenerationFromEntriesTest extends JournalTestSupport {

    private static final ZoneId TUNIS = ZoneId.of("Africa/Tunis");

    @org.springframework.beans.factory.annotation.Autowired
    private DocIntelClient docIntel;

    /**
     * The fake port is a context-wide bean, so an override (e.g. the degraded
     * service test) is restored after every test.
     */
    @org.junit.jupiter.api.AfterEach
    void restoreDefaultRendering() {
        FakeDocIntelClientConfiguration.stubRender(docIntel);
        org.mockito.Mockito.clearInvocations(docIntel);
    }

    private Intern eligibleStudent(String tag) {
        LocalDate today = LocalDate.now(TUNIS);
        return createStudent(tag, supervisorUser, today.minusMonths(4), today.plusDays(5));
    }

    private MvcResult generate(String token, UUID internshipId) throws Exception {
        return postJson("/api/internships/" + internshipId + "/journal/generate-from-entries",
                token, null);
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private void seedEntries(Intern intern, int count) {
        LocalDate start = internshipRepository.findById(intern.internshipId()).orElseThrow().getStartDate();
        for (int i = 0; i < count; i++) {
            addEntry(intern.internshipId(), intern.user(), "Entry " + i + " " + run,
                    "Work performed " + i, start.plusDays(i));
        }
    }

    // -----------------------------------------------------------------------

    @Test
    @DisplayName("generates a draft deliverable and reports the entry facts")
    void generatesFromEntries() throws Exception {
        Intern intern = eligibleStudent("G");
        seedEntries(intern, 3);

        MvcResult result = generate(intern.token(), intern.internshipId());
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        JsonNode json = body(result);

        assertThat(json.path("source").asText()).isEqualTo("JOURNAL_ENTRIES");
        assertThat(json.path("entryCount").asInt()).isEqualTo(3);
        assertThat(json.path("dayCount").asInt()).isEqualTo(3);
        assertThat(json.path("replacedDraft").asBoolean()).isFalse();
        assertThat(json.path("previousSubmitted").asBoolean()).isFalse();

        JsonNode deliverable = json.path("deliverable");
        assertThat(deliverable.path("title").asText())
                .isEqualTo("Journal de stage (journal saisi) — " + intern.reference());
        assertThat(deliverable.path("status").asText()).isEqualTo("DRAFT");
        assertThat(deliverable.path("currentVersion").asInt()).isEqualTo(1);
        assertThat(deliverable.path("latestVersion").path("fileName").asText()).endsWith(".pdf");

        assertThat(deliverableRepository.findByInternshipId(intern.internshipId())).hasSize(1);
    }

    @Test
    @DisplayName("the legacy task endpoint resolves to the SAME entries workflow")
    void legacyEndpointIsTheSameWorkflow() throws Exception {
        Intern intern = eligibleStudent("L");
        seedEntries(intern, 2);

        MvcResult legacy = postJson(
                "/api/internships/" + intern.internshipId() + "/journal/generate",
                intern.token(), null);
        assertThat(legacy.getResponse().getStatus()).isEqualTo(201);
        assertThat(body(legacy).path("source").asText()).isEqualTo("JOURNAL_ENTRIES");
        assertThat(body(legacy).path("entryCount").asInt()).isEqualTo(2);
    }

    @Test
    @DisplayName("several entries on the same date are all sent, never merged away")
    void sameDateEntriesAreAllSent() throws Exception {
        Intern intern = eligibleStudent("S");
        LocalDate day = internshipRepository.findById(intern.internshipId()).orElseThrow().getStartDate();
        addEntry(intern.internshipId(), intern.user(), "First " + run, "A", day);
        addEntry(intern.internshipId(), intern.user(), "Second " + run, "B", day);
        addEntry(intern.internshipId(), intern.user(), "Third " + run, "C", day);

        MvcResult result = generate(intern.token(), intern.internshipId());
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(body(result).path("entryCount").asInt()).isEqualTo(3);
        assertThat(body(result).path("dayCount").asInt()).isEqualTo(1);
    }

    @Test
    @DisplayName("an empty journal is refused with an actionable code and creates nothing")
    void emptyJournalIsRefused() throws Exception {
        Intern intern = eligibleStudent("Z");

        MvcResult result = generate(intern.token(), intern.internshipId());
        assertThat(result.getResponse().getStatus()).isEqualTo(422);
        assertThat(result.getResponse().getContentAsString()).contains("JOURNAL_NO_ENTRIES");
        assertThat(deliverableRepository.findByInternshipId(intern.internshipId())).isEmpty();
    }

    @Test
    @DisplayName("a degraded document service creates nothing and reports honestly")
    void renderUnavailableCreatesNothing() throws Exception {
        Intern intern = eligibleStudent("U");
        seedEntries(intern, 1);
        // doReturn, not when(...): the fake already has an answer that
        // dereferences its argument, and when() would call it with null.
        org.mockito.Mockito.doReturn(Optional.empty()).when(docIntel).renderJournalPdf(any());

        MvcResult result = generate(intern.token(), intern.internshipId());
        assertThat(result.getResponse().getStatus()).isEqualTo(422);
        assertThat(result.getResponse().getContentAsString()).contains("JOURNAL_RENDER_UNAVAILABLE");
        assertThat(deliverableRepository.findByInternshipId(intern.internshipId())).isEmpty();
    }

    @Test
    @DisplayName("no window, no document: the eligibility check runs before any rendering")
    void notEligibleIsRefusedBeforeRendering() throws Exception {
        LocalDate today = LocalDate.now(TUNIS);
        Intern intern = createStudent("N", supervisorUser, today.plusMonths(1), today.plusMonths(4));
        seedEntries(intern, 2);
        // The port is a shared context bean: invocations from earlier tests in
        // this class must not make `never()` lie.
        org.mockito.Mockito.clearInvocations(docIntel);

        MvcResult result = generate(intern.token(), intern.internshipId());
        assertThat(result.getResponse().getStatus()).isEqualTo(422);
        assertThat(result.getResponse().getContentAsString()).contains("JOURNAL_NOT_ELIGIBLE");
        verify(docIntel, never()).renderJournalPdf(any());
        assertThat(deliverableRepository.findByInternshipId(intern.internshipId())).isEmpty();
    }

    @Test
    @DisplayName("IDOR: another student, a supervisor and an anonymous caller get nothing")
    void scopeIsEnforced() throws Exception {
        Intern mine = eligibleStudent("A");
        Intern other = eligibleStudent("B");
        seedEntries(mine, 1);

        assertThat(generate(other.token(), mine.internshipId()).getResponse().getStatus()).isEqualTo(403);
        assertThat(generate(supervisorToken, mine.internshipId()).getResponse().getStatus()).isEqualTo(403);
        assertThat(generate(otherSupervisorToken, mine.internshipId()).getResponse().getStatus()).isEqualTo(403);
        assertThat(generate(null, mine.internshipId()).getResponse().getStatus()).isEqualTo(401);
        assertThat(generate(mine.token(), UUID.randomUUID()).getResponse().getStatus()).isEqualTo(403);
        assertThat(deliverableRepository.findByInternshipId(mine.internshipId())).isEmpty();
        assertThat(deliverableRepository.findByInternshipId(other.internshipId())).isEmpty();

        // Admin override reaches the service for a known internship, and a
        // genuinely unknown id is a 404 — no existence leak either way.
        assertThat(generate(adminToken, mine.internshipId()).getResponse().getStatus()).isEqualTo(201);
        assertThat(generate(adminToken, UUID.randomUUID()).getResponse().getStatus()).isEqualTo(404);
    }

    @Test
    @DisplayName("an Admin receives the INTERN's entries, never their own or another student's")
    void adminReceivesTheInternEntries() throws Exception {
        Intern intern = eligibleStudent("AD");
        seedEntries(intern, 2);
        // A row authored by somebody else inside the same internship must not
        // leak into the intern's official document.
        addEntry(intern.internshipId(), supervisorUser, "Supervisor row " + run, "x",
                LocalDate.now(TUNIS));

        assertThat(generate(adminToken, intern.internshipId()).getResponse().getStatus()).isEqualTo(201);
        assertThat(body(postJson(
                "/api/internships/" + intern.internshipId() + "/journal/generate-from-entries",
                adminToken, null)).path("entryCount").asInt()).isEqualTo(2);
    }

    @Test
    @DisplayName("only the request's own entries are sent: no cross-internship leak")
    void rendererRequestIsScoped() throws Exception {
        Intern mine = eligibleStudent("P");
        Intern other = eligibleStudent("Q");
        seedEntries(mine, 2);
        seedEntries(other, 1);
        org.mockito.Mockito.clearInvocations(docIntel);

        assertThat(generate(mine.token(), mine.internshipId()).getResponse().getStatus()).isEqualTo(201);

        ArgumentCaptor<DocIntelClient.JournalRenderRequest> captor =
                ArgumentCaptor.forClass(DocIntelClient.JournalRenderRequest.class);
        verify(docIntel).renderJournalPdf(captor.capture());
        List<DocIntelClient.JournalEntryData> sent = captor.getValue().entries();
        assertThat(sent).hasSize(2);
        assertThat(sent).allSatisfy(e -> assertThat(e.title()).contains(run).doesNotContain("Q"));
    }
}
