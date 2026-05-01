# Legacy Firebase Authorized Domain and Environment Posture Decision

Issue: #545
Parent posture issue: #266
Related docs: `LEGACY_AUTHORIZED_DOMAIN_CLEANUP_DECISION.md`, `SECRET_OWNER_ROTATION_CADENCE_POLICY.md`, `ISSUE_266_REMAINING_OPS_POSTURE_GAPS.md`

This document records the legacy Firebase authorized-domain and legacy environment posture decision for LoveBud. It is docs-only. It does not inspect, print, rotate, remove, create, update, or otherwise modify Firebase Authentication authorized domains, Firebase/GCP credentials, Netlify/Vercel settings, Modal settings, GitHub Actions secrets, runtime code, workflows, packages, or deployment configuration.

## Purpose

Issue #545 tracks the remaining #266 follow-up to decide how legacy Firebase authorized domains and legacy environment secrets should be handled without reactivating retired platforms or exposing sensitive values.

The decision in this document is category-level only. It separates active Cloudflare Pages + Modal posture from legacy Netlify/Vercel posture and records which actions require a separate approved operational task.

## Current active runtime decision

LoveBud active runtime remains:

- frontend and Pages Functions: Cloudflare Pages;
- API route surface: same-origin `/api/*`;
- backend compute: Modal;
- database: Neon where active backend code uses it;
- Firebase: Auth/client bootstrap and Firebase Admin verification paths where active runtime requires them.

Netlify and Vercel remain legacy deployment artifacts. They are not active verification targets and must not be treated as production, fallback, or smoke-test environments unless CTO explicitly assigns a separate task.

## Authorized domain posture

| Domain category | Posture | Decision | Follow-up |
|---|---|---|---|
| `lovebud.pages.dev` production domain | Active | `INTENTIONALLY_RETAINED` | Keep as active production authorized domain category |
| Cloudflare Pages preview domains | Active verification support | `INTENTIONALLY_RETAINED` when needed for PR preview/test slot auth flows | Use only approved preview/fixed slot targets and verify deployed SHA where applicable |
| Fixed test slot domains | Active verification support only if documented | `INTENTIONALLY_RETAINED` when assigned by CTO/test-slot policy | Do not use unassigned slots; confirm slot and deployed SHA before browser verification |
| Localhost and local development origins | Local development | `INTENTIONALLY_RETAINED` if needed for local dev/auth bootstrap | Do not use local-only proof for Auth/API/data-loaded merge readiness |
| Netlify authorized domains | Legacy | `NEEDS_REMOVAL_DECISION` unless owner confirms an intentional retention reason | Removal requires separate owner-approved Console task and rollback note |
| Vercel authorized domains | Legacy | `NEEDS_REMOVAL_DECISION` unless owner confirms an intentional retention reason | Removal requires separate owner-approved Console task and rollback note |
| GitHub Pages or other old static domains | Legacy/unknown | `NEEDS_REMOVAL_DECISION` unless owner confirms active need | Decide separately; do not assume fallback role |

## Legacy environment posture

| Environment category | Posture | Decision | Follow-up |
|---|---|---|---|
| Legacy Netlify Firebase service-account env | Legacy-only | `LEGACY_ONLY` if present; `ABSENT` if removed by owner | Presence/status may be recorded only as category-level evidence |
| Legacy Netlify Firebase client env | Legacy-only | `LEGACY_ONLY` if present and not active; `ABSENT` if removed | Do not use Netlify as active verification target |
| Legacy Vercel Firebase env | Legacy-only | `LEGACY_ONLY` if present and not active; `ABSENT` if removed | Do not use Vercel as active verification target |
| Active Modal Firebase service-account secret | Active runtime secret category | Covered by `SECRET_OWNER_ROTATION_CADENCE_POLICY.md` and `MODAL_FIREBASE_SECRET_ROTATION_RUNBOOK.md` | Do not print, export, rotate, or modify in this issue |
| GitHub Actions secrets | Active only if consumed by workflows | Covered by secret owner/cadence policy | No workflow or secret changes in this issue |

## Decision summary

- Active Cloudflare Pages + Modal posture is confirmed as the current runtime category.
- Legacy Netlify/Vercel authorized-domain categories are not active runtime requirements by default.
- Legacy Netlify/Vercel secret categories are not active runtime requirements by default.
- Legacy domains or secrets may remain only as `LEGACY_ONLY`, `INTENTIONALLY_RETAINED`, or `NEEDS_REMOVAL_DECISION` category-level statuses.
- Actual removal of Firebase authorized domains or legacy environment secrets requires a separate approved operational task.
- Any operational removal must include owner approval, rollback/re-add note, and evidence that no secret values were exposed.

## Evidence policy

Allowed report values:

- `PRESENT`
- `ABSENT`
- `LEGACY_ONLY`
- `INTENTIONALLY_RETAINED`
- `NEEDS_REMOVAL_DECISION`
- `NOT_VERIFIED`
- `BLOCKED_BY_OWNER_ACCESS`
- `SECRET_VALUES_EXPOSED_NO`

Forbidden evidence:

- secret values;
- partial prefixes, suffixes, checksums, or last characters;
- Firebase Web API key values;
- service-account JSON content;
- private keys;
- raw Firebase Console payloads;
- raw Netlify/Vercel environment payloads;
- credential screenshots;
- token, session, cookie, OAuth, refresh-token, access-token, or ID-token values;
- browser storage or request headers containing Auth/session material.

## Operational removal requirements

A separate authorized-domain or legacy-secret removal task must define:

1. owner performing the Console/provider action;
2. exact category being changed, without printing sensitive values;
3. active runtime impact assessment;
4. rollback or re-add procedure;
5. verification target and expected deployed SHA if browser/runtime verification is needed;
6. evidence report using category-level labels only;
7. explicit confirmation that Netlify/Vercel were not reactivated as active runtime targets.

No operational removal is authorized by this document.

## Verification template

Use this template when reporting #545 posture:

```text
Legacy Firebase domain/env posture
active runtime: Cloudflare Pages + Modal
Netlify active runtime: NO
Vercel active runtime: NO
legacy authorized domains: PRESENT | ABSENT | LEGACY_ONLY | NEEDS_REMOVAL_DECISION | NOT_VERIFIED | BLOCKED_BY_OWNER_ACCESS
legacy Netlify env posture: PRESENT | ABSENT | LEGACY_ONLY | NEEDS_REMOVAL_DECISION | NOT_VERIFIED | BLOCKED_BY_OWNER_ACCESS
legacy Vercel env posture: PRESENT | ABSENT | LEGACY_ONLY | NEEDS_REMOVAL_DECISION | NOT_VERIFIED | BLOCKED_BY_OWNER_ACCESS
operational removal performed: NO
secret values exposed: NO
follow-up required: NO | OWNER_REVIEW | REMOVAL_DECISION | OPERATIONAL_REMOVAL_TASK
```

## Issue #545 closure criteria

Issue #545 can be closed when:

- legacy authorized-domain posture is recorded at category level;
- legacy environment posture is recorded at category level;
- active Cloudflare Pages + Modal runtime is confirmed;
- Netlify/Vercel are explicitly not reactivated;
- removal/retention decisions are documented without exposing sensitive values;
- any actual operational removal remains split into a separately approved task.

This document satisfies the decision/documentation gate only. It does not certify provider console state and does not close #266 by itself.

## Non-goals

- No Firebase Console changes.
- No Google Cloud Console changes.
- No Netlify/Vercel environment inspection by value.
- No Netlify/Vercel runtime reactivation.
- No Modal secret lookup, print, export, rotation, creation, update, or deletion.
- No GitHub Actions secret lookup, print, export, creation, update, or deletion.
- No runtime/client/backend code change.
- No workflow/package/dependency change.
- No deployment configuration change.
- No PR #7/prototype/reference/demo/variant change.
- No PR #450 change.

Refs #545
Refs #266
