import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { CarelogNetworkError } from '../src/integrations/carelog/errors';
import { createCarelogHttpClient } from '../src/integrations/carelog/httpClient';

const CUSTOMER_API_PATH = '/api/v1/users/customers';
const CUSTOMER_EVENTS_API_PATH = '/api/v1/customer-events';
const LOGIN_API_PATH = '/api/v1/auth/login';
const LOGOUT_API_PATH = '/api/v1/auth/logout';
const ACCOUNT_B_LOGIN = 'issue24-e2e-user-b';

interface ApiRequest {
  path: string;
  method: 'GET' | 'POST';
  token?: string;
  body?: unknown;
}

interface ApiResult {
  status: number;
  payload: unknown;
}

interface LoopbackServer {
  server: Server;
  origin: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function responseData(result: ApiResult): unknown {
  if (
    !isRecord(result.payload) ||
    result.payload.status !== result.status ||
    typeof result.payload.message !== 'string' ||
    !Object.prototype.hasOwnProperty.call(result.payload, 'data')
  ) {
    throw new Error('Carelog API response envelope is invalid.');
  }
  return result.payload.data;
}

function validatedGatewayOrigin(value: string | undefined): string {
  if (!value) throw new Error('Real API test requires a configured Gateway target.');

  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new Error('Real API test requires a loopback-only HTTP Gateway target.');
  }

  if (
    target.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(target.hostname) ||
    !target.port ||
    target.username ||
    target.password ||
    target.pathname !== '/' ||
    target.search ||
    target.hash ||
    value !== target.origin
  ) {
    throw new Error('Real API test requires a loopback-only HTTP Gateway origin.');
  }
  return target.origin;
}

async function callApi(
  request: APIRequestContext,
  gatewayOrigin: string,
  apiRequest: ApiRequest,
): Promise<ApiResult> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiRequest.token) headers.Authorization = `Bearer ${apiRequest.token}`;
  if (apiRequest.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await request.fetch(new URL(apiRequest.path, gatewayOrigin).toString(), {
    method: apiRequest.method,
    headers,
    data: apiRequest.body,
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  expect(
    response.status() >= 300 && response.status() < 400,
    `Gateway redirect status ${response.status()} is rejected.`,
  ).toBe(false);
  const payload: unknown = await response.json().catch(() => undefined);
  return { status: response.status(), payload };
}

async function listenLoopbackServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<LoopbackServer> {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeLoopbackServer(server);
    throw new Error('The local redirect fixture did not bind a TCP port.');
  }
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function closeLoopbackServer(server: Server): Promise<void> {
  const closed = new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  server.closeAllConnections();
  await closed;
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
  });
}

async function login(
  request: APIRequestContext,
  gatewayOrigin: string,
  account: string,
  password: string,
): Promise<string> {
  const result = await callApi(request, gatewayOrigin, {
    path: LOGIN_API_PATH,
    method: 'POST',
    body: { userId: account, password },
  });
  expect(result.status).toBe(200);

  const data = responseData(result);
  const accessToken = isRecord(data) ? data.accessToken : undefined;
  expect(typeof accessToken).toBe('string');
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Carelog login response has no access token.');
  }
  return accessToken;
}

test('Carelog HTTP client rejects a loopback 302 without forwarding credentials', async () => {
  const passwordSentinel = 'rpl64-local-password-sentinel';
  const bearerSentinel = 'rpl64-local-bearer-sentinel';
  let initialRequestCount = 0;
  let initialRequestHasPassword = false;
  let initialRequestHasBearer = false;
  let redirectTargetRequestCount = 0;
  let redirectTargetHasPassword = false;
  let redirectTargetHasBearer = false;
  const consoleOutput: string[] = [];
  let targetServer: Server | undefined;
  let redirectServer: Server | undefined;

  expect(test.info().project.use.trace).toBe('off');

  try {
    const target = await listenLoopbackServer(async (incoming, outgoing) => {
      redirectTargetRequestCount += 1;
      const body = await readRequestBody(incoming);
      redirectTargetHasPassword ||= body.includes(passwordSentinel);
      redirectTargetHasBearer ||= incoming.headers.authorization === `Bearer ${bearerSentinel}`;
      outgoing.writeHead(200, { 'Content-Type': 'application/json' });
      outgoing.end('{}');
    });
    targetServer = target.server;
    const redirect = await listenLoopbackServer(async (incoming, outgoing) => {
      initialRequestCount += 1;
      const body = await readRequestBody(incoming);
      initialRequestHasPassword ||= body.includes(passwordSentinel);
      initialRequestHasBearer ||= incoming.headers.authorization === `Bearer ${bearerSentinel}`;
      outgoing.writeHead(302, { Location: `${target.origin}/capture` });
      outgoing.end();
    });
    redirectServer = redirect.server;

    expect(new URL(target.origin).hostname).toBe('127.0.0.1');
    expect(new URL(redirect.origin).hostname).toBe('127.0.0.1');

    const client = createCarelogHttpClient({
      baseUrl: redirect.origin,
      fetchImpl: fetch,
      sessionProvider: { getAccessToken: () => bearerSentinel },
    });

    const originalConsole = {
      debug: console.debug,
      error: console.error,
      info: console.info,
      log: console.log,
      warn: console.warn,
    };
    const captureConsole = (...args: unknown[]) => {
      consoleOutput.push(
        args
          .map((value) => {
            if (typeof value === 'string') return value;
            try {
              return JSON.stringify(value) ?? String(value);
            } catch {
              return '[unserializable console value]';
            }
          })
          .join(' '),
      );
    };
    let rejectionMessage = '';
    try {
      console.debug = captureConsole;
      console.error = captureConsole;
      console.info = captureConsole;
      console.log = captureConsole;
      console.warn = captureConsole;
      await client.post('/credentialed-request', { password: passwordSentinel });
    } catch (error) {
      rejectionMessage = error instanceof CarelogNetworkError ? error.message : String(error);
    } finally {
      console.debug = originalConsole.debug;
      console.error = originalConsole.error;
      console.info = originalConsole.info;
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
    }

    expect(rejectionMessage).toBe('The Carelog API could not be reached.');
    expect(initialRequestCount).toBe(1);
    expect(initialRequestHasPassword).toBe(true);
    expect(initialRequestHasBearer).toBe(true);
    expect(redirectTargetRequestCount).toBe(0);
    expect(redirectTargetHasPassword).toBe(false);
    expect(redirectTargetHasBearer).toBe(false);
    expect(rejectionMessage).not.toContain(passwordSentinel);
    expect(rejectionMessage).not.toContain(bearerSentinel);
    expect(consoleOutput.some((line) => line.includes(passwordSentinel))).toBe(false);
    expect(consoleOutput.some((line) => line.includes(bearerSentinel))).toBe(false);
  } finally {
    try {
      if (redirectServer) await closeLoopbackServer(redirectServer);
    } finally {
      if (targetServer) await closeLoopbackServer(targetServer);
    }
  }
});

test('Gateway API rejects anonymous reads and scopes customer/event reads to each workspace', async ({
  request,
}) => {
  const disposable = process.env.CARELOG_E2E_DISPOSABLE;
  const accountA = process.env.CARELOG_E2E_ACCOUNT_A?.trim();
  const passwordA = process.env.CARELOG_E2E_PASSWORD_A;
  const passwordB = process.env.G4_E2E_PASSWORD_B;
  const gatewayTarget = process.env.CARELOG_E2E_GATEWAY_TARGET;

  expect(disposable).toBe('1');
  expect(accountA).toBeTruthy();
  expect(passwordA).toBeTruthy();
  expect(passwordB).toBeTruthy();
  const gatewayOrigin = validatedGatewayOrigin(gatewayTarget);

  expect(
    (await callApi(request, gatewayOrigin, { path: CUSTOMER_API_PATH, method: 'GET' })).status,
  ).toBe(401);
  expect(
    (
      await callApi(request, gatewayOrigin, {
        path: CUSTOMER_EVENTS_API_PATH,
        method: 'GET',
      })
    ).status,
  ).toBe(401);

  const accessTokenA = await login(request, gatewayOrigin, accountA!, passwordA!);
  const suffix = randomUUID();
  const customerResult = await callApi(request, gatewayOrigin, {
    path: CUSTOMER_API_PATH,
    method: 'POST',
    token: accessTokenA,
    body: {
      displayName: `RPL-64 workspace customer ${suffix}`,
      customerMemo: `RPL-64 workspace memo ${suffix}`,
    },
  });
  expect(customerResult.status).toBe(201);
  const customer = responseData(customerResult);
  const customerId = isRecord(customer) ? customer.publicId : undefined;
  expect(typeof customerId).toBe('string');
  if (typeof customerId !== 'string' || customerId.length === 0) {
    throw new Error('Created customer has no server-assigned public ID.');
  }

  const eventResult = await callApi(request, gatewayOrigin, {
    path: CUSTOMER_EVENTS_API_PATH,
    method: 'POST',
    token: accessTokenA,
    body: {
      customerId,
      status: 'PLANNED',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      descriptor: `RPL-64 workspace event ${suffix}`,
      note: `RPL-64 workspace note ${suffix}`,
    },
  });
  expect(eventResult.status).toBe(201);
  const event = responseData(eventResult);
  const eventId = isRecord(event) ? event.id : undefined;
  expect(typeof eventId).toBe('string');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Created event has no server-assigned ID.');
  }

  expect(
    (
      await callApi(request, gatewayOrigin, {
        path: LOGOUT_API_PATH,
        method: 'POST',
        token: accessTokenA,
      })
    ).status,
  ).toBe(204);

  const accessTokenB = await login(request, gatewayOrigin, ACCOUNT_B_LOGIN, passwordB!);
  const customerList = await callApi(request, gatewayOrigin, {
    path: CUSTOMER_API_PATH,
    method: 'GET',
    token: accessTokenB,
  });
  expect(customerList.status).toBe(200);
  const customerListData = responseData(customerList);
  expect(Array.isArray(customerListData)).toBe(true);
  if (!Array.isArray(customerListData)) {
    throw new Error('Customer list response is not an array.');
  }
  expect(customerListData.some((item) => isRecord(item) && item.publicId === customerId)).toBe(
    false,
  );

  expect(
    (
      await callApi(request, gatewayOrigin, {
        path: `${CUSTOMER_API_PATH}/${customerId}`,
        method: 'GET',
        token: accessTokenB,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await callApi(request, gatewayOrigin, {
        path: `${CUSTOMER_EVENTS_API_PATH}/${eventId}`,
        method: 'GET',
        token: accessTokenB,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await callApi(request, gatewayOrigin, {
        path: `${CUSTOMER_EVENTS_API_PATH}?customerId=${encodeURIComponent(customerId)}`,
        method: 'GET',
        token: accessTokenB,
      })
    ).status,
  ).toBe(404);

  expect(
    (
      await callApi(request, gatewayOrigin, {
        path: LOGOUT_API_PATH,
        method: 'POST',
        token: accessTokenB,
      })
    ).status,
  ).toBe(204);
});
