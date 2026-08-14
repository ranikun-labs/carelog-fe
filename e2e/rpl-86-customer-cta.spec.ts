import { expect, test, useEmptyApplicationSeed } from './fixtures';
import type { Locator } from '@playwright/test';

async function expectPrimaryCreateLink(link: Locator) {
  await expect(link).toHaveAttribute('href', '/app/customers/new');
  await expect(link).toHaveClass(/\bbg-accent-primary\b/);
  const box = await link.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test('non-empty Customers exposes the existing create route as a primary keyboard CTA', async ({
  page,
}) => {
  await page.goto('/app/customers');

  const cta = page.getByRole('link', { name: '+ 고객 추가', exact: true });
  await expectPrimaryCreateLink(cta);
  await expect(page.getByRole('link', { name: '첫 고객 추가', exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/app/customers/new"]')).toHaveCount(1);

  await cta.focus();
  await page.waitForTimeout(250);
  const focus = await cta.evaluate((element) => {
    const accentProbe = document.createElement('span');
    accentProbe.style.color = 'var(--accent-primary)';
    document.body.append(accentProbe);
    const accentColor = getComputedStyle(accentProbe).color;
    accentProbe.remove();

    const style = getComputedStyle(element);
    return {
      accentColor,
      outlineColor: style.outlineColor,
      outlineOffset: style.outlineOffset,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  expect(focus.outlineColor).toBe(focus.accentColor);
  expect(focus).toMatchObject({
    outlineOffset: '2px',
    outlineStyle: 'solid',
    outlineWidth: '2px',
  });

  await cta.press('Enter');
  await expect(page).toHaveURL('/app/customers/new');
  await expect(page.locator('[data-customer-create-page]')).toBeVisible();
});

test('Customer0 keeps the existing first-customer CTA and route', async ({ page }) => {
  await useEmptyApplicationSeed(page);
  await page.goto('/app/customers');

  const cta = page.getByRole('link', { name: '첫 고객 추가', exact: true });
  await expectPrimaryCreateLink(cta);
  await expect(page.getByRole('link', { name: '+ 고객 추가', exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/app/customers/new"]')).toHaveCount(1);
  await cta.press('Enter');
  await expect(page).toHaveURL('/app/customers/new');
  await expect(page.locator('[data-customer-create-page]')).toBeVisible();
});

test('Schedule Customer0 uses the same primary first-customer CTA', async ({ page }) => {
  await useEmptyApplicationSeed(page);
  await page.goto('/app/schedule');

  const cta = page.getByRole('link', { name: '첫 고객 추가', exact: true });
  await expectPrimaryCreateLink(cta);
  await cta.press('Enter');
  await expect(page).toHaveURL('/app/customers/new');
  await expect(page.locator('[data-customer-create-page]')).toBeVisible();
});
