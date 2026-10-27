package tn.steg.backend.iam;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tn.steg.backend.TestcontainersConfiguration;
import tn.steg.backend.iam.application.dto.LoginRequest;
import tn.steg.backend.iam.application.dto.RegisterRequest;
import tn.steg.backend.iam.infrastructure.persistence.RefreshTokenRepository;
import tn.steg.backend.iam.infrastructure.persistence.UserRepository;
import tn.steg.backend.iam.infrastructure.persistence.UserSessionRepository;
import tn.steg.backend.iam.infrastructure.security.JwtService;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * S1 — the premature-session-expiration regression suite.
 *
 * <p>Users were logged out minutes after signing in. Against a real database
 * these tests pin the behaviour the fix rests on:
 *
 * <ul>
 *   <li>a session outlives the access token through refresh;</li>
 *   <li>rotation is STRICT — a consumed token is dead immediately, because a
 *       replay is indistinguishable from a stolen-token reuse;</li>
 *   <li>the row lock means concurrent refreshes produce a precise refusal
 *       instead of the 409 \"concurrent modification\" that read as a broken
 *       server (the clients coalesce, so they never hit this — but nothing
 *       may crash with a conflict);</li>
 *   <li>expired / unknown / malformed refresh tokens stay refused;</li>
 *   <li>logout and administrative revocation really end the session;</li>
 *   <li>refresh does not grow the session table without bound;</li>
 *   <li>unauthorized access stays blocked — no weakening for convenience.</li>
 * </ul>
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
// NOT @Transactional on purpose: the concurrency test drives several real
// threads, and an uncommitted test transaction is invisible to them — they
// would each see "no such token" and the race would never actually be raced.
// Every test uses a unique email instead.
class SessionExpiryIntegrationTest {

    private static final String PASSWORD = "session-test-123";
    private static final String PROTECTED = "/api/notifications/unread-count";

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;
    @Autowired
    private UserSessionRepository userSessionRepository;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private tn.steg.backend.iam.infrastructure.config.JwtProperties jwtProperties;

    private MockMvc mockMvc;
    private String issuer;
    private javax.crypto.SecretKey signingKey;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity()).build();
        issuer = jwtProperties.getIssuer();
        signingKey = io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                jwtProperties.getSecretKey().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    // ---------------------------------------------------------------- helpers

    private String registerAndLogin(String email) throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(RegisterRequest.builder()
                                .email(email).password(PASSWORD)
                                .firstName("Sess").lastName("Tester")
                                .phone("+216 70 000 000").build())))
                .andExpect(status().isCreated());
        return login(email);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> loginResponse(String email) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(LoginRequest.builder()
                                .email(email).password(PASSWORD).build())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readValue(body, Map.class);
    }

    private String login(String email) throws Exception {
        return (String) loginResponse(email).get("accessToken");
    }

    private String refreshTokenOf(String email) throws Exception {
        return (String) loginResponse(email).get("refreshToken");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> refresh(String refreshToken) throws Exception {
        String body = mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken + "\"}"))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readValue(body, Map.class);
    }

    // ------------------------------------------------------------------ tests

    @Test
    @DisplayName("an expired access token is renewed from a valid refresh token")
    void refreshRenewsAnExpiredAccessToken() throws Exception {
        String email = "sess-renew@test.tn";
        registerAndLogin(email);
        String refreshToken = refreshTokenOf(email);

        // An access token that is already outside its window must be refused.
        // Minted directly with a past `exp`: generateAccessToken always mints a
        // live one, so it cannot express "expired".
        var user = userRepository.findByEmail(email).orElseThrow();
        String expired = io.jsonwebtoken.Jwts.builder()
                .subject(user.getId().toString())
                .issuer(issuer)
                .issuedAt(java.util.Date.from(Instant.now().minusSeconds(600)))
                .expiration(java.util.Date.from(Instant.now().minusSeconds(300)))
                .claim("email", email)
                .claim("roles", List.of("ROLE_CANDIDATE"))
                .signWith(signingKey)
                .compact();
        mockMvc.perform(get(PROTECTED).header("Authorization", "Bearer " + expired))
                .andExpect(status().is4xxClientError());

        // The refresh token still works and yields a usable pair.
        Map<String, Object> renewed = refresh(refreshToken);
        assertThat(renewed).containsKeys("accessToken", "refreshToken");
        mockMvc.perform(get(PROTECTED)
                        .header("Authorization", "Bearer " + renewed.get("accessToken")))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("rotation is strict: a consumed token is refused immediately")
    void consumedTokenIsRefusedImmediately() throws Exception {
        String email = "sess-consumed@test.tn";
        registerAndLogin(email);
        String consumed = refreshTokenOf(email);

        assertThat(refresh(consumed)).containsKeys("accessToken", "refreshToken");
        // A second use of the SAME token, one second later, is refused. There is
        // no grace window: a replay cannot be told apart from a thief.
        assertThat(refresh(consumed)).containsEntry("error", "INVALID_REFRESH_TOKEN");
    }

    @Test
    @DisplayName("an old rotation is refused")
    void oldRotationIsRefused() throws Exception {
        String email = "sess-rotate-old@test.tn";
        registerAndLogin(email);
        String original = refreshTokenOf(email);

        var row = refreshTokenRepository.findByTokenHash(jwtService.hashToken(original))
                .orElseThrow();
        row.revoke(Instant.now().minusSeconds(600));
        refreshTokenRepository.saveAndFlush(row);

        assertThat(refresh(original)).containsEntry("error", "INVALID_REFRESH_TOKEN");
    }

    /**
     * A client that does NOT coalesce must get one success and precise
     * refusals — never the 409 \"concurrent modification\", which is what made
     * a rotation race look like a broken server. Both shipped clients
     * coalesce, so this is the contract for anything that misbehaves.
     */
    @Test
    @DisplayName("concurrent refreshes: one wins, the rest are refused cleanly (never a 409)")
    void concurrentRefreshesNeverProduceAConflict() throws Exception {
        String email = "sess-race@test.tn";
        registerAndLogin(email);
        String refreshToken = refreshTokenOf(email);

        int racers = 6;
        ExecutorService pool = Executors.newFixedThreadPool(racers);
        try {
            CyclicBarrier gate = new CyclicBarrier(racers);
            List<Callable<Integer>> calls = new java.util.ArrayList<>();
            for (int i = 0; i < racers; i++) {
                calls.add(() -> {
                    gate.await();
                    return mockMvc.perform(post("/api/auth/refresh")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"refreshToken\":\"" + refreshToken + "\"}"))
                            .andReturn().getResponse().getStatus();
                });
            }
            List<Future<Integer>> results = pool.invokeAll(calls);
            int ok = 0;
            for (Future<Integer> result : results) {
                int code = result.get();
                assertThat(code).as("no optimistic-lock conflict").isNotEqualTo(409);
                if (code == 200) {
                    ok++;
                } else {
                    assertThat(code).as("refused as a replay").isEqualTo(422);
                }
            }
            assertThat(ok).as("exactly one rotation wins").isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    @DisplayName("an expired refresh token is refused")
    void expiredRefreshTokenIsRefused() throws Exception {
        String email = "sess-expired-refresh@test.tn";
        registerAndLogin(email);
        String refreshToken = refreshTokenOf(email);

        var row = refreshTokenRepository.findByTokenHash(jwtService.hashToken(refreshToken))
                .orElseThrow();
        row.setExpiresAt(Instant.now().minusSeconds(60));
        refreshTokenRepository.saveAndFlush(row);

        assertThat(refresh(refreshToken)).containsEntry("error", "INVALID_REFRESH_TOKEN");
    }

    @Test
    @DisplayName("an unknown or blank refresh token is refused")
    void unknownAndMalformedRefreshTokensAreRefused() throws Exception {
        assertThat(refresh("not-a-real-token")).containsEntry("error", "INVALID_REFRESH_TOKEN");
        // A blank token is rejected by bean validation before the service runs
        // — still refused, with a different (and equally safe) code.
        assertThat(refresh("")).containsEntry("error", "Validation Failure");
    }

    @Test
    @DisplayName("an administratively revoked token is refused (password reset / deactivation path)")
    void administrativelyRevokedIsRefused() throws Exception {
        String email = "sess-admin-revoked@test.tn";
        registerAndLogin(email);
        String refreshToken = refreshTokenOf(email);

        var row = refreshTokenRepository.findByTokenHash(jwtService.hashToken(refreshToken))
                .orElseThrow();
        row.revoke(Instant.now());
        refreshTokenRepository.saveAndFlush(row);

        assertThat(refresh(refreshToken)).containsEntry("error", "INVALID_REFRESH_TOKEN");
    }

    @Test
    @DisplayName("logout revokes the session and its refresh token stops working")
    void logoutEndsTheSession() throws Exception {
        String email = "sess-logout@test.tn";
        String access = registerAndLogin(email);
        String refreshToken = refreshTokenOf(email);

        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + access)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken + "\"}"))
                .andExpect(status().isNoContent());

        var row = refreshTokenRepository.findByTokenHash(jwtService.hashToken(refreshToken))
                .orElseThrow();
        assertThat(row.getRevokedAt()).isNotNull();
        assertThat(refresh(refreshToken)).containsEntry("error", "INVALID_REFRESH_TOKEN");
    }

    @Test
    @DisplayName("refresh does not create a session row every time (no unbounded growth)")
    void refreshDoesNotMultiplySessionRows() throws Exception {
        String email = "sess-rows@test.tn";
        registerAndLogin(email);
        var user = userRepository.findByEmail(email).orElseThrow();

        long before = userSessionRepository.findByUserIdAndRevokedAtIsNull(user.getId()).size();
        String refreshToken = refreshTokenOf(email);
        for (int i = 0; i < 5; i++) {
            refreshToken = (String) refresh(refreshToken).get("refreshToken");
        }
        long after = userSessionRepository.findByUserIdAndRevokedAtIsNull(user.getId()).size();

        assertThat(after).as("one row per device session, not per refresh")
                .isLessThanOrEqualTo(before + 1);
    }

    @Test
    @DisplayName("unauthorized access stays blocked — no weakening for convenience")
    void unauthorizedAccessStaysBlocked() throws Exception {
        mockMvc.perform(get(PROTECTED)).andExpect(status().is4xxClientError());

        String email = "sess-unauth@test.tn";
        String access = registerAndLogin(email);
        String tampered = access.substring(0, access.length() - 3) + "AAA";
        mockMvc.perform(get(PROTECTED).header("Authorization", "Bearer " + tampered))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("token lifetimes are centralized and match what the clients assume")
    void lifetimesAreCentralizedAndReadable() {
        assertThat(jwtService.getAccessTokenExpirationSeconds()).isEqualTo(15 * 60);
        assertThat(jwtService.getRefreshTokenExpirationSeconds()).isEqualTo(7L * 24 * 3600);
    }
}
