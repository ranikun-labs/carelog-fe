# Carelog P0 implementation contract

Status: `FOUNDATION_V1_0_0_APPLYING` (visual LOCK lifted by the Owner; product-meaning contract retained)

This document is the durable React implementation snapshot for Carelog P0. It records only the
decisions locked by the Design Sprint and RPL-56 campaign contract; anything not listed here is not
implicitly approved.

## Source precedence

When sources disagree, use this order:

1. STEP 4b-2 Final Implementation Handoff
2. STEP 4b-1 Design Tokens / Components
3. STEP 4a Final Stress Test
4. STEP 3-3 / 3-2 / 3-1 Locked Designs
5. STEP 2 Historical Exploration Only

The visual reference is `Carelog Final Visual Reference`. This snapshot is the repository-local
implementation source for the values below; it does not copy the original design HTML.

## Product and time-axis contract

The P0 product core is:

`User -> Workspace -> Customer -> CustomerEvent`

`CustomerEvent.status` is one of `PLANNED`, `OCCURRED`, or `CANCELLED`.

- `PLANNED` owns `scheduledAt`.
- `OCCURRED` owns `occurredAt`.
- `CANCELLED` preserves the original planned `scheduledAt`; `occurredAt` is not synthesized.
- Overdue is derived as `status === PLANNED && scheduledAt < now`. It is not an event status.
- Prepared is an expression of a `PLANNED` event. It is not an event status.
- Timeline is an `OCCURRED` event projection.
- Follow-up is the P0 expression of a `PLANNED` event.
- Scenario labels such as visit or contact are optional descriptors, not a core event-type enum.

## Design Foundation v1.0.0 (visual contract)

Status of the visual contract: **LOCK lifted by the Owner; Ranikun Labs Design Foundation v1.0.0 is
being applied** (PR-1: tokens and shared UI). The product-meaning contract above (time axis, status
grammar, boundaries below) is **not** lifted.

Carelog follows Foundation as-is except for the four rows below. Policy text is not copied here;
the canonical Foundation lives with the design system, and the interim reference implementation is
the Finance FE at `origin/dev` `7dd9590` (see "Interim copy mechanism").

| Where Carelog differs | Carelog value                                                                                | Why                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Brand                 | `brand.carelog` Teal: strong `#007974`, deep `#00605c`, subtle `#d9f1ef`                     | Product identity (Dark: `#3cb7ab` / `#8fe0d6` / `#0f2e2c`) |
| Density               | Compact: control height 44, type 22/18/15/20/15/14/13/12/12, line 30/26/22/28/24/21/19/17/17 | Information-dense, phone-first screens                     |
| Status rails          | 3px rail. PLANNED = `info`, overdue = `warning`, others = divider                            | Product status grammar (decision D-4)                      |
| Compatibility aliases | RPL-56 names (`accent-primary*`, `bg-*`, `text-primary`, `border-*`) remain                  | Screens migrate PR by PR; removed in PR-10                 |

Everything else (neutral surfaces, text roles, status colors, radius set badge 6 / control 10 /
inset 12 / card 16 / sheet 24, focus, shadows only on overlays) is Foundation. `src/styles/globals.css`
marks `[FOUNDATION]` and `[CARELOG]` sections.

Rules that tests enforce (`src/styles/contrast.test.ts`, `globals.test.ts`):

- Text and status pairs are at least 4.5:1 in Light and Dark; control outlines and the focus ring at least 3:1.
- **Text on a `brand-subtle` surface must be `brand-deep`.** Teal strong on subtle is 4.46:1 (below 4.5).
- Dark `on-strong` (`#0b1220`, 7.63:1 on Teal strong) and Dark `brand-border` (`#2a6b65`) are
  **proposals (unconfirmed)**; the first is guarded at 4.5:1 or more.
- Dark mode is exposed in Account > Display mode (System / Light / Dark; Owner approval G2). Default follows the system setting; the choice is stored only in this browser's `localStorage` (`carelog.theme`), never sent to a server. An inline script in `index.html` applies it before first paint; `color-scheme` and `theme-color` are kept in sync. Dark `on-strong` stays a proposal (D-2).

Open items (not decided here):

- Known violation kept for the Auth status PR: `AuthStatusSurface` uses `text-accent-primary` on
  `bg-accent-primary-bg` (Teal strong on subtle). The contrast test pins it as the only exception.

## Interim copy mechanism (shared UI)

There is no shared package yet, so `src/components/ui/{card,section-header,info-row,select-chip,error-state}.tsx`
are **verbatim** copies and `button.tsx`, `badge.tsx` are **derived** copies of the Finance FE at
`7dd9590` (Foundation 1.0.0). This is a temporary mechanism; delete it when a package exists.

- Provenance: first line of each file, plus `design-foundation.lock.json` (source sha, upstream sha256, derived-file hash, patch list).
- Drift test: `src/components/ui/design-foundation-drift.test.ts` fails if a verbatim file differs from upstream, or if a derived file changes without updating the lock and its patch list.
- Local needs go upstream first, or into `src/components/common/`. Derived patches are limited to the lock's list.
- To update: take the new upstream files, recompute `sha256` (`sha256sum` of the upstream blob; verbatim body = file minus its first line), update `source.sha` and the headers, and review the upstream diff in the PR.
- `text-field.tsx`, `field-message.tsx`, `notice.tsx` were added later as **verbatim** copies of Finance FE `1c7b014`
  (they did not exist at `7dd9590`). Their lock entries carry a per-file `sourceSha`; the drift test checks the
  header and body against that SHA. Existing entries are unchanged.
- Not copied: Dialog, Checkbox (no call site).

## Accessibility baseline

- Interactive hit targets are at least `44px` in both dimensions; visual icons may remain smaller.
- `focus-visible` is a global 2px brand outline (`--ring`) with a 2px offset.
- Disabled primitives use opacity `0.5` (Foundation; was `0.4` under the old lock) and permit product flows to provide a textual or accessible
  reason. RPL-56 does not invent that copy.
- Generic Button, Badge, and layout foundations must not clip text at increased text scale.
- Hover is never the only interaction or state indicator.
- Form fields use `TextField` (label, hint and error linked by `htmlFor`, `aria-describedby`, `aria-invalid`; 44+ height).
  A validation error belongs to its field (`FieldMessage`); a save failure is a danger `Notice` and keeps the typed input.
  Single choices use native radios (the language choice in Account and the event kind choice).
  Scroll surfaces that hold a form set `scroll-padding-bottom` so the focused field is not hidden by the keyboard.

## Responsive foundation

- `375px`: phone, single column, bottom navigation.
- `768px` portrait: single column, side navigation rail, content width approximately `520px`.
- `1024px` portrait: large-mobile single column, content width approximately `560px`.
- A two-pane composition may activate only when available width is at least `1100px` and the
  viewport is landscape.
- `1180px+` landscape is two-pane capable.

Shell behaviour (PR-2) and where it deliberately differs from the Foundation v1.0.0 responsive
recommendation (0-767 bottom tabs, 768-1099 narrow rail, 1100+ sidebar / two-pane). **The Host
contract wins**; the differences are:

- The 80px rail is also the width that makes `availableWidth = viewport - 80`. A two-pane therefore
  starts at a **1180px** landscape viewport, not 1100. At a 1100px landscape viewport
  `availableWidth` is 1020, so the host stays single-column by contract (not a defect). The
  v1.0.0 "1100+ sidebar" is not adopted; a wider sidebar would raise the threshold further.
- Changing the 1100 threshold, the 80px rail width, or the landscape condition changes the LOCK
  value and needs an Owner gate. PR-2 changes none of them (`adaptiveHostModel.test.ts` pins them).
- Safe area: top/left/right are applied once on `AppShell` (and the public/auth chrome), bottom by
  `BottomNavigation` (phone) or the shell (>= 768). The viewport already uses `viewport-fit=cover`.
- Shell tabs use the 12px `type-label` role; focus is the global ring (no per-link outline).

RPL-56 only removes the permanent 480px host limitation and supplies an opt-in adaptive seam. It
does not implement a Schedule/Event Detail two-pane screen or stretch the RPL-49 screens into a new
desktop design.

## Responsibility boundaries

- **RPL-56:** semantic tokens, primitive capability, accessibility baseline, adaptive host seam, and
  responsive verification foundation.
- **RPL-57:** canonical CustomerEvent model and information-preserving legacy adapter. It retains
  `CustomerContext` as a legacy snapshot view model, maps `TimelineEntry` to `OCCURRED`, maps only
  unfinished `FollowUp` records to `PLANNED`, and does not promote `Interaction` to an event.
- **RPL-58:** Schedule/Agenda, Event Detail, and the navigation change from today/customers/follow-up
  to schedule/customers.

RPL-56 does not rewrite the RPL-49 Customer List -> Customer Detail -> Timeline product flow.

## Explicitly undefined

The following remain `UNDEFINED — implementation decision` and must not be silently locked by
RPL-56:

- Customer List Row final component
- Search, filter, and sort
- Input and Textarea final visual contracts
- Save failure and Event Memo save failure UX
- Skeleton delay threshold
- Exact product-component React prop signatures
- Production API DTO and backend schema
