# CSS Version and Prototype Folder Reference Audit

**Status:** Audit record / no cleanup approval  
**Related:** Issue #224, Issue #221  
**Base main SHA:** `242b1969479ac725405c3576b24965debf1d3efa`  
**Scope:** `gpt-v2`, `gemini-v2`, `gemini-v3`, and `v2` version/prototype folder references

---

## 1. Purpose

This document records the current classification for reported CSS version/prototype folders.

It is a docs-only audit. It does not delete, move, rename, route-block, hide, archive, or rewire any file or folder. It does not modify runtime code, pages, CSS, JS, assets, functions, Modal backend, package files, or prototype/reference/demo/variant paths.

The goal is to support Issue #224 triage by distinguishing active production dependencies from preserved prototype/reference/demo/variant artifacts. It also records the deployment/config implication for Issue #221: legacy static artifacts and deployment config cleanup must not be conflated with prototype/reference folder deletion.

---

## 2. Classification key

| Classification | Meaning | Current action |
|---|---|---|
| Active production dependency | Current production route, JS, CSS, API, package script, or runtime flow directly depends on the path. | Preserve and treat as active code. |
| Prototype/reference/demo/variant | Historical UI exploration, prototype, design variant, or preserved reference path. | Preserve. Do not auto-delete. |
| Removable legacy candidate | No active or reference dependency found and cleanup has explicit CTO approval. | Separate cleanup PR only. |
| Not confirmed present | Path name was reported or documented but not confirmed as an existing folder in current main. | No deletion action. Re-check before any future cleanup. |

---

## 3. Current folder classification summary

| Path | Current main existence | Production page reference found | Docs/readme reference found | Classification | Decision |
|---|---:|---:|---:|---|---|
| `pages/gpt-v2/` | Yes | No active production reference found | Yes | Prototype/reference/demo/variant | Preserve |
| `assets/gpt-v2/` | Yes | No active production reference found | Yes | Prototype/reference support asset | Preserve |
| `css/gpt-v2/` | Not confirmed | No | Mentioned as historical/requested path | Not confirmed present | No action |
| `pages/gemini-v2/` | Yes | No active production reference found | Yes | Prototype/reference/demo/variant | Preserve |
| `css/gemini-v2/` | Yes | Only referenced by `pages/gemini-v2/` variant pages | Yes | Prototype/reference support CSS | Preserve |
| `pages/gemini-v2/*.css` | Yes | No active production reference found | Indirectly through variant folder references | Variant/historical colocated CSS | Preserve pending targeted audit |
| `pages/gemini-v3/` | Yes | No active production reference found | Yes | Prototype/reference/demo/variant | Preserve |
| `css/gemini-v3/` | Yes | Only referenced by `pages/gemini-v3/` variant pages | Yes | Prototype/reference support CSS | Preserve |
| `pages/v2/` | Yes | No active production reference found | Yes | Prototype/reference/demo/variant | Preserve |
| `css/v2/` | Yes | Only referenced by `pages/v2/` variant pages | Yes | Prototype/reference support CSS | Preserve |
| `pages/kimi-v2/` | Yes, observed through broad `v2` search | No active production reference found | Yes | Prototype/reference/demo/variant | Preserve |
| `assets/css/kimi-v2/` | Yes, observed through broad `v2` search | Only referenced by `pages/kimi-v2/` variant pages | Yes | Prototype/reference support CSS | Preserve |
| `assets/js/kimi-v2/` | Yes, observed through broad `v2` search | Only referenced by `pages/kimi-v2/` variant pages | Yes | Prototype/reference support JS | Preserve |

---

## 4. Exact current folder paths and reference notes

### 4.1 `gpt-v2` paths

Current paths:

- `pages/gpt-v2/`
- `assets/gpt-v2/`
- `css/gpt-v2/` was reported/documented but not confirmed as an existing current-main folder in the prior reference map.

Reference notes:

- `pages/gpt-v2/` is treated as a historical UI/reference path.
- `assets/gpt-v2/` is treated as support material for that reference path.
- No active production page dependency into these paths was found in the reference audit.
- Docs references exist through prototype/reference policy and prototype index documents.

Classification:

- `pages/gpt-v2/`: prototype/reference/demo/variant — preserve.
- `assets/gpt-v2/`: prototype/reference support asset — preserve.
- `css/gpt-v2/`: not confirmed present — no deletion action.

### 4.2 `gemini-v2` paths

Current paths:

- `pages/gemini-v2/`
- `css/gemini-v2/`
- colocated CSS under `pages/gemini-v2/` was observed by the prior reference map.

Reference notes:

- `pages/gemini-v2/` variant pages reference `css/gemini-v2/` internally.
- Some variant pages may link outward to active shared pages, but active production pages were not found linking back into `pages/gemini-v2/`.
- Docs references exist through prototype/reference policy and prototype index documents.

Classification:

- `pages/gemini-v2/`: prototype/reference/demo/variant — preserve.
- `css/gemini-v2/`: prototype/reference support CSS — preserve.
- `pages/gemini-v2/*.css`: variant/historical colocated CSS — preserve pending targeted audit.

### 4.3 `gemini-v3` paths

Current paths:

- `pages/gemini-v3/`
- `css/gemini-v3/`

Reference notes:

- `pages/gemini-v3/` variant pages reference `css/gemini-v3/` internally.
- No active production page dependency into these paths was found in the reference audit.
- Docs references exist through prototype/reference policy and prototype index documents.

Classification:

- `pages/gemini-v3/`: prototype/reference/demo/variant — preserve.
- `css/gemini-v3/`: prototype/reference support CSS — preserve.

### 4.4 `v2` paths

Current paths:

- `pages/v2/`
- `css/v2/`

Reference notes:

- `pages/v2/` variant pages reference `css/v2/` internally.
- No active production page dependency into these paths was found in the reference audit.
- Docs references exist through prototype/reference policy and prototype index documents.

Classification:

- `pages/v2/`: prototype/reference/demo/variant — preserve.
- `css/v2/`: prototype/reference support CSS — preserve.

### 4.5 `kimi-v2` paths observed through broad `v2` matching

Current paths:

- `pages/kimi-v2/`
- `assets/css/kimi-v2/`
- `assets/js/kimi-v2/`

Reference notes:

- These paths are not the main reported folder names, but broad `v2` search surfaces them.
- They are already governed as prototype/reference/demo/variant paths.
- They must not be included in any CSS version cleanup without a separate explicit task.

Classification:

- `pages/kimi-v2/`: prototype/reference/demo/variant — preserve.
- `assets/css/kimi-v2/`: prototype/reference support CSS — preserve.
- `assets/js/kimi-v2/`: prototype/reference support JS — preserve.

---

## 5. Production page reference result

The existing reference map found no active production dependency from current production pages, package scripts, or active runtime JS into the reported version folders.

Important distinction:

- A folder may not be part of active production navigation.
- The same folder may still be directly reachable as a deployed static artifact.
- Direct static reachability does not make it active production code, but it does mean deletion/route-blocking decisions require explicit approval and deployment impact review.

Current action:

- Do not delete.
- Do not rename.
- Do not hide by route rule.
- Do not move to archive without separate approval.

---

## 6. Docs and README references

Known governance/reference documents already refer to these classes of paths, including:

- `docs/reference/PROTOTYPE_INDEX.md`
- `docs/design/PROTOTYPE_REFERENCE_POLICY.md`
- `docs/doc_index.md`
- `docs/design/design_index.md`
- `docs/reports/CSS_VERSION_FOLDER_REFERENCE_MAP.md`

These references are not runtime dependencies. They are governance and inventory references. They should be preserved unless the prototype/reference retention policy is intentionally changed.

---

## 7. Issue #221 deployment/config impact

Issue #221 concerns legacy deployment/config and runtime cleanup. The CSS version/prototype folder question should not be merged into deployment config cleanup.

Decision:

- Netlify/Vercel/Cloudflare deployment cleanup does not automatically authorize deletion of prototype/reference/demo/variant folders.
- Static artifact exposure should be considered separately from active runtime routing.
- If a future deployment policy wants to stop serving these paths, that requires a separate route-block/archive policy decision and browser/static URL verification.
- Any cleanup must avoid PR #7 and protected prototype/reference/demo/variant areas unless a specifically approved task names them.

---

## 8. Deletion and movement guardrails

No deletion candidate is approved by this audit.

Before any future deletion, movement, archive relocation, route-block, or ignore-rule change, require all of the following:

1. Explicit CTO approval naming the exact path.
2. Fresh latest-main full-tree reference search for the path and filenames.
3. Active production route/navigation check.
4. Package/script/test check.
5. Deployed static artifact decision: preserve, archive, route-block, or remove.
6. Documentation update plan for prototype/reference policy and indexes.
7. Confirmation that the path is not part of PR #7 or other protected prototype/reference/demo/variant work.
8. A separate PR with no unrelated JS, CSS, Auth, API, Modal, Cloudflare, Vercel, or Netlify changes.

---

## 9. PR #7 safety statement

This audit does not touch PR #7.

Do not modify, close, merge, delete, or branch-delete PR #7 as part of CSS version/prototype folder cleanup. PR #7 and prototype/reference/demo/variant areas remain protected unless a future task explicitly overrides that protection with CTO approval.

---

## 10. Final judgment

The reported folders are best classified as preserved prototype/reference/demo/variant artifacts, not active production dependencies and not approved deletion candidates.

The correct current action is documentation and preservation. Any later cleanup requires a separate, explicitly approved cleanup PR.
