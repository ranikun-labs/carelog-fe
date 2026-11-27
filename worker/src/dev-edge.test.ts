// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { handleDevEdgeRequest, parseExactOrigin, type DevEdgeEnv } from './dev-edge';

const PUBLIC = 'https://carelog-dev.example.test';
const GATEWAY = 'https://gateway.example.test';
const env: DevEdgeEnv = { GATEWAY_ORIGIN: GATEWAY, PUBLIC_ORIGIN: PUBLIC };

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function html(status: number, body = '<!doctype html><html><body>SPA</body></html>'): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function browser(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return new Request(`${PUBLIC}${path}`, init);
}

/**
 * A request whose URL string is kept exactly as written. `new Request()` would already
 * resolve `..` and turn `\` into `/`, which is what the raw-path guard must see first.
 */
function rawRequest(rawUrl: string, method = 'GET'): Request {
  return { url: rawUrl, method, headers: new Headers() } as unknown as Request;
}

describe('DEV same-origin edge routing', () => {
  it('serves non-API paths from assets and never calls the Gateway', async () => {
    const assets = vi.fn(async () => html(200));
    const upstream = vi.fn();
    const response = await handleDevEdgeRequest(
      browser('/app/customers'),
      { ...env, ASSETS: { fetch: assets } },
      upstream,
    );

    expect(response.status).toBe(200);
    expect(assets).toHaveBeenCalledTimes(1);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('never hands an /api path to assets, even an unknown one', async () => {
    const assets = vi.fn(async () => html(200));
    const upstream = vi.fn(async () => json(404, { status: 404, message: 'Not found' }));
    await handleDevEdgeRequest(
      browser('/api/v1/unknown'),
      { ...env, ASSETS: { fetch: assets } },
      upstream,
    );

    expect(assets).not.toHaveBeenCalled();
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

describe('DEV same-origin edge API proxy', () => {
  it('forwards method, path, query, body and bearer to the Gateway and returns the JSON envelope', async () => {
    const upstream = vi.fn(async () =>
      json(200, { status: 200, message: 'ok', data: { accessToken: 'a', refreshToken: 'r' } }),
    );
    const response = await handleDevEdgeRequest(
      browser('/api/v1/customer-events?limit=100&customerId=c1', {
        method: 'GET',
        headers: { authorization: 'Bearer a-token', accept: 'application/json' },
      }),
      env,
      upstream,
    );

    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${GATEWAY}/api/v1/customer-events?limit=100&customerId=c1`);
    expect(init.method).toBe('GET');
    expect(init.redirect).toBe('manual');
    expect((init.headers as Headers).get('authorization')).toBe('Bearer a-token');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toMatchObject({ status: 200, message: 'ok' });
  });

  it('sends the public origin on registration so the Gateway allowlist matches', async () => {
    const upstream = vi.fn(async () =>
      json(201, { status: 201, message: 'Registration completed.' }),
    );
    const response = await handleDevEdgeRequest(
      browser('/api/v1/auth/carelog/registration', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: PUBLIC,
          'idempotency-key': '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
        },
        body: JSON.stringify({ userId: 'u', email: 'u@example.test', password: 'p', name: 'n' }),
      }),
      env,
      upstream,
    );

    const init = (upstream.mock.calls[0] as unknown as [string, RequestInit])[1];
    const headers = init.headers as Headers;
    expect(headers.get('origin')).toBe(PUBLIC);
    expect(headers.get('idempotency-key')).toBe('6ba7b810-9dad-41d1-80b4-00c04fd430c8');
    expect(init.body).toBeInstanceOf(ArrayBuffer);
    expect(response.status).toBe(201);
  });

  it('does not send an Origin header on other product routes', async () => {
    const upstream = vi.fn(async () => json(200, { status: 200, message: 'ok', data: [] }));
    await handleDevEdgeRequest(
      browser('/api/v1/users/customers', { method: 'GET', headers: { origin: PUBLIC } }),
      env,
      upstream,
    );

    const init = (upstream.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Headers).get('origin')).toBeNull();
  });

  it('replaces a client-supplied X-Forwarded-For with the edge-verified address', async () => {
    const upstream = vi.fn(async () => json(200, { status: 200, message: 'ok', data: {} }));
    await handleDevEdgeRequest(
      browser('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '10.0.0.66',
          'cf-connecting-ip': '203.0.113.10',
          cookie: 'session=secret',
          connection: 'keep-alive',
          'x-internal-trusted': 'spoofed',
        },
        body: '{}',
      }),
      env,
      upstream,
    );

    const headers = (upstream.mock.calls[0] as unknown as [string, RequestInit])[1]
      .headers as Headers;
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.10');
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('connection')).toBeNull();
    expect(headers.get('x-internal-trusted')).toBeNull();
  });
});

describe('DEV same-origin edge error responses', () => {
  it.each([
    [401, { status: 401, message: 'Invalid credentials.' }],
    [409, { status: 409, message: 'Registration conflict.' }],
    [503, { status: 503, message: 'Registration pending. Retry with the same key.' }],
  ])('passes upstream JSON status %i through unchanged', async (status, body) => {
    const response = await handleDevEdgeRequest(
      browser('/api/v1/auth/login', { method: 'POST', body: '{}' }),
      env,
      async () => json(status, body),
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
  });

  it('returns JSON 404 for an unknown /api path even when the upstream answers with HTML', async () => {
    const response = await handleDevEdgeRequest(browser('/api/v1/does-not-exist'), env, async () =>
      html(404),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    const text = await response.text();
    expect(text).not.toContain('<');
    expect(JSON.parse(text)).toEqual({ status: 404, message: 'Not found.' });
  });

  it('replaces an upstream HTML error page with a JSON envelope of the same status', async () => {
    const response = await handleDevEdgeRequest(browser('/api/v1/users/customers'), env, async () =>
      html(530),
    );

    expect(response.status).toBe(530);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.text()).not.toContain('SPA');
  });

  it('answers 502 JSON when the Gateway cannot be reached', async () => {
    const response = await handleDevEdgeRequest(
      browser('/api/v1/auth/login', { method: 'POST', body: '{}' }),
      env,
      async () => {
        throw new TypeError('socket closed');
      },
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      status: 502,
      message: 'The Carelog API is unavailable.',
    });
  });

  it('does not expose an upstream redirect location', async () => {
    const response = await handleDevEdgeRequest(
      browser('/api/v1/auth/login', { method: 'POST', body: '{}' }),
      env,
      async () =>
        new Response(null, { status: 302, headers: { location: 'https://internal.example/x' } }),
    );

    expect(response.status).toBe(502);
    expect(response.headers.get('location')).toBeNull();
  });

  it('returns 204 with no body', async () => {
    const response = await handleDevEdgeRequest(
      browser('/api/v1/auth/logout', { method: 'POST', headers: { authorization: 'Bearer a' } }),
      env,
      async () => new Response(null, { status: 204 }),
    );

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  it('rejects disallowed methods before contacting the Gateway', async () => {
    const upstream = vi.fn();
    const response = await handleDevEdgeRequest(
      browser('/api/v1/auth/login', { method: 'OPTIONS' }),
      env,
      upstream,
    );

    expect(response.status).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe('DEV same-origin edge caching and headers', () => {
  it('forces no-store on API responses even when the upstream asks for caching', async () => {
    const response = await handleDevEdgeRequest(browser('/api/v1/users/customers'), env, async () =>
      json(
        200,
        { status: 200, message: 'ok', data: [] },
        { 'cache-control': 'public, max-age=600' },
      ),
    );

    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('forwards only the allowlisted response headers', async () => {
    const response = await handleDevEdgeRequest(
      browser('/api/v1/auth/login', { method: 'POST', body: '{}' }),
      env,
      async () =>
        json(
          401,
          { status: 401, message: 'no' },
          {
            'retry-after': '3',
            'set-cookie': 'gateway=secret',
            'x-gateway-internal': 'leak',
          },
        ),
    );

    expect(response.headers.get('retry-after')).toBe('3');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-gateway-internal')).toBeNull();
  });
});

describe('DEV same-origin edge configuration', () => {
  it.each([
    ['missing gateway', { GATEWAY_ORIGIN: undefined, PUBLIC_ORIGIN: PUBLIC }],
    ['gateway with a path', { GATEWAY_ORIGIN: `${GATEWAY}/api`, PUBLIC_ORIGIN: PUBLIC }],
    [
      'plain http gateway',
      { GATEWAY_ORIGIN: 'http://gateway.example.test', PUBLIC_ORIGIN: PUBLIC },
    ],
    ['missing public origin', { GATEWAY_ORIGIN: GATEWAY, PUBLIC_ORIGIN: '' }],
    [
      'public origin with a trailing slash path',
      { GATEWAY_ORIGIN: GATEWAY, PUBLIC_ORIGIN: `${PUBLIC}/` + 'x' },
    ],
  ])('fails closed with JSON 500 for %s and never calls the Gateway', async (_label, config) => {
    const upstream = vi.fn();
    const response = await handleDevEdgeRequest(browser('/api/v1/auth/login'), config, upstream);

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('gateway.example.test');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('accepts a loopback HTTP origin only for local development', () => {
    expect(parseExactOrigin('http://127.0.0.1:8080', 'GATEWAY_ORIGIN')).toBe(
      'http://127.0.0.1:8080',
    );
    expect(() => parseExactOrigin('http://gateway.example.test', 'GATEWAY_ORIGIN')).toThrow();
  });
});

describe('DEV same-origin edge raw path guard', () => {
  it.each([
    ['encoded slash', '/api/v1/customer-events/a%2fb'],
    ['encoded backslash', '/api/v1/customer-events/a%5Cb'],
    ['encoded dot', '/api/v1/customer-events/%2e%2E/x'],
    ['semicolon', '/api/v1/customer-events;x/1'],
    ['raw backslash', '/api/v1/customer-events\\x'],
    ['empty segment', '/api/v1//customer-events'],
    ['dot-dot segment', '/api/v1/users/../auth/login'],
    ['encoded unreserved letter in an auth path', '/api/v1/%61uth/login'],
    ['dot-dot on a non-API path', '/app/%2e%2e/secret'],
  ])('rejects %s with JSON 400 before routing or contacting the Gateway', async (_label, path) => {
    const assets = vi.fn(async () => html(200));
    const upstream = vi.fn();
    const response = await handleDevEdgeRequest(
      rawRequest(`${PUBLIC}${path}`),
      { ...env, ASSETS: { fetch: assets } },
      upstream,
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ status: 400, message: 'Invalid request path.' });
    expect(assets).not.toHaveBeenCalled();
    expect(upstream).not.toHaveBeenCalled();
  });

  it('does not inspect the query string', async () => {
    const upstream = vi.fn(async () => json(200, { status: 200, message: 'ok', data: [] }));
    const response = await handleDevEdgeRequest(
      browser('/api/v1/customer-events?cursor=a%2Fb;c&q=..'),
      env,
      upstream,
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

describe('DEV same-origin edge upstream timeout', () => {
  it('bounds the upstream call with a 10 second AbortSignal by default', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    try {
      await handleDevEdgeRequest(browser('/api/v1/users/customers'), env, async () =>
        json(200, { status: 200, message: 'ok', data: [] }),
      );
      expect(spy).toHaveBeenCalledWith(10_000);
    } finally {
      spy.mockRestore();
    }
  });

  it('answers 504 JSON when the Gateway does not respond in time', async () => {
    const response = await handleDevEdgeRequest(
      browser('/api/v1/auth/login', { method: 'POST', body: '{}' }),
      { ...env, UPSTREAM_TIMEOUT_MS: '20' },
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({
      status: 504,
      message: 'The Carelog API did not respond in time.',
    });
  });

  it.each(['0', '-5', 'ten', '1.5', '60001'])(
    'fails closed with JSON 500 for UPSTREAM_TIMEOUT_MS=%s',
    async (value) => {
      const upstream = vi.fn();
      const response = await handleDevEdgeRequest(
        browser('/api/v1/auth/login', { method: 'POST', body: '{}' }),
        { ...env, UPSTREAM_TIMEOUT_MS: value },
        upstream,
      );

      expect(response.status).toBe(500);
      expect(upstream).not.toHaveBeenCalled();
    },
  );
});

describe('DEV same-origin edge auth route allowlist', () => {
  it.each([
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/auth/logout',
    '/api/v1/auth/carelog/registration',
  ])('forwards POST %s to the Gateway', async (path) => {
    const upstream = vi.fn(async () => json(200, { status: 200, message: 'ok' }));
    const response = await handleDevEdgeRequest(
      browser(path, { method: 'POST', body: '{}' }),
      env,
      upstream,
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['GET login', 'GET', '/api/v1/auth/login'],
    ['PUT refresh', 'PUT', '/api/v1/auth/refresh'],
    ['DELETE logout', 'DELETE', '/api/v1/auth/logout'],
    ['GET registration', 'GET', '/api/v1/auth/carelog/registration'],
    ['POST an unlisted auth path', 'POST', '/api/v1/auth/password/reset'],
    ['POST below the registration path', 'POST', '/api/v1/auth/carelog/registration/extra'],
    ['POST the auth root', 'POST', '/api/v1/auth'],
  ])('answers 405 JSON for %s without contacting the Gateway', async (_label, method, path) => {
    const upstream = vi.fn();
    const response = await handleDevEdgeRequest(
      browser(path, { method, body: method === 'GET' ? undefined : '{}' }),
      env,
      upstream,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(await response.json()).toEqual({ status: 405, message: 'Method not allowed.' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('sends the public origin only on POST to the registration path', async () => {
    const upstream = vi.fn(async () => json(200, { status: 200, message: 'ok' }));
    await handleDevEdgeRequest(
      browser('/api/v1/auth/login', {
        method: 'POST',
        body: '{}',
        headers: { origin: 'https://evil.example.test' },
      }),
      env,
      upstream,
    );

    const init = (upstream.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Headers).get('origin')).toBeNull();
  });
});

describe('DEV same-origin edge API namespace casing', () => {
  it.each(['/API/v1/users/customers', '/Api/v1/users/customers', '/aPI', '/API/v1/auth/login'])(
    'answers JSON 404 for %s without assets or the Gateway',
    async (path) => {
      const assets = vi.fn(async () => html(200));
      const upstream = vi.fn();
      const response = await handleDevEdgeRequest(
        browser(path, { method: 'POST', body: '{}' }),
        { ...env, ASSETS: { fetch: assets } },
        upstream,
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ status: 404, message: 'Not found.' });
      expect(assets).not.toHaveBeenCalled();
      expect(upstream).not.toHaveBeenCalled();
    },
  );
});

describe('DEV same-origin edge request body cap', () => {
  it('answers 413 JSON when the declared Content-Length is over 64 KiB', async () => {
    const upstream = vi.fn();
    const response = await handleDevEdgeRequest(
      browser('/api/v1/auth/login', {
        method: 'POST',
        body: '{}',
        headers: { 'content-length': String(64 * 1024 + 1) },
      }),
      env,
      upstream,
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ status: 413, message: 'Request body is too large.' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('answers 413 when a chunked body without a length exceeds the cap', async () => {
    const chunk = new Uint8Array(40 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.close();
      },
    });
    const upstream = vi.fn();
    const response = await handleDevEdgeRequest(
      new Request(`${PUBLIC}/api/v1/auth/login`, {
        method: 'POST',
        body: stream,
        duplex: 'half',
      } as RequestInit),
      env,
      upstream,
    );

    expect(response.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('forwards a body of exactly 64 KiB', async () => {
    const upstream = vi.fn(async () => json(200, { status: 200, message: 'ok' }));
    const response = await handleDevEdgeRequest(
      browser('/api/v1/auth/login', { method: 'POST', body: 'a'.repeat(64 * 1024) }),
      env,
      upstream,
    );

    expect(response.status).toBe(200);
    const init = (upstream.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.body as ArrayBuffer).byteLength).toBe(64 * 1024);
  });
});
