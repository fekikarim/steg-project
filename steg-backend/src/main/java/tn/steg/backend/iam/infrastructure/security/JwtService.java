package tn.steg.backend.iam.infrastructure.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tn.steg.backend.iam.application.dto.TokenPayload;
import tn.steg.backend.iam.application.port.out.TokenServicePort;
import tn.steg.backend.iam.infrastructure.config.JwtProperties;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
public class JwtService implements TokenServicePort {

    private final SecretKey signingKey;
    private final String issuer;
    private final JwtProperties properties;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        this.signingKey =
                Keys.hmacShaKeyFor(properties.getSecretKey().getBytes(StandardCharsets.UTF_8));
        this.issuer = properties.getIssuer();
    }

    public String generateAccessToken(UUID userId, String email, List<String> roles) {
        return generateAccessToken(userId, email, roles, false);
    }

    public String generateAccessToken(UUID userId, String email, List<String> roles, boolean mustChangePassword) {
        Instant now = Instant.now();
        Instant expiration = now.plus(properties.getAccessTokenExpirationMinutes(), ChronoUnit.MINUTES);

        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(userId.toString())
                .issuer(issuer)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .claim("email", email)
                .claim("roles", roles)
                .claim("mustChangePassword", mustChangePassword)
                .signWith(signingKey)
                .compact();
    }

    public String generateRefreshToken() {
        byte[] randomBytes = new byte[64];
        new SecureRandom().nextBytes(randomBytes);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    public long getRefreshTokenExpirationSeconds() {
        return properties.getRefreshTokenExpirationDays() * 24L * 60 * 60;
    }

    public long getAccessTokenExpirationSeconds() {
        return properties.getAccessTokenExpirationMinutes() * 60;
    }

    public Claims validateAccessToken(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .requireIssuer(issuer)
                // Tolerate a little clock drift instead of rejecting a token
                // that is still comfortably inside its window.
                .clockSkewSeconds(Math.max(0, properties.getClockSkewSeconds()))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String hashToken(String rawToken) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    public TokenPayload extractPayload(Claims claims) {
        return TokenPayload.builder()
                .userId(UUID.fromString(claims.getSubject()))
                .email(claims.get("email", String.class))
                .roles(claims.get("roles", List.class))
                .issuedAt(claims.getIssuedAt().toInstant())
                .expiresAt(claims.getExpiration().toInstant())
                .jti(claims.getId())
                .build();
    }
}
