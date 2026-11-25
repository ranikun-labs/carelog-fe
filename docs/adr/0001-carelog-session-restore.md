# ADR 0001: Restore the Carelog session across page reloads

- Status: Accepted for Seoul DEV acceptance. Production persistence still needs the
  product/auth owner decision in `docs/production-auth-owner-gate.md`.
- Scope: `src/integrations/carelog/authPort.ts`, `productionAuthRuntime.ts`

## Context

Core (`platform-core/identity`, `POST /api/v1/auth/login`, `/refresh`) returns
`accessToken` and `refreshToken` in the JSON body. It sets no cookie and defines no
browser session contract. `/refresh` takes `{ refreshToken }` and rotates the pair.

Before this ADR, both tokens lived only in page memory, so every reload returned the
user to Anonymous. The DEV acceptance flow (sign up, log in, create data, reload,
confirm the same data) cannot pass that way.

## Decision

- The **access token stays in page memory** only. It is sent as a Bearer header.
- The **refresh token is mirrored into `sessionStorage`** under one key,
  `carelog.auth.refreshToken`. It is written on every successful login or rotation and
  cleared on logout, a new login, or a refresh the server rejects (401/404).
- On load, `bootstrapSession` reads the refresh token, calls `/refresh`, and stores the
  rotated pair. A rejected token returns the page to Anonymous. A network failure keeps
  the token and shows the retry state.
- Credentials stay `omit`. Nothing is sent as a cookie, so no CORS credentials or CSRF
  surface is added.

## Deployment note

The DEV frontend is served same-origin by a Worker (`docs/adr/0002-same-origin-dev-worker.md`).
That does not change this decision: the refresh token is still in `sessionStorage`, and
the access token is still memory-only.

## Alternatives considered

1. **Memory only (previous state).** Safest for XSS, but a reload logs the user out, so
   the acceptance flow fails. Rejected for DEV.
2. **`localStorage`.** Survives browser restarts and is shared across tabs. That widens
   the exposure window and the blast radius of one stolen token. Rejected.
3. **httpOnly cookie set by Core/Gateway (recommended for production).** JavaScript
   cannot read it, which is the strongest XSS posture. It needs a backend change: Core
   `Set-Cookie` on login and refresh, Gateway CORS with credentials for the exact FE
   origin, `SameSite`, and CSRF protection for refresh and logout. This is not in place.
4. **Chosen: sessionStorage refresh token.** Survives reload within one tab, is cleared
   when the tab closes, and needs no backend change. It is readable by any script running
   on the page while the tab is open.

## Consequences

- An XSS on the FE can read the refresh token for the life of the tab. The FE mitigates
  this only by keeping its dependency and script surface small. It does not solve it.
- Core rotates on every refresh, so a stolen earlier refresh token stops working after
  the next legitimate refresh. Replay detection is Core's responsibility and is not
  verified here.
- Storage that is blocked or throws degrades to memory-only. The adapter does not crash,
  and a reload simply returns to Anonymous.
- Signup creates no session (see below). The adapter signs the user in with the same
  password login, so the restore path is one path.

## Signup and idempotency (related)

- Signup calls `POST /api/v1/auth/carelog/registration` through the Gateway with
  `Idempotency-Key`. Core answers 201 with a message-only envelope, so the adapter sends
  `withoutData` and does not expect `data`.
- 503 (PENDING or transient) is retried up to 3 times with the same key and body. A
  resubmitted form with identical values reuses the key, so Core replays the outcome.
- 409 and 400 are terminal and clear the key. A changed form value gets a new key.
- The key and the pending payload are held in page memory only and are cleared on success.
- After 201 the adapter logs in with `POST /api/v1/auth/login`. If that login fails, the
  UI says the account was created and asks the user to log in.

## Logout and tab edge cases

- **Logout runs only when an access token is in memory.** `logout()` returns early
  without calling `/api/v1/auth/logout` when there is no access token. A page that
  holds only a refresh token (for example after a failed restore, or a reload that
  has not refreshed yet) therefore clears local state while the server refresh
  session stays valid until it expires or is rotated.
- **Expired access token at logout.** The logout client has no refresh-recovery
  path, so Core's 401 rejects `logout()` after local state is cleared. The server
  refresh session again remains. The same local-clear-first order applies.
- **Duplicated tab.** Browsers copy `sessionStorage` into a duplicated tab. Both tabs
  then hold the same refresh token. The first refresh rotates it, and the other tab's
  next refresh is rejected (401/404) and it returns to Anonymous. Logout in one tab
  revokes the shared server session, so the other tab's next call fails the same way.
- Mitigation is a follow-up, not part of this ADR: attempt a refresh before logout
  when only a refresh token is present, and show a clear "signed out in another tab"
  state instead of a generic failure.

## Open items

- Product/auth owner approval of browser persistence before it is promised to users.
- Confirm that Seoul DEV `PLATFORM_GATEWAY_AUTH_URI` routes `/api/v1/auth/**` to Platform
  Core. Registration uses the same route. The Carelog BE upstream has no such endpoint.
- Confirm that Carelog BE accepts the Core-issued access token on product APIs.
- Move to an httpOnly cookie contract when the backend supports it. Then remove the
  sessionStorage vault.
