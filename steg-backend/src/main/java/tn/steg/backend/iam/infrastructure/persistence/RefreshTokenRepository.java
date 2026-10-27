package tn.steg.backend.iam.infrastructure.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tn.steg.backend.iam.domain.model.RefreshToken;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA adapter for the domain {@link tn.steg.backend.iam.domain.repository.RefreshTokenRepository} port.
 */
@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID>, tn.steg.backend.iam.domain.repository.RefreshTokenRepository {

    @Override
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RefreshToken r WHERE r.tokenHash = :tokenHash")
    Optional<RefreshToken> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    @Override
    @Modifying
    @Query("UPDATE RefreshToken r SET r.revokedAt = CURRENT_TIMESTAMP WHERE r.user.id = :userId AND r.revokedAt IS NULL")
    void revokeAllForUser(@Param("userId") UUID userId);
}
