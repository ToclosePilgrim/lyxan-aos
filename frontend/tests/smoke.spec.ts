import { test, expect } from '@playwright/test';

test.describe('Frontend Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });

    // Listen for page errors
    const errors: any[] = [];
    page.on('pageerror', (error) => {
      errors.push(error);
      console.error('Page error:', error.message);
    });

    // Store errors for later assertion
    (page as any).__errors = errors;
  });

  test('Production Orders new page loads without errors', async ({ page }) => {
    const errors: any[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/scm/production-orders/new');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Check URL
    await expect(page).toHaveURL(/production-orders/);
    
    // Check no console errors
    expect(errors.length).toBe(0);
    
    // Check page is not blank
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toBeNull();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('Warehouses new page loads without errors', async ({ page }) => {
    const errors: any[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/scm/warehouses/new');
    
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    await expect(page).toHaveURL(/warehouses/);
    expect(errors.length).toBe(0);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toBeNull();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('Supplies new page loads without errors', async ({ page }) => {
    const errors: any[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/scm/supplies/new');
    
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    await expect(page).toHaveURL(/supplies/);
    expect(errors.length).toBe(0);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toBeNull();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('Finance Documents page loads without errors', async ({ page }) => {
    const errors: any[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/finance/documents');
    
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    await expect(page).toHaveURL(/documents/);
    expect(errors.length).toBe(0);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toBeNull();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('Select components do not break the application', async ({ page }) => {
    const errors: any[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/scm/production-orders/new');
    
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Try to find and interact with Select components
    const selectTriggers = await page.locator('[role="combobox"]').all();
    
    // If selects exist, try to click them (should not cause errors)
    if (selectTriggers.length > 0) {
      for (const select of selectTriggers.slice(0, 3)) {
        try {
          await select.click({ timeout: 2000 });
          await page.keyboard.press('Escape'); // Close dropdown
        } catch (e) {
          // Ignore timeout errors
        }
      }
    }
    
    expect(errors.length).toBe(0);
  });

  test('Forms load data without errors', async ({ page }) => {
    const errors: any[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/scm/warehouses/new');
    
    // Wait for any data loading
    await page.waitForTimeout(2000);
    
    // Check that page is interactive
    const inputs = await page.locator('input').count();
    expect(inputs).toBeGreaterThan(0);
    
    expect(errors.length).toBe(0);
  });
});

