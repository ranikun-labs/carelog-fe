import { chromium } from '@playwright/test';

const origin = process.env.CARELOG_E2E_ORIGIN;
const customerId = process.env.CARELOG_E2E_CUSTOMER_ID;
const eventId = process.env.CARELOG_E2E_EVENT_ID;
const credentials = {
  account_a: {
    login: process.env.CARELOG_E2E_LOGIN_A,
    password: process.env.CARELOG_E2E_PASSWORD_A,
  },
  account_b: {
    login: process.env.CARELOG_E2E_LOGIN_B,
    password: process.env.CARELOG_E2E_PASSWORD_B,
  },
};

const customerPath = '/api/v1/users/customers';
const eventPath = '/api/v1/customer-events';
const checks = [];
const sessions = {};
let browser;
let phase = 'browser-launch';

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) });
}

function observe(page) {
  const reads = [];
  const requests = [];
  const pending = [];
  const requestRecords = new WeakMap();

  page.on('request', (request) => {
    let url;
    try {
      url = new URL(request.url());
    } catch {
      return;
    }
    if (!url.pathname.startsWith('/api/v1/')) return;
    const record = {
      method: request.method(),
      path: url.pathname,
      status: null,
      loopback: url.hostname === '127.0.0.1' || url.hostname === 'localhost',
    };
    requests.push(record);
    requestRecords.set(request, record);
  });

  page.on('response', (response) => {
    const requestRecord = requestRecords.get(response.request());
    if (!requestRecord) return;
    requestRecord.status = response.status();
    if (!requestRecord.loopback || requestRecord.method !== 'GET' || ![customerPath, eventPath].includes(requestRecord.path)) return;

    const record = {
      method: 'GET',
      path: requestRecord.path,
      status: response.status(),
      dataIsArray: false,
      count: null,
      includesSeededRow: false,
      settled: false,
    };
    reads.push(record);
    pending.push((async () => {
      try {
        const body = await response.json();
        const data = body?.data;
        record.dataIsArray = Array.isArray(data);
        if (Array.isArray(data)) {
          const expectedId = requestRecord.path === customerPath ? customerId : eventId;
          record.count = data.length;
          record.includesSeededRow = data.some((item) => (item?.publicId ?? item?.id) === expectedId);
        }
      } catch {
        record.dataIsArray = false;
      } finally {
        record.settled = true;
      }
    })());
  });

  return { reads, requests, pending };
}

async function waitForRead(observed, path, startIndex) {
  const deadline = Date.now() + 20000;
  let last = null;
  while (Date.now() < deadline) {
    await Promise.all(observed.pending);
    const matches = observed.reads.slice(startIndex).filter((record) => record.path === path && record.settled);
    last = matches.at(-1) ?? last;
    const success = matches.find((record) => record.status === 200);
    if (success) return success;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return last;
}

function allReadsFor(session, path) {
  return session.reads.filter((record) => record.path === path && record.settled);
}

async function runAccount(key) {
  const account = credentials[key];
  phase = `${key}-login`;
  const context = await browser.newContext({
    viewport: { width: 1180, height: 800 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const observed = observe(page);
  const result = {
    loginStatus: null,
    landingRoute: null,
    customerBootstrapRead: null,
    eventRead: null,
    customerCards: null,
    customersEmptyVisible: false,
    scheduleRows: null,
    scheduleEmptyVisible: false,
    reads: observed.reads,
    requests: observed.requests,
  };
  sessions[key] = result;

  try {
    await page.goto(`${origin}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="account"]').fill(account.login);
    await page.locator('input[name="secret"]').fill(account.password);
    const bootstrapBoundary = observed.reads.length;
    const loginResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/auth/login',
    );
    await page.locator('[data-auth-form] button[type="submit"]').click();
    result.loginStatus = (await loginResponsePromise).status();
    check(`${key} actual form login returns HTTP 200`, result.loginStatus === 200);
    await page.waitForURL((url) => ['/app/schedule', '/app/customers'].includes(url.pathname));
    result.landingRoute = new URL(page.url()).pathname;
    check(`${key} first-use route matches its seeded customer readiness`,
      result.landingRoute === (key === 'account_a' ? '/app/schedule' : '/app/customers'));

    phase = `${key}-customer-readiness`;
    result.customerBootstrapRead = await waitForRead(observed, customerPath, bootstrapBoundary);

    if (result.landingRoute === '/app/schedule') {
      phase = `${key}-schedule-landing-read`;
      result.eventRead = await waitForRead(observed, eventPath, bootstrapBoundary);
      phase = `${key}-schedule-screen`;
      if (key === 'account_a') {
        await page.locator('[data-agenda-row]').first().waitFor({ state: 'visible' });
      } else {
        await page.locator('[data-schedule-first-customer-cta]').waitFor({ state: 'visible' });
      }
      result.scheduleRows = await page.locator('[data-agenda-row]').count();
      result.scheduleEmptyVisible = await page.locator('[data-schedule-first-customer-cta]').isVisible().catch(() => false);
    }

    if (result.landingRoute !== '/app/customers') {
      phase = `${key}-customers-navigation`;
      await page.locator('[data-side-navigation] a[href="/app/customers"]').click();
      await page.waitForURL((url) => url.pathname === '/app/customers');
      await page.waitForTimeout(300);
    }

    phase = `${key}-customers-screen`;
    if (key === 'account_a') {
      await page.locator('[data-customer-card]').first().waitFor({ state: 'visible' });
    } else {
      await page.locator('[data-customers-empty]').waitFor({ state: 'visible' });
    }
    result.customerCards = await page.locator('[data-customer-card]').count();
    result.customersEmptyVisible = await page.locator('[data-customers-empty]').isVisible().catch(() => false);

    if (result.landingRoute !== '/app/schedule') {
      phase = `${key}-schedule-navigation`;
      const scheduleBoundary = observed.reads.length;
      await page.locator('[data-side-navigation] a[href="/app/schedule"]').click();
      await page.waitForURL((url) => url.pathname === '/app/schedule');
      result.eventRead = await waitForRead(observed, eventPath, scheduleBoundary);
      phase = `${key}-schedule-screen`;
      if (key === 'account_a') {
        await page.locator('[data-agenda-row]').first().waitFor({ state: 'visible' });
      } else {
        await page.locator('[data-schedule-first-customer-cta]').waitFor({ state: 'visible' });
      }
      result.scheduleRows = await page.locator('[data-agenda-row]').count();
      result.scheduleEmptyVisible = await page.locator('[data-schedule-first-customer-cta]').isVisible().catch(() => false);
    }
  } finally {
    await Promise.all(observed.pending);
    await context.close();
  }
}

function assertReadSet(reads, expectedCount, expectedIncludesSeeded) {
  return reads.length > 0 && reads.every((record) =>
    record.status === 200 && record.dataIsArray && record.count === expectedCount &&
    record.includesSeededRow === expectedIncludesSeeded);
}

async function main() {
  if (!origin || !customerId || !eventId || Object.values(credentials).some((item) => !item.login || !item.password)) {
    throw new Error('input');
  }
  browser = await chromium.launch({ headless: true });
  await runAccount('account_a');
  await runAccount('account_b');

  const a = sessions.account_a;
  const b = sessions.account_b;
  const aCustomerReads = allReadsFor(a, customerPath);
  const aEventReads = allReadsFor(a, eventPath);
  const bCustomerReads = allReadsFor(b, customerPath);
  const bEventReads = allReadsFor(b, eventPath);

  check('A post-login Customer readiness read contains only its seeded Customer and screen renders it',
    a.customerBootstrapRead?.status === 200 && aCustomerReads.length > 0 &&
    assertReadSet(aCustomerReads, 1, true) && a.customerCards === 1 && !a.customersEmptyVisible);
  check('A Schedule screen read contains its seeded Event and screen renders it',
    aEventReads.length > 0 && assertReadSet(aEventReads, 1, true) && a.scheduleRows === 1);
  check('B post-login Customer readiness read is empty and Customers screen shows empty state',
    b.customerBootstrapRead?.status === 200 && bCustomerReads.length > 0 &&
    assertReadSet(bCustomerReads, 0, false) && b.customerCards === 0 && b.customersEmptyVisible);
  check('B Schedule screen read is empty and screen shows first-customer guidance',
    bEventReads.length > 0 && assertReadSet(bEventReads, 0, false) && b.scheduleRows === 0 && b.scheduleEmptyVisible);

  const allRequests = Object.values(sessions).flatMap((session) => session.requests);
  const unexpectedMutationAttempts = allRequests.filter((request) =>
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
    !(request.method === 'POST' && request.path === '/api/v1/auth/login')).length;
  const onlyLoginPostObserved = allRequests.every((request) =>
    request.method === 'GET' || (request.method === 'POST' && request.path === '/api/v1/auth/login'));
  const unexpectedApiOrigins = allRequests.filter((request) => !request.loopback).length;
  check('No unexpected browser API mutation attempts or non-loopback API calls were observed',
    unexpectedMutationAttempts === 0 && onlyLoginPostObserved && unexpectedApiOrigins === 0);

  return { allRequests, unexpectedMutationAttempts, unexpectedApiOrigins };
}

let failurePhase = null;
let allRequests = [];
let unexpectedMutationAttempts = null;
let unexpectedApiOrigins = null;
try {
  const result = await main();
  allRequests = result.allRequests;
  unexpectedMutationAttempts = result.unexpectedMutationAttempts;
  unexpectedApiOrigins = result.unexpectedApiOrigins;
} catch {
  failurePhase = phase;
} finally {
  if (browser) await browser.close();
  const a = sessions.account_a ?? {};
  const b = sessions.account_b ?? {};
  if (allRequests.length === 0) {
    allRequests = Object.values(sessions).flatMap((session) => session.requests);
  }
  if (unexpectedMutationAttempts === null) {
    unexpectedMutationAttempts = allRequests.filter((request) =>
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
      !(request.method === 'POST' && request.path === '/api/v1/auth/login')).length;
  }
  if (unexpectedApiOrigins === null) {
    unexpectedApiOrigins = allRequests.filter((request) => !request.loopback).length;
  }
  const passed = failurePhase === null && checks.length === 9 && checks.every((item) => item.passed);
  const summary = {
    verdict: passed ? 'PASS_BOUNDED_SYNTHETIC_ACCOUNT_AB_ISOLATION' : 'FAILED_OR_BLOCKED',
    phase: failurePhase ?? 'assertions',
    assertion_count: checks.length,
    passed_assertions: checks.filter((item) => item.passed).length,
    checks,
    account_a: {
      login_status: a.loginStatus ?? null,
      customer_read_status: a.customerBootstrapRead?.status ?? null,
      customer_read_count: a.customerBootstrapRead?.count ?? null,
      customer_cards: a.customerCards ?? null,
      schedule_read_status: a.eventRead?.status ?? null,
      schedule_read_count: a.eventRead?.count ?? null,
      agenda_rows: a.scheduleRows ?? null,
    },
    account_b: {
      login_status: b.loginStatus ?? null,
      customer_read_status: b.customerBootstrapRead?.status ?? null,
      customer_read_count: b.customerBootstrapRead?.count ?? null,
      customer_cards: b.customerCards ?? null,
      schedule_read_status: b.eventRead?.status ?? null,
      schedule_read_count: b.eventRead?.count ?? null,
      agenda_rows: b.scheduleRows ?? null,
    },
    observed_api_requests: allRequests.length,
    unexpected_browser_mutation_attempts: unexpectedMutationAttempts,
    non_loopback_api_requests: unexpectedApiOrigins,
    traces_har_screenshots_video: false,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (!passed) process.exitCode = 1;
}
