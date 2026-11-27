// In-memory stand-in for the shared Gateway + Core + Carelog BE, used only by the
// same-origin e2e. It enforces the registration Origin allowlist and the Idempotency-Key
// rules the real Gateway/Core enforce, and rotates refresh tokens like Core does.
import { randomUUID } from 'node:crypto';

export interface MockGatewayOptions {
  /** Exact origin the Gateway allowlist contains (the DEV edge's public origin). */
  allowedOrigin: string;
}

interface Account {
  userId: string;
  password: string;
  name: string;
  email: string;
  customers: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
}

const IDEMPOTENCY_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function envelope(status: number, message: string, data?: unknown): Response {
  const body = data === undefined ? { status, message } : { status, message, data };
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function bearerOf(headers: Headers): string | undefined {
  const value = headers.get('authorization') ?? '';
  return value.startsWith('Bearer ') ? value.slice(7) : undefined;
}

export function createMockGateway({ allowedOrigin }: MockGatewayOptions) {
  const accounts = new Map<string, Account>();
  const registrations = new Map<string, { fingerprint: string }>();
  const accessTokens = new Map<string, string>();
  const refreshTokens = new Map<string, string>();
  const requestLog: string[] = [];
  let refreshCount = 0;
  let lastAccessToken: string | undefined;

  function mintTokens(userId: string): { accessToken: string; refreshToken: string } {
    const accessToken = `at-${randomUUID()}`;
    const refreshToken = `rt-${randomUUID()}`;
    accessTokens.set(accessToken, userId);
    refreshTokens.set(refreshToken, userId);
    lastAccessToken = accessToken;
    return { accessToken, refreshToken };
  }

  function accountFor(headers: Headers): Account | undefined {
    const token = bearerOf(headers);
    const userId = token ? accessTokens.get(token) : undefined;
    return userId ? accounts.get(userId) : undefined;
  }

  async function handle(url: string, init: RequestInit): Promise<Response> {
    const { pathname, searchParams } = new URL(url);
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    const text = init.body ? new TextDecoder().decode(init.body as ArrayBuffer) : '';
    requestLog.push(`${method} ${pathname}`);
    const parseBody = (): Record<string, unknown> => {
      try {
        const value: unknown = JSON.parse(text);
        return typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    };

    if (method === 'POST' && pathname === '/api/v1/auth/carelog/registration') {
      if (headers.get('origin') !== allowedOrigin) {
        return new Response(JSON.stringify({ status: 403, message: 'Forbidden' }), {
          status: 403,
          headers: JSON_HEADERS,
        });
      }
      const key = headers.get('idempotency-key') ?? '';
      if (!IDEMPOTENCY_KEY.test(key)) return envelope(400, 'Invalid registration request.');
      const body = parseBody();
      const userId = String(body.userId ?? '');
      const fingerprint = JSON.stringify(body);
      const replay = registrations.get(key);
      if (replay) {
        return replay.fingerprint === fingerprint
          ? envelope(201, 'Registration completed.')
          : envelope(409, 'Registration conflict.');
      }
      if (accounts.has(userId)) return envelope(409, 'Registration conflict.');
      accounts.set(userId, {
        userId,
        password: String(body.password ?? ''),
        name: String(body.name ?? ''),
        email: String(body.email ?? ''),
        customers: [],
        events: [],
      });
      registrations.set(key, { fingerprint });
      return envelope(201, 'Registration completed.');
    }

    if (method === 'POST' && pathname === '/api/v1/auth/login') {
      const body = parseBody();
      const account = accounts.get(String(body.userId ?? ''));
      if (!account || account.password !== body.password) {
        return envelope(401, 'Invalid credentials.');
      }
      return envelope(200, '요청에 성공하였습니다.', mintTokens(account.userId));
    }

    if (method === 'POST' && pathname === '/api/v1/auth/refresh') {
      const presented = String(parseBody().refreshToken ?? '');
      const userId = refreshTokens.get(presented);
      if (!userId) return envelope(401, 'Invalid refresh token.');
      refreshTokens.delete(presented);
      refreshCount += 1;
      return envelope(200, '요청에 성공하였습니다.', mintTokens(userId));
    }

    if (method === 'POST' && pathname === '/api/v1/auth/logout') {
      const token = bearerOf(headers);
      const userId = token ? accessTokens.get(token) : undefined;
      if (token) accessTokens.delete(token);
      if (userId) {
        for (const [refresh, owner] of refreshTokens) {
          if (owner === userId) refreshTokens.delete(refresh);
        }
      }
      return new Response(null, { status: 204 });
    }

    if (
      pathname.startsWith('/api/v1/users/customers') ||
      pathname.startsWith('/api/v1/customer-events')
    ) {
      const account = accountFor(headers);
      if (!account) return envelope(401, 'Unauthorized.');

      if (pathname === '/api/v1/users/customers' && method === 'GET') {
        return envelope(200, 'ok', account.customers);
      }
      if (pathname === '/api/v1/users/customers' && method === 'POST') {
        const body = parseBody();
        const customer = {
          publicId: randomUUID(),
          displayName: String(body.displayName ?? ''),
          customerMemo: body.customerMemo ?? null,
        };
        account.customers.push(customer);
        return envelope(201, 'created', customer);
      }
      if (pathname === '/api/v1/customer-events' && method === 'GET') {
        const customerId = searchParams.get('customerId');
        return envelope(
          200,
          'ok',
          account.events.filter((event) => !customerId || event.customerId === customerId),
        );
      }
      if (pathname === '/api/v1/customer-events' && method === 'POST') {
        const body = parseBody();
        const event = {
          id: randomUUID(),
          customerId: String(body.customerId ?? ''),
          status: String(body.status ?? 'PLANNED'),
          scheduledAt: body.scheduledAt,
          descriptor: body.descriptor ?? null,
        };
        account.events.push(event);
        return envelope(201, 'created', event);
      }
    }

    // A misrouted upstream answers with an HTML page. The edge must not pass it through.
    return new Response('<!doctype html><html><body>Gateway 404 page</body></html>', {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  return {
    fetch: handle,
    requestLog,
    refreshCount: () => refreshCount,
    lastAccessToken: () => lastAccessToken,
  };
}
