# ADR 0002: Serve the DEV frontend same-origin through a Worker

- Status: Accepted for Seoul DEV. Not yet deployed. No Worker or Gateway change was applied from this repository.
- Scope: `worker/` (edge code, `wrangler.toml`), `e2e-same-origin/`, `src/integrations/carelog/*` (`VITE_CARELOG_API_BASE_URL=/`).

## Context

- The browser must call the Gateway from the same origin as the page. Login, refresh and
  product APIs have no CORS configuration on the Gateway. Only the registration route
  (`carelog-registration-enabled`) has a CORS filter, and it accepts exact origins only.
- The Gateway's `CarelogRegistrationCorsConfiguration` (platform-services `f9adfd3`) rejects
  a non-allowlisted `Origin` with 403 on every request to that path, including the actual
  POST, not only the preflight. So the Origin the Worker sends must be in the allowlist.
- No FE hosting definition (Wrangler, Pages, Worker) exists in `carelog-fe`, `platform-infra`
  or the other workspace repositories. This ADR introduces the Worker. It does not extend an existing one.

## Decision

- A Worker serves the built SPA (`dist/`) and proxies every `/api` request to the shared Gateway.
  The FE is built with `VITE_CARELOG_API_BASE_URL=/`, so all calls are relative.
- `PUBLIC_ORIGIN` is the exact browser origin of the Worker. The Worker sends it as `Origin`
  only on `POST /api/v1/auth/carelog/registration`. That origin must be in the Gateway allowlist.
- `GATEWAY_ORIGIN` is the exact HTTPS origin of the public DEV Gateway, with no path.
  It is a Worker secret, not a committed value. Plain HTTP is accepted only for loopback, for local runs.
- Raw path guard, checked on the request URL string before any URL normalization, for every path.
  The request is rejected with JSON 400 if the path contains `%2f`, `%5c` or `%2e` (case-insensitive),
  `;`, `\`, `//`, a `..` segment, or a percent-encoded unreserved character (for example `%61uth`).
- Auth allowlist. The FE calls exactly four auth routes, all `POST`: `/api/v1/auth/login`,
  `/api/v1/auth/refresh`, `/api/v1/auth/logout`, `/api/v1/auth/carelog/registration`
  (verified against `src/integrations/carelog/authPort.ts`). Any other method or path under
  `/api/v1/auth` gets JSON 405 with `Allow: POST` and never reaches the Gateway.
- API namespace casing. `/API/...` and other casings of `/api` are API paths. They get JSON 404 from
  the edge, never the SPA fallback and never the Gateway.
- Forwarded request headers are an allowlist: `accept`, `accept-language`, `authorization`,
  `content-type`, `idempotency-key`. `cf-connecting-ip` becomes `x-forwarded-for`, which
  overwrites any client-supplied value. Cookies and hop-by-hop headers are dropped.
- Request body is capped at 64 KiB. A declared `Content-Length` over the cap, or a streamed body
  that goes over it, gets JSON 413 before anything is forwarded.
- Upstream timeout is `AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)`, default 10000 ms, accepted range
  1 to 60000. A timed-out upstream call gets JSON 504. Invalid config fails closed with JSON 500.
- Forwarded response headers are `content-type`, `retry-after`, `www-authenticate`. `Set-Cookie`
  and `Location` are dropped. Every `/api` response is `Cache-Control: no-store`.
- Errors stay JSON. An upstream HTML page is replaced with `{status, message}` at the same status.
  A 3xx from upstream becomes 502. An unreachable upstream becomes 502. A 500 with no details is
  returned when the config is invalid. Nothing reaches the SPA fallback.
- `wrangler.toml` sets `run_worker_first = ["/api", "/api/*"]`, so the lowercase API namespace never
  goes to static assets.
- Rate limiting is done at the Cloudflare WAF, not in the Worker. An in-isolate counter is not a
  global limit, so the Worker adds no guard of its own.

## Exact values to configure

| Name                                                      | Where                               | Value                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_ORIGIN`                                           | Worker secret                       | `https://<dev-fe-host>` (scheme, host, port; no path). Example form only.                                                                                                                                                                                                                                                                     |
| `GATEWAY_ORIGIN`                                          | Worker secret                       | `https://<dev-api-host>` (the public Cloudflare Tunnel hostname that maps to the Gateway, no path).                                                                                                                                                                                                                                           |
| `UPSTREAM_TIMEOUT_MS`                                     | Worker var (`[vars]`)               | `10000` (default when unset). Whole number, 1 to 60000. Keep it below the Tunnel and Cloudflare idle timeouts.                                                                                                                                                                                                                                |
| `PLATFORM_GATEWAY_CARELOG_REGISTRATION_ENABLED`           | Gateway env                         | `true`                                                                                                                                                                                                                                                                                                                                        |
| `platform.gateway.carelog-registration-allowed-origins`   | Gateway config                      | exactly the `PUBLIC_ORIGIN` value. Env form assumed to be `PLATFORM_GATEWAY_CARELOG_REGISTRATION_ALLOWED_ORIGINS` (Spring relaxed binding). Verify before enabling.                                                                                                                                                                           |
| `PLATFORM_GATEWAY_AUTH_URI`                               | Gateway env                         | Platform Core, already `http://<prefix>-core.<namespace>:8081` in `platform-infra` `environments/dev/platform/services.tf:51`                                                                                                                                                                                                                 |
| `PLATFORM_GATEWAY_OAUTH_RATE_LIMIT_TRUSTED_PROXY_HOPS`    | Gateway env                         | Must match the real chain Worker to Tunnel to Gateway. Not verified here. See the deploy checklist.                                                                                                                                                                                                                                           |
| Cloudflare WAF rate-limit rule (proposed starting values) | Cloudflare zone of the Worker route | Expression: `http.request.method eq "POST" and http.request.uri.path in {"/api/v1/auth/login" "/api/v1/auth/refresh" "/api/v1/auth/carelog/registration"}`. Counting: per IP (`ip.src`). Period 60 s, threshold 20 requests, action Block, mitigation 600 s. A clinic behind one NAT IP shares this budget, so tune it after DEV observation. |
| Build                                                     | CI or local                         | `VITE_CARELOG_API_BASE_URL=/ pnpm build:client` (outputs `dist/`)                                                                                                                                                                                                                                                                             |
| Deploy                                                    | `worker/`                           | `wrangler deploy` with the two secrets set. Not run here: no Cloudflare account access.                                                                                                                                                                                                                                                       |

## Deploy checklist (must verify before the DEV URL is shared)

1. Secrets and vars are set on the Worker: `GATEWAY_ORIGIN`, `PUBLIC_ORIGIN`. `UPSTREAM_TIMEOUT_MS` is
   either unset or a valid value. A missing or malformed secret shows up as 500 JSON on every `/api` call.
2. The Gateway allowlist binding name is confirmed, and its value equals `PUBLIC_ORIGIN` exactly.
3. **Trusted proxy hops (must verify).** Send one login from a known public IP through the Worker.
   Read the client address the Gateway logs or uses for rate limiting. It must be that IP, not a
   Cloudflare or Worker address, and not a value the client sent. Only then set
   `PLATFORM_GATEWAY_OAUTH_RATE_LIMIT_TRUSTED_PROXY_HOPS` to the hop count that gives this result.
   The Worker overwrites `x-forwarded-for` with `cf-connecting-ip`, and cloudflared may append to it.
   Verify the actual chain. Do not assume it.
4. The WAF rate-limit rule exists on the zone that serves the Worker route. Confirm that it fires on
   the Worker host by sending more than the threshold of login requests from one IP and seeing 429.
   Confirm that a rule on the Gateway host alone does not count for this route.
5. Spot checks on the deployed Worker: `GET /api/v1/auth/login` returns 405 JSON with `Allow: POST`.
   `GET /API/v1/x` returns 404 JSON. `GET /api/v1/x%2fy` returns 400 JSON. An unknown `/api` path returns JSON 404.
6. `run_worker_first` routing works in the deployed Worker. `/api` and `/api/v1/...` reach the Worker, not assets.
7. The FE build used `VITE_CARELOG_API_BASE_URL=/`, and the `dist/` deployed with the Worker matches it.

## Verification

- `worker/src/dev-edge.test.ts` (59 tests): routing and namespace casing, raw path guard, Origin rewrite,
  X-Forwarded-For overwrite, auth POST allowlist and 405s, body cap (413), upstream timeout (504),
  error JSON for 401/404/409/503/530, 502 on unreachable upstream, 3xx, 204, 405, forced `no-store`,
  header allowlists, and fail-closed config.
- `e2e-same-origin/same-origin-dev.spec.ts`: a production build with base `/`. Requests go
  through the same Worker handler via route interception, with a stateful mock Gateway. It covers
  signup, password login, reload with refresh, customer and event save, reload, logout,
  JSON 404 on an unknown `/api` path, and a 409 on a duplicate registration.
  The mock stands in for the Gateway. It does not prove the live Gateway or tunnel behaviour.

## Consequences

- Cross-origin CORS is no longer needed for login, refresh, logout or product APIs.
  Registration still goes through the allowlist because the Worker sends the public origin.
- The Worker is a trusted hop for client addresses. The Gateway must trust exactly one
  edge-verified address, so the hop count must be configured to match the real chain.
- The refresh token in `sessionStorage` (ADR 0001) is still readable by page scripts. Same-origin
  does not change that. The Worker only sets `no-store` on API responses. It does not hide tokens from JavaScript.
- The raw path guard and the auth method allowlist are edge policy, not a substitute for Gateway
  authorization. A client can still send any allowed request, so the Gateway must enforce its own checks.

## Open items

- Confirm the Spring env-binding name for the allowlist and the trusted-hop count against the deployed chain (deploy checklist 2 and 3).
- Confirm the Gateway's public DEV hostname is the one the Worker should use for `GATEWAY_ORIGIN`.
- Tune the WAF rate-limit values after DEV traffic is observed. The starting values above are not measured.
- Mixed-case paths reach the Worker only if the routing patterns match them. `run_worker_first = true`
  would send every request through the Worker, including static assets, at the cost of Worker invocations
  on every asset load. This is a decision to make before production.
- The live path has not been exercised: no Worker deploy, no DEV Gateway call, no CI run on this branch.
