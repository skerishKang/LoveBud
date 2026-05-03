# v0.1 CTA exposure policy

**Status:** Product readiness policy  
**Owner:** CTO / Product  
**Related issue:** #683

This document defines how LoveBud v0.1 should expose actions that lead to complete, partial, unavailable, or intentionally deferred flows.

The goal is to protect product trust. A polished screen should not present a strong primary action that routes users into an unfinished, unverified, or unrecoverable experience.

This is not an implementation PR. It does not change UI, copy, routing, Auth, API, backend, database, packages, workflows, or provider settings.

---

## 1. Core rule

A strong primary CTA requires a `Ready` classification.

If a flow is not ready, the action must be softened, disabled with explanation, or hidden/deferred.

```text
Primary CTA allowed: Ready only
Secondary CTA allowed: Ready or Soft exposure
Disabled CTA allowed: Not ready but useful to explain expectation
Hidden/deferred: Not ready and likely to confuse or erode trust
```

---

## 2. Readiness classifications

### Ready

Use for actions that are:

- implemented;
- runtime verified in an appropriate environment;
- connected to the intended route or behavior;
- supported by acceptable loading states;
- supported by acceptable error/recovery states;
- safe with Auth/API/DB boundaries;
- not known to expose restricted data.

Ready actions may be primary, secondary, or contextual.

### Soft exposure

Use for actions that are partially ready but not stable enough to own the screen.

Soft exposure actions:

- should be visually secondary;
- should use cautious copy;
- should not promise more than they can deliver;
- should not be the only route to a critical flow;
- must not hide known failure or incomplete state.

### Disabled with explanation

Use when users benefit from knowing the feature is planned or intentionally unavailable.

Disabled actions should:

- state that the feature is not available yet;
- avoid implying a bug;
- avoid a dead click;
- not require users to discover failure by trying the action.

### Hidden / deferred

Use when exposing the action creates more confusion than value.

Hide or defer actions that:

- route to missing or placeholder pages;
- cannot recover from failure;
- require unavailable Auth/API/backend support;
- represent v0.2 or later behavior;
- are likely to be interpreted as complete when they are not.

---

## 3. Verification standard before promotion

Before an action can be promoted to primary, the responsible PR or review must verify:

- the click/tap target is wired;
- the target route or behavior exists;
- the intended state loads;
- loading and empty states are acceptable;
- failure states are safe and recoverable;
- Auth/session behavior is correct when applicable;
- API/database behavior is verified when applicable;
- no restricted values are exposed in reports;
- desktop and mobile behavior are acceptable when the action is user-facing.

Runtime-sensitive actions require a valid deployed environment. Localhost-only or production-only pre-merge proof is not sufficient for Auth/API/My Trees/Editor/Browse-dependent flows.

---

## 4. Screen-specific v0.1 decision template

Use this template for each active screen or component:

```text
Screen:
Action label:
Action type: PRIMARY / SECONDARY / DESTRUCTIVE / CONTEXTUAL
Target behavior:
Readiness classification: READY / SOFT_EXPOSURE / DISABLED_WITH_EXPLANATION / HIDDEN_DEFERRED
Runtime verification: PASS / NOT_VERIFIED / BLOCKED / NOT_REQUIRED
Failure/recovery state: PRESENT / MISSING / NOT_APPLICABLE / UNKNOWN
Decision: KEEP_PRIMARY / MAKE_SECONDARY / DISABLE_WITH_COPY / HIDE / SPLIT_FOLLOWUP
Follow-up issue/PR:
Restricted values exposed: NO
```

Do not include tree IDs, owner IDs, memory IDs, copied tree IDs, user IDs, tokens, sessions, cookies, private keys, DB URLs, raw payloads, or DB rows.

---

## 5. Initial v0.1 screen recommendations

These are policy-level recommendations, not implementation changes.

### Browse selected hub

Actions to classify:

- open selected tree / viewing route;
- copy/import to My Trees;
- share or copy link;
- selected hub preview interactions.

Policy:

- Do not make a route-opening action primary unless the target viewing experience is implemented and runtime verified.
- If import/copy lacks reliable recovery, keep it secondary or disabled with explanation.
- If the selected hub is the only verified experience, favor preview-safe actions over route promises.

### Login/account entry

Actions to classify:

- Google continuation;
- email continuation;
- signup/account creation messaging;
- account/settings links.

Policy:

- Do not duplicate equivalent auth methods as separate strong CTAs.
- If account/settings routes are not implemented, avoid sending users to a generic login screen without explanation.
- Preserve working auth methods when simplifying hierarchy.

### My Trees

Actions to classify:

- open owned tree;
- create tree;
- manage/overflow actions;
- visibility-related controls;
- empty-state actions.

Policy:

- The primary action should match the product role of a personal LoveTree gallery.
- Management actions should be quiet unless needed.
- Destructive or unavailable actions should not compete with open/create flows.

### Editor

Actions to classify:

- save/cancel for title, moment, and memo edits;
- delete/destructive actions;
- source/video replacement;
- add moment or branch placement.

Policy:

- Save actions should be clear and recoverable.
- Destructive actions should be visually and semantically separated.
- Unverified edit paths should not be presented as complete.
- Auth/owner-write behavior must be runtime verified before calling an edit flow ready.

---

## 6. Copy guidance for unavailable actions

Use concise copy that sets expectation without making the screen feel broken.

Preferred patterns:

- `준비 중입니다`
- `곧 사용할 수 있어요`
- `아직 열 수 없는 기능입니다`
- `저장할 수 없는 상태입니다`
- `다시 시도해 주세요`

Avoid:

- strong action labels that imply completion;
- silent no-op buttons;
- disabled buttons without explanation;
- vague error-only copy when the feature is intentionally deferred.

---

## 7. Follow-up split rules

Do not bundle broad CTA cleanup into one implementation PR.

Split by screen or action family:

1. Browse selected hub route/readiness actions.
2. Login/account CTA hierarchy.
3. My Trees primary/secondary action hierarchy.
4. Editor edit/save/destructive action readiness.
5. Settings/account unavailable action handling.
6. Cross-screen audit-only decision map.

Each runtime-sensitive follow-up needs its own verification plan and deployed target when applicable.

---

## 8. Current disposition

This document satisfies the policy-definition layer for #683. It defines Ready / Soft exposure / Disabled with explanation / Hidden-deferred classifications, promotion gates, screen-specific recommendation areas, unavailable-action copy guidance, and follow-up split rules.

#683 should remain open until screen-specific action decisions are audited and linked follow-up PRs or explicit deferrals exist.
