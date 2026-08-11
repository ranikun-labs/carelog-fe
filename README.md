# Carelog

Mobile-first React frontend for Carelog — a generic customer relationship tool that keeps
customer context, timeline entries, and follow-up work in one place. Built on a localized public
site, a mobile app shell, typed ko/en messages, pre-rendering, accessible navigation, and reusable
UI primitives.

## Quick start

Requirements:

- Node 22 (`22.23.1` is pinned)
- pnpm 11 (`11.15.1` is pinned through Corepack)

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

## Routes

Public locale comes from the URL:

```text
/                 replace redirect to /ko
/:locale          localized public home (ko or en)
/:locale/features localized feature summary
```

Unsupported public locales render the public not-found screen.

The app uses local storage, then the browser locale, then `ko`:

```text
/app
/app/customers
/app/customers/:customerId
/app/customers/:customerId/import
/app/reviews/:reviewId
/app/customers/:customerId/handoff
/app/follow-ups
```

Route constants and builders live in `src/constants/routes.ts`. Change routes there first, then
update `src/app/AppRouter.tsx` and the pre-render manifest. Bottom tabs (오늘 / 고객 / 후속 업무) are
configured once in `src/constants/navigation.ts`; labels remain in the typed dictionaries.

## Product contract

Carelog is a generic customer CRM, not a vertical-specific product. The canonical product model is
`User -> Workspace -> Customer -> CustomerEvent`. RPL-49 types such as `CustomerContext`,
`Interaction`, `TimelineEntry`, and `FollowUp` remain compatibility models; event-capable records
cross the legacy adapter before canonical consumers use them. The model is shared across scenarios,
for example a landlord's tenants or a physical therapist's patients. Scenario-specific words appear
only in copy and fixture metadata, never as core type, route, or component names.

### Capacitor

Capacitor dependencies and `capacitor.config.ts` are included, but native projects are deliberately
absent.

- `appId`: `com.carelog.app`
- `appName`: `Carelog`

Do not run `cap add ios` or `cap add android` until native shipping is actually planned. The web
output is `dist`.

### Font

Pretendard Variable is self-hosted in `src/assets/fonts/` and its license is included beside it.
To replace it:

1. Add the replacement font file and required license or attribution.
2. Update `src/styles/fonts.css`.
3. Update `--font-sans` in `src/styles/globals.css`.
4. Remove the Pretendard file and license only after no CSS references remain.

### Localization

Public locale is URL-owned. App locale is stored under `carelog.language`, with
`navigator.languages` and `ko` as fallbacks. `I18nProvider` keeps `<html lang>` synchronized. Add a
locale by updating the locale allowlist, both typed message resources, public path generation,
pre-render expectations, and tests.

### Pre-rendering

`pnpm build` produces static HTML for `/ko`, `/en`, `/ko/features`, and `/en/features`. App routes
remain SPA routes and use the unmarked `dist/index.html` shell as the host fallback. Update
`src/prerender/manifest.ts` and `scripts/verify-prerender-output.mjs` together when public paths
change.

### SPA Host Rewrite

The app uses `BrowserRouter`, so direct navigation and page refreshes under `/app/*` need the host
to fall back to `index.html`:

- The four public routes (`/ko`, `/en`, `/ko/features`, `/en/features`) are pre-rendered and can be
  served as static files directly.
- `/app/*` routes are client-rendered only. Any unknown path under `/app` must be rewritten to
  `index.html` by the static host or CDN, or direct links and refreshes will 404.
- Host-specific rewrite config (for example a `_redirects` or `vercel.json` file) is intentionally
  not included yet. Add the rewrite rule for the chosen host before shipping.

## Verification

```sh
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
corepack pnpm verify:full
```

Playwright covers 375 px and 480 px phones, 768 px and 1024 px portrait tablets, and an 1180 px
landscape host. Existing product content retains its centered 480 px maximum while the full-width app
host provides the seam for later adaptive composition.

## Provenance

This repository uses a clean initial history. Its structural foundation (routing boundaries,
localization mechanics, rendering profile, UI primitives, and verification pattern) was
materialized from a reusable template's exact tagged snapshot rather than carrying that template's
Git history or product screens. See [the provenance record](docs/provenance.md).
