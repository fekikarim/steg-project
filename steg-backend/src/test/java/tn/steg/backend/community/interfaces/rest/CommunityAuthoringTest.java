package tn.steg.backend.community.interfaces.rest;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tn.steg.backend.TestcontainersConfiguration;
import tn.steg.backend.candidate.domain.model.Candidate;
import tn.steg.backend.candidate.domain.model.University;
import tn.steg.backend.candidate.infrastructure.persistence.CandidateRepository;
import tn.steg.backend.candidate.infrastructure.persistence.UniversityRepository;


import tn.steg.backend.iam.domain.model.User;
import tn.steg.backend.iam.domain.model.UserStatus;
import tn.steg.backend.iam.domain.repository.RoleRepository;
import tn.steg.backend.iam.infrastructure.persistence.UserRepository;
import tn.steg.backend.internship.application.InternshipService;
import tn.steg.backend.internship.application.dto.InternshipCreateManualRequest;
import tn.steg.backend.internship.application.dto.InternshipResponse;
import tn.steg.backend.internship.domain.repository.InternshipRepository;
import tn.steg.backend.iam.infrastructure.security.JwtService;
import tn.steg.backend.organization.domain.model.Department;
import tn.steg.backend.organization.infrastructure.persistence.DepartmentRepository;
import tn.steg.backend.organization.infrastructure.persistence.EmployeeRepository;

import tn.steg.backend.common.domain.model.UserPrincipal;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * T08 — the three things the community screen needed and did not have:
 * an optional attachment that really is optional, an edit, and a directory of
 * the current cohort.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@DisplayName("T08 — community editing, optional attachment, candidate directory")
class CommunityAuthoringTest {

    @org.springframework.beans.factory.annotation.Autowired
    private WebApplicationContext context;
    @org.springframework.beans.factory.annotation.Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @org.springframework.beans.factory.annotation.Autowired
    private UserRepository userRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private RoleRepository roleRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private CandidateRepository candidateRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private UniversityRepository universityRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private DepartmentRepository departmentRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private EmployeeRepository employeeRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private InternshipService internshipService;
    @org.springframework.beans.factory.annotation.Autowired
    private InternshipRepository internshipRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private JwtService jwtService;

    private org.springframework.test.web.servlet.MockMvc mockMvc;
    private User internUser;
    private User otherInternUser;
    private User outsiderUser;
    private String internToken;
    private String otherToken;
    private String outsiderToken;
    private University uni;
    private Department dept;
    private UserPrincipal adminPrincipal;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        User admin = userRepository.saveAndFlush(
                new User("t08e_admin_" + suffix + "@steg.com", "hash", UserStatus.ACTIVE));
        adminPrincipal = new UserPrincipal(admin.getId(), admin.getEmail(), List.of("ROLE_ADMIN"));

        uni = universityRepository.saveAndFlush(new University("INSAT_E_" + suffix, "INSAT Tunis"));
        dept = departmentRepository.saveAndFlush(new Department("DIR_E_" + suffix, "Direction", "E"));

        internUser = userRepository.saveAndFlush(
                new User("t08e_intern_" + suffix + "@steg.com", "hash", UserStatus.ACTIVE));
        internToken = token(internUser);

        otherInternUser = userRepository.saveAndFlush(
                new User("t08e_other_" + suffix + "@steg.com", "hash", UserStatus.ACTIVE));
        otherToken = token(otherInternUser);

        outsiderUser = userRepository.saveAndFlush(
                new User("t08e_out_" + suffix + "@steg.com", "hash", UserStatus.ACTIVE));
        outsiderToken = token(outsiderUser);

        activeInternship(internUser, "e1", suffix + "01");
        activeInternship(otherInternUser, "e2", suffix + "02");
    }

    private String token(User u) {
        return jwtService.generateAccessToken(u.getId(), u.getEmail(),
                List.of("ROLE_CANDIDATE", "ROLE_INTERN"));
    }

    private void activeInternship(User user, String first, String cin) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        String hash = Base64.getEncoder()
                .encodeToString(digest.digest(cin.getBytes(StandardCharsets.UTF_8)));
        Candidate candidate = new Candidate(first.toUpperCase(), "Intern",
                user.getEmail().split("@")[0] + "@steg.com", hash, uni);
        candidate.setUser(user);
        candidate.setNationalIdEncrypted(cin);
        candidate = candidateRepository.saveAndFlush(candidate);
        // Assigned, so the internship reaches IN_PROGRESS.
        InternshipResponse created = internshipService.createManual(new InternshipCreateManualRequest(
                candidate.getId(), LocalDate.now().minusDays(5), LocalDate.now().plusDays(60),
                "Community", "Ingénieur", false), adminPrincipal);
        assertThat(created.status()).isNotNull();
    }

    private MvcResult json(String method, String path, String token, String body) throws Exception {
        var request = method.equals("POST")
                ? post(path).contentType(MediaType.APPLICATION_JSON).content(body)
                : put(path).contentType(MediaType.APPLICATION_JSON).content(body);
        return mockMvc.perform(request.header("Authorization", "Bearer " + token)).andReturn();
    }

    private UUID createPost(String token, String body) throws Exception {
        MvcResult r = json("POST", "/api/community/posts", token, "{\"body\":\"" + body + "\"}");
        assertThat(r.getResponse().getStatus()).isEqualTo(201);
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText());
    }

    // ------------------------------------------------------------------
    // Optional attachment
    // ------------------------------------------------------------------

    @Test
    @DisplayName("posting WITHOUT a file works: the attachment field is truly optional")
    void multipartWithoutFileStillPublishes() throws Exception {
        MvcResult r = mockMvc.perform(multipart("/api/community/posts/with-attachment")
                        .param("body", "texte seul")
                        .header("Authorization", "Bearer " + internToken))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode post = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(post.get("body").asText()).isEqualTo("texte seul");
        assertThat(post.get("attachment").isNull()).isTrue();
    }

    @Test
    @DisplayName("an EMPTY file part still publishes the text instead of failing")
    void emptyFilePartStillPublishes() throws Exception {
        MvcResult r = mockMvc.perform(multipart("/api/community/posts/with-attachment")
                        .param("body", "avec part vide")
                        .file(new MockMultipartFile("file", "", "application/octet-stream", new byte[0]))
                        .header("Authorization", "Bearer " + internToken))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode post = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(post.get("body").asText()).isEqualTo("avec part vide");
    }

    @Test
    @DisplayName("posting WITH an image/PDF attaches it")
    void multipartWithFileAttaches() throws Exception {
        MvcResult r = mockMvc.perform(multipart("/api/community/posts/with-attachment")
                        .param("body", "avec fichier")
                        .file(new MockMultipartFile("file", "schema.pdf", "application/pdf",
                                "%PDF-1.4 test".getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + internToken))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode post = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(post.get("attachment").isNull()).isFalse();
        assertThat(post.get("attachment").get("fileName").asText()).isEqualTo("schema.pdf");
    }

    // ------------------------------------------------------------------
    // Edit
    // ------------------------------------------------------------------

    @Test
    @DisplayName("the author can edit their post")
    void authorCanEdit() throws Exception {
        UUID id = createPost(internToken, "version initiale");

        MvcResult r = json("PUT", "/api/community/posts/" + id, internToken,
                "{\"body\":\"version corrigee\"}");
        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        JsonNode post = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(post.get("body").asText()).isEqualTo("version corrigee");
    }

    @Test
    @DisplayName("someone else's post cannot be edited, and the post is not leaked")
    void foreignPostCannotBeEdited() throws Exception {
        UUID id = createPost(internToken, "prive");

        MvcResult r = json("PUT", "/api/community/posts/" + id, otherToken, "{\"body\":\"vole\"}");
        assertThat(r.getResponse().getStatus()).isEqualTo(404);

        // Untouched.
        MvcResult feed = mockMvc.perform(get("/api/community/posts")
                        .header("Authorization", "Bearer " + otherToken)).andReturn();
        assertThat(feed.getResponse().getContentAsString()).contains("prive").doesNotContain("vole");
    }

    @Test
    @DisplayName("an unknown post id is a 404 on edit, not a 500")
    void unknownPostEditIs404() throws Exception {
        MvcResult r = json("PUT", "/api/community/posts/" + UUID.randomUUID(), internToken,
                "{\"body\":\"x\"}");
        assertThat(r.getResponse().getStatus()).isEqualTo(404);
    }

    @Test
    @DisplayName("a blank edit is rejected")
    void blankEditIsRejected() throws Exception {
        UUID id = createPost(internToken, "contenu");
        MvcResult r = json("PUT", "/api/community/posts/" + id, internToken, "{\"body\":\"   \"}");
        assertThat(r.getResponse().getStatus() / 100).isEqualTo(4);
    }

    @Test
    @DisplayName("an edit still enforces the contact-data rule")
    void editEnforcesContactDataRule() throws Exception {
        UUID id = createPost(internToken, "contenu");
        MvcResult r = json("PUT", "/api/community/posts/" + id, internToken,
                "{\"body\":\"ecris moi au 20 123 456\"}");
        assertThat(r.getResponse().getStatus() / 100).isEqualTo(4);
    }

    @Test
    @DisplayName("editing keeps the attachment the post was published with")
    void editKeepsAttachment() throws Exception {
        MvcResult created = mockMvc.perform(multipart("/api/community/posts/with-attachment")
                        .param("body", "avec fichier")
                        .file(new MockMultipartFile("file", "keep.pdf", "application/pdf",
                                "%PDF-1.4 test".getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + internToken))
                .andExpect(status().isCreated()).andReturn();
        JsonNode post = objectMapper.readTree(created.getResponse().getContentAsString());
        UUID id = UUID.fromString(post.get("id").asText());

        MvcResult edited = json("PUT", "/api/community/posts/" + id, internToken,
                "{\"body\":\"texte modifie\"}");
        JsonNode after = objectMapper.readTree(edited.getResponse().getContentAsString());
        assertThat(after.get("body").asText()).isEqualTo("texte modifie");
        assertThat(after.get("attachment").isNull()).isFalse();
        assertThat(after.get("attachment").get("fileName").asText()).isEqualTo("keep.pdf");
    }

    // ------------------------------------------------------------------
    // Candidate directory
    // ------------------------------------------------------------------

    @Test
    @DisplayName("the directory lists the current cohort and marks the caller")
    void directoryListsCurrentCohort() throws Exception {
        MvcResult r = mockMvc.perform(get("/api/community/candidates")
                        .header("Authorization", "Bearer " + internToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode page = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(page.get("items")).isNotEmpty();

        boolean sawMe = false;
        for (JsonNode item : page.get("items")) {
            assertThat(item.get("displayName").asText()).isNotBlank();
            // Privacy: no email, no CIN, no phone ever leaves the server.
            assertThat(item.has("email")).isFalse();
            assertThat(item.has("cin")).isFalse();
            assertThat(item.has("phone")).isFalse();
            assertThat(item.has("nationalId")).isFalse();
            if (item.get("userId").asText().equals(internUser.getId().toString())) {
                sawMe = true;
                assertThat(item.get("isMe").asBoolean()).isTrue();
            }
        }
        assertThat(sawMe).isTrue();
    }

    @Test
    @DisplayName("the directory is readable by any community reader, not by outsiders")
    void directoryRespectsCommunityScope() throws Exception {
        mockMvc.perform(get("/api/community/candidates")
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/community/candidates")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/community/candidates"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("the directory filters by name")
    void directoryFiltersByName() throws Exception {
        MvcResult all = mockMvc.perform(get("/api/community/candidates")
                        .header("Authorization", "Bearer " + internToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode items = objectMapper.readTree(all.getResponse().getContentAsString()).get("items");
        assertThat(items).isNotEmpty();
        String name = items.get(0).get("displayName").asText();
        String token0 = name.length() > 2 ? name.substring(0, 3) : name;

        MvcResult filtered = mockMvc.perform(get("/api/community/candidates?q=" + token0)
                        .header("Authorization", "Bearer " + internToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode page = objectMapper.readTree(filtered.getResponse().getContentAsString());
        assertThat(page.get("total").asInt()).isGreaterThanOrEqualTo(1);
        for (JsonNode item : page.get("items")) {
            assertThat(item.get("displayName").asText().toLowerCase()
                    .contains(token0.toLowerCase())).isTrue();
        }
    }

    @Test
    @DisplayName("a graduated internship does not appear in the directory")
    void graduatedInternsAreNotListed() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        User grad = userRepository.saveAndFlush(
                new User("t08e_grad_" + suffix + "@steg.com", "hash", UserStatus.ACTIVE));
        activeInternship(grad, "g1", suffix + "77");
        var internship = internshipRepository.findByCandidateId(
                candidateRepository.findByUserId(grad.getId()).orElseThrow().getId()).get(0);
        internship.setStatus(tn.steg.backend.internship.domain.model.InternshipStatus.VALIDATED);
        internshipRepository.save(internship);

        MvcResult r = mockMvc.perform(get("/api/community/candidates")
                        .header("Authorization", "Bearer " + internToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode items = objectMapper.readTree(r.getResponse().getContentAsString()).get("items");
        for (JsonNode item : items) {
            assertThat(item.get("userId").asText()).isNotEqualTo(grad.getId().toString());
        }
    }
}
