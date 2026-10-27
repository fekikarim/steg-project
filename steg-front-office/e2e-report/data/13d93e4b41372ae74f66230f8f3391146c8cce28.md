# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: candidate-journey.spec.ts >> Front Office: register → login → apply → track >> register page renders form with required fields
- Location: e2e/candidate-journey.spec.ts:152:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('textbox', { name: /nom|last.*name/i })
Expected: visible
Error: strict mode violation: getByRole('textbox', { name: /nom|last.*name/i }) resolved to 2 elements:
    1) <input value="" required="" name="firstName" id="_R_1iklritpl5rlb_" autocomplete="given-name" class="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 dark:border-slate-700 dark:bg-navy-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 d…/> aka getByRole('textbox', { name: 'Prénom' })
    2) <input value="" required="" name="lastName" id="_R_2iklritpl5rlb_" autocomplete="family-name" class="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 dark:border-slate-700 dark:bg-navy-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 d…/> aka getByRole('textbox', { name: 'Nom', exact: true })

Call log:
  - Expect "toBeVisible" getByRole('textbox', { name: /nom|last.*name/i }) with timeout 5000ms
  - waiting for getByRole('textbox', { name: /nom|last.*name/i })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Aller au contenu" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - link "STEG" [ref=e6] [cursor=pointer]:
          - /url: /fr
          - img "STEG" [ref=e7]
        - generic [ref=e8]: Portail National
      - navigation "Principale" [ref=e10]:
        - link "Accueil" [ref=e11] [cursor=pointer]:
          - /url: /fr
        - link "À propos" [ref=e12] [cursor=pointer]:
          - /url: /fr/about
        - link "Histoire" [ref=e13] [cursor=pointer]:
          - /url: /fr/history
        - link "Stages" [ref=e14] [cursor=pointer]:
          - /url: /fr/internships
        - link "Companion" [ref=e15] [cursor=pointer]:
          - /url: /fr/companion
      - generic [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]: Langue
          - combobox "Langue" [ref=e19] [cursor=pointer]:
            - option "Français" [selected]
            - option "English"
            - option "العربية"
        - generic [ref=e20]:
          - generic [ref=e21]: Thème
          - combobox "Thème" [ref=e22] [cursor=pointer]:
            - option "Clair"
            - option "Sombre"
            - option "Système" [selected]
        - link [ref=e23] [cursor=pointer]:
          - /url: /fr/login
          - button "Se connecter" [ref=e24]
        - link [ref=e25] [cursor=pointer]:
          - /url: /fr/apply
          - button "Postuler" [ref=e26]
  - main [ref=e27]:
    - generic [ref=e28]:
      - generic [ref=e29]:
        - heading "Créer un compte candidat" [level=1] [ref=e30]
        - paragraph [ref=e31]: Pour déposer votre candidature et suivre vos stages en ligne.
      - generic [ref=e32]:
        - group "Informations personnelles" [ref=e33]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - generic [ref=e37]: Prénom*
              - textbox "Prénom" [ref=e38]
            - generic [ref=e39]:
              - generic [ref=e40]: Nom*
              - textbox "Nom" [ref=e41]
          - generic [ref=e42]:
            - generic [ref=e43]: Numéro de téléphone
            - textbox "Numéro de téléphone" [ref=e44]
            - paragraph [ref=e45]: optionnel
        - group "Informations du compte" [ref=e46]:
          - generic [ref=e48]:
            - generic [ref=e49]: Adresse e-mail*
            - textbox "Adresse e-mail" [ref=e50]
          - generic [ref=e51]:
            - generic [ref=e52]: Mot de passe*
            - generic [ref=e53]:
              - textbox "Mot de passe" [ref=e54]
              - button "Afficher le mot de passe" [ref=e55] [cursor=pointer]
            - paragraph [ref=e59]: Au moins 8 caractères, avec une majuscule, un chiffre et un caractère spécial.
          - generic [ref=e60]:
            - generic [ref=e61]: Confirmer le mot de passe*
            - generic [ref=e62]:
              - textbox "Confirmer le mot de passe" [ref=e63]
              - button "Afficher le mot de passe" [ref=e64] [cursor=pointer]
        - generic [ref=e70]:
          - checkbox "J'accepte les conditions d'utilisation et la politique de confidentialité." [ref=e71] [cursor=pointer]
          - generic [ref=e72] [cursor=pointer]: J'accepte les conditions d'utilisation et la politique de confidentialité.
        - button "Créer mon compte" [ref=e73] [cursor=pointer]
        - paragraph [ref=e74]:
          - text: Vous avez déjà un compte ?
          - link "Se connecter" [ref=e75] [cursor=pointer]:
            - /url: /fr/login
  - contentinfo [ref=e76]:
    - generic [ref=e77]:
      - generic [ref=e78]:
        - generic [ref=e79]: STEG — Direction des Ressources Humaines & Formation
        - generic [ref=e82]: Portail National de Gestion Dématérialisée des Stages
      - generic [ref=e84]:
        - generic [ref=e85]:
          - img "STEG" [ref=e88]
          - paragraph [ref=e89]: Société Tunisienne de l'Électricité et du Gaz — plateforme des stages.
          - generic [ref=e90]:
            - generic [ref=e91]: Fondée le 3 Avril 1962
            - generic [ref=e92]: Démarche Zéro Papier
        - navigation "Pied de page" [ref=e93]:
          - heading "Navigation" [level=2] [ref=e94]
          - list [ref=e95]:
            - listitem [ref=e96]:
              - link "Accueil" [ref=e97] [cursor=pointer]:
                - /url: /fr
            - listitem [ref=e100]:
              - link "À propos" [ref=e101] [cursor=pointer]:
                - /url: /fr/about
            - listitem [ref=e104]:
              - link "Histoire" [ref=e105] [cursor=pointer]:
                - /url: /fr/history
            - listitem [ref=e108]:
              - link "Stages" [ref=e109] [cursor=pointer]:
                - /url: /fr/internships
            - listitem [ref=e112]:
              - link "FAQ" [ref=e113] [cursor=pointer]:
                - /url: /fr/faq
            - listitem [ref=e116]:
              - link "Contact" [ref=e117] [cursor=pointer]:
                - /url: /fr/contact
        - generic [ref=e120]:
          - heading "Contact" [level=2] [ref=e121]
          - list [ref=e122]:
            - listitem [ref=e123]:
              - link "information@steg.tn" [ref=e124] [cursor=pointer]:
                - /url: mailto:information@steg.tn
            - listitem [ref=e130]:
              - link "+216 71 234 567" [ref=e131] [cursor=pointer]:
                - /url: tel:+21671234567
      - generic [ref=e136]:
        - paragraph [ref=e137]: © 2026 STEG — Tous droits réservés.
        - paragraph [ref=e138]: Accueil · Stages · Companion
  - button "Open Next.js Dev Tools" [ref=e144] [cursor=pointer]
  - alert [ref=e148]
```

# Test source

```ts
  56  |         tokenType: 'Bearer',
  57  |       }),
  58  |     })
  59  |   );
  60  | 
  61  |   // My profile (loaded after login)
  62  |   await page.route(`${API}/api/auth/me`, (route: Route) =>
  63  |     route.fulfill({
  64  |       status: 200,
  65  |       contentType: 'application/json',
  66  |       body: JSON.stringify({
  67  |         id: 'c1',
  68  |         email: 'e2e.candidate@test.tn',
  69  |         firstName: 'E2E',
  70  |         lastName: 'Candidate',
  71  |         roles: ['ROLE_CANDIDATE'],
  72  |       }),
  73  |     })
  74  |   );
  75  | 
  76  |   // Applications list (track page)
  77  |   await page.route(`${API}/api/applications`, async (route: Route) => {
  78  |     if (route.request().method() === 'GET') {
  79  |       await route.fulfill({
  80  |         status: 200,
  81  |         contentType: 'application/json',
  82  |         body: JSON.stringify([
  83  |           {
  84  |             id: 'app-e2e-1',
  85  |             reference: 'APP-2026-99001',
  86  |             status: 'SUBMITTED',
  87  |             internshipType: 'OBSERVATION',
  88  |             desiredStartDate: '2026-07-01',
  89  |             desiredEndDate: '2026-07-31',
  90  |           },
  91  |         ]),
  92  |       });
  93  |     } else {
  94  |       // POST — new application submission
  95  |       await route.fulfill({
  96  |         status: 201,
  97  |         contentType: 'application/json',
  98  |         body: JSON.stringify({
  99  |           id: 'app-e2e-new',
  100 |           reference: 'APP-2026-99002',
  101 |           status: 'DRAFT',
  102 |         }),
  103 |       });
  104 |     }
  105 |   });
  106 | 
  107 |   // Candidate profile (apply page may load it)
  108 |   await page.route(`${API}/api/candidates/me`, (route: Route) =>
  109 |     route.fulfill({
  110 |       status: 200,
  111 |       contentType: 'application/json',
  112 |       body: JSON.stringify({
  113 |         id: 'c1',
  114 |         firstName: 'E2E',
  115 |         lastName: 'Candidate',
  116 |         email: 'e2e.candidate@test.tn',
  117 |         universityName: 'ENIT',
  118 |         specialization: 'Génie Électrique',
  119 |         level: 'LICENCE_3',
  120 |       }),
  121 |     })
  122 |   );
  123 | }
  124 | 
  125 | function fakeJwt(roles: string[]): string {
  126 |   const header = btoa(JSON.stringify({ alg: 'HS256' }));
  127 |   const payload = btoa(
  128 |     JSON.stringify({ sub: 'c1', email: 'e2e.candidate@test.tn', roles, exp: 9999999999 })
  129 |   );
  130 |   return `${header}.${payload}.sig`;
  131 | }
  132 | 
  133 | // ---------------------------------------------------------------------------
  134 | // Tests
  135 | // ---------------------------------------------------------------------------
  136 | 
  137 | test.describe('Front Office: register → login → apply → track', () => {
  138 |   test.beforeEach(async ({ page }) => {
  139 |     await mockApi(page);
  140 |   });
  141 | 
  142 |   test('home page renders hero and CTA in French', async ({ page }) => {
  143 |     await page.goto(`${BASE}/fr`);
  144 |     // Hero section should be visible — check for any major heading
  145 |     const heading = page.getByRole('heading', { level: 1 });
  146 |     await expect(heading).toBeVisible();
  147 |     // At least one "Apply" / "Postuler" CTA or internship link
  148 |     const cta = page.getByRole('link').filter({ hasText: /postuler|apply|stage|internship/i });
  149 |     await expect(cta.first()).toBeVisible();
  150 |   });
  151 | 
  152 |   test('register page renders form with required fields', async ({ page }) => {
  153 |     await page.goto(`${BASE}/fr/register`);
  154 |     // Form fields
  155 |     await expect(page.getByRole('textbox', { name: /prénom|first.*name/i })).toBeVisible();
> 156 |     await expect(page.getByRole('textbox', { name: /nom|last.*name/i })).toBeVisible();
      |                                                                          ^ Error: expect(locator).toBeVisible() failed
  157 |     await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  158 |   });
  159 | 
  160 |   test('register form submission shows success feedback on valid data', async ({ page }) => {
  161 |     await page.goto(`${BASE}/fr/register`);
  162 | 
  163 |     // Fill required fields
  164 |     const firstNameField = page.getByRole('textbox', { name: /prénom|first.*name/i });
  165 |     const lastNameField = page.getByRole('textbox', { name: /nom de famille|last.*name/i });
  166 |     const emailField = page.getByRole('textbox', { name: /email/i });
  167 |     const passwordField = page.getByLabel(/mot de passe|password/i).first();
  168 | 
  169 |     if (await firstNameField.isVisible()) await firstNameField.fill('E2E');
  170 |     if (await lastNameField.isVisible()) await lastNameField.fill('Candidate');
  171 |     if (await emailField.isVisible()) await emailField.fill('e2e.candidate@test.tn');
  172 |     if (await passwordField.isVisible()) await passwordField.fill('SecurePass!2026');
  173 | 
  174 |     // CIN field
  175 |     const cinField = page.getByLabel(/cin|national.id|numéro/i).first();
  176 |     if (await cinField.isVisible()) await cinField.fill('12345678');
  177 | 
  178 |     // Select university if dropdown is present
  179 |     const uniSelect = page.getByLabel(/université|university/i).first();
  180 |     if (await uniSelect.isVisible()) {
  181 |       await uniSelect.selectOption({ index: 1 });
  182 |     }
  183 | 
  184 |     // Submit
  185 |     const submitBtn = page.getByRole('button', { name: /créer|register|s'inscrire|soumettre/i });
  186 |     await submitBtn.click();
  187 | 
  188 |     // Expect either success message, redirect, or no error displayed
  189 |     // The mock returns 201, so the form should not show an error
  190 |     await page.waitForTimeout(500);
  191 |     const errorVisible = await page.locator('[role="alert"]').filter({ hasText: /erreur|error/i }).isVisible();
  192 |     expect(errorVisible).toBe(false);
  193 |   });
  194 | 
  195 |   test('login page renders email and password fields', async ({ page }) => {
  196 |     await page.goto(`${BASE}/fr/login`);
  197 |     await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  198 |     await expect(page.getByLabel(/mot de passe|password/i).first()).toBeVisible();
  199 |   });
  200 | 
  201 |   test('successful login redirects to authenticated area', async ({ page }) => {
  202 |     await page.goto(`${BASE}/fr/login`);
  203 | 
  204 |     await page.getByRole('textbox', { name: /email/i }).fill('e2e.candidate@test.tn');
  205 |     await page.getByLabel(/mot de passe|password/i).first().fill('SecurePass!2026');
  206 |     await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();
  207 | 
  208 |     // Should navigate away from login (to track, apply, or home)
  209 |     await page.waitForURL(/\/(track|apply|companion|history|fr\/[a-z])/i, { timeout: 5000 }).catch(() => {});
  210 |     const currentUrl = page.url();
  211 |     expect(currentUrl).not.toContain('/login');
  212 |   });
  213 | 
  214 |   test('track page shows application list when authenticated', async ({ page }) => {
  215 |     // Inject a fake token into storage to simulate a logged-in state
  216 |     await page.goto(`${BASE}/fr`);
  217 |     await page.evaluate((token) => {
  218 |       localStorage.setItem('steg-fo-access', token);
  219 |       sessionStorage.setItem('steg-fo-user', JSON.stringify({
  220 |         id: 'c1', email: 'e2e.candidate@test.tn', roles: ['ROLE_CANDIDATE'],
  221 |       }));
  222 |     }, fakeJwt(['ROLE_CANDIDATE']));
  223 | 
  224 |     await page.goto(`${BASE}/fr/track`);
  225 |     // The page should not redirect to login
  226 |     await page.waitForTimeout(500);
  227 |     expect(page.url()).toContain('/track');
  228 |     const errorHeading = page.getByRole('heading', { name: /500|erreur serveur/i });
  229 |     await expect(errorHeading).not.toBeVisible();
  230 |   });
  231 | 
  232 |   test('internships listing page renders publicly', async ({ page }) => {
  233 |     // Internships listing is public (no auth required)
  234 |     await page.route(`${API}/api/internships/public**`, (route: Route) =>
  235 |       route.fulfill({
  236 |         status: 200,
  237 |         contentType: 'application/json',
  238 |         body: JSON.stringify({
  239 |           content: [
  240 |             {
  241 |               id: 'i1',
  242 |               title: 'Stage d\'observation électricité',
  243 |               department: 'Direction Électricité',
  244 |               type: 'OBSERVATION',
  245 |               durationWeeks: 4,
  246 |             },
  247 |           ],
  248 |           totalElements: 1,
  249 |           totalPages: 1,
  250 |           number: 0,
  251 |         }),
  252 |       })
  253 |     );
  254 | 
  255 |     await page.goto(`${BASE}/fr/internships`);
  256 |     // Page should load without error
```