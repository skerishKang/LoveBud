# Cloudflare Pages E2E Smoke Replacement Design

> **Status:** OPTIONAL / CURRENTLY UNAVAILABLE AS A REQUIRED GATE
>
> 이 절차는 환경이 실제로 사용 가능하고 CTO가 명시적으로 지정한
> 경우에만 사용합니다. 해당 환경의 부재는 merge blocker가 아닙니다.
> 자세한 내용은 `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`를 참고하세요.

Issue: #136

## Purpose

Design a replacement for Netlify dev-based CI E2E smoke verification using Cloudflare Pages + Modal approach.

Current CI focuses on static verification (lint, build, test). We need E2E smoke that validates actual production behavior against Cloudflare Pages deployed artifacts before merge.

## Current State

- Existing CI: lint/build/test/verify centered static verification
- No Cloudflare Pages-based E2E smoke exists
- Legacy E2E scripts (`scripts/e2e-*`) support LOVEBUD_URL override
- LOVEBUD_URL can point to Cloudflare Preview or fixed test slot

## Phase 1: Design (This PR)

Scope: docs-only design document

- No runtime changes
- No workflow changes
- No script modifications
- Define verification tiers and prerequisites

### Smoke Tier Classification

| Tier | Page Type | Validation Target | Required Setup |
|------|----------|----------------|----------------|
| 1 | Static (index, intro) | Cloudflare static | None |
| 2 | API-dependent (browse search) | Cloudflare + Modal | Fixed slot |
| 3 | Auth-dependent (my-trees, editor) | Cloudflare + Modal + Auth | Fixed slot + test account |
| 4 | Data-load (detail tree) | Cloudflare + Modal | Fixed slot |

### Fixed Test Slot Requirements

- Fixed slot must be PR-isolated
- Slot pool management for parallel PRs
- Auth state isolation per slot

## Phase 2: Implementation (Future PR)

Candidates:
- Cloudflare Preview URL-based smoke workflow
- Fixed test slot pool management
- LOVEBUD_URL override integration
- Comment-triggered verification
- Auto-discovery of available slots

### Prerequisites Before Phase 2

1. Fixed test slot provisioned
2. Test account credentials secured
3. Auth state isolation verified
4. Modal upstream health confirmed
5. Smoke test script baseline

## Non-Goals

This PR does NOT include:
- Workflow additions
- Playwright test code
- Auth/API/DB/runtime changes
- Netlify fallback
- Vercel fallback

## Safety Rules

- PR-only deployment flow
- No direct main push
- Fixed slot per-PR isolation
- Local static server cannot pass browser/API/auth verification
- Production URL never used for smoke

## Related

- Refs #136