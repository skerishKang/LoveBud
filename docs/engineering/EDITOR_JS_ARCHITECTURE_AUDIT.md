# Editor JS Architecture Audit

> Status: audit only
> Related: #72
> Runtime impact: none

## 1. Purpose

This document records the planned audit for Editor JavaScript structure before any implementation work.

It is documentation-only and does not change product behavior.

## 2. Areas to inspect

| Area | Files | Question |
|---|---|---|
| Page entry | `pages/editor.html` | What loads first and why? |
| Root script | `js/editor.js` | Is it a bootstrap file or a large coordinator? |
| Editor folder | `js/editor/**` | Which responsibilities are already separated? |
| Editor styles | `css/editor.css`, `css/editor/**` | Which work belongs to visual polish rather than JS structure? |
| Editor copy | `js/i18n/i18n-editor.js` | Which text changes are separate from JS structure? |

## 3. Current judgment

Editor JS structure work should remain paused until the audit identifies stable boundaries.

The audit should separate:

- page startup;
- tree and memory state;
- canvas rendering;
- detail panel rendering;
- composer behavior;
- save and load behavior;
- compatibility behavior.

## 4. Guardrails

- Do not combine this with Editor visual polish.
- Do not change page script order from this audit.
- Do not change CSS from this audit.
- Do not change runtime behavior.
- Do not touch PR #7.
- Do not modify prototype/reference/demo/variant paths.

## 5. Recommended follow-up sequence

1. Complete this audit.
2. Pick one narrow boundary.
3. Add checks where useful.
4. Open one implementation PR for one boundary only.
5. Verify in a production-like browser environment before merge.

## 6. Non-goals

- No UI polish.
- No code changes.
- No CSS changes.
- No page markup changes.
- No Issue #72 closure.
