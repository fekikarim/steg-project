# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: candidate-journey.spec.ts >> Front Office: register → login → apply → track >> register form submission shows success feedback on valid data
- Location: e2e/candidate-journey.spec.ts:160:7

# Error details

```
Error: locator.isVisible: Error: strict mode violation: locator('[role="alert"]').filter({ hasText: /erreur|error/i }) resolved to 2 elements:
    1) <div role="alert" class="flex w-full flex-col gap-1 rounded-lg border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800 dark:border-accent-900/60 dark:bg-accent-950/40 dark:text-accent-100">…</div> aka getByRole('alert').filter({ hasText: 'Veuillez corriger les erreurs' })
    2) <p role="alert" id="_R_4klritpl5rlb_-error" class="text-xs font-medium text-accent-700 dark:text-accent-100">Une erreur est survenue. Veuillez réessayer.</p> aka getByText('Une erreur est survenue.')

Call log:
    - checking visibility of locator('[role="alert"]').filter({ hasText: /erreur|error/i })

```

# Page snapshot

```yaml
- generic [ref=e1]:
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
        - alert [ref=e33]:
          - generic [ref=e34]: Veuillez corriger les erreurs du formulaire avant de continuer.
        - group "Informations personnelles" [ref=e35]:
          - generic [ref=e37]:
            - generic [ref=e38]:
              - generic [ref=e39]: Prénom*
              - textbox "Prénom" [ref=e40]: E2E
            - generic [ref=e41]:
              - generic [ref=e42]: Nom*
              - textbox "Nom" [invalid] [ref=e43]
              - alert [ref=e44]: Ce champ est obligatoire.
          - generic [ref=e45]:
            - generic [ref=e46]: Numéro de téléphone
            - textbox "Numéro de téléphone" [ref=e47]: "12345678"
            - paragraph [ref=e48]: optionnel
        - group "Informations du compte" [ref=e49]:
          - generic [ref=e51]:
            - generic [ref=e52]: Adresse e-mail*
            - textbox "Adresse e-mail" [invalid] [ref=e53]
            - alert [ref=e54]: Ce champ est obligatoire.
          - generic [ref=e55]:
            - generic [ref=e56]: Mot de passe*
            - generic [ref=e57]:
              - textbox "Mot de passe" [ref=e58]: SecurePass!2026
              - button "Afficher le mot de passe" [ref=e59] [cursor=pointer]
            - meter "Solidité du mot de passe" [ref=e63]
            - paragraph [ref=e69]: Au moins 8 caractères, avec une majuscule, un chiffre et un caractère spécial.
          - generic [ref=e70]:
            - generic [ref=e71]: Confirmer le mot de passe*
            - generic [ref=e72]:
              - textbox "Confirmer le mot de passe" [invalid] [ref=e73]
              - button "Afficher le mot de passe" [ref=e74] [cursor=pointer]
            - alert [ref=e78]: Ce champ est obligatoire.
        - generic [ref=e80]:
          - generic [ref=e81]:
            - checkbox "J'accepte les conditions d'utilisation et la politique de confidentialité." [invalid] [ref=e82] [cursor=pointer]
            - generic [ref=e83] [cursor=pointer]: J'accepte les conditions d'utilisation et la politique de confidentialité.
          - alert [ref=e84]: Une erreur est survenue. Veuillez réessayer.
        - button "Créer mon compte" [active] [ref=e85] [cursor=pointer]
        - paragraph [ref=e86]:
          - text: Vous avez déjà un compte ?
          - link "Se connecter" [ref=e87] [cursor=pointer]:
            - /url: /fr/login
  - contentinfo [ref=e88]:
    - generic [ref=e89]:
      - generic [ref=e90]:
        - generic [ref=e91]: STEG — Direction des Ressources Humaines & Formation
        - generic [ref=e94]: Portail National de Gestion Dématérialisée des Stages
      - generic [ref=e96]:
        - generic [ref=e97]:
          - img "STEG" [ref=e100]
          - paragraph [ref=e101]: Société Tunisienne de l'Électricité et du Gaz — plateforme des stages.
          - generic [ref=e102]:
            - generic [ref=e103]: Fondée le 3 Avril 1962
            - generic [ref=e104]: Démarche Zéro Papier
        - navigation "Pied de page" [ref=e105]:
          - heading "Navigation" [level=2] [ref=e106]
          - list [ref=e107]:
            - listitem [ref=e108]:
              - link "Accueil" [ref=e109] [cursor=pointer]:
                - /url: /fr
            - listitem [ref=e112]:
              - link "À propos" [ref=e113] [cursor=pointer]:
                - /url: /fr/about
            - listitem [ref=e116]:
              - link "Histoire" [ref=e117] [cursor=pointer]:
                - /url: /fr/history
            - listitem [ref=e120]:
              - link "Stages" [ref=e121] [cursor=pointer]:
                - /url: /fr/internships
            - listitem [ref=e124]:
              - link "FAQ" [ref=e125] [cursor=pointer]:
                - /url: /fr/faq
            - listitem [ref=e128]:
              - link "Contact" [ref=e129] [cursor=pointer]:
                - /url: /fr/contact
        - generic [ref=e132]:
          - heading "Contact" [level=2] [ref=e133]
          - list [ref=e134]:
            - listitem [ref=e135]:
              - link "information@steg.tn" [ref=e136] [cursor=pointer]:
                - /url: mailto:information@steg.tn
            - listitem [ref=e142]:
              - link "+216 71 234 567" [ref=e143] [cursor=pointer]:
                - /url: tel:+21671234567
      - generic [ref=e148]:
        - paragraph [ref=e149]: © 2026 STEG — Tous droits réservés.
        - paragraph [ref=e150]: Accueil · Stages · Companion
  - button "Open Next.js Dev Tools" [ref=e156] [cursor=pointer]
  - alert [ref=e160]
```

# Test source

```ts
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
  156 |     await expect(page.getByRole('textbox', { name: /nom|last.*name/i })).toBeVisible();
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
> 191 |     const errorVisible = await page.locator('[role="alert"]').filter({ hasText: /erreur|error/i }).isVisible();
      |                                                                                                    ^ Error: locator.isVisible: Error: strict mode violation: locator('[role="alert"]').filter({ hasText: /erreur|error/i }) resolved to 2 elements:
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
  257 |     const errorHeading = page.getByRole('heading', { name: /500|erreur/i });
  258 |     await expect(errorHeading).not.toBeVisible();
  259 |   });
  260 | });
  261 | 
```