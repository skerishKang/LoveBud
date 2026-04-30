# Page Module Grouping Audit

> Status: audit only
> Related: #72
> Runtime impact: none

## 1. Purpose

This document records candidate page-level JavaScript grouping work after the staged Search split.

It is documentation-only and does not approve implementation.

## 2. Pages in scope

| Area | Current files to inspect | Preliminary recommendation |
|---|---|---|
| Detail | `js/detail.js`, related detail helpers | Audit current responsibilities before any split |
| My Trees | `js/my-trees.js`, `js/my-trees/` | Wait until active My Trees PRs are merged |
| Home | `js/index.js` | Audit whether a `js/home/` entry would reduce ambiguity |
| Settings | `js/settings.js` | Audit consumers and page load order first |

## 3. Current judgment

Do not reorganize all page modules at once.

Each page needs a separate audit and, if approved, a separate implementation PR.

## 4. Safe sequence

1. Finish active My Trees work before any My Trees grouping audit moves to implementation.
2. Audit Detail module boundaries separately.
3. Audit Home and Settings only after higher-risk runtime work is quiet.
4. Use Cloudflare Preview or a fixed test slot for any page runtime implementation.

## 5. Guardrails

- No JavaScript moves from this audit.
- No page markup changes from this audit.
- No runtime behavior changes.
- Do not mix page grouping with Search, Editor, or My Trees fixes.
- Do not touch PR #7.
- Do not modify prototype/reference/demo/variant paths.

## 6. Recommended follow-ups

| Follow-up | Type | Notes |
|---|---|---|
| Detail module boundary audit | audit | Determine bootstrap vs orchestrator responsibilities |
| My Trees module boundary audit | audit | Run after active My Trees PRs settle |
| Home module boundary audit | audit | Low priority |
| Settings module boundary audit | audit | Low priority |

## 7. Non-goals

- No Issue #72 closure.
- No file movement.
- No script load order changes.
- No broad JavaScript tree reorganization.
