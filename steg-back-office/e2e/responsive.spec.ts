import { test, expect } from '@playwright/test';
import { installMockApi, createMockState, loginAs, withSupervisionBoard } from './mock-backend';

/** Mobile / tablet / desktop: drawer nav, no overflow, dialogs fit the viewport. */
test.describe('responsive', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, createMockState());
  });

  test('mobile drawer navigation works and nothing overflows', async ({ page }) => {
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('.st-shell__side--open')).toBeAttached();
    await page.goto('/applications');
    await page.getByRole('link', { name: 'APP-2026-000123' }).click();
    await expect(page).toHaveURL(/\/applications\/app-1$/);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('dialogs fit small viewports', async ({ page }) => {
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    await page.goto('/applications');
    await page.getByRole('link', { name: 'APP-2026-000123' }).click();
    await page.getByRole('button', { name: 'Commencer l’instruction' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.width).toBeLessThanOrEqual(viewport.width);
  });

  test('200% zoom keeps the dashboard usable without horizontal scroll', async ({ page }) => {
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    await page.evaluate(() => {
      document.body.style.zoom = '200%';
    });
    await expect(page.locator('#st-content')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('supervision table and notification list stay inside the viewport on mobile', async ({
    page,
  }) => {
    await installMockApi(page, withSupervisionBoard(createMockState()));
    await loginAs(page, 'admin@steg.tn', 'ADMIN');

    // Wide tables scroll inside their own container, never the page.
    await page.goto('/supervisor');
    await expect(page.locator('st-data-table tbody tr').first()).toBeVisible();
    const table = await page.evaluate(() => {
      const wrap = document.querySelector('.st-table-wrap') as HTMLElement;
      wrap.scrollLeft = 400;
      const scrolled = wrap.scrollLeft;
      wrap.scrollLeft = 0;
      window.scrollTo(400, 0);
      const docScrolled = window.scrollX;
      window.scrollTo(0, 0);
      const hiddenLow = getComputedStyle(
        document.querySelector('tbody td[data-priority="low"]') as HTMLElement,
      ).display;
      return { scrolled, docScrolled, hiddenLow };
    });
    expect(table.scrolled).toBeGreaterThan(0);
    expect(table.docScrolled).toBe(0);
    // Low-priority columns collapse on small screens (cell + header).
    expect(table.hiddenLow).toBe('none');

    await page.goto('/notifications');
    await expect(page.locator('.st-nc-item').first()).toBeVisible();
    const listScroll = await page.evaluate(() => {
      window.scrollTo(400, 0);
      const docScrolled = window.scrollX;
      window.scrollTo(0, 0);
      return docScrolled;
    });
    expect(listScroll).toBe(0);
  });
});
