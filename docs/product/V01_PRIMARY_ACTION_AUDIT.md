# v0.1 Primary Action Audit

Refs #682
Refs #681
Refs #683

## Purpose

Audit primary, secondary, destructive, hidden, disabled, and deferred actions across active v0.1 LoveBud screens so each screen has one clear user-facing action hierarchy.

This document is audit-only. It does not implement UI, routing, Auth, API, backend, database, package, workflow, or runtime behavior.

## Classification legend

| Status | Meaning |
|---|---|
| `PASS` | Current action model is acceptable for v0.1 or already covered by a merged PR. |
| `NEEDS_FOLLOWUP` | Action hierarchy or readiness needs a narrow implementation or verification issue. |
| `DEFERRED` | The action should not be promoted in v0.1. |
| `NOT_VERIFIED` | Runtime or screenshot verification is required before final readiness. |

Readiness follows `V01_CTA_EXPOSURE_POLICY.md`:

- `READY`
- `SOFT_EXPOSURE`
- `DISABLED_WITH_EXPLANATION`
- `HIDDEN_DEFERRED`

Strong primary CTAs require `READY` plus runtime verification when Auth/API/data-loaded behavior is involved.

## Audit source

This audit is based on current GitHub issue and PR state, not fresh runtime screenshots. Runtime-sensitive follow-ups remain subject to fixed-slot or trusted deployed-SHA verification when the deployment path is available.

No tree IDs, owner IDs, memory IDs, copied tree IDs, user IDs, tokens, sessions, cookies, DB URLs, raw payloads, or DB rows are included.

---

## 1. Home

| Field | Decision |
|---|---|
| Primary action | Lead user toward the core LoveTree entry path. |
| Secondary actions | Intro / product explanation / Browse as appropriate. |
| Destructive actions | None. |
| Risk | Home and Intro can overlap in narrative role if both try to explain the whole product. |
| Readiness | `SOFT_EXPOSURE` pending full Home/Intro role audit. |
| Status | `NEEDS_FOLLOWUP` |
| Follow-up | #587 for Intro role/copy separation; #681 for v0.1 trust gate. |

Decision:

Home may keep a product-entry primary action, but it should not carry all product education if Intro is responsible for explanation. Avoid duplicate strong CTAs that compete with Login or Intro.

---

## 2. Intro

| Field | Decision |
|---|---|
| Primary action | Explain LoveTree clearly, then route to the appropriate next step. |
| Secondary actions | Login/start or Home return, depending on entry context. |
| Destructive actions | None. |
| Risk | Intro can duplicate Home copy or become a second landing page with unclear role. |
| Readiness | `SOFT_EXPOSURE` |
| Status | `NEEDS_FOLLOWUP` |
| Follow-up | #587 and related Intro copy PRs. |

Decision:

Intro should be the place where first-time users understand what LoveTree is. It should not duplicate Home hero copy or create competing primary actions.

---

## 3. Login / Account entry

| Field | Decision |
|---|---|
| Primary action | One clear returning-user login path. |
| Secondary actions | Alternate login method and signup/start link. |
| Destructive actions | None. |
| Risk | Duplicate Google/email actions make login vs signup unclear. Settings/account route can look available while routing to login. |
| Readiness | `NEEDS_FOLLOWUP` |
| Status | `NEEDS_FOLLOWUP` |
| Follow-up | #642 for login CTA hierarchy; #776 for login/signup separation; #639 for Settings route behavior. |

Decision:

Login should not show duplicate strong Google/email choices that appear to be different flows. If signup remains separate, it should be reached through a clear secondary link. Settings/account actions must not imply an authenticated settings experience unless the route is stable and verified.

---

## 4. My Trees

| Field | Decision |
|---|---|
| Primary action | Open a tree via the card surface. |
| Secondary actions | Sort/filter, quiet overflow/manage actions, create tree. |
| Destructive actions | Hidden or placed behind deliberate overflow/confirmation. |
| Risk | Visible open buttons can duplicate whole-card click and make the gallery feel like an admin table. |
| Readiness | `PASS` for primary card-click direction; runtime-sensitive changes still require verification. |
| Status | `PASS` / `NOT_VERIFIED` for future changes |
| Follow-up | Existing My Trees card cleanup PRs/issues; #681 trust gate. |

Decision:

My Trees should behave like a personal LoveTree gallery. The card surface is the primary open action. Management controls should remain quiet, and default public metadata should not dominate the card.

---

## 5. Editor

| Field | Decision |
|---|---|
| Primary action | Continue editing the current tree/moment safely. |
| Secondary actions | Title edit, moment edit, memo edit, detail/view link, source replacement when ready. |
| Destructive actions | Delete moment/tree actions must be visually separated and confirmation-gated. |
| Risk | Title/moment/memo edit actions can feel detached or inconsistent; source replacement is not yet clearly represented; layout overlap can weaken first editing trust. |
| Readiness | `NEEDS_FOLLOWUP` |
| Status | `NEEDS_FOLLOWUP` / `NOT_VERIFIED` |
| Follow-up | #624, #626, #627, #633, #635, #651, #775. |

Decision:

Editor needs consistent edit-action grammar. Save/cancel/destructive actions must be clear and recoverable. Any Auth/API write behavior remains `NOT_VERIFIED` until runtime verification is available.

---

## 6. Browse / selected 감상 hub

| Field | Decision |
|---|---|
| Primary action | Keep the selected hub preview stable; do not promote unfinished route actions. |
| Secondary actions | 감상/detail route, copy/import, share/copy link, flow expansion/selection when verified. |
| Destructive actions | None. |
| Risk | “트리 열기” may imply a true tree-view route when the destination is actually a viewing/detail route. Copy/import can fail without useful recovery. Infinite scroll reliability is currently blocked by deployment verification environment. |
| Readiness | `NEEDS_FOLLOWUP` |
| Status | `NEEDS_FOLLOWUP` / `NOT_VERIFIED` / `DEFERRED` for unfinished tree-view route |
| Follow-up | #605, #604, #777, #766, #768. |

Decision:

Browse should not overpromise a route that is not ready. If the current destination is a detail/감상 experience, label it as such. If a true tree-view route is not ready, `트리 열기` should be hidden, deferred, disabled with explanation, or relabeled according to the actual destination.

---

## Cross-screen action decisions

| Screen | Primary action decision | Status | Follow-up |
|---|---|---|---|
| Home | Product entry; avoid duplicating Intro/Login role | `NEEDS_FOLLOWUP` | #587, #681 |
| Intro | Explain LoveTree; route to next step after explanation | `NEEDS_FOLLOWUP` | #587 |
| Login | One clear login hierarchy; signup/start as secondary | `NEEDS_FOLLOWUP` | #642, #776 |
| My Trees | Card surface is primary open action | `PASS` | existing My Trees cleanup track |
| Editor | Editing current tree/moment is primary; edit controls need consistent grammar | `NEEDS_FOLLOWUP` | #624, #626, #627, #633, #635, #651, #775 |
| Browse | Stable preview first; unfinished route actions not primary | `NEEDS_FOLLOWUP` | #604, #605, #777, #766, #768 |

## Duplicate or competing CTA list

| Area | Risk | Decision | Follow-up |
|---|---|---|---|
| Login Google/email actions | Duplicate login/start choices confuse returning vs new users | Simplify hierarchy | #642, #776 |
| My Trees card/open controls | Visible open button can duplicate card click | Card is primary; explicit open CTA should be removed or softened | existing My Trees cleanup track |
| Browse `트리 열기` / viewing action | Label may not match actual destination | Relabel to 감상/detail if that is the route; true tree view only when ready | #605 |
| Browse copy/import | Failure can become a dead state | Keep secondary until recovery exists | #604 |
| Editor edit actions | Title/moment/memo edit controls use inconsistent placement | Align edit grammar | #624, #626, #627 |

## Incomplete or unverified action exposure

| Action family | Current disposition | Required next step |
|---|---|---|
| Browse infinite scroll | `NOT_VERIFIED` due deployment blocker | #777 / PR #781 waits for trusted test-slot path |
| Settings route from account menu | `NOT_VERIFIED` auth E2E | #639 runtime verification when possible |
| Detail/viewing route loading | `NEEDS_FOLLOWUP` | #646 |
| Editor post-create landing | `NEEDS_FOLLOWUP` | #775 |
| Social writing | `HIDDEN_DEFERRED` | #756 and future implementation phases |
| Public viewer social placeholders | `SOFT_EXPOSURE` as read-only placeholder plan | #755 / PR #782 |

## Release-gate implications

For v0.1, strong primary CTAs should be limited to flows that are stable, recoverable, and runtime-verified. Current MVP-critical gating remains:

1. Resolve or defer deployment-token trust model (#668) before treating runtime-sensitive PRs as merge-ready.
2. Keep Browse/Editor/Auth PRs that require deployed-SHA verification on hold until the trusted verification path returns.
3. Continue docs/planning work where it reduces ambiguity without requiring runtime proof.
4. Do not use branch preview as a substitute for test-slot verification when the active CTO decision requires fixed test slot SHA match.

## Acceptance mapping

| #682 acceptance criterion | Status |
|---|---|
| Every core screen has documented primary action decision | `PASS` |
| Duplicate or competing CTAs listed with follow-up issue/PR links | `PASS` |
| Incomplete route/action exposure listed with follow-up links | `PASS` |
| Editor edit/save/cancel/destructive action ownership documented | `PASS` |
| My Trees card primary action decision documented | `PASS` |
| Login duplicate auth action decision documented | `PASS` |
| Browse selected hub action hierarchy documented | `PASS` |
| PASS / NEEDS_FOLLOWUP / DEFERRED / NOT_VERIFIED separated | `PASS` |

## Status

- Audit: READY
- Runtime implementation: NOT_INCLUDED
- Related issue: #682
- Release gate parent: #681
- CTA policy dependency: #683
