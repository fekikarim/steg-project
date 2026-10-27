package tn.steg.backend.ai.infrastructure.python;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import tn.steg.backend.TestcontainersConfiguration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The AI health indicator must actually be REGISTERED, not merely written.
 *
 * <p>An indicator that never appears in {@code /actuator/health} is worse than
 * none: operators believe the AI dependency is covered while the status stays
 * silently UP. This asserts the bean exists under the documented name and that
 * the health endpoint can serve it.
 */
@SpringBootTest
@ActiveProfiles("test")
@org.springframework.context.annotation.Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
        // Configured-but-unreachable: the indicator must report DEGRADED, not vanish.
        "steg.python.base-url=http://localhost:1",
        "steg.python.service-token=test-token",
})
@DisplayName("Python AI health indicator registration")
class PythonAiHealthIndicatorRegistrationTest {

    @Autowired
    private WebApplicationContext webContext;

    private MockMvc mockMvc;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webContext)
                .apply(springSecurity())
                .build();
    }

    @Test
    @DisplayName("the indicator bean is registered as a health contributor named pythonAiService")
    void indicatorIsRegistered() {
        assertThat(webContext.getBeanNamesForType(
                org.springframework.boot.health.contributor.HealthContributor.class))
                .contains("pythonAiService");
    }

    @Test
    @DisplayName("an unreachable service reports DEGRADED with an actionable reason")
    void unreachableServiceIsDegraded() {
        var indicator = webContext.getBean("pythonAiService",
                PythonAiServiceHealthIndicator.class);
        var health = indicator.health();
        assertThat(health.getStatus().getCode()).isEqualTo("DEGRADED");
        assertThat(health.getDetails().toString()).contains("journal PDF");
    }

    @Test
    @DisplayName("a DEGRADED AI service does not make the aggregate health endpoint fail")
    void degradedAiDoesNotBreakAggregateHealth() throws Exception {
        // The Python AI service is an OPTIONAL dependency. If it reported DOWN,
        // /actuator/health would answer 503 and every orchestrator probe would
        // declare a still-serving API dead — and any restart policy would kill
        // live user sessions. The aggregate must therefore stay UP while the
        // component carries the truth.
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
