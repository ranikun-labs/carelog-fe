# Production Auth Owner Decision Gate

The FE adapter implements the verified Carelog password-login contract and uses
the configured shared Gateway origin. The following production decisions remain
open and must be confirmed before enabling the affected flows.

## V1 routing

`platform-services/main` routes `/api/v1/auth/**` through
`PLATFORM_GATEWAY_AUTH_URI`. In Seoul DEV that value is set to Platform Core:
`platform-infra` `environments/dev/platform/services.tf` (line 51) sets
`PLATFORM_GATEWAY_AUTH_URI = http://<prefix>-core.<namespace>:8081`. Production
is not confirmed in these repositories and must be verified by the runtime owner
before release. The FE must set `VITE_CARELOG_API_BASE_URL` to the HTTPS shared
Gateway origin, without a path suffix (or use the same-origin Worker, see the
ADR's deployment note).

## Browser token lifetime

Core (`/api/v1/auth/login`, `/refresh`) returns `accessToken` and `refreshToken`
in JSON and does not define a browser cookie contract. This adapter keeps access tokens in page memory, sends
them as Bearer headers, sends refresh tokens in the verified refresh request body,
and omits cookies. The refresh token is also mirrored into `sessionStorage` so a
reload within the same tab restores the session (see `docs/adr/0001-carelog-session-restore.md`).
The product/auth owner must approve this cross-reload policy, or provide a
server-managed cookie session contract, before persistent sessions are promised
to users. Seoul DEV acceptance uses this decision; production is not approved by it.

## Kakao callback

Carelog BE accepts `POST /api/v1/auth/oauth/kakao/authorization` with
`{ clientChannel: "WEB", returnTo }` and returns only `authorizationUrl`; BE
generates and stores state server-side (default TTL 5 minutes). The callback
exchange is `POST /api/v1/auth/oauth/kakao/exchange` with `{ code, state }` and
returns the Carelog token pair for linked accounts. Invalid state/provider auth
returns 401; unlinked or conflicting accounts return 409; state-store failure
returns 503. The production callback URI is selected by BE runtime configuration
for the registered product client, and its value and FE route are not present in
the inspected repositories. The OAuth owner must confirm the callback owner,
exact HTTPS redirect URI, and how the FE preserves `returnTo` before a callback
route or Kakao button is added.

## Verified password endpoints

- `POST /api/v1/auth/login`: `{ userId, password }` → `{ accessToken, refreshToken }`.
- `POST /api/v1/auth/refresh`: `{ refreshToken }` → a rotated token pair.
- `POST /api/v1/auth/logout`: Bearer access token → HTTP 204; BE blacklists the
  access token and deletes the account refresh session.
- Login credentials map explicitly as `account → userId` and `secret → password`.
- Signup uses `POST /api/v1/auth/carelog/registration` through the Gateway with an
  `Idempotency-Key` header. It is available only when the Gateway registration flag is on.
  The legacy `/api/v1/users/managers` path is not used. Registration returns no tokens;
  the adapter then signs in with the password login above.

The shared Gateway keeps login and refresh public only for exact POST routes.
Logout and product APIs require a valid, non-blacklisted Bearer access token;
the Gateway removes caller-supplied trusted headers and injects its own BE
credential/claims. The FE sends only `Authorization: Bearer <accessToken>` and
never sends Gateway-internal headers. Missing, invalid, expired, or blacklisted
access tokens are rejected with 401; authenticated requests denied by BE policy
return 403. BE maps invalid credentials and invalid/expired refresh tokens to
401, a refresh token absent from the session store to 404, and rotates a
successful refresh by replacing the prior stored refresh token with a new pair.
Kakao account-unlinked and identity-conflict outcomes are 409; they are not
treated as password-login failures.
