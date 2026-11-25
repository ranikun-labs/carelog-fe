// Same-origin edge for the Carelog DEV frontend (docs/adr/0002-same-origin-dev-worker.md).
// The browser talks only to this origin. Requests under /api/ are forwarded to the
// shared Gateway; everything else is served from the built SPA assets.
// Nothing here logs request or response content: tokens and passwords never leave memory.

export interface DevEdgeEnv {
  /** Exact HTTPS origin of the shared Gateway, no path (set per environment). */
  GATEWAY_ORIGIN?: string;
  /** Exact origin the browser sees for this Worker. Must be in the Gateway's registration allowlist. */
  PUBLIC_ORIGIN?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

export type UpstreamFetch = (url: string, init: RequestInit) => Promise<Response>;

const REGISTRATION_PATH = '/api/v1/auth/carelog/registration';
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

export class DevEdgeConfigError extends Error {}

export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
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
  const url = new URL(request.url);
  if (!isApiPath(url.pathname)) {
    if (!env.ASSETS) return jsonResponse(404, messageForStatus(404));
    return env.ASSETS.fetch(request);
  }

  let gatewayOrigin: string;
  let publicOrigin: string;
  try {
    gatewayOrigin = parseExactOrigin(env.GATEWAY_ORIGIN, 'GATEWAY_ORIGIN');
    publicOrigin = parseExactOrigin(env.PUBLIC_ORIGIN, 'PUBLIC_ORIGIN');
  } catch {
    // Fail closed without naming the setting values in the response.
    return jsonResponse(500, 'The DEV edge is not configured.');
  }

  if (!(ALLOWED_METHODS as readonly string[]).includes(request.method)) {
    return jsonResponse(405, 'Method not allowed.', { allow: ALLOWED_METHODS.join(', ') });
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
  if (url.pathname === REGISTRATION_PATH) headers.set('origin', publicOrigin);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await upstreamFetch(`${gatewayOrigin}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      redirect: 'manual',
      body: hasBody ? await request.arrayBuffer() : undefined,
    });
  } catch {
    return jsonResponse(502, 'The Carelog API is unavailable.');
  }
  return toEdgeResponse(upstream);
}
