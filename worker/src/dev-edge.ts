// Same-origin edge for the Carelog DEV frontend (docs/adr/0002-same-origin-dev-worker.md).
// The browser talks only to this origin. Requests under /api/ are forwarded to the
// shared Gateway; everything else is served from the built SPA assets.
// Nothing here logs request or response content: tokens and passwords never leave memory.

export interface DevEdgeEnv {
  /** Exact HTTPS origin of the shared Gateway, no path (set per environment). */
  GATEWAY_ORIGIN?: string;
  /** Exact origin the browser sees for this Worker. Must be in the Gateway's registration allowlist. */
  PUBLIC_ORIGIN?: string;
  /** Upstream timeout in milliseconds: a whole number from 1 to 60000. Unset means 10000. */
  UPSTREAM_TIMEOUT_MS?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

export type UpstreamFetch = (url: string, init: RequestInit) => Promise<Response>;

const REGISTRATION_PATH = '/api/v1/auth/carelog/registration';
// The complete auth route set the FE calls (src/integrations/carelog/authPort.ts).
// Every one of them is POST. Any other method or path under /api/v1/auth is a 405.
const AUTH_POST_PATHS: ReadonlySet<string> = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  REGISTRATION_PATH,
]);
const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
// Allowlists: anything not listed here (cookies, Gateway-internal headers, hop-by-hop
// headers, client-supplied X-Forwarded-For) is dropped in both directions.
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'authorization',
  'content-type',
  'idempotency-key',
] as const;
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'retry-after', 'www-authenticate'] as const;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_UPSTREAM_TIMEOUT_MS = 60_000;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;

export class DevEdgeConfigError extends Error {}

/** Canonical API namespace. Matching is exact and case-sensitive, like the Gateway. */
export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

/** Any casing of the API namespace. These are answered by the edge, never by assets. */
function isApiNamespace(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return lower === '/api' || lower.startsWith('/api/');
}

function isAuthPath(pathname: string): boolean {
  return pathname === '/api/v1/auth' || pathname.startsWith('/api/v1/auth/');
}

/** Accepts an exact origin: HTTPS, or HTTP only for a loopback host. No path, query, or credentials. */
export function parseExactOrigin(value: string | undefined, label: string): string {
  if (!value || !value.trim()) throw new DevEdgeConfigError(`${label} is not set.`);
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new DevEdgeConfigError(`${label} is not a URL.`);
  }
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new DevEdgeConfigError(`${label} must be HTTPS.`);
  }
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new DevEdgeConfigError(`${label} must be an origin without path or credentials.`);
  }
  return url.origin;
}

export function parseUpstreamTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_UPSTREAM_TIMEOUT_MS;
  const trimmed = value.trim();
  const ms = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || ms < 1 || ms > MAX_UPSTREAM_TIMEOUT_MS) {
    throw new DevEdgeConfigError(
      `UPSTREAM_TIMEOUT_MS must be a whole number from 1 to ${MAX_UPSTREAM_TIMEOUT_MS}.`,
    );
  }
  return ms;
}

/**
 * The path portion of the raw request URL string, taken before URL normalization.
 * `new URL()` and `new Request()` already resolve `..` and turn `\` into `/`, so the
 * forbidden-sequence check has to read the string as the client sent it.
 */
export function rawPathOf(rawUrl: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*([^?#]*)/i.exec(rawUrl);
  return match?.[1] ?? '';
}

function isUnreservedByte(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) || // 0-9
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) || // a-z
    code === 0x2d || // -
    code === 0x2e || // .
    code === 0x5f || // _
    code === 0x7e // ~
  );
}

/**
 * True when the raw path must be rejected: encoded slash, backslash or dot, `;`, `\`,
 * an empty `//` segment, a `..` segment, or a percent-encoded unreserved character.
 * The last rule also closes `%61uth` style spellings of `/auth/*` that the Gateway
 * might decode while the edge's exact-path checks would not see them.
 */
export function isForbiddenRawPath(rawPath: string): boolean {
  if (/%2f|%5c|%2e|;|\\|\/\//i.test(rawPath)) return true;
  if (rawPath.split('/').includes('..')) return true;
  for (const match of rawPath.matchAll(/%([0-9a-f]{2})/gi)) {
    if (isUnreservedByte(Number.parseInt(match[1] ?? '', 16))) return true;
  }
  return false;
}

function jsonResponse(status: number, message: string, headers: HeadersInit = {}): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  responseHeaders.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify({ status, message }), { status, headers: responseHeaders });
}

function messageForStatus(status: number): string {
  if (status === 401) return 'Unauthorized.';
  if (status === 403) return 'Forbidden.';
  if (status === 404) return 'Not found.';
  if (status === 409) return 'Conflict.';
  if (status === 429) return 'Too many requests.';
  if (status >= 500) return 'The Carelog API is unavailable.';
  return 'The Carelog API request failed.';
}

function isJsonContentType(value: string): boolean {
  return /^application\/json(\s*;|$)/i.test(value.trim());
}

function isTimeoutError(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === 'TimeoutError';
}

/**
 * Reads the request body up to `maxBytes`. The declared Content-Length is checked first;
 * the stream is then counted so a chunked body without a length is capped too.
 */
async function readRequestBody(
  request: Request,
  maxBytes: number,
): Promise<ArrayBuffer | 'too-large' | 'unreadable'> {
  const declared = request.headers.get('content-length');
  if (declared !== null && Number(declared) > maxBytes) return 'too-large';
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return 'too-large';
      }
      chunks.push(value);
    }
  } catch {
    return 'unreadable';
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

function toEdgeResponse(upstream: Response): Response {
  const status = upstream.status;
  if (status >= 300 && status < 400) {
    // The FE never follows redirects. Do not expose the upstream Location either.
    void upstream.body?.cancel();
    return jsonResponse(502, 'The Carelog API returned an unexpected redirect.');
  }
  const headers = new Headers({
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  if (status === 204 || status === 205) {
    void upstream.body?.cancel();
    return new Response(null, { status, headers });
  }
  const contentType = upstream.headers.get('content-type') ?? '';
  if (!isJsonContentType(contentType)) {
    // Proxies and tunnels answer with HTML error pages. Replace them so the FE API
    // client always receives the JSON status it expects, never an SPA or proxy page.
    void upstream.body?.cancel();
    return jsonResponse(status, messageForStatus(status));
  }
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return new Response(upstream.body, { status, headers });
}

/**
 * Routes one request. `upstreamFetch` is injectable so tests and the Playwright
 * mock Gateway can stand in for the real Gateway.
 */
export async function handleDevEdgeRequest(
  request: Request,
  env: DevEdgeEnv,
  upstreamFetch: UpstreamFetch = (url, init) => fetch(url, init),
): Promise<Response> {
  // Checked on the raw string, before any URL normalization, for every path.
  if (isForbiddenRawPath(rawPathOf(request.url))) {
    return jsonResponse(400, 'Invalid request path.');
  }

  const url = new URL(request.url);
  if (!isApiNamespace(url.pathname)) {
    if (!env.ASSETS) return jsonResponse(404, messageForStatus(404));
    return env.ASSETS.fetch(request);
  }
  // `/API/...` and other casings are API paths. They never reach the SPA fallback and
  // never reach the Gateway, whose routes are case-sensitive.
  if (!isApiPath(url.pathname)) return jsonResponse(404, messageForStatus(404));

  let gatewayOrigin: string;
  let publicOrigin: string;
  let timeoutMs: number;
  try {
    gatewayOrigin = parseExactOrigin(env.GATEWAY_ORIGIN, 'GATEWAY_ORIGIN');
    publicOrigin = parseExactOrigin(env.PUBLIC_ORIGIN, 'PUBLIC_ORIGIN');
    timeoutMs = parseUpstreamTimeout(env.UPSTREAM_TIMEOUT_MS);
  } catch {
    // Fail closed without naming the setting values in the response.
    return jsonResponse(500, 'The DEV edge is not configured.');
  }

  if (!(ALLOWED_METHODS as readonly string[]).includes(request.method)) {
    return jsonResponse(405, 'Method not allowed.', { allow: ALLOWED_METHODS.join(', ') });
  }
  if (
    isAuthPath(url.pathname) &&
    !(request.method === 'POST' && AUTH_POST_PATHS.has(url.pathname))
  ) {
    return jsonResponse(405, 'Method not allowed.', { allow: 'POST' });
  }

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  // The Worker's own address is the only client address the Gateway should trust.
  const clientAddress = request.headers.get('cf-connecting-ip');
  if (clientAddress) headers.set('x-forwarded-for', clientAddress);
  // The Gateway's registration CORS check compares Origin against its allowlist on
  // every request to this path, including non-preflight POST. Send the public origin.
  if (request.method === 'POST' && url.pathname === REGISTRATION_PATH) {
    headers.set('origin', publicOrigin);
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const read = await readRequestBody(request, MAX_REQUEST_BODY_BYTES);
    if (read === 'too-large') return jsonResponse(413, 'Request body is too large.');
    if (read === 'unreadable') return jsonResponse(400, 'The request body could not be read.');
    body = read;
  }

  let upstream: Response;
  try {
    upstream = await upstreamFetch(`${gatewayOrigin}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      redirect: 'manual',
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      return jsonResponse(504, 'The Carelog API did not respond in time.');
    }
    return jsonResponse(502, 'The Carelog API is unavailable.');
  }
  return toEdgeResponse(upstream);
}
