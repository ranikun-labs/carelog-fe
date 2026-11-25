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

- A Worker serves the built SPA (`dist/`) and proxies every `/api/` request to the shared Gateway.
  The FE is built with `VITE_CARELOG_API_BASE_URL=/`, so all calls are relative.
- `PUBLIC_ORIGIN` is the exact browser origin of the Worker. The Worker sends it as `Origin`
  on `POST /api/v1/auth/carelog/registration` only. That origin must be in the Gateway allowlist.
- `GATEWAY_ORIGIN` is the exact HTTPS origin of the public DEV Gateway, with no path.
  It is a Worker secret, not a committed value. Plain HTTP is accepted only for loopback, for local runs.
- Forwarded request headers are an allowlist: `accept`, `accept-language`, `authorization`,
  `content-type`, `idempotency-key`. `cf-connecting-ip` becomes `x-forwarded-for`, which
  overwrites any client-supplied value. Cookies and hop-by-hop headers are dropped.
- Forwarded response headers are `content-type`, `retry-after`, `www-authenticate`. `Set-Cookie`
  and `Location` are dropped. Every `/api` response is `Cache-Control: no-store`.
- Errors stay JSON. An upstream HTML page, or an unknown `/api` path, is replaced with
  `{status, message}` at the same status. A 3xx from upstream becomes 502. A 500 with no
  details is returned when the config is invalid. An unreachable upstream becomes 502. Nothing reaches the SPA fallback.
- Unknown `/api` paths are never served from assets. `wrangler.toml` sets `run_worker_first = ["/api/*"]`.

## Exact values to configure

| Name                                                    | Where          | Value                                                                                                                                                               |
| ------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_ORIGIN`                                         | Worker secret  | `https://<dev-fe-host>` (scheme, host, port; no path). Example form only.                                                                                           |
| `GATEWAY_ORIGIN`                                        | Worker secret  | `https://<dev-api-host>` (the public Cloudflare Tunnel hostname that maps to the Gateway, no path).                                                                 |
| `PLATFORM_GATEWAY_CARELOG_REGISTRATION_ENABLED`         | Gateway env    | `true`                                                                                                                                                              |
| `platform.gateway.carelog-registration-allowed-origins` | Gateway config | exactly the `PUBLIC_ORIGIN` value. Env form assumed to be `PLATFORM_GATEWAY_CARELOG_REGISTRATION_ALLOWED_ORIGINS` (Spring relaxed binding). Verify before enabling. |
| `PLATFORM_GATEWAY_AUTH_URI`                             | Gateway env    | Platform Core, already `http://<prefix>-core.<namespace>:8081` in `platform-infra` `environments/dev/platform/services.tf:51`                                       |
| `PLATFORM_GATEWAY_OAUTH_RATE_LIMIT_TRUSTED_PROXY_HOPS`  | Gateway env    | Must match the real chain Worker to Tunnel to Gateway. Not verified here.                                                                                           |
| Build                                                   | CI or local    | `VITE_CARELOG_API_BASE_URL=/ pnpm build:client` (outputs `dist/`)                                                                                                   |
| Deploy                                                  | `worker/`      | `wrangler deploy` with the two secrets set. Not run here: no Cloudflare account access.                                                                             |

## Verification

- `worker/src/dev-edge.test.ts` (23 tests): routing, Origin rewrite, X-Forwarded-For
  overwrite, error JSON for 401/404/409/503/530, 502 on unreachable upstream, 3xx, 204,
  405, forced `no-store`, header allowlists, and fail-closed config.
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

## Open items

- Confirm the Spring env-binding name for the allowlist and the trusted-hop count against the deployed chain.
- Confirm the Gateway's public DEV hostname is the one the Worker should use for `GATEWAY_ORIGIN`.
- The live path has not been exercised: no Worker deploy, no DEV Gateway call, no CI run on this branch.
