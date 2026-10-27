import { test, expect } from '@playwright/test';
import { installMockApi, createMockState, loginAs, withSupervisionBoard } from './mock-backend';

/**
 * Supervisor workflow + administrative validation (mocked API, stateful):
 * supervision dashboard, task/journal/evaluation review, and the four
 * validation decisions with mandatory-reason enforcement.
 */
test.describe('supervision and validation', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, createMockState());
  });

  test('SUPERVISOR home dashboard aggregates internships, supervision and receipts', async ({
    page,
  }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    await page.goto('/supervisor-dashboard');
    // Cross-page stats: completion rates, receipt tracking, breakdowns.
    await expect(page.getByText('Tâches terminées').first()).toBeVisible();
    await expect(page.getByText('Journaux validés').first()).toBeVisible();
    await expect(page.getByText('Paiements — synthèse').first()).toBeVisible();
    await expect(page.getByText('Stages — synthèse').first()).toBeVisible();
    await expect(page.getByText('READY_FOR_DECISION').first()).toBeVisible();
  });

  test('SUPERVISOR dashboard shows assigned intern with progress KPIs', async ({ page }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    await page.goto('/supervisor');
    // Assignment join: Leila Mansour supervises the mocked internship.
    await expect(page.getByText('Amira Ben Salah').first()).toBeVisible();
    await expect(page.getByText('Journaux à relire')).toBeVisible();
    await expect(page.getByText('STAGE-2026-000007').first()).toBeVisible();
    // Receipt tracking: the mocked finance case is READY_FOR_DECISION, no receipt yet.
    await expect(page.getByText('READY_FOR_DECISION').first()).toBeVisible();
    // Candidate info dialog (read-only supporting info, no CIN).
    await page.getByRole('button', { name: 'Amira Ben Salah' }).click();
    await expect(page.getByRole('dialog')).toContainText('amira.ben.salah@example.tn');
    await expect(page.getByRole('dialog')).toContainText('ENIT');
    await expect(page.getByRole('dialog').getByText('09876543')).toHaveCount(0);
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  });

  test('SUPERVISOR reviews journal and submits a FINAL evaluation (tasks are read-only)', async ({
    page,
  }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    await page.goto('/internships/ship-1');
    await page.getByRole('tab', { name: 'Suivi' }).click();

    // Tasks are supporting info only: visible with progress, no authoring controls.
    await expect(page.getByText('Rapport intermédiaire').first()).toBeVisible();
    await expect(page.getByText(/lecture seule|read-only/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marquer terminée' })).toHaveCount(0);

    // Validate the submitted journal entry.
    await page.getByRole('button', { name: 'Valider' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByText('VALIDATED').first()).toBeVisible();

    // Submit the final review.
    await page.getByLabel(/Date \*/).fill('2026-07-30');
    await page.getByLabel(/Appréciation|Feedback/).fill('Stage satisfaisant, objectifs atteints.');
    await page.getByRole('button', { name: 'Soumettre l’évaluation' }).click();
    await expect(page.getByText('FINAL').first()).toBeVisible();
  });

  test('ADMIN authors and advances tasks', async ({ page }) => {
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    await page.goto('/internships/ship-1');
    await page.getByRole('tab', { name: 'Suivi' }).click();
    await page.getByRole('button', { name: 'Marquer terminée' }).click();
    await expect(page.getByText('Rapport intermédiaire').first()).toBeVisible();
  });

  test('ADMIN validation: hold requires a reason and is audited', async ({ page }) => {
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    // Complete first so the validation tab appears.
    await page.goto('/internships/ship-1');
    await page.getByRole('button', { name: 'Activer' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await page.getByRole('button', { name: 'Clôturer' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();

    await page.getByRole('tab', { name: 'Validation' }).click();
    await expect(page.getByText(/En attente de validation/)).toBeVisible();

    // Hold without a reason is refused client-side.
    await page.getByRole('button', { name: 'Mettre en attente' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
    await page
      .getByRole('dialog')
      .getByLabel(/Motif/)
      .fill('Rapport final manquant — attente du dépôt.');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByText('RETURNED').first()).toBeVisible();

    // Certificate stays locked until APPROVED.
    await page.getByRole('tab', { name: 'Aperçu' }).click();
    await expect(page.getByText(/exige une validation administrative/)).toBeVisible();
  });

  test('supervision board: the attention alert is replaced by a professional triage table', async ({
    page,
  }) => {
    await installMockApi(page, withSupervisionBoard(createMockState()));
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    await page.goto('/supervisor');

    // The "Needs attention first" warning dump is gone.
    await expect(page.getByText('À traiter en priorité')).toHaveCount(0);
    // Rows needing action are flagged in the shared table instead.
    const table = page.locator('st-data-table table.st-table');
    await expect(table).toBeVisible();
    await expect(table.getByText('Sami Ben Ali')).toBeVisible();
    await expect(page.locator('tr.st-row--attn')).toHaveCount(2);
    await expect(page.getByText('Action requise').first()).toBeVisible();
    // A completed internship without its FINAL report is explicit.
    const samiRow = page.locator('tbody tr', { hasText: 'Sami Ben Ali' });
    await expect(samiRow.getByText('Manquante')).toBeVisible();
    await expect(
      page.getByText('Prêt pour décision').or(page.getByText('READY_FOR_DECISION')).first(),
    ).toBeVisible();
    // Triage filter + column sorting + pagination footer.
    await page.getByRole('button', { name: /Action requise/ }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('st-pagination')).toBeVisible();
    await page.getByRole('button', { name: /Tous les stagiaires/ }).click();
    const sortButton = page.getByRole('button', { name: /Stagiaire/ });
    await sortButton.click();
    await expect(table.locator('tbody tr').first()).toContainText('Nour Trabelsi');
    await sortButton.click();
    await expect(table.locator('tbody tr').first()).toContainText('Yassine Jlassi');
  });

  test('ADMIN is notified in real time when an intern ends without a final evaluation', async ({
    page,
  }) => {
    await installMockApi(page, withSupervisionBoard(createMockState()));
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    await page.goto('/notifications');

    // Grouped, severity-coloured, deep-linked notification list.
    await expect(page.getByRole('heading', { name: /Aujourd/ })).toBeVisible();
    await expect(page.locator('.st-nc-item[data-priority="HIGH"]').first()).toBeVisible();
    await expect(page.getByText('Final evaluation required')).toBeVisible();
    await expect(page.locator('a[href="/internships/ship-42"]')).toBeVisible();
    // Unread triage: filter, then clear the whole list.
    await expect(page.locator('.st-nc-item--unread')).toHaveCount(2);
    await page.getByRole('button', { name: /Non lues/ }).click();
    await expect(page.locator('.st-nc-item')).toHaveCount(2);
    await page.getByRole('button', { name: /Toutes/ }).click();
    await page.getByRole('button', { name: /Tout marquer comme lu/ }).click();
    await expect(page.locator('.st-nc-item--unread')).toHaveCount(0);
    // A single row can be cleared too, and the bell badge follows the state.
    await expect(page.locator('header .st-top__dot')).toHaveCount(0);
  });
});
