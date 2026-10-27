# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: candidate-journey.spec.ts >> Front Office: register → login → apply → track >> login page renders email and password fields
- Location: e2e/candidate-journey.spec.ts:195:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('textbox', { name: /email/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('textbox', { name: /email/i }) with timeout 5000ms
  - waiting for getByRole('textbox', { name: /email/i })

```

```yaml
- link "Aller au contenu":
  - /url: "#main-content"
- banner:
  - link "STEG":
    - /url: /fr
    - img "STEG"
  - text: Portail National
  - navigation "Principale":
    - link "Accueil":
      - /url: /fr
    - link "À propos":
      - /url: /fr/about
    - link "Histoire":
      - /url: /fr/history
    - link "Stages":
      - /url: /fr/internships
    - link "Companion":
      - /url: /fr/companion
  - text: Langue
  - combobox "Langue":
    - option "Français" [selected]
    - option "English"
    - option "العربية"
  - text: Thème
  - combobox "Thème":
    - option "Clair"
    - option "Sombre"
    - option "Système" [selected]
  - link "Se connecter":
    - /url: /fr/login
    - button "Se connecter"
  - link "Postuler":
    - /url: /fr/apply
    - button "Postuler"
- main:
  - heading "Connexion" [level=1]
  - paragraph: Accédez à votre espace candidat pour suivre vos candidatures et vos documents.
  - text: Adresse e-mail
  - textbox "Adresse e-mail"
  - text: Mot de passe
  - textbox "Mot de passe"
  - checkbox "Rester connecté"
  - text: Rester connecté
  - paragraph: Fermez la session automatiquement à la fermeture du navigateur.
  - button "Se connecter"
  - link "Mot de passe oublié ?":
    - /url: /fr/forgot-password
  - paragraph:
    - text: Pas encore de compte ?
    - link "Créer un compte":
      - /url: /fr/register
- contentinfo:
  - text: STEG — Direction des Ressources Humaines & Formation Portail National de Gestion Dématérialisée des Stages
  - img "STEG"
  - paragraph: Société Tunisienne de l'Électricité et du Gaz — plateforme des stages.
  - text: Fondée le 3 Avril 1962 Démarche Zéro Papier
  - navigation "Pied de page":
    - heading "Navigation" [level=2]
    - list:
      - listitem:
        - link "Accueil":
          - /url: /fr
      - listitem:
        - link "À propos":
          - /url: /fr/about
      - listitem:
        - link "Histoire":
          - /url: /fr/history
      - listitem:
        - link "Stages":
          - /url: /fr/internships
      - listitem:
        - link "FAQ":
          - /url: /fr/faq
      - listitem:
        - link "Contact":
          - /url: /fr/contact
  - heading "Contact" [level=2]
  - list:
    - listitem:
      - link "information@steg.tn":
        - /url: mailto:information@steg.tn
    - listitem:
      - link "+216 71 234 567":
        - /url: tel:+21671234567
  - paragraph: © 2026 STEG — Tous droits réservés.
  - paragraph: Accueil · Stages · Companion
- alert
```

# Test source

```ts
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
  191 |     const errorVisible = await page.locator('[role="alert"]').filter({ hasText: /erreur|error/i }).isVisible();
  192 |     expect(errorVisible).toBe(false);
  193 |   });
  194 | 
  195 |   test('login page renders email and password fields', async ({ page }) => {
  196 |     await page.goto(`${BASE}/fr/login`);
> 197 |     await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
      |                                                                 ^ Error: expect(locator).toBeVisible() failed
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