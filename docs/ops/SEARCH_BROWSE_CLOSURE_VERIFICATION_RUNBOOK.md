# Search/Browse Closure Verification Runbook

> **Status:** closure verification runbook
> **Scope:** Issue #65 / Issue #72 final close decision support
> **Type:** docs-only. No Search runtime, CSS, page, API, Cloudflare workflow, package, or test runner changes.

---

## 1. Purpose

This runbook defines the production-equivalent verification required before closing the remaining Browse/Search work tracked by Issues #65 and #72.

Browse/Search depends on same-origin `/api/*`, Cloudflare Pages routing, Modal upstream responses, browser history state, and preview behavior. Therefore a local static server can help catch syntax or layout problems, but it cannot be the only evidence for final PASS.

Use this runbook after Search JS split, URL state/control split, preview controller split, data loading split, and Search CSS/inline-style closure work are complete.

---

## 2. Verification URL principles

### 2.1 Local static server

Local static server verification is allowed only as an early smoke check.

Use local static server results for:

- HTML parse and script load sanity;
- obvious visual regressions;
- basic layout inspection;
- console syntax errors caused by local files.

Do not use local static server alone for final PASS because Browse/Search depends on production-equivalent `/api/*` routing and Modal upstream behavior.

### 2.2 Cloudflare PR Preview

Preferred final verification URL for a Search/Browse PR is its Cloudflare PR Preview or branch preview.

Record:

- PR number;
- commit SHA tested;
- preview URL;
- date/time tested;
- browser and viewport;
- whether the preview deployment includes the target commit.

### 2.3 Fixed test slot

Use a fixed test slot when PR Preview cannot verify Auth/API/runtime behavior reliably or when project policy assigns a slot for that PR.

Rules:

- One fixed slot should map to one PR until verification completes.
- Record the slot URL and branch/commit deployed to the slot.
- Do not reuse a slot across parallel PRs without clearing the prior assignment.

### 2.4 Production URL

Production URL verification can supplement evidence, but it must state whether the tested production build contains the PR changes.

Use production URL only for final close evidence when:

- the target PR is already merged and deployed; or
- the check is validating an existing production behavior that is not PR-specific.

If production does not include the target change, mark the result as baseline-only, not PR verification.

---

## 3. Required smoke matrix

Run the following smoke checks before #65/#72 closure.

| Area | Required check | Expected result |
|---|---|---|
| Initial Browse/Search load | Open `/pages/search.html` on production-equivalent URL. | Results area renders without fatal error; initial data load path is attempted. |
| Search query URL state | Enter a `q` value. | URL updates with `q`; visible results reflect query filtering. |
| Category URL state | Select each category chip. | URL updates with `category` where applicable; selected chip and results stay in sync. |
| Sort URL state | Select latest/popular controls. | URL updates with `sort` only when non-default; results reload without blank/fatal state. |
| Limit URL state | Use load-more/limit control. | URL updates with `limit`; results count/head state remains coherent. |
| Refresh restore | Refresh after setting `q/category/sort/limit`. | Input, active chip, sort/limit controls, and results restore from URL. |
| Browser back/forward | Use browser back and forward across state changes. | Search state and results update without fatal console errors. |
| Selected tree deep link | Open a URL with `tree=<id>`. | Matching tree becomes selected when present; preview opens/updates as before. |
| Desktop preview selection | Select a tree on desktop viewport. | Preview panel updates with selected tree content; active card state is visible. |
| Mobile preview open/close | Select a tree on mobile viewport and close preview. | Preview sheet opens and closes without scroll lock breakage or page jump regression. |
| Thumbnail fallback | Inspect trees with missing/invalid thumbnails if available. | Existing fallback rendering remains intact. |
| Horizontal overflow | Inspect 375px-430px and desktop widths. | No unexpected horizontal overflow. |
| Fatal console errors | Inspect browser console during all interactions. | No uncaught fatal errors caused by the PR. |

---

## 4. Network and API verification

Browse/Search final PASS must include network evidence from a production-equivalent URL.

Required checks:

1. Open DevTools Network.
2. Filter requests by `/api/`.
3. Reload `/pages/search.html`.
4. Interact with sort/limit controls where applicable.
5. Select a tree to trigger preview hydration where applicable.
6. Record same-origin `/api/*` request status codes.
7. Record whether any Modal upstream failure is visible through response status or known response headers.

Expected result:

- `/api/*` requests use the same origin as the tested preview/slot URL.
- Initial Search/Browse data route returns a successful response or a documented non-blocking empty/error state.
- Preview hydration route returns a successful response when a valid tree is selected, or a documented fallback/error state if preview data is unavailable.
- No repeated failing network loop occurs.

### 4.1 Local-only 404 vs production-equivalent blocker

Classify failures as follows:

| Failure | Classification |
|---|---|
| Local static server returns 404 for `/api/*` | Local-only limitation. Not final PASS evidence. |
| Cloudflare Preview/fixed slot returns 404 for expected mapped `/api/*` route | Production-equivalent blocker unless route is intentionally absent. |
| Modal upstream unavailable on Preview/fixed slot | Production-equivalent blocker or environment issue; document exact route/status. |
| Browser blocks due to mixed-origin or CORS on same-origin API path | Production-equivalent blocker. |
| Network failure only on local file/static test | Local-only limitation; rerun on Preview/slot. |

---

## 5. Closure checklist

Do not close #65/#72 until this checklist is complete or explicitly waived by CTO.

### 5.1 Search script grouping

- [ ] Search script grouping is merged to main.
- [ ] Script order is verified on a production-equivalent URL.
- [ ] No missing module global errors appear in console.

### 5.2 PR #336 data split

- [ ] PR #336 or equivalent data split is merged.
- [ ] Initial Browse/Search data load is verified on production-equivalent URL.
- [ ] Growing trees data load is verified where applicable.
- [ ] Preview hydration still works after data split.
- [ ] No API/Auth/runtime/CSS changes were introduced by the data split beyond approved scope.

### 5.3 PR #337 URL/controls split

- [ ] PR #337 or equivalent URL/controls split is merged.
- [ ] `q`, `category`, `sort`, and `limit` URL state are verified.
- [ ] Refresh restore is verified.
- [ ] Browser back/forward state is verified.
- [ ] Selected tree deep link remains unchanged.

### 5.4 Preview controller split

- [ ] Preview controller split is merged.
- [ ] Desktop tree selection opens/updates preview as before.
- [ ] Mobile preview open/close is verified.
- [ ] Preview renderer output is unchanged except for approved follow-up changes.
- [ ] Card renderer output is unchanged except for approved follow-up changes.

### 5.5 CSS / inline style closure

- [ ] Search page scoped inline style/style block audit is complete.
- [ ] Any remaining presentation-only Search inline style in `pages/search.html` is moved to Search owner CSS.
- [ ] No JS behavior changes are mixed into CSS closure.
- [ ] Desktop and mobile visual smoke pass.
- [ ] No horizontal overflow is observed.

### 5.6 PR #7 and prototype safety

- [ ] PR #7 was not modified, closed, merged, or branch-deleted by closure work.
- [ ] Prototype/reference/demo/variant paths were not changed as part of Search closure.

---

## 6. Evidence template

Use this template in PR comments or final closure reports.

```text
Search/Browse production-equivalent verification
1. PR / branch:
2. commit SHA:
3. URL tested:
4. URL type: Cloudflare PR Preview / fixed test slot / production / local-only
5. Browser / viewport:
6. Initial data load:
7. q URL state:
8. category URL state:
9. sort URL state:
10. limit URL state:
11. refresh restore:
12. back/forward:
13. selected tree deep link:
14. desktop preview selection:
15. mobile preview open/close:
16. thumbnail fallback:
17. horizontal overflow:
18. console result:
19. network `/api/*` result:
20. blocker / warning / pass:
```

---

## 7. Guardrails

This runbook is documentation only.

Do not use this document as approval to change:

- Search JavaScript;
- Search CSS;
- `pages/search.html`;
- Cloudflare Pages Functions;
- Modal runtime;
- package scripts or test runners;
- Cloudflare workflows;
- fixed test slot assignments;
- PR #7 or prototype/reference/demo/variant paths.

Any runtime, CSS, JS, page, API, or workflow change requires a separate scoped PR.
