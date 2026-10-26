import { randomUUID } from 'node:crypto';
import { expect, test, type Page, type Response } from '@playwright/test';

const CUSTOMER_API_PATH = '/api/v1/users/customers';
const CUSTOMER_EVENTS_API_PATH = '/api/v1/customer-events';
const LOGIN_API_PATH = '/api/v1/auth/login';
const LOGOUT_API_PATH = '/api/v1/auth/logout';

interface CapturedCustomerEventsRead {
  customerId: string | null;
  body: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function responseData(payload: unknown, httpStatus: number): unknown {
  if (
    !isRecord(payload) ||
    typeof payload.status !== 'number' ||
    !Number.isInteger(payload.status) ||
    typeof payload.message !== 'string' ||
    !Object.prototype.hasOwnProperty.call(payload, 'data')
  ) {
    throw new Error('Carelog API response envelope is invalid.');
  }
  if (payload.status !== httpStatus) {
    throw new Error('Carelog API envelope status does not match HTTP status.');
  }
  return payload.data;
}

function responseReadbackState(errors: readonly string[], found: boolean): string {
  if (errors[0]) return `API response capture failed: ${errors[0]}`;
  return found ? 'matched' : 'pending';
}

function customerListContains(body: unknown, customerId: string, displayName: string): boolean {
  return (
    Array.isArray(body) &&
    body.some(
      (customer) =>
        isRecord(customer) &&
        customer.publicId === customerId &&
        customer.displayName === displayName,
    )
  );
}

function customerEventsContain(body: unknown, eventId: string, descriptor: string): boolean {
  return (
    Array.isArray(body) &&
    body.some((event) => isRecord(event) && event.id === eventId && event.descriptor === descriptor)
  );
}

async function expectSuccessful(response: Response): Promise<void> {
  expect(
    response.status(),
    `${response.request().method()} ${new URL(response.url()).pathname} must succeed`,
  ).toBeGreaterThanOrEqual(200);
  expect(response.status()).toBeLessThan(300);
}

async function loginThroughUi(page: Page, account: string, password: string): Promise<void> {
  await page.locator('[data-auth-form] input[name="account"]').fill(account);
  await page.locator('[data-auth-form] input[name="secret"]').fill(password);
  const loginResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST' && url.pathname === LOGIN_API_PATH;
  });
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expectSuccessful(await loginResponsePromise);
  await expect(page.locator('[data-app-shell]')).toBeVisible();
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
  const { year, month, day, hour, minute } = values;
  if (!year || !month || !day || !hour || !minute) {
    throw new Error('Could not create the required future Asia/Seoul schedule time.');
  }
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

test('real Identity login persists a customer and event across logout and re-login', async ({
  page,
}) => {
  const disposable = process.env.CARELOG_E2E_DISPOSABLE;
  const accountA = process.env.CARELOG_E2E_ACCOUNT_A?.trim();
  const passwordA = process.env.CARELOG_E2E_PASSWORD_A;
  const gatewayTarget = process.env.CARELOG_E2E_GATEWAY_TARGET;
  expect(disposable).toBe('1');
  expect(accountA).toBeTruthy();
  expect(passwordA).toBeTruthy();
  expect(gatewayTarget).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);

  const customerListReads: unknown[] = [];
  const customerEventReads: CapturedCustomerEventsRead[] = [];
  const responseReadErrors: string[] = [];
  let capturePostLoginReads = false;
  page.on('response', (response) => {
    void (async () => {
      const request = response.request();
      if (!capturePostLoginReads || request.method() !== 'GET' || !response.ok()) return;

      const url = new URL(response.url());
      if (url.pathname === CUSTOMER_API_PATH) {
        customerListReads.push(responseData(await response.json(), response.status()));
        return;
      }
      if (url.pathname === CUSTOMER_EVENTS_API_PATH) {
        customerEventReads.push({
          customerId: url.searchParams.get('customerId'),
          body: responseData(await response.json(), response.status()),
        });
      }
    })().catch((error: unknown) => {
      responseReadErrors.push(
        error instanceof Error ? error.message : 'Carelog API response capture failed.',
      );
    });
  });

  const uniqueSuffix = randomUUID();
  const customerName = `Batch 5 고객 ${uniqueSuffix}`;
  const customerMemo = `Batch 5 실 API ${uniqueSuffix}`;
  const eventName = `Batch 5 일정 ${uniqueSuffix}`;

  await page.goto('/auth/login');
  await loginThroughUi(page, accountA!, passwordA!);

  await page.locator('[data-side-navigation] a[href="/app/customers"]').click();
  await expect(page.locator('[data-customers-page]')).toBeVisible();
  const customerCreateCta = page.locator('[data-first-customer-cta], [data-customer-add-cta]');
  await expect(customerCreateCta).toHaveCount(1);
  await customerCreateCta.click();
  await expect(page.locator('[data-customer-create-page]')).toBeVisible();

  await page.locator('[data-customer-field="displayName"]').fill(customerName);
  await page.locator('[data-customer-field="customerMemo"]').fill(customerMemo);
  const customerCreateResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST' && url.pathname === CUSTOMER_API_PATH;
  });
  await page.locator('[data-customer-form-submit]').click();
  const customerCreateResponse = await customerCreateResponsePromise;
  await expectSuccessful(customerCreateResponse);
  const customerCreateBody = responseData(
    await customerCreateResponse.json(),
    customerCreateResponse.status(),
  );
  const customerPublicId = isRecord(customerCreateBody) ? customerCreateBody.publicId : undefined;
  expect(typeof customerPublicId).toBe('string');

  await expect(page.locator('[data-customer-detail-page]')).toBeVisible();
  const customerId = await page
    .locator('[data-customer-detail-page]')
    .getAttribute('data-selected-customer-id');
  expect(customerId).toBe(customerPublicId);
  if (!customerId) throw new Error('The created customer has no server-assigned public ID.');

  await page.locator('[data-add-event]').click();
  await expect(page.locator('[data-event-form]')).toBeVisible();
  await page.locator('[data-event-field="descriptor"]').fill(eventName);
  await page.locator('[data-event-field="scheduledAt"]').fill(seoulDateTimeLocalAfterOneHour());
  const eventCreateResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST' && url.pathname === CUSTOMER_EVENTS_API_PATH;
  });
  await page.locator('[data-event-form-submit]').click();
  const eventCreateResponse = await eventCreateResponsePromise;
  await expectSuccessful(eventCreateResponse);
  const eventCreateBody = responseData(
    await eventCreateResponse.json(),
    eventCreateResponse.status(),
  );
  const createdEventId = isRecord(eventCreateBody) ? eventCreateBody.id : undefined;
  expect(typeof createdEventId).toBe('string');
  if (typeof createdEventId !== 'string') {
    throw new Error('The created event has no server-assigned ID.');
  }

  const upcomingEventLink = page.locator('[data-upcoming-primary]');
  await expect(upcomingEventLink).toContainText(eventName);
  expect(await upcomingEventLink.getAttribute('href')).toContain(createdEventId);
  const eventId = createdEventId;

  await page.locator('[data-side-navigation] a[href="/app/settings"]').click();
  const logoutResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST' && url.pathname === LOGOUT_API_PATH;
  });
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expectSuccessful(await logoutResponsePromise);
  await expect(page.locator('[data-app-shell]')).toBeHidden();
  await expect(page.locator('[data-auth-entry]')).toBeVisible();
  customerListReads.length = 0;
  customerEventReads.length = 0;
  capturePostLoginReads = true;

  await page.locator('[data-auth-entry] a[href="/auth/login"]').click();
  await loginThroughUi(page, accountA!, passwordA!);
  await page.locator('[data-side-navigation] a[href="/app/customers"]').click();
  await expect(page.locator('[data-customers-page]')).toBeVisible();

  const customerCard = page.locator('[data-customer-card]').filter({ hasText: customerName });
  await expect(customerCard).toHaveCount(1);
  await expect(customerCard).toHaveAttribute('data-customer-id', customerId);
  await expect
    .poll(() =>
      responseReadbackState(
        responseReadErrors,
        customerListReads.some((body) => customerListContains(body, customerId, customerName)),
      ),
    )
    .toBe('matched');

  await customerCard.locator('a').click();
  await expect(page.locator('[data-customer-detail-page]')).toHaveAttribute(
    'data-selected-customer-id',
    customerId,
  );
  const rereadUpcomingEventLink = page.locator('[data-upcoming-primary]');
  await expect(rereadUpcomingEventLink).toContainText(eventName);
  expect(await rereadUpcomingEventLink.getAttribute('href')).toContain(eventId);
  await expect
    .poll(() =>
      responseReadbackState(
        responseReadErrors,
        customerEventReads.some(
          (read) =>
            read.customerId === customerId && customerEventsContain(read.body, eventId, eventName),
        ),
      ),
    )
    .toBe('matched');
});
