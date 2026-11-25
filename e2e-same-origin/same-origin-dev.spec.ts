import { expect, test, type Page } from '@playwright/test';

import { handleDevEdgeRequest, type DevEdgeEnv } from '../worker/src/dev-edge';
import { createMockGateway } from './mock-gateway';

// Requests reach the Worker handler through Playwright's route interception, so the
// same code that the DEV edge runs answers the page. The Gateway behind it is the mock.
const GATEWAY_ORIGIN = 'https://gateway.dev.example.test';
const REFRESH_KEY = 'carelog.auth.refreshToken';

async function refreshTokenInSession(page: Page): Promise<string | null> {
  return page.evaluate((key) => sessionStorage.getItem(key), REFRESH_KEY);
}

async function persistedStorageText(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
}

function seoulDateTimeLocalAfterOneHour(): string {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(Date.now() + 60 * 60 * 1000))
      .map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

test('signup, password login, reload, save, reload, logout work through the same-origin edge', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const gateway = createMockGateway({ allowedOrigin: origin });
  const env: DevEdgeEnv = { GATEWAY_ORIGIN, PUBLIC_ORIGIN: origin };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const postData = request.postDataBuffer();
    const response = await handleDevEdgeRequest(
      new Request(request.url(), {
        method: request.method(),
        headers: await request.allHeaders(),
        body: postData ? new Uint8Array(postData) : undefined,
      }),
      env,
      gateway.fetch,
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });

  const account = 'therapist-e2e';
  const password = 'correct-horse-1';
  const customerName = `E2E 고객 ${Date.now()}`;
  const eventName = `E2E 일정 ${Date.now()}`;

  // 1. Self-service signup signs the user in with the password login.
  await page.goto('/auth/signup');
  await page.locator('[data-auth-field="account"]').fill(account);
  await page.locator('[data-auth-field="name"]').fill('김치료');
  await page.locator('[data-auth-field="email"]').fill('therapist-e2e@example.test');
  await page.locator('[data-auth-field="secret"]').fill(password);
  await page.locator('[data-auth-field="secretConfirmation"]').fill(password);
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page.locator('[data-app-shell]')).toBeVisible();
  const firstRefresh = await refreshTokenInSession(page);
  expect(firstRefresh).toMatch(/^rt-/);

  // The access token never reaches browser storage; only the refresh token does.
  const accessToken = gateway.lastAccessToken();
  expect(accessToken).toBeDefined();
  expect(await persistedStorageText(page)).not.toContain(accessToken!);

  // 2. Logout clears the refresh token before the request settles, then password login.
  await page.locator('[data-side-navigation] a[href="/app/settings"]').click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.locator('[data-auth-entry]')).toBeVisible();
  expect(await refreshTokenInSession(page)).toBeNull();

  await page.locator('[data-auth-entry] a[href="/auth/login"]').click();
  await page.locator('[data-auth-field="account"]').fill(account);
  await page.locator('[data-auth-field="secret"]').fill(password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.locator('[data-app-shell]')).toBeVisible();

  // 3. Save a customer and a schedule event through the edge.
  await page.locator('[data-side-navigation] a[href="/app/customers"]').click();
  await page.locator('[data-first-customer-cta], [data-customer-add-cta]').click();
  await page.locator('[data-customer-field="displayName"]').fill(customerName);
  await page.locator('[data-customer-field="customerMemo"]').fill('same-origin e2e');
  await page.locator('[data-customer-form-submit]').click();
  await expect(page.locator('[data-customer-detail-page]')).toBeVisible();
  const customerId = await page
    .locator('[data-customer-detail-page]')
    .getAttribute('data-selected-customer-id');
  expect(customerId).toBeTruthy();

  await page.locator('[data-add-event]').click();
  await page.locator('[data-event-field="descriptor"]').fill(eventName);
  await page.locator('[data-event-field="scheduledAt"]').fill(seoulDateTimeLocalAfterOneHour());
  await page.locator('[data-event-form-submit]').click();
  await expect(page.locator('[data-upcoming-primary]')).toContainText(eventName);

  // 4. Reload: the refresh token restores the session and the data is read back.
  const refreshesBeforeReload = gateway.refreshCount();
  await page.reload();
  await expect(page.locator('[data-app-shell]')).toBeVisible();
  expect(gateway.refreshCount()).toBeGreaterThan(refreshesBeforeReload);
  await expect(await refreshTokenInSession(page)).not.toBe(firstRefresh);

  await page.locator('[data-side-navigation] a[href="/app/customers"]').click();
  const customerCard = page.locator('[data-customer-card]').filter({ hasText: customerName });
  await expect(customerCard).toHaveCount(1);
  await customerCard.locator('a').click();
  await expect(page.locator('[data-customer-detail-page]')).toHaveAttribute(
    'data-selected-customer-id',
    customerId!,
  );
  await expect(page.locator('[data-upcoming-primary]')).toContainText(eventName);

  // 5. API errors come back as JSON from the edge, never as an HTML page.
  const unknownRoute = await page.evaluate(async () => {
    const response = await fetch('/api/v1/not-a-route');
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      text: await response.text(),
    };
  });
  expect(unknownRoute.status).toBe(404);
  expect(unknownRoute.contentType).toContain('application/json');
  expect(unknownRoute.text).not.toMatch(/<!doctype|<html/i);
  expect(JSON.parse(unknownRoute.text)).toEqual({ status: 404, message: 'Not found.' });

  const duplicateSignup = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/carelog/registration', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        userId: 'therapist-e2e',
        email: 'other@example.test',
        password: 'another-secret-1',
        name: '다른 사람',
      }),
    });
    return { status: response.status, text: await response.text() };
  });
  expect(duplicateSignup.status).toBe(409);
  expect(JSON.parse(duplicateSignup.text)).toMatchObject({ status: 409 });

  // 6. Logout; a wrong password shows the copy and no SPA markup.
  await page.locator('[data-side-navigation] a[href="/app/settings"]').click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.locator('[data-auth-entry]')).toBeVisible();
  expect(await refreshTokenInSession(page)).toBeNull();
  expect(await persistedStorageText(page)).not.toContain(accessToken!);

  await page.locator('[data-auth-entry] a[href="/auth/login"]').click();
  await page.locator('[data-auth-field="account"]').fill(account);
  await page.locator('[data-auth-field="secret"]').fill('wrong-password-1');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.locator('[role="alert"]')).toContainText('계정 정보를 확인할 수 없습니다');
  await expect(page.locator('[data-app-shell]')).toHaveCount(0);

  // Every Gateway call the page made was a same-origin relative call through the edge.
  expect(
    gateway.requestLog.some((line) => line.includes('/api/v1/auth/carelog/registration')),
  ).toBe(true);
});
