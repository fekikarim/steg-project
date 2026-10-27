package tn.steg.backend.ai.infrastructure.python;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.boot.health.contributor.Status;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tn.steg.backend.ai.domain.client.DocIntelClient;
import tn.steg.backend.ai.domain.client.DocIntelClient.ReadinessProbe;

import java.time.Duration;
import java.util.Optional;

/**
 * Honest health of the Python AI service.
 *
 * <p>The service being <em>configured</em> and the service being <em>usable</em>
 * are different claims. A container can be running while the shared token is
 * missing (every call would 401) or while the journal PDF renderer is broken
 * (every PDF would 5xx). Reporting "UP" for that state is what let a broken AI
 * stack look healthy to operators and silently degrade every AI feature,
 * including "Generate Journal with AI".
 *
 * <p>This indicator therefore asks the service's {@code /ready} endpoint,
 * which itself verifies the token AND renders a real PDF, and reports
 * {@code DEGRADED} otherwise. It is deliberately excluded from the
 * <em>liveness</em> group so a degraded AI service never restarts the API and
 * drops live user sessions — readiness and AI availability are different
 * questions.
 *
 * <p>The status is {@code DEGRADED} rather than {@code DOWN} because the Python
 * AI service is an <em>optional</em> dependency: the rest of this API keeps
 * serving while it is unusable. Reporting {@code DOWN} would make the aggregate
 * {@code /actuator/health} return 503 and mark a perfectly serving API as
 * unhealthy. {@code DEGRADED} is ordered below {@code UP} in
 * {@code management.endpoint.health.status.order}, so the aggregate stays
 * 200/UP while authorized operators still see the real failure and its reason.
 */
@Slf4j
@Component("pythonAiService")
@ConditionalOnProperty(prefix = "steg.python", name = "base-url")
public class PythonAiServiceHealthIndicator implements HealthIndicator {

    /**
     * Optional dependency is configured but not usable. Must be ordered below
     * {@code UP} (see application.yml) to keep the aggregate health 200.
     */
    public static final String STATUS_DEGRADED_CODE = "DEGRADED";

    public static final Status STATUS_DEGRADED = new Status(STATUS_DEGRADED_CODE);

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(3);

    private final PythonProperties props;
    private final DocIntelClient client;

    public PythonAiServiceHealthIndicator(PythonProperties props, DocIntelClient client) {
        this.props = props;
        this.client = client;
    }

    @Override
    public Health health() {
        if (!client.isConfigured()) {
            // Misconfiguration is a real, actionable fault: no base URL or no
            // shared token means every AI call fails.
            return Health.status(STATUS_DEGRADED)
                    .withDetail("configured", false)
                    .withDetail("reason",
                            "PYTHON_AI_SERVICE_BASE_URL / PYTHON_AI_SERVICE_TOKEN not set — "
                                    + "the AI service (journal PDF, document checks) is disabled")
                    .build();
        }
        if (client.circuitOpen()) {
            return Health.status(STATUS_DEGRADED)
                    .withDetail("configured", true)
                    .withDetail("reason",
                            "Python AI circuit breaker is open after repeated failures; "
                                    + "the service is being considered unavailable")
                    .build();
        }
        // A Mismatched shared secret is its own fault, with its own fix: both
        // sides are healthy and every call would simply answer 401. Checking it
        // first means the name of the problem is never lost behind "not ready".
        if (client.tokenMismatch()) {
            return Health.status(STATUS_DEGRADED)
                    .withDetail("configured", true)
                    .withDetail("problem", "token-mismatch")
                    .withDetail("reason",
                            "PYTHON_AI_SERVICE_TOKEN differs between this backend and the "
                                    + "Python AI service, so every call is rejected with 401. "
                                    + "Set the SAME value in both .env files (repo root .env is "
                                    + "canonical) and restart both services.")
                    .build();
        }
        // A real probe of the service's /ready endpoint, which itself verifies
        // the shared token AND renders a PDF. "The process is running" is not
        // an acceptable answer here.
        Optional<ReadinessProbe> probe = client.probeReadiness();
        if (probe.isEmpty()) {
            return Health.status(STATUS_DEGRADED)
                    .withDetail("configured", true)
                    .withDetail("probe", "unsupported")
                    .withDetail("reason",
                            "Python AI service did not report readiness — journal PDF rendering "
                                    + "and document checks are unavailable")
                    .build();
        }
        ReadinessProbe readiness = probe.get();
        if (!readiness.ready()) {
            return Health.status(STATUS_DEGRADED)
                    .withDetail("configured", true)
                    .withDetail("probe", "not ready")
                    .withDetail("reason",
                            "Python AI service is not ready — the journal PDF renderer or the "
                                    + "shared token is not working, so journal generation and "
                                    + "document checks are unavailable")
                    .build();
        }
        return Health.up()
                .withDetail("configured", true)
                .withDetail("probe", "ready")
                .withDetail("timeoutMs", PROBE_TIMEOUT.toMillis())
                .build();
    }
}
