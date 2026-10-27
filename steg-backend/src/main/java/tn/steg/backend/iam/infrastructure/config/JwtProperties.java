package tn.steg.backend.iam.infrastructure.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Token lifetimes and rotation policy, in ONE place (S1 session fix).
 *
 * <p>These were previously four separate {@code @Value} reads in
 * {@code JwtService}, which made it impossible to answer "how long is a
 * session really allowed to last?" without reading the code and the three
 * environment profiles. They are now a single, environment-overridable block:
 *
 * <pre>
 * steg.security.jwt.access-token-expiration-minutes   (JWT_ACCESS_EXP_MINUTES)
 * steg.security.jwt.refresh-token-expiration-days    (JWT_REFRESH_EXP_DAYS)
 * steg.security.jwt.clock-skew-seconds               (JWT_CLOCK_SKEW_SECONDS)
 * steg.security.jwt.rotation-grace-seconds           (JWT_ROTATION_GRACE_SECONDS)
 * </pre>
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "steg.security.jwt")
public class JwtProperties {

    /** HS512 signing secret. Must stay server-side; never shipped to a client. */
    private String secretKey = "";

    /** {@code iss} claim; a token from another issuer is rejected. */
    private String issuer = "steg-platform";

    /**
     * Access-token lifetime. Kept deliberately SHORT (the blast radius of a
     * leaked token is bounded), with the clients silently renewing well before
     * it elapses.
     */
    private long accessTokenExpirationMinutes = 15;

    /** Refresh-token lifetime: this is the real "log me out of everything" window. */
    private long refreshTokenExpirationDays = 7;

    /**
     * Tolerance for clock drift between this server and the issuer that minted
     * a token. Without it, a token minted a second before a boundary is
     * rejected a second early — which looks exactly like a random logout.
     */
    private long clockSkewSeconds = 60;

}
