package tn.steg.backend.companion.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.steg.backend.ai.domain.client.AiCompletionClient;
import tn.steg.backend.ai.domain.client.DocIntelClient;
import tn.steg.backend.audit.application.AuditService;
import tn.steg.backend.candidate.domain.model.Candidate;
import tn.steg.backend.common.application.ApplicationTimeZone;
import tn.steg.backend.common.domain.exception.BusinessRuleException;
import tn.steg.backend.common.domain.exception.ResourceNotFoundException;
import tn.steg.backend.common.domain.model.UserPrincipal;
import tn.steg.backend.companion.application.dto.JournalEntriesGenerationResponse;
import tn.steg.backend.companion.domain.model.Deliverable;
import tn.steg.backend.companion.domain.model.DeliverableStatus;
import tn.steg.backend.companion.domain.model.InternshipJournal;
import tn.steg.backend.companion.domain.model.JournalEntry;
import tn.steg.backend.companion.domain.model.JournalEntryStatus;
import tn.steg.backend.companion.domain.repository.DeliverableRepository;
import tn.steg.backend.companion.domain.repository.InternshipJournalRepository;
import tn.steg.backend.companion.domain.repository.JournalEntryRepository;
import tn.steg.backend.companion.domain.repository.TaskRepository;
import tn.steg.backend.companion.application.dto.DeliverableResponse;
import tn.steg.backend.document.domain.service.OfficialBrandingProvider;
import tn.steg.backend.document.domain.service.PdfDocumentRenderer;
import tn.steg.backend.iam.domain.model.User;
import tn.steg.backend.internship.application.SupervisionScopeService;
import tn.steg.backend.internship.domain.model.Internship;
import tn.steg.backend.internship.domain.model.InternshipStatus;
import tn.steg.backend.internship.domain.repository.InternshipRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * S8 entries-compiled journal: student isolation, chronological completeness
 * and honest degradation.
 *
 * <p>The contract under test is deliberately narrow. Which rows the student is
 * allowed to see is decided HERE, before anything is rendered: an Admin
 * generating on a student's behalf must still get that student's journal, a
 * draft or rejected entry must not reach an official document, and the rows
 * must leave the service in a deterministic order so two runs produce the same
 * PDF.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JournalDocumentService — S8 generateFromEntries")
class JournalEntriesJournalServiceTest {

    private static final byte[] PDF = "%PDF-1.4 journal".getBytes(java.nio.charset.StandardCharsets.UTF_8);

    @Mock private AiCompletionClient aiCompletionClient;
    @Mock private DocIntelClient docIntelClient;
    @Mock private PdfDocumentRenderer pdfRenderer;
    @Mock private OfficialBrandingProvider brandingProvider;
    @Mock private InternshipRepository internshipRepository;
    @Mock private InternshipJournalRepository internshipJournalRepository;
    @Mock private JournalEntryRepository journalEntryRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private DeliverableRepository deliverableRepository;
    @Mock private CompanionService companionService;
    @Mock private SupervisionScopeService supervisionScopeService;
    @Mock private AuditService auditService;

    private JournalDocumentService service;
    private User intern;
    private User otherStudent;
    private Internship internship;
    private UUID internshipId;

    @BeforeEach
    void setUp() {
        ApplicationTimeZone tz = new ApplicationTimeZone("Africa/Tunis");
        service = new JournalDocumentService(aiCompletionClient, pdfRenderer, brandingProvider,
                internshipRepository, docIntelClient, internshipJournalRepository,
                journalEntryRepository, taskRepository, deliverableRepository, companionService,
                supervisionScopeService, tz, auditService, new com.fasterxml.jackson.databind.ObjectMapper());

        intern = user("Amine Trabelsi");
        otherStudent = user("Someone Else");
        internshipId = UUID.randomUUID();

        Candidate candidate = new Candidate();
        candidate.setUser(intern);
        candidate.setFirstName("Amine");
        candidate.setLastName("Trabelsi");

        internship = new Internship();
        internship.setId(internshipId);
        internship.setCandidate(candidate);
        internship.setReference("INT-2026-00001");
        internship.setStartDate(LocalDate.of(2026, 1, 5));
        internship.setEndDate(LocalDate.of(2026, 4, 30));
        internship.setStatus(InternshipStatus.IN_PROGRESS);

        lenient().when(internshipRepository.findById(internshipId)).thenReturn(Optional.of(internship));

        InternshipJournal journal = new InternshipJournal(internship);
        lenient().when(internshipJournalRepository.findByInternshipId(internshipId))
                .thenReturn(Optional.of(journal));
        lenient().when(journalEntryRepository.findByJournalId(journal.getId())).thenReturn(List.of());
        lenient().when(deliverableRepository.findByInternshipId(internshipId)).thenReturn(List.of());
        lenient().when(companionService.registerGeneratedDeliverable(
                eq(internshipId), anyString(), anyString(), any(), anyString(), any()))
                .thenAnswer(inv -> new DeliverableResponse(UUID.randomUUID(), internshipId, null, null,
                        inv.getArgument(1), inv.getArgument(2), DeliverableStatus.DRAFT, null, 1,
                        null, null, null, null, null));
    }

    private static User user(String name) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setEmail(name.toLowerCase().replace(' ', '.') + "@steg.com");
        return u;
    }

    private JournalEntry entry(User author, LocalDate date, String title,
                               JournalEntryStatus status, Instant created) {
        InternshipJournal journal = new InternshipJournal(internship);
        journal.setId(UUID.randomUUID());
        JournalEntry e = new JournalEntry(journal, author, title, "description of " + title, date);
        e.setId(UUID.randomUUID());
        e.setStatus(status);
        e.setCreatedAt(created);
        e.setUpdatedAt(created);
        return e;
    }

    private void givenEntries(List<JournalEntry> entries) {
        when(journalEntryRepository.findByJournalId(any())).thenReturn(entries);
        // A test may refuse before reaching the renderer, so this stub is
        // available without being demanded.
        lenient().when(docIntelClient.renderJournalPdf(any())).thenAnswer(inv -> Optional.of(
                new DocIntelClient.JournalRenderResult(PDF, entries.size(), 3,
                        "2026-01-05", "2026-01-09", 2)));
    }

    private UserPrincipal principalFor(User user, String role) {
        return new UserPrincipal(user.getId(), user.getEmail(), List.of(role));
    }

    private DocIntelClient.JournalRenderRequest capturedRequest() {
        ArgumentCaptor<DocIntelClient.JournalRenderRequest> captor =
                ArgumentCaptor.forClass(DocIntelClient.JournalRenderRequest.class);
        verify(docIntelClient).renderJournalPdf(captor.capture());
        return captor.getValue();
    }

    // -----------------------------------------------------------------------

    @Test
    @DisplayName("only the internship's intern entries are rendered, never another student's")
    void rendersOnlyTheInternEntries() {
        givenEntries(List.of(
                entry(intern, LocalDate.of(2026, 1, 5), "Accueil", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-05T08:00:00Z")),
                entry(otherStudent, LocalDate.of(2026, 1, 6), "Someone else work", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-06T08:00:00Z"))));

        service.generateFromEntries(principalFor(intern, "INTERN"), internshipId);

        List<DocIntelClient.JournalEntryData> rendered = capturedRequest().entries();
        assertThat(rendered).hasSize(1);
        assertThat(rendered.get(0).title()).isEqualTo("Accueil");
    }

    @Test
    @DisplayName("an Admin generating on a student's behalf still gets only that student's entries")
    void adminGetsTheInternEntriesNotTheirOwn() {
        User admin = user("Admin");
        givenEntries(List.of(
                entry(intern, LocalDate.of(2026, 1, 5), "Accueil", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-05T08:00:00Z")),
                entry(admin, LocalDate.of(2026, 1, 7), "Admin own entry", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-07T08:00:00Z"))));

        service.generateFromEntries(principalFor(admin, "ADMIN"), internshipId);

        assertThat(capturedRequest().entries()).extracting(DocIntelClient.JournalEntryData::title)
                .containsExactly("Accueil");
    }

    @Test
    @DisplayName("drafts and rejected entries stay out of the official document")
    void excludesDraftAndRejected() {
        givenEntries(List.of(
                entry(intern, LocalDate.of(2026, 1, 5), "Submitted", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-05T08:00:00Z")),
                entry(intern, LocalDate.of(2026, 1, 6), "Validated", JournalEntryStatus.VALIDATED, Instant.parse("2026-01-06T08:00:00Z")),
                entry(intern, LocalDate.of(2026, 1, 7), "Draft", JournalEntryStatus.DRAFT, Instant.parse("2026-01-07T08:00:00Z")),
                entry(intern, LocalDate.of(2026, 1, 8), "Rejected", JournalEntryStatus.REJECTED, Instant.parse("2026-01-08T08:00:00Z"))));

        service.generateFromEntries(principalFor(intern, "INTERN"), internshipId);

        assertThat(capturedRequest().entries()).extracting(DocIntelClient.JournalEntryData::title)
                .containsExactly("Submitted", "Validated");
    }

    @Test
    @DisplayName("entries leave the service in chronological order whatever the repository order")
    void ordersEntriesChronologically() {
        givenEntries(List.of(
                entry(intern, LocalDate.of(2026, 1, 9), "Earlier on the 9th", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-09T08:00:00Z")),
                entry(intern, LocalDate.of(2026, 1, 5), "First", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-05T08:00:00Z")),
                entry(intern, LocalDate.of(2026, 1, 9), "Later on the 9th", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-09T09:00:00Z")),
                entry(intern, LocalDate.of(2026, 1, 7), "Second", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-07T08:00:00Z"))));

        service.generateFromEntries(principalFor(intern, "INTERN"), internshipId);

        assertThat(capturedRequest().entries()).extracting(DocIntelClient.JournalEntryData::title)
                .containsExactly("First", "Second", "Earlier on the 9th", "Later on the 9th");
    }

    @Test
    @DisplayName("every recorded entry reaches the renderer: none omitted, none duplicated")
    void rendersEveryEntryExactlyOnce() {
        List<JournalEntry> all = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            all.add(entry(intern, LocalDate.of(2026, 1, 5).plusDays(i), "Task " + i,
                    JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-05T08:00:00Z").plusSeconds(i)));
        }
        givenEntries(all);

        service.generateFromEntries(principalFor(intern, "INTERN"), internshipId);

        List<DocIntelClient.JournalEntryData> rendered = capturedRequest().entries();
        assertThat(rendered).hasSize(12);
        assertThat(rendered.stream().map(DocIntelClient.JournalEntryData::id).distinct().count()).isEqualTo(12);
    }

    @Test
    @DisplayName("the request carries the header facts the document shows")
    void carriesHeaderFacts() {
        givenEntries(List.of(
                entry(intern, LocalDate.of(2026, 1, 5), "Accueil", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-05T08:00:00Z"))));

        service.generateFromEntries(principalFor(intern, "INTERN"), internshipId);

        DocIntelClient.JournalRenderRequest request = capturedRequest();
        assertThat(request.internFullName()).contains("Amine");
        assertThat(request.internshipReference()).isEqualTo("INT-2026-00001");
        assertThat(request.startDate()).isEqualTo("2026-01-05");
        assertThat(request.endDate()).isEqualTo("2026-04-30");
    }

    @Test
    @DisplayName("the student is told how many entries and days the document holds")
    void reportsCountsBack() {
        givenEntries(List.of(
                entry(intern, LocalDate.of(2026, 1, 5), "A", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-05T08:00:00Z")),
                entry(intern, LocalDate.of(2026, 1, 5), "B", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-05T09:00:00Z"))));

        JournalEntriesGenerationResponse response =
                service.generateFromEntries(principalFor(intern, "INTERN"), internshipId);

        assertThat(response.source()).isEqualTo(JournalEntriesGenerationResponse.SOURCE_JOURNAL_ENTRIES);
        assertThat(response.entryCount()).isEqualTo(2);
        assertThat(response.dayCount()).isEqualTo(3);
        assertThat(response.firstDate()).isEqualTo("2026-01-05");
    }

    // -----------------------------------------------------------------------

    @Test
    @DisplayName("a journal with nothing submitted is refused with an actionable message, not an empty PDF")
    void emptyJournalIsRefused() {
        assertThatThrownBy(() -> service.generateFromEntries(principalFor(intern, "INTERN"), internshipId))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("no submitted journal entries");

        verify(docIntelClient, never()).renderJournalPdf(any());
        verify(companionService, never()).registerGeneratedDeliverable(
                any(), anyString(), anyString(), any(), anyString(), any());
    }

    @Test
    @DisplayName("when only drafts exist, nothing is rendered")
    void draftsOnlyIsRefused() {
        givenEntries(List.of(
                entry(intern, LocalDate.of(2026, 1, 5), "Draft", JournalEntryStatus.DRAFT, Instant.parse("2026-01-05T08:00:00Z"))));

        assertThatThrownBy(() -> service.generateFromEntries(principalFor(intern, "INTERN"), internshipId))
                .isInstanceOf(BusinessRuleException.class);
        verify(docIntelClient, never()).renderJournalPdf(any());
    }

    @Test
    @DisplayName("an unreachable document service fails honestly instead of storing nothing")
    void pythonUnavailableFailsHonestly() {
        when(journalEntryRepository.findByJournalId(any())).thenReturn(List.of(
                entry(intern, LocalDate.of(2026, 1, 5), "Accueil", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-05T08:00:00Z"))));
        when(docIntelClient.renderJournalPdf(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generateFromEntries(principalFor(intern, "INTERN"), internshipId))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("temporarily unavailable");

        verify(companionService, never()).registerGeneratedDeliverable(
                any(), anyString(), anyString(), any(), anyString(), any());
    }

    @Test
    @DisplayName("generation outside the eligibility window is refused before anything is rendered")
    void outsideWindowIsRefused() {
        // A window that has not opened yet.
        internship.setStartDate(LocalDate.now(ZoneId.of("Africa/Tunis")).plusDays(30));
        internship.setEndDate(LocalDate.now(ZoneId.of("Africa/Tunis")).plusDays(90));

        assertThatThrownBy(() -> service.generateFromEntries(principalFor(intern, "INTERN"), internshipId))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("eligibility window");

        verify(docIntelClient, never()).renderJournalPdf(any());
    }

    @Test
    @DisplayName("a non-participant gets no existence leak: 404, never a document")
    void foreignUserIsRefused() {
        User stranger = user("Stranger");
        assertThatThrownBy(() -> service.generateFromEntries(principalFor(stranger, "INTERN"), internshipId))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(docIntelClient, never()).renderJournalPdf(any());
    }

    @Test
    @DisplayName("regenerating replaces the draft instead of piling up documents")
    void regeneratingReplacesTheDraft() {
        Deliverable draft = new Deliverable();
        draft.setId(UUID.randomUUID());
        draft.setTitle("Journal de stage (journal saisi) — INT-2026-00001");
        draft.setStatus(DeliverableStatus.DRAFT);
        draft.setCreatedAt(Instant.parse("2026-01-05T08:00:00Z"));
        when(deliverableRepository.findByInternshipId(internshipId)).thenReturn(List.of(draft));
        when(companionService.addGeneratedVersion(eq(draft.getId()), any(), anyString(), anyString(), any()))
                .thenAnswer(inv -> new DeliverableResponse(draft.getId(), internshipId, null, null,
                        draft.getTitle(), "desc", DeliverableStatus.DRAFT, null, 2,
                        null, null, null, null, null));

        givenEntries(List.of(
                entry(intern, LocalDate.of(2026, 1, 5), "Accueil", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-05T08:00:00Z"))));

        JournalEntriesGenerationResponse response =
                service.generateFromEntries(principalFor(intern, "INTERN"), internshipId);

        assertThat(response.replacedDraft()).isTrue();
        verify(companionService).addGeneratedVersion(eq(draft.getId()), any(), anyString(), anyString(), any());
        verify(companionService, never()).registerGeneratedDeliverable(
                any(), anyString(), anyString(), any(), anyString(), any());
    }

    @Test
    @DisplayName("a submitted journal stays immutable: regeneration creates a new draft")
    void submittedJournalStaysImmutable() {
        Deliverable submitted = new Deliverable();
        submitted.setId(UUID.randomUUID());
        submitted.setTitle("Journal de stage (journal saisi) — INT-2026-00001");
        submitted.setStatus(DeliverableStatus.SUBMITTED);
        submitted.setCreatedAt(Instant.parse("2026-01-05T08:00:00Z"));
        when(deliverableRepository.findByInternshipId(internshipId)).thenReturn(List.of(submitted));

        givenEntries(List.of(
                entry(intern, LocalDate.of(2026, 1, 5), "Accueil", JournalEntryStatus.SUBMITTED, Instant.parse("2026-01-05T08:00:00Z"))));

        JournalEntriesGenerationResponse response =
                service.generateFromEntries(principalFor(intern, "INTERN"), internshipId);

        assertThat(response.previousSubmitted()).isTrue();
        assertThat(response.replacedDraft()).isFalse();
        ArgumentCaptor<String> title = ArgumentCaptor.forClass(String.class);
        verify(companionService).registerGeneratedDeliverable(
                eq(internshipId), title.capture(), anyString(), any(), anyString(), any());
        assertThat(title.getValue()).endsWith("(nouveau)");
    }
}
