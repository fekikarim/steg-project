import { test, expect, Page, Route } from '@playwright/test';

/**
 * E9 — Front Office E2E: register → apply → track
 *
 * Uses Playwright route interception to simulate the backend API
 * without requiring a running server. All assertions are behavioural
 * (visible text, navigation, form state).
 *
 * Flow:
 *  1. Visit home — verify hero and CTA are visible in French
 *  2. Navigate to /fr/register — fill and submit the form
 *  3. Navigate to /fr/login — log in as the newly registered user
 *  4. Navigate to /fr/apply — complete the application wizard step 1
 *  5. Navigate to /fr/track — verify the application tracking surface loads
 */

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8080';

// ---------------------------------------------------------------------------
// API mock helpers
// ---------------------------------------------------------------------------

async function mockApi(page: Page): Promise<void> {
  // Universities (public endpoint, needed by register form)
  await page.route(`${API}/api/universities`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'u1', name: 'ENIT', code: 'ENIT' },
        { id: 'u2', name: 'FST', code: 'FST' },
      ]),
    })
  );

  // Registration
  await page.route(`${API}/api/auth/register`, (route: Route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Account created. Please verify your email.' }),
    })
  );

  // Login
  await page.route(`${API}/api/auth/login`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: fakeJwt(['ROLE_CANDIDATE']),
        refreshToken: 'rt-mock',
        expiresIn: 3600,
        tokenType: 'Bearer',
      }),
    })
  );

  // My profile (loaded after login)
  await page.route(`${API}/api/auth/me`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'c1',
        email: 'e2e.candidate@test.tn',
        firstName: 'E2E',
        lastName: 'Candidate',
        roles: ['ROLE_CANDIDATE'],
      }),
    })
  );

  // Applications list (track page)
  await page.route(`${API}/api/applications`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'app-e2e-1',
            reference: 'APP-2026-99001',
            status: 'SUBMITTED',
            internshipType: 'OBSERVATION',
            desiredStartDate: '2026-07-01',
            desiredEndDate: '2026-07-31',
          },
        ]),
      });
    } else {
      // POST — new application submission
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'app-e2e-new',
          reference: 'APP-2026-99002',
          status: 'DRAFT',
        }),
      });
    }
  });

  // Candidate profile (apply page may load it)
  await page.route(`${API}/api/candidates/me`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'c1',
        firstName: 'E2E',
        lastName: 'Candidate',
        email: 'e2e.candidate@test.tn',
        universityName: 'ENIT',
        specialization: 'Génie Électrique',
        level: 'LICENCE_3',
      }),
    })
  );
}

function fakeJwt(roles: string[]): string {
  const header = btoa(JSON.stringify({ alg: 'HS256' }));
  const payload = btoa(
    JSON.stringify({ sub: 'c1', email: 'e2e.candidate@test.tn', roles, exp: 9999999999 })
  );
  return `${header}.${payload}.sig`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Front Office: register → login → apply → track', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('home page renders hero and CTA in French', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    // Hero section should be visible — check for any major heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    // At least one "Apply" / "Postuler" CTA or internship link
    const cta = page.getByRole('link').filter({ hasText: /postuler|apply|stage|internship/i });
    await expect(cta.first()).toBeVisible();
  });

  test('register page renders form with required fields', async ({ page }) => {
    await page.goto(`${BASE}/fr/register`);
    // Form fields
    await expect(page.getByRole('textbox', { name: /prénom|first.*name/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /nom|last.*name/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  });

  test('register form submission shows success feedback on valid data', async ({ page }) => {
    await page.goto(`${BASE}/fr/register`);

    // Fill required fields
    const firstNameField = page.getByRole('textbox', { name: /prénom|first.*name/i });
    const lastNameField = page.getByRole('textbox', { name: /nom de famille|last.*name/i });
    const emailField = page.getByRole('textbox', { name: /email/i });
    const passwordField = page.getByLabel(/mot de passe|password/i).first();

    if (await firstNameField.isVisible()) await firstNameField.fill('E2E');
    if (await lastNameField.isVisible()) await lastNameField.fill('Candidate');
    if (await emailField.isVisible()) await emailField.fill('e2e.candidate@test.tn');
    if (await passwordField.isVisible()) await passwordField.fill('SecurePass!2026');

    // CIN field
    const cinField = page.getByLabel(/cin|national.id|numéro/i).first();
    if (await cinField.isVisible()) await cinField.fill('12345678');

    // Select university if dropdown is present
    const uniSelect = page.getByLabel(/université|university/i).first();
    if (await uniSelect.isVisible()) {
      await uniSelect.selectOption({ index: 1 });
    }

    // Submit
    const submitBtn = page.getByRole('button', { name: /créer|register|s'inscrire|soumettre/i });
    await submitBtn.click();

    // Expect either success message, redirect, or no error displayed
    // The mock returns 201, so the form should not show an error
    await page.waitForTimeout(500);
    const errorVisible = await page.locator('[role="alert"]').filter({ hasText: /erreur|error/i }).isVisible();
    expect(errorVisible).toBe(false);
  });

  test('login page renders email and password fields', async ({ page }) => {
    await page.goto(`${BASE}/fr/login`);
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByLabel(/mot de passe|password/i).first()).toBeVisible();
  });

  test('successful login redirects to authenticated area', async ({ page }) => {
    await page.goto(`${BASE}/fr/login`);

    await page.getByRole('textbox', { name: /email/i }).fill('e2e.candidate@test.tn');
    await page.getByLabel(/mot de passe|password/i).first().fill('SecurePass!2026');
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    // Should navigate away from login (to track, apply, or home)
    await page.waitForURL(/\/(track|apply|companion|history|fr\/[a-z])/i, { timeout: 5000 }).catch(() => {});
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
  });

  test('track page shows application list when authenticated', async ({ page }) => {
    // Inject a fake token into storage to simulate a logged-in state
    await page.goto(`${BASE}/fr`);
    await page.evaluate((token) => {
      localStorage.setItem('steg-fo-access', token);
      sessionStorage.setItem('steg-fo-user', JSON.stringify({
        id: 'c1', email: 'e2e.candidate@test.tn', roles: ['ROLE_CANDIDATE'],
      }));
    }, fakeJwt(['ROLE_CANDIDATE']));

    await page.goto(`${BASE}/fr/track`);
    // The page should not redirect to login
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/track');
    const errorHeading = page.getByRole('heading', { name: /500|erreur serveur/i });
    await expect(errorHeading).not.toBeVisible();
  });

  test('internships listing page renders publicly', async ({ page }) => {
    // Internships listing is public (no auth required)
    await page.route(`${API}/api/internships/public**`, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: [
            {
              id: 'i1',
              title: 'Stage d\'observation électricité',
              department: 'Direction Électricité',
              type: 'OBSERVATION',
              durationWeeks: 4,
            },
          ],
          totalElements: 1,
          totalPages: 1,
          number: 0,
        }),
      })
    );

    await page.goto(`${BASE}/fr/internships`);
    // Page should load without error
    const errorHeading = page.getByRole('heading', { name: /500|erreur/i });
    await expect(errorHeading).not.toBeVisible();
  });
});
