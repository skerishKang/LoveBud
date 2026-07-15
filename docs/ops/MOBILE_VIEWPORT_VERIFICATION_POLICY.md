# Mobile viewport verification policy — Issue #823

**Status:** Browser verification policy
> **Status:** OPTIONAL / CURRENTLY UNAVAILABLE AS A REQUIRED GATE
>
> 이 절차는 환경이 실제로 사용 가능하고 CTO가 명시적으로 지정한
> 경우에만 사용합니다. 해당 환경의 부재는 merge blocker가 아닙니다.
> 자세한 내용은 `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`를 참고하세요.

**Owner:** CTO / UI Lead
**Related issue:** #823

This document defines the mobile viewport coverage policy for LoveBud browser verification. It extends the existing 375px mobile baseline with modern large-phone smoke coverage for UI-sensitive work.

This is a docs-only policy. It does not change product UI, CSS, JavaScript, HTML, Auth, API, backend, database, package, workflow, deployment, or runtime behavior.

---

## 1. Core rule

375px remains the minimum mobile baseline, but 375px alone is not enough for every UI-sensitive PR.

Use this rule:

```text
Minimum mobile baseline: 375px
Modern phone smoke: 390px or 393px
Large phone smoke: 430px
Large Android / Ultra fallback: 480px when layout risk justifies it
```

The goal is not to make every PR test every width. The goal is to prevent a narrow 375px-only PASS from hiding defects that appear on modern phone widths.

---

## 2. Viewport classes

| Class | Width | Purpose | Default requirement |
|---|---:|---|---|
| Minimum mobile baseline | 375px | Small-phone guardrail and existing baseline continuity | Required for UI-sensitive browser verification |
| Modern phone smoke | 390px or 393px | Modern iPhone-class width where spacing and toolbar behavior can differ | Required for high-risk UI surfaces |
| Large phone smoke | 430px | Large iPhone / large mobile layout behavior | Required for Editor canvas overlays, Browse panels, card grids, and responsive panels |
| Large Android / Ultra fallback | 480px | Wider mobile class where layouts may switch or expose extra columns/spacing | Conditional; use when the component has breakpoint, grid, sticky, side-panel, or overlay risk |

Use either 390px or 393px. Do not require both unless a specific device regression is suspected.

---

## 3. When 375px-only is acceptable

375px-only mobile evidence is acceptable only when all of the following are true:

- the PR is not changing layout, responsive CSS, card structure, panel positioning, canvas geometry, sticky controls, navigation, Auth-gated page rendering, or primary CTA placement;
- the changed surface is text-only, docs-only, or static copy-only;
- desktop evidence covers the main interaction;
- no previous report or issue mentions wider mobile risk for the touched surface;
- the PR report explicitly says wider mobile smoke was not required and why.

Examples where 375px-only can be acceptable:

- docs-only PRs;
- copy-only changes without layout shifts;
- small i18n string fixes that do not affect button length materially;
- non-visual runtime refactors with browser smoke focused on behavior only.

---

## 4. When wider mobile smoke is mandatory

Wider mobile smoke is mandatory when a PR touches any of these areas:

- Editor canvas layout, growth affordance, toolbar, detail panel, pan/fit/recenter behavior, node placement, or form overlays;
- Browse/Search card grid, selected hub, preview/sidebar panel, filters, sort controls, CTA rows, thumbnail/tree-preview zones, or import/share actions;
- My Trees cards, toolbar, gallery grid, overflow menus, empty state, or whole-card click behavior;
- Login/Auth/Settings protected-route rendering, account menu, login/signup CTAs, or Auth state UI;
- global CSS tokens/selectors affecting layout, visibility, focus rings, sticky headers, or responsive behavior;
- any change whose acceptance criteria mention mobile, overflow, viewport, 375px, responsive, card grid, panel, overlay, toolbar, canvas, or affordance placement.

Mandatory wider smoke set:

```text
375px + one of 390px/393px + 430px
```

Add 480px when the surface uses grid columns, side panels, sticky controls, canvas bounds, or breakpoint transitions near that range.

---

## 5. Surface-specific matrix

| Surface | Minimum | Wider smoke | 480px condition | Notes |
|---|---:|---:|---|---|
| Browse/Search | 375px | 390/393 + 430 | Card grid, selected hub, filters, preview sidebar, tree-preview zone | Verify no horizontal overflow and selected hub usability |
| Editor | 375px | 390/393 + 430 | Canvas overlays, pan/fit, full-view, affordance, detail panel, forms | Verify node readability, controls, and no overflow |
| My Trees | 375px | 390/393 + 430 | Card grid, toolbar, overflow menu, empty state, full-card action | Verify tap targets and card hierarchy |
| Login/Auth/Settings | 375px | 390/393 + 430 | CTA hierarchy, account menu, modal/form height, protected-route block | Verify no contradictory Auth state |
| Detail/Public viewer | 375px | 390/393 + 430 | Media panels, selected moment panel, public viewer node list | Verify read-only UI and stacked layout |
| Docs-only | Not required | Not required | Not required | No browser viewport evidence required |

---

## 6. Fixed-slot requirement

For runtime-sensitive surfaces, viewport verification must use a valid deployed browser target.

Required proof:

```text
fixed test slot or approved Cloudflare deployment
PR head SHA
slot deployed SHA
SHA match: YES
real browser viewport width
login-capable verification when Auth/My Trees/Editor/Settings requires it
```

Production URL evidence is not acceptable as pre-merge PR proof for Auth/API/My Trees/Editor/Browse-dependent flows. Localhost-only evidence is not enough for final PASS on those surfaces.

---

## 7. Required report fields

Viewport-sensitive browser verification reports should include this block:

```text
Mobile viewport policy: ISSUE_823_APPLIED
375px baseline: PASS / FAIL / NOT_VERIFIED / NOT_REQUIRED
390px or 393px modern phone smoke: PASS / FAIL / NOT_VERIFIED / NOT_REQUIRED
430px large phone smoke: PASS / FAIL / NOT_VERIFIED / NOT_REQUIRED
480px large Android/Ultra fallback: PASS / FAIL / NOT_VERIFIED / NOT_REQUIRED
Horizontal overflow: ABSENT / PRESENT / NOT_VERIFIED
Tap target usability: PASS / FAIL / NOT_VERIFIED / NOT_REQUIRED
Fatal console errors: NONE / PRESENT
Fatal network blockers: NONE / PRESENT
Private data exposure: NO
```

If a width is marked `NOT_REQUIRED`, the report must explain the reason in one sentence.

If a width is marked `NOT_VERIFIED`, the PR must not claim full mobile viewport PASS.

---

## 8. Browser executor prompt standard

For UI-sensitive browser executor prompts, include:

```text
Viewport set:
- 375px minimum mobile baseline
- 390px or 393px modern phone smoke
- 430px large phone smoke
- 480px only if grid/panel/canvas breakpoint risk is present

For each required viewport:
- load target page from fixed slot
- verify deployed SHA match before testing
- capture screenshot or equivalent visual evidence
- verify no horizontal overflow
- verify primary action and affected controls remain usable
- report fatal console/network errors
- do not print secrets, tokens, sessions, cookies, tree IDs, owner IDs, memory IDs, copied tree IDs, raw payloads, or DB rows
```

---

## 9. Pass classification

Use these classifications:

| Classification | Meaning |
|---|---|
| `MOBILE_BASELINE_PASS` | 375px passed; wider mobile not required |
| `MODERN_MOBILE_SMOKE_PASS` | 375px plus 390/393 and 430 passed |
| `LARGE_MOBILE_FALLBACK_PASS` | 375px plus 390/393, 430, and 480 passed |
| `MOBILE_PARTIAL_NOT_VERIFIED` | Some required viewport was not tested |
| `MOBILE_BLOCKED` | Required viewport could not be tested due to slot, login, data, or runtime blocker |
| `MOBILE_FAIL` | Required viewport revealed a layout, overflow, usability, or fatal runtime issue |

Do not use a generic mobile PASS if required wider smoke is missing.

---

## 10. Follow-up handling

If wider viewport smoke reveals a defect:

1. Do not expand the current PR unless the fix is directly in scope.
2. Record the failing width and surface.
3. Attach safe screenshot evidence where appropriate.
4. Open or link a follow-up issue with the classification `MOBILE_VIEWPORT_FOLLOWUP`.
5. Keep restricted identifiers and private payloads out of comments and reports.

---

## 11. Non-goals

This policy does not require:

- every PR to test every mobile width;
- device-specific pixel-perfect matching;
- visual redesign of any surface;
- production testing as pre-merge proof;
- browser verification for docs-only PRs;
- exposure of test account credentials or private runtime data.

It also does not change any implementation code or runtime behavior.

---

## 12. Current disposition

This document satisfies the policy-document layer for #823.

#823 should remain open until this policy is referenced by future browser verification prompts and at least one UI-sensitive PR applies the expanded viewport matrix in practice.
