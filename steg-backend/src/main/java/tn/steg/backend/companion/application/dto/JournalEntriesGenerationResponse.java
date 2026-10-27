package tn.steg.backend.companion.application.dto;

/**
 * S8 result of the entries-compiled internship journal: the stored draft
 * deliverable plus the facts about the document the student can see on their
 * own screen.
 *
 * <p>Deliberately entry-shaped rather than task-shaped: the document is
 * compiled from the student's submitted {@code journal_entries}, so a
 * task-completion ratio would describe data that is not in the PDF.
 *
 * @param deliverable       the stored draft deliverable
 * @param source            always {@code JOURNAL_ENTRIES}; present so a client
 *                          can tell this workflow apart from the free-text one
 * @param entryCount        entries rendered, after de-duplication
 * @param dayCount          distinct dates those entries fall on
 * @param firstDate         earliest entry date (ISO), {@code null} when empty
 * @param lastDate          latest entry date (ISO), {@code null} when empty
 * @param pageCount         pages in the rendered PDF
 * @param replacedDraft     {@code true} when the previous unsubmitted journal
 *                          draft was replaced by a new version of the same
 *                          deliverable
 * @param previousSubmitted {@code true} when an earlier journal deliverable was
 *                          already submitted/validated and stayed immutable,
 *                          so this generation is a NEW draft
 */
public record JournalEntriesGenerationResponse(
        DeliverableResponse deliverable,
        String source,
        int entryCount,
        int dayCount,
        String firstDate,
        String lastDate,
        int pageCount,
        boolean replacedDraft,
        boolean previousSubmitted) {

    public static final String SOURCE_JOURNAL_ENTRIES = "JOURNAL_ENTRIES";
}
