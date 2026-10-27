package tn.steg.backend.community.application.dto;

import java.util.List;
import java.util.UUID;

/**
 * One current STEG intern as the community directory shows them (T08).
 *
 * <p>Privacy (D7 / BR-39) applies here exactly as it does to a post author: a
 * display name, a role/status label and an opaque id. Never email, CIN,
 * phone, national id, university record or supervisor data — this is a
 * directory of colleagues, not an HR export.
 *
 * @param userId       opaque; lets the app tell "me" from "somebody else"
 * @param displayName  "Yasmine H." — first name + last initial
 * @param internshipReference the internship they are currently on
 * @param statusLabel  the internship status, as a readable label
 * @param postCount    how many visible posts they have (their activity level)
 */
public record CommunityCandidateResponse(
        UUID userId,
        String displayName,
        String internshipReference,
        String statusLabel,
        long postCount,
        boolean isMe
) {

    /** Paged directory; `hasMore` drives the client's infinite scroll. */
    public record DirectoryPage(
            List<CommunityCandidateResponse> items,
            int page,
            int size,
            boolean hasMore,
            long total
    ) {}
}
