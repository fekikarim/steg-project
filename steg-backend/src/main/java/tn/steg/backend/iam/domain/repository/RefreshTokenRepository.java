package tn.steg.backend.iam.domain.repository;

import tn.steg.backend.iam.domain.model.RefreshToken;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Domain port interface for RefreshToken persistence operations.
 */
public interface RefreshTokenRepository {
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /**
     * Same lookup, but takes a row lock for the duration of the transaction.
     *
     * <p>Used by the refresh rotation: without it, two requests arriving at the
     * same instant both read the row as active, both revoke it, and the loser
     * fails on the optimistic-lock conflict at COMMIT time — surfacing as a 409
     * that clients read as "session broken".
     */
    Optional<RefreshToken> findByTokenHashForUpdate(String tokenHash);
    List<RefreshToken> findByUserIdAndRevokedAtIsNull(UUID userId);
    RefreshToken save(RefreshToken token);

    /**
     * Session revocation: marks EVERY active refresh token of the account as
     * revoked (deactivation, deletion, admin password reset). Tokens stay as
     * revoked rows for traceability; the refresh flow refuses them.
     */
    void revokeAllForUser(UUID userId);

    void deleteByUserId(UUID userId);
}
