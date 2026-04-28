# Cloudflare Pages E2E Smoke Replacement Design

> **Issue:** #136
> **Status:** Design Draft
> **Scope:** Post-Netlify CI gap fill — design doc only, no implementation

---

## 1. Current CI Coverage Summary

LoveBud CI is centered on **static verification** and **contract testing**:

| Layer | Tool | Coverage |
|-------|------|----------|
| Lint | `npm run lint` (static) | JS/CSS style, line endings, trailing whitespace |
| Build | `npm run build` (static) | Static site generation, asset bundling |
| Unit/Contract | `npm test` (Node test runner) | Route mapping, API contract, ownership policy, runtime contracts |
| Static Site | `verify-static.js` | Pages exist, critical files present |

**What CI does NOT include:**
- No browser-based E2E smoke against a live deployed environment
- No visual regression testing
- No multi-page navigation auth/session workflow validation in a real browser

---

## 2. The Netlify Dev E2E Gap

**Historical state:**
- `.github/workflows/ci.yml` once included a job that used `LOVEBUD_URL` to hit a Netlify dev instance and run `scripts/e2e-*` smoke scripts.
- Those scripts (`scripts/e2e-search-detail-smoke.js`, `scripts/e2e-auth-guard-smoke.js`, etc.) are **still in the repo** but **not wired into CI**.

**Current state after PR #283 (Netlify artifact removal):**
- Netlify runtime is fully legacy; no Netlify Functions in active path.
- CI no longer has any browser E2E against a deployed URL.
- The gap: **No automated smoke verification against Cloudflare Pages + Modal runtime**.

---

## 3. Official Verification Direction: Cloudflare Pages + Modal

From `docs/ops/OPERATIONS.md` and `docs/ops/BROWSER_VERIFICATION_URL_POLICY.md`:

- **Primary frontend:** Cloudflare Pages (static hosting)
- **Primary backend:** Modal (compute)
- **API entry:** same-origin `/api/*` → Cloudflare Pages Functions → Modal
- **Official verification URLs:**
  - PR Preview URLs (Cloudflare Pages PR deployments)
  - Fixed test slots: `https://test1.lovebud.pages.dev` through `test5` (assigned by CTO per PR)
  - **Production `https://lovebud.pages.dev/` is NOT used for pre-merge verification**

**Conclusion:** The replacement E2E smoke must target **Cloudflare Pages** (not Netlify) and must use the **PR Preview** or **fixed test slot** provenance model.

---

## 4. Existing E2E Scripts Inventory

| Script | Current State | Dependencies |
|--------|---------------|--------------|
| `scripts/e2e-auth-guard-smoke.js` | Present, unmodified | Auth session, redirect logic |
| `scripts/e2e-editor-delete-smoke.js` | Present, unmodified | Editor auth, tree delete |
| `scripts/e2e-editor-save-smoke.js` | Present, unmodified | Editor auth, memory save |
| `scripts/e2e-login-success-smoke.js` | Present, unmodified | Firebase auth UI |
| `scripts/e2e-login-timeout-smoke.js` | Present, unmodified | Auth timeout handling |
| `scripts/e2e-search-detail-smoke.js` | Present, unmodified | Search card → detail preview |
| `scripts/e2e-ui-regression-smoke.js` | Present, unmodified | Generic UI checks |

**Key property:** All scripts read `LOVEBUD_URL` (or default to `http://localhost:8080`). This override hook means they **can** target a Cloudflare test slot without code changes, provided the slot serves the built static site and can reach Modal compute.

---

## 5. Page Smoke Tier Classification

To scope the replacement smoke appropriately, pages fall into four tiers:

### Tier 1 — Static-only / Public-first
- `/pages/intro.html` (public intro)
- `/pages/login.html` (public login page)
- `/pages/search.html` (public browse; requires `/api/*` but no session)

**Validation target:** Page loads, static assets present, `/api/*` routes respond (no auth required).

### Tier 2 — API-dependent (session optional)
- `/pages/detail.html` — needs `/api/trees/public` or private with session
- `/pages/my-trees.html` — requires auth; redirects if no session

**Validation target:** Authenticated or public API calls succeed; routing guards work.

### Tier 3 — Auth/Session-dependent
- `/pages/my-trees.html` (user's private trees)
- `/pages/settings.html` (user settings)

**Validation target:** Login → session establishment → protected page renders without redirect loop.

### Tier 4 — Modal upstream-dependent
- Any page that calls Modal compute directly via `/api/*` (all authenticated flows)
- Validate that Cloudflare Functions correctly proxy to Modal and return expected shapes.

---

## 6. Phase 1 Recommendation — Manual/Semi-Automated Cloudflare Preview Smoke

**Approach:** Keep existing `scripts/e2e-*` as-is. Add a **PR comment bot** or **manual gate** that runs them against the Cloudflare PR Preview URL or assigned fixed test slot.

**Procedure per PR:**

1. Deploy PR to Cloudflare Pages (automatic on PR open).
2. CTO or QA assigns a fixed test slot (`test1`–`test5`) **or** uses the PR Preview URL.
3. Set environment: `LOVEBUD_URL=https://<PR_PREVIEW_OR_TEST_SLOT>`
4. Run selected e2e scripts locally or in a dedicated CI job (manual trigger).
5. Report pass/fail in PR comment.

**Why Phase 1 only (design doc scope):**
- Automating PR Preview URL extraction requires GitHub API token and Cloudflare API access — infra setup.
- Fixed test slots are finite (5) and need rotation/cleanup policy.
- The scripts themselves are **already usable**; we only need Orchestration.

**Output:** A **runbook** (separate doc/PR) describing how to trigger the smoke for a given PR.

---

## 7. Phase 2 Recommendation — Automated CI Gate (Future)

Once Phase 1 process is validated, consider:

| Option | Mechanism | Pros | Open Questions |
|--------|-----------|------|----------------|
| **Cloudflare PR Preview auto-discover** | GitHub Action calls Cloudflare API to list preview URLs for the PR deployment | No manual slot assignment; always fresh | Requires Cloudflare API token in GitHub Secrets; rate limits |
| **Fixed test slot pool** | Assign slot via CTO comment (`/assign-test 3`), CI consumes that slot | Deterministic, simple | Slot cleanup/rotation needed; only 5 slots |
| **On-demand Preview via `wrangler`** | Use `wrangler pages deployment list` to fetch latest preview for branch | Leverages existing tooling | Needs `wrangler` installed in CI runner; auth complexity |

**Recommendation:** Start with **fixed test slots** (already allocated by CTO for manual verification). Build a simple GitHub Action that:
- Triggers on `PR #<number>` comment containing `/smoke-test slot:<1-5>`
- Sets `LOVEBUD_URL=https://test<1-5>.lovebud.pages.dev`
- Runs `node scripts/e2e-auth-guard-smoke.js` … (all or subset)
- Posts job summary as a check run.

---

## 8. Explicit Non-Goals

- **Netlify dev restoration** — prohibited; Netlify is legacy-only.
- **Netlify as active fallback** — prohibited; Cloudflare Pages is primary entry.
- **Auth blocker #133 resolution** — separate issue; smoke scripts exercise auth but do not fix auth gaps.
- **UI/CSS/Search backlog integration** — separate tracks; smoke validates current behavior, not perfection.
- **Full end-to-end coverage** — initial smoke focuses on **happy path** for Tier 1–2 pages only.
- **Modal contract compliance validation** — already covered by `npm test`; smoke complements with live deployment verification.

---

## 9. Prerequisites for the Workflow PR (Future)

Any future PR that automates E2E smoke in CI **must**:

1. **Use only allowed CI resources**
   - GitHub Actions (existing `.github/workflows/ci.yml` or separate workflow file)
   - No new CI provider without CTO approval.

2. **Respect URL provenance policy**
   - Only run against PR Preview or CTO-assigned fixed test slots.
   - Never target `https://lovebud.pages.dev/` (production).

3. **Preserve script integrity**
   - Do not modify `scripts/e2e-*` in the same PR as workflow changes.
   - If script changes needed, separate PR with clear justification.

4. **Handle auth/session with care**
   - Use documented test accounts from `docs/ops/QA_ACCOUNT_USAGE.md` (read-only reference).
   - Never log credentials or session tokens.
   - Clear storage between test runs (scripts already call `clearAuthData`).

5. **Gate behind manual approval or limited auto-trigger**
   - Initial automated smoke should be **comment-triggered**, not on every PR automatically.
   - Prevent CI overload and slot contention.

6. **Report clearly**
   - Create a GitHub Check Run with pass/fail.
   - Post a PR comment summarizing failures with links to logs.

---

## 10. Related Documents

- `docs/ops/OPERATIONS.md` — current infra hierarchy
- `docs/ops/BROWSER_VERIFICATION_URL_POLICY.md` — test slot assignment and PR Preview policy
- `docs/ops/QA_ACCOUNT_USAGE.md` — test credentials (read-only reference)
- `docs/engineering/API_CONTRACT.md` — API route expectations
- `docs/engineering/MANUAL_TEST_CHECKLIST.md` — manual smoke checklist (existing)
- `scripts/e2e-*` — existing smoke scripts (unchanged)

---

## 11. Open Questions (For Follow-Up)

1. **Which subset of scripts?** Should all 7 scripts run, or only a core smoke set (search → detail, auth-guard)?
2. **Parallel vs sequential:** Run scripts sequentially (simpler) or parallel (faster)?
3. **Log retention:** Upload raw logs as artifacts? Or just comment summary?
4. **Slot cleanup:** Who rotates test slots, and how often?
5. **Flake tolerance:** Retry policy for transient network/Modal cold-start failures?
6. **Coverage measurement:** Should smoke also validate page structure via DOM assertions (already in scripts)?

---

## 12. Next Steps

1. **CTO review** this design → approve Phase 1 manual runbook PR.
2. Create separate PR for `docs/ops/e2e-smoke-runbook.md` (manual orchestration guide).
3. (Optional) Create GitHub Action that runs `/smoke-test` comment-triggered using fixed test slots.
4. Iterate on script robustness based on real smoke runs.
5. Expand coverage to Tier 3–4 pages after Phase 1 stability.

---

**Summary:**
Netlify-based CI E2E is gone. The replacement is **Cloudflare Pages + Modal** using **existing e2e scripts** orchestrated **manually or via comment-triggered CI** against **PR Preview URLs or fixed test slots**. No Netlify restoration. No workflow code changes in this design doc PR — only documentation. Implementation follows in separate PRs.
