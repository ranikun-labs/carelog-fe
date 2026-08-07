# React Product Foundation

A minimal React product starter with localized public pages, a mobile-first application shell,
typed ko/en messages, four-path pre-rendering, accessible navigation, reusable UI primitives, and
an optional-ready Capacitor configuration.

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
/app/items
/app/items/:id
/app/settings
```

Route constants and builders live in `src/constants/routes.ts`. Change routes there first, then
update `src/app/AppRouter.tsx` and the pre-render manifest. Bottom tabs are configured once in
`src/constants/navigation.ts`; labels remain in the typed dictionaries.

## Customize before use

- [ ] Change the `package.json` package name and description.
- [ ] Replace the HTML title and description in `index.html`.
- [ ] Replace the brand name in `src/i18n/messages/`.
- [ ] Replace color and typography tokens in `src/styles/globals.css`.
- [ ] Replace public and app routes in `src/constants/routes.ts`.
- [ ] Replace bottom navigation in `src/constants/navigation.ts`.
- [ ] Replace all ko/en product copy while keeping both dictionary shapes aligned.
- [ ] Change the `react-product-foundation.language` local-storage key.
- [ ] Change Capacitor `appId`.
- [ ] Change Capacitor `appName`.
- [ ] Change the four pre-render paths and their tests.
- [ ] Remove or replace `ComplianceNotice`.
- [ ] Replace the example items.
- [ ] Add the product's analytics and error monitoring.
- [ ] Add reviewed privacy and legal text.

### Capacitor

Capacitor dependencies and `capacitor.config.ts` are included, but native projects are deliberately
absent. The checked-in values are placeholders:

- `appId`: `com.example.reactproductfoundation`
- `appName`: `React Product Foundation`

Change both to official product values **before** running any native initialization command. Do not
run `cap add ios` or `cap add android` while the placeholder identity remains. The web output is
`dist`.

### Font

Pretendard Variable is self-hosted in `src/assets/fonts/` and its license is included beside it.
To replace it:

1. Add the replacement font file and required license or attribution.
2. Update `src/styles/fonts.css`.
3. Update `--font-sans` in `src/styles/globals.css`.
4. Remove the Pretendard file and license only after no CSS references remain.

### Localization

Public locale is URL-owned. App locale is stored under
`react-product-foundation.language`, with `navigator.languages` and `ko` as fallbacks.
`I18nProvider` keeps `<html lang>` synchronized. Add a locale by updating the locale allowlist,
both typed message resources, public path generation, pre-render expectations, and tests.

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
  not included, to keep the template platform-neutral. Add the rewrite rule for your chosen host
  before shipping.

### Compliance notice

`src/components/ComplianceNotice.tsx` is an independent, informational example with no title,
action, or product-specific legal language. Remove it when the product does not need a notice, or
replace its dictionary message after policy review.

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

Playwright covers 375 px, 480 px, and a centered 480 px app frame in a 1024 px viewport.

## Provenance

This repository uses a clean initial history. It selectively extracts reusable structure from a
verified foundation rather than carrying product history or copying product screens verbatim. See
[the provenance record](docs/provenance.md).
