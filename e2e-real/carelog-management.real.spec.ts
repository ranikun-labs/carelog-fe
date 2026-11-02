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

interface ExpectedCustomerEventReadback {
  id: string;
  status: 'OCCURRED' | 'CANCELLED' | 'PLANNED';
  descriptor: string;
  scheduledAt?: string;
  occurredAt?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} response data is not an object.`);
  return value;
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

function customerListContains(
  body: unknown,
  customerId: string,
  displayName: string,
  customerMemo: string,
): boolean {
  return (
    Array.isArray(body) &&
    body.some(
      (customer) =>
        isRecord(customer) &&
        customer.publicId === customerId &&
        customer.displayName === displayName &&
        customer.customerMemo === customerMemo,
    )
  );
}

function timestampMatchesSeoulLocalTime(value: unknown, localTime: string): boolean {
  return typeof value === 'string' && Date.parse(value) === Date.parse(`${localTime}:00+09:00`);
}

function customerEventsContain(body: unknown, expected: ExpectedCustomerEventReadback): boolean {
  return (
    Array.isArray(body) &&
    body.some((event) => {
      if (
        !isRecord(event) ||
        event.id !== expected.id ||
        event.status !== expected.status ||
        event.descriptor !== expected.descriptor
      ) {
        return false;
      }
      return (
        (expected.scheduledAt === undefined ||
          timestampMatchesSeoulLocalTime(event.scheduledAt, expected.scheduledAt)) &&
        (expected.occurredAt === undefined ||
          timestampMatchesSeoulLocalTime(event.occurredAt, expected.occurredAt))
      );
    })
  );
}

async function expectSuccessful(response: Response): Promise<void> {
  expect(
    response.status(),
    `${response.request().method()} ${new URL(response.url()).pathname} must succeed`,
  ).toBeGreaterThanOrEqual(200);
  expect(response.status()).toBeLessThan(300);
}

function waitForApiResponse(page: Page, method: string, pathname: string): Promise<Response> {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === method && url.pathname === pathname;
  });
}

async function loginThroughUi(page: Page, account: string, password: string): Promise<void> {
  await page.locator('[data-auth-form] input[name="account"]').fill(account);
  await page.locator('[data-auth-form] input[name="secret"]').fill(password);
  const loginResponsePromise = waitForApiResponse(page, 'POST', LOGIN_API_PATH);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expectSuccessful(await loginResponsePromise);
  await expect(page.locator('[data-app-shell]')).toBeVisible();
}

async function logoutThroughUi(page: Page): Promise<void> {
  await page.locator('[data-side-navigation] a[href="/app/settings"]').click();
  const logoutResponsePromise = waitForApiResponse(page, 'POST', LOGOUT_API_PATH);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expectSuccessful(await logoutResponsePromise);
  await expect(page.locator('[data-app-shell]')).toBeHidden();
  await expect(page.locator('[data-auth-entry]')).toBeVisible();
}

async function openCustomerDetail(page: Page, customerId: string, displayName: string) {
  await page.locator('[data-side-navigation] a[href="/app/customers"]').click();
  await expect(page.locator('[data-customers-page]')).toBeVisible();
  const customerCard = page
    .locator(`[data-customer-card][data-customer-id="${customerId}"]`)
    .filter({ hasText: displayName });
  await expect(customerCard).toHaveCount(1);
  await customerCard.locator('a').click();
  await expect(page.locator('[data-customer-detail-page]')).toHaveAttribute(
    'data-selected-customer-id',
    customerId,
  );
}

function seoulDateTimeLocalAfterMinutes(offsetMinutes: number): string {
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
      .formatToParts(new Date(Date.now() + offsetMinutes * 60 * 1000))
      .map(({ type, value }) => [type, value]),
  );
  const { year, month, day, hour, minute } = values;
  if (!year || !month || !day || !hour || !minute) {
    throw new Error('Could not create the required Asia/Seoul date and time.');
  }
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function expectTimestampAtSeoulLocalTime(value: unknown, localTime: string): void {
  expect(typeof value).toBe('string');
  if (typeof value !== 'string') throw new Error('Carelog API timestamp is missing.');
  expect(Date.parse(value)).toBe(Date.parse(`${localTime}:00+09:00`));
}

test('real API customer edit and event management persist across readbacks', async ({ page }) => {
  const disposable = process.env.CARELOG_E2E_DISPOSABLE;
  const accountA = process.env.CARELOG_E2E_ACCOUNT_A?.trim();
  const passwordA = process.env.CARELOG_E2E_PASSWORD_A;
  const gatewayTarget = process.env.CARELOG_E2E_GATEWAY_TARGET;
  expect(disposable).toBe('1');
  expect(accountA).toBeTruthy();
  expect(passwordA).toBeTruthy();
  expect(gatewayTarget).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);

  const suffix = randomUUID();
  const originalCustomerName = `RPL-64 customer ${suffix}`;
  const originalCustomerMemo = `RPL-64 memo ${suffix}`;
  const editedCustomerName = `RPL-64 customer edited ${suffix}`;
  const editedCustomerMemo = `RPL-64 memo edited ${suffix}`;
  const rescheduleDescriptor = `RPL-64 rescheduled ${suffix}`;
  const cancellationDescriptor = `RPL-64 cancellation ${suffix}`;
  const initialScheduledAt = seoulDateTimeLocalAfterMinutes(24 * 60);
  const rescheduledAt = seoulDateTimeLocalAfterMinutes(48 * 60);
  const cancellationScheduledAt = seoulDateTimeLocalAfterMinutes(72 * 60);
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

  await page.goto('/auth/login');
  await loginThroughUi(page, accountA!, passwordA!);
  capturePostLoginReads = true;

  await page.locator('[data-side-navigation] a[href="/app/customers"]').click();
  await expect(page.locator('[data-customers-page]')).toBeVisible();
  const customerCreateCta = page.locator('[data-first-customer-cta], [data-customer-add-cta]');
  await expect(customerCreateCta).toHaveCount(1);
  await customerCreateCta.click();
  await expect(page.locator('[data-customer-create-page]')).toBeVisible();
  await page.locator('[data-customer-field="displayName"]').fill(originalCustomerName);
  await page.locator('[data-customer-field="customerMemo"]').fill(originalCustomerMemo);
  const customerCreatePromise = waitForApiResponse(page, 'POST', CUSTOMER_API_PATH);
  await page.locator('[data-customer-form-submit]').click();
  const customerCreateResponse = await customerCreatePromise;
  await expectSuccessful(customerCreateResponse);
  const createdCustomer = asRecord(
    responseData(await customerCreateResponse.json(), customerCreateResponse.status()),
    'Customer',
  );
  const customerId = createdCustomer.publicId;
  expect(typeof customerId).toBe('string');
  if (typeof customerId !== 'string' || customerId.length === 0) {
    throw new Error('The created customer has no server-assigned public ID.');
  }

  await expect(page.locator('[data-customer-detail-page]')).toHaveAttribute(
    'data-selected-customer-id',
    customerId,
  );
  await page.locator('[data-edit-customer]').click();
  await expect(page.locator('[data-customer-edit-page]')).toHaveAttribute(
    'data-editing-customer-id',
    customerId,
  );
  await page.locator('[data-customer-field="displayName"]').fill(editedCustomerName);
  await page.locator('[data-customer-field="customerMemo"]').fill(editedCustomerMemo);
  const customerEditPromise = waitForApiResponse(
    page,
    'PATCH',
    `${CUSTOMER_API_PATH}/${customerId}`,
  );
  await page.locator('[data-customer-form-submit]').click();
  const customerEditResponse = await customerEditPromise;
  await expectSuccessful(customerEditResponse);
  const editedCustomer = asRecord(
    responseData(await customerEditResponse.json(), customerEditResponse.status()),
    'Updated customer',
  );
  expect(editedCustomer.publicId).toBe(customerId);
  expect(editedCustomer.displayName).toBe(editedCustomerName);
  expect(editedCustomer.customerMemo).toBe(editedCustomerMemo);

  await page.locator('[data-add-event]').click();
  await expect(page.locator('[data-event-form]')).toBeVisible();
  await page.locator('[data-event-field="descriptor"]').fill(rescheduleDescriptor);
  await page.locator('[data-event-field="scheduledAt"]').fill(initialScheduledAt);
  const eventCreatePromise = waitForApiResponse(page, 'POST', CUSTOMER_EVENTS_API_PATH);
  await page.locator('[data-event-form-submit]').click();
  const eventCreateResponse = await eventCreatePromise;
  await expectSuccessful(eventCreateResponse);
  const createdEvent = asRecord(
    responseData(await eventCreateResponse.json(), eventCreateResponse.status()),
    'CustomerEvent',
  );
  const eventId = createdEvent.id;
  expect(typeof eventId).toBe('string');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('The created event has no server-assigned ID.');
  }
  expect(createdEvent.customerId).toBe(customerId);
  expect(createdEvent.status).toBe('PLANNED');

  await page.locator('[data-upcoming-primary]').click();
  await expect(page).toHaveURL(`/app/events/${eventId}`);
  await page.locator('[data-event-action="edit"]').click();
  await expect(page.locator('[data-event-form][data-event-form-mode="edit"]')).toBeVisible();
  await page.locator('[data-event-field="scheduledAt"]').fill(rescheduledAt);
  const eventEditPromise = waitForApiResponse(
    page,
    'PATCH',
    `${CUSTOMER_EVENTS_API_PATH}/${eventId}`,
  );
  await page.locator('[data-event-form-submit]').click();
  const eventEditResponse = await eventEditPromise;
  await expectSuccessful(eventEditResponse);
  const rescheduledEvent = asRecord(
    responseData(await eventEditResponse.json(), eventEditResponse.status()),
    'Rescheduled event',
  );
  expect(rescheduledEvent.id).toBe(eventId);
  expect(rescheduledEvent.customerId).toBe(customerId);
  expect(rescheduledEvent.status).toBe('PLANNED');
  expectTimestampAtSeoulLocalTime(rescheduledEvent.scheduledAt, rescheduledAt);

  await expect(page).toHaveURL('/app/schedule');
  await openCustomerDetail(page, customerId, editedCustomerName);
  await expect
    .poll(() =>
      responseReadbackState(
        responseReadErrors,
        customerEventReads.some(
          (read) =>
            read.customerId === customerId &&
            customerEventsContain(read.body, {
              id: eventId,
              status: 'PLANNED',
              descriptor: rescheduleDescriptor,
              scheduledAt: rescheduledAt,
            }),
        ),
      ),
    )
    .toBe('matched');
  const rescheduledUpcoming = page.locator('[data-upcoming-primary]');
  await expect(rescheduledUpcoming).toContainText(rescheduleDescriptor);
  await rescheduledUpcoming.click();
  await expect(page).toHaveURL(`/app/events/${eventId}`);
  await expect(page.locator('[data-event-detail]')).toHaveAttribute('data-event-status', 'PLANNED');

  await page.locator('[data-event-action="occur"]').click();
  await expect(page.locator('[data-event-occurrence-confirmation]')).toBeVisible();
  const occurredAt = seoulDateTimeLocalAfterMinutes(-1);
  await page.locator('[data-event-occurrence-time]').fill(occurredAt);
  const occurPromise = waitForApiResponse(
    page,
    'POST',
    `${CUSTOMER_EVENTS_API_PATH}/${eventId}/occur`,
  );
  await page.locator('[data-event-occurrence-confirm]').click();
  const occurResponse = await occurPromise;
  await expectSuccessful(occurResponse);
  const occurredEvent = asRecord(
    responseData(await occurResponse.json(), occurResponse.status()),
    'Occurred event',
  );
  expect(occurredEvent.id).toBe(eventId);
  expect(occurredEvent.status).toBe('OCCURRED');
  expectTimestampAtSeoulLocalTime(occurredEvent.scheduledAt, rescheduledAt);
  expectTimestampAtSeoulLocalTime(occurredEvent.occurredAt, occurredAt);

  await expect(page).toHaveURL('/app/schedule');
  await openCustomerDetail(page, customerId, editedCustomerName);
  await expect
    .poll(() =>
      responseReadbackState(
        responseReadErrors,
        customerEventReads.some(
          (read) =>
            read.customerId === customerId &&
            customerEventsContain(read.body, {
              id: eventId,
              status: 'OCCURRED',
              descriptor: rescheduleDescriptor,
              scheduledAt: rescheduledAt,
              occurredAt,
            }),
        ),
      ),
    )
    .toBe('matched');
  await expect(
    page.locator(`[data-customer-history-item][data-event-id="${eventId}"]`),
  ).toHaveAttribute('data-event-status', 'OCCURRED');

  await page.locator('[data-add-event]').click();
  await expect(page.locator('[data-event-form]')).toBeVisible();
  await page.locator('[data-event-field="descriptor"]').fill(cancellationDescriptor);
  await page.locator('[data-event-field="scheduledAt"]').fill(cancellationScheduledAt);
  const cancellationCreatePromise = waitForApiResponse(page, 'POST', CUSTOMER_EVENTS_API_PATH);
  await page.locator('[data-event-form-submit]').click();
  const cancellationCreateResponse = await cancellationCreatePromise;
  await expectSuccessful(cancellationCreateResponse);
  const cancellationCandidate = asRecord(
    responseData(await cancellationCreateResponse.json(), cancellationCreateResponse.status()),
    'Cancellation candidate',
  );
  const cancellationEventId = cancellationCandidate.id;
  expect(typeof cancellationEventId).toBe('string');
  if (typeof cancellationEventId !== 'string' || cancellationEventId.length === 0) {
    throw new Error('The cancellation candidate has no server-assigned ID.');
  }

  const cancellationUpcoming = page.locator('[data-upcoming-primary]');
  await expect(cancellationUpcoming).toContainText(cancellationDescriptor);
  await cancellationUpcoming.click();
  await expect(page).toHaveURL(`/app/events/${cancellationEventId}`);
  await expect(page.locator('[data-event-detail]')).toHaveAttribute('data-event-status', 'PLANNED');

  const cancelPromise = waitForApiResponse(
    page,
    'POST',
    `${CUSTOMER_EVENTS_API_PATH}/${cancellationEventId}/cancel`,
  );
  await page.locator('[data-event-action="cancel"]').click();
  const cancelResponse = await cancelPromise;
  await expectSuccessful(cancelResponse);
  const cancelledEvent = asRecord(
    responseData(await cancelResponse.json(), cancelResponse.status()),
    'Cancelled event',
  );
  expect(cancelledEvent.id).toBe(cancellationEventId);
  expect(cancelledEvent.status).toBe('CANCELLED');

  await expect(page).toHaveURL('/app/schedule');
  await logoutThroughUi(page);
  customerListReads.length = 0;
  customerEventReads.length = 0;
  responseReadErrors.length = 0;

  await page.locator('[data-auth-entry] a[href="/auth/login"]').click();
  await loginThroughUi(page, accountA!, passwordA!);
  await openCustomerDetail(page, customerId, editedCustomerName);
  await expect(page.getByTestId('customer-memo-copy')).toHaveText(editedCustomerMemo);
  await expect
    .poll(() =>
      responseReadbackState(
        responseReadErrors,
        customerListReads.some((body) =>
          customerListContains(body, customerId, editedCustomerName, editedCustomerMemo),
        ),
      ),
    )
    .toBe('matched');

  await expect
    .poll(() =>
      responseReadbackState(
        responseReadErrors,
        customerEventReads.some(
          (read) =>
            read.customerId === customerId &&
            customerEventsContain(read.body, {
              id: eventId,
              status: 'OCCURRED',
              descriptor: rescheduleDescriptor,
              scheduledAt: rescheduledAt,
              occurredAt,
            }),
        ),
      ),
    )
    .toBe('matched');
  await expect
    .poll(() =>
      responseReadbackState(
        responseReadErrors,
        customerEventReads.some(
          (read) =>
            read.customerId === customerId &&
            customerEventsContain(read.body, {
              id: cancellationEventId,
              status: 'CANCELLED',
              descriptor: cancellationDescriptor,
              scheduledAt: cancellationScheduledAt,
            }),
        ),
      ),
    )
    .toBe('matched');
  await expect(
    page.locator(`[data-customer-history-item][data-event-id="${cancellationEventId}"]`),
  ).toHaveAttribute('data-event-status', 'CANCELLED');
});
