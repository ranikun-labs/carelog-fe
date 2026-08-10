# Carelog P0 implementation contract

Status: `DESIGN_SPRINT_FINAL_LOCK`

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

## Semantic color tokens

| Token                       | Value                  | Role                                                        |
| --------------------------- | ---------------------- | ----------------------------------------------------------- |
| `bg-page`                   | `oklch(97% 0.004 90)`  | App background and space outside desktop panes              |
| `bg-surface`                | `oklch(100% 0 0)`      | Card, pane, and row background                              |
| `bg-subtle`                 | `oklch(96% 0.006 90)`  | Upcoming, memo, AI context, and neutral subtle blocks       |
| `text-primary`              | `oklch(22% 0.01 260)`  | Customer, event, and screen titles                          |
| `text-secondary`            | `oklch(40% 0.012 260)` | Body, event summary, and memo                               |
| `text-tertiary`             | `oklch(53% 0.01 260)`  | Date, time, metadata, section label, and placeholder        |
| `status-neutral-foreground` | `oklch(48% 0.012 260)` | Neutral status and tag label                                |
| `border-subtle`             | `oklch(94% 0.006 90)`  | Row and section divider                                     |
| `border-default`            | `oklch(90% 0.006 90)`  | Card, pane, and input outline                               |
| `accent-primary`            | `oklch(52% 0.1 235)`   | Primary action, Today marker, and active navigation         |
| `accent-primary-deep`       | `oklch(45% 0.1 235)`   | Accent-background text, secondary action, and customer link |
| `accent-primary-bg`         | `oklch(94% 0.025 235)` | Planned/prepared badge and selected row                     |
| `accent-primary-rail`       | `oklch(70% 0.09 235)`  | `PLANNED` status rail                                       |
| `warning`                   | `oklch(45% 0.1 70)`    | Overdue/error text and cue                                  |
| `warning-bg`                | `oklch(94% 0.03 70)`   | Overdue badge and cue background                            |
| `warning-rail`              | `oklch(70% 0.11 70)`   | Overdue `PLANNED` status rail                               |
| `rail-neutral`              | `oklch(88% 0.006 90)`  | `OCCURRED` and `CANCELLED` status rail                      |

`bg-subtle` does not communicate status. `accent-primary` communicates action rather than event
status. The canonical tertiary text value is 53%; the 48% neutral status/tag foreground is a
separate semantic role.

The existing dark palette is preserved for compatibility. A final dark-mode palette is not locked.

## Typography

| Token      | Size / weight / line-height |
| ---------- | --------------------------- |
| `display`  | `24px / 700 / 1.3`          |
| `title-lg` | `20px / 700 / 1.35`         |
| `title`    | `18px / 700 / 1.4`          |
| `body-lg`  | `16px / 700 / 1.45`         |
| `body`     | `14px / 400-700 / 1.6`      |
| `body-sm`  | `13px / 400-600 / 1.6`      |
| `meta`     | `12px / 400-600 / 1.5`      |
| `label`    | `11px / 600 / 1.4`          |

## Spacing and shape

- Spacing: `4, 8, 12, 16, 20, 24, 32px` as `space-1, 2, 3, 4, 5, 6, 8`.
- Radius: badge `6px`, control `8px`, card `12px`, pane `16px`.
- Border: normal `1px`, status rail `3px`.
- Default shadow: none.

## Status grammar

| State              | Rail                       | Badge/expression                             | Additional rule                                             |
| ------------------ | -------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| `PLANNED`          | `accent-primary-rail`, 3px | `예정` where detail needs an explicit status | Transition history is not encoded by color                  |
| Overdue `PLANNED`  | `warning-rail`, 3px        | `정리 필요`; meta may say `예정 시각 지남`   | Status remains `PLANNED`                                    |
| `OCCURRED`         | `rail-neutral`, 3px        | Optional descriptor                          | Do not dim the entire past event                            |
| `CANCELLED`        | `rail-neutral`, 3px        | Explicit `취소됨`                            | Header may be diminished; body and memo remain full opacity |
| Prepared `PLANNED` | `accent-primary-rail`, 3px | `준비됨`                                     | Status remains `PLANNED`                                    |

Badges always contain a visible label and are not actions. Color must not be the only status cue.

## Accessibility baseline

- Interactive hit targets are at least `44px` in both dimensions; visual icons may remain smaller.
- `focus-visible` is a 2px accent outline with a 2px offset.
- Disabled primitives use opacity `0.4` and permit product flows to provide a textual or accessible
  reason. RPL-56 does not invent that copy.
- Generic Button, Badge, and layout foundations must not clip text at increased text scale.
- Hover is never the only interaction or state indicator.
- Existing inputs retain sufficient non-text contrast when touched; a final Input/Textarea component
  is not defined here.

## Responsive foundation

- `375px`: phone, single column, bottom navigation.
- `768px` portrait: single column, side navigation rail, content width approximately `520px`.
- `1024px` portrait: large-mobile single column, content width approximately `560px`.
- A two-pane composition may activate only when available width is at least `1100px` and the
  viewport is landscape.
- `1180px+` landscape is two-pane capable.

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
- Dark-mode final visual contract
