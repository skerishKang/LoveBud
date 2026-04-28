# CSS Version Folder Reference Map

Issue: #224, checklist item 3

Base branch: `main`

Base main SHA used for this audit: `dedd08e27a831fb2f9b462b806899fbb5d58a56f`

This report maps references for versioned UI/CSS folders that include the names `gpt-v2`, `gemini-v2`, `gemini-v3`, or `v2`. This is a reference audit only. It does not approve deletion, movement, route blocking, ignore rules, or production rewiring.

## Scope

Checked areas:

- `pages/` paths containing `gpt-v2`, `gemini-v2`, `gemini-v3`, or `v2`
- `css/` paths containing `gpt-v2`, `gemini-v2`, `gemini-v3`, or `v2`
- `assets/` paths containing `gpt-v2`, `gemini-v2`, `gemini-v3`, or `v2`
- `docs/` references to the same names
- `package.json` scripts
- HTML `link` and navigation/script references surfaced by repository search

Explicitly not done:

- No files deleted
- No folders moved
- No imports, links, scripts, or routes changed
- No prototype/reference/demo/variant paths modified
- No PR #7 files or branch state modified

## Classification key

| Label | Meaning |
| --- | --- |
| `active production dependency` | Current production page/runtime depends on the path directly. |
| `prototype/reference/demo/variant — preserve` | Historical or design exploration artifact protected from automatic cleanup. |
| `legacy artifact — audit 후 보존/정리 후보` | Older artifact that may merit future cleanup planning, but not from this audit alone. |
| `unused but not safe to delete` | No current dependency found in this pass, but deletion could still remove reference, snapshot, or deployed static content. |
| `deletion candidate, but 별도 승인 필요` | Potential cleanup candidate only after explicit CTO approval and additional checks. |

## Executive summary

- No active production dependency was found from current production `pages/*.html`, `package.json` scripts, or active runtime JS into the requested version folders.
- The version folders are still static artifacts in the repository and may remain directly reachable if deployed as static files.
- Existing project policy already classifies these version folders as prototype / design variant / historical UI exploration and not automatic cleanup targets.
- `gemini-v2`, `gemini-v3`, and `v2` pages link to their corresponding version CSS folders internally.
- `gpt-v2` appears primarily as page/reference artifact plus `assets/gpt-v2/`; a `css/gpt-v2/` folder was not confirmed in current main.
- `kimi-v2` was also observed because it contains `v2`; it is included below as a v2-containing reference path, not as a requested direct cleanup target.
- No deletion candidate is approved by this report. Any cleanup requires separate CTO approval.

## Existing policy cross-check

Current reference policy states that prototype / reference folders are not automatic cleanup targets, even if they are not connected to production flow. The canonical prototype index also lists the relevant version paths as not active production routes and as reference artifacts.

Policy-relevant paths already documented elsewhere:

- `pages/gemini-v2/`
- `pages/gemini-v3/`
- `pages/gpt-v2/`
- `pages/kimi-v2/`
- `pages/v2/`
- `css/gemini-v2/`
- `css/gemini-v3/`
- `css/v2/`
- `assets/css/kimi-v2/`
- `assets/gpt-v2/`
- `assets/js/kimi-v2/`

## Reference map

### 1. `pages/gpt-v2/`

| Item | Finding |
| --- | --- |
| Path | `pages/gpt-v2/` |
| Observed files | `TODO.md`, `home.md`, `home.html`, `home2.html`, `start.html`, `browse.html`, `intro.html`, `editor.html` |
| Reference locations | Internal `pages/gpt-v2/*` links, `assets/gpt-v2/home2/README.md`, `docs/reference/PROTOTYPE_INDEX.md`, `docs/design/PROTOTYPE_REFERENCE_POLICY.md`, `docs/design/design_index.md`, `docs/doc_index.md`, other design baseline/roadmap docs |
| HTML link/script references | `home2.html` contains internal links such as `./home2.html`, `./browse.html`, and `./start.html`; no active production page was found linking into this folder during this audit. |
| Production impact | Not an active production dependency. It may still be deployed as a directly reachable static reference path. |
| Classification | `prototype/reference/demo/variant — preserve` |
| Follow-up judgment | Preserve. Do not delete, move, hide, or wire into production as-is. |
| Additional conditions before any deletion/move | Explicit CTO approval; fresh full-tree grep; active navigation check; Cloudflare Pages deployed artifact check; confirmation that no open PR, design doc, issue, or QA artifact still references it; replacement archive/reference strategy if preserving history elsewhere. |

### 2. `assets/gpt-v2/`

| Item | Finding |
| --- | --- |
| Path | `assets/gpt-v2/` |
| Observed files | `assets/gpt-v2/home2/README.md` surfaced in search. |
| Reference locations | `docs/reference/PROTOTYPE_INDEX.md`, `docs/design/PROTOTYPE_REFERENCE_POLICY.md`, `pages/gpt-v2/*` context. |
| HTML link/script references | No active production HTML reference found in this pass. |
| Production impact | Not an active production dependency. Treated as prototype support/reference asset. |
| Classification | `prototype/reference/demo/variant — preserve` |
| Follow-up judgment | Preserve with `pages/gpt-v2/`. |
| Additional conditions before any deletion/move | Same approval path as `pages/gpt-v2/`; also verify that no visual snapshot or generated design reproduction depends on these assets. |

### 3. `css/gpt-v2/`

| Item | Finding |
| --- | --- |
| Path | `css/gpt-v2/` |
| Observed files | No actual `css/gpt-v2/` folder or file was confirmed in current main during this pass. |
| Reference locations | Mentioned in `docs/reference/PROTOTYPE_INDEX.md` as a requested-but-not-confirmed path. |
| HTML link/script references | None found. |
| Production impact | No current production impact found because the path was not confirmed to exist. |
| Classification | `unused but not safe to delete` / not-present tracking entry |
| Follow-up judgment | Do not infer existence. No deletion action applies from this audit. |
| Additional conditions before any deletion/move | Fresh tree listing must confirm existence first; if restored later, classify it as design variant/reference unless CTO directs otherwise. |

### 4. `pages/gemini-v2/`

| Item | Finding |
| --- | --- |
| Path | `pages/gemini-v2/` |
| Observed files | `index.html`, `intro.html`, `search.html`, `detail.html`, plus colocated CSS files surfaced by search such as `index.css`, `detail.css`, and `search.css`. |
| Reference locations | `docs/reference/PROTOTYPE_INDEX.md`; internal links among Gemini v2 pages; outbound links to shared production-like pages such as `../login.html` and `../my-trees.html`. |
| HTML link/script references | `pages/gemini-v2/index.html` links `../../css/gemini-v2/home.css`; exact search found `../../css/gemini-v2/*` references from `pages/gemini-v2/detail.html`, `intro.html`, `index.html`, and `search.html`. |
| Production impact | Not an active production dependency. The variant page links outward to active/shared pages, but no active production page was found linking back into `pages/gemini-v2/`. |
| Classification | `prototype/reference/demo/variant — preserve` |
| Follow-up judgment | Preserve as design variant/historical UI exploration. |
| Additional conditions before any deletion/move | CTO approval; verify deployed static exposure; verify no design comparison docs still depend on it; decide whether to archive, route-block, or retain direct URL access; do not remove because of Netlify/Vercel legacy assumptions alone. |

### 5. `css/gemini-v2/`

| Item | Finding |
| --- | --- |
| Path | `css/gemini-v2/` |
| Observed files | `home.css`, `intro.css`, `detail.css`, `search.css` surfaced by search. |
| Reference locations | `pages/gemini-v2/index.html`, `pages/gemini-v2/intro.html`, `pages/gemini-v2/search.html`, `pages/gemini-v2/detail.html`; `docs/reference/PROTOTYPE_INDEX.md`. |
| HTML link/script references | Version pages link CSS via `../../css/gemini-v2/...`. |
| Production impact | Not active production dependency; active only for the Gemini v2 reference pages. |
| Classification | `prototype/reference/demo/variant — preserve` |
| Follow-up judgment | Preserve together with `pages/gemini-v2/`. |
| Additional conditions before any deletion/move | Same as `pages/gemini-v2/`; additionally run visual/reference comparison if removing would break directly reachable prototype pages. |

### 6. `pages/gemini-v2/*.css`

| Item | Finding |
| --- | --- |
| Path | `pages/gemini-v2/index.css`, `pages/gemini-v2/detail.css`, `pages/gemini-v2/search.css` |
| Reference locations | Surfaced as colocated CSS artifacts under `pages/gemini-v2/`. |
| HTML link/script references | No active production reference found in this pass; sampled `index.html` uses `../../css/gemini-v2/home.css`, not the colocated `pages/gemini-v2/index.css`. |
| Production impact | No active production dependency found. Still part of the variant folder and may be a historical snapshot. |
| Classification | `unused but not safe to delete` |
| Follow-up judgment | Do not delete in this pass. Treat as variant support/historical artifact until a targeted cleanup PR proves otherwise. |
| Additional conditions before any deletion/move | Full grep for exact filenames; compare with version page history; CTO approval; visual snapshot review if these files correspond to earlier Gemini v2 page states. |

### 7. `pages/gemini-v3/`

| Item | Finding |
| --- | --- |
| Path | `pages/gemini-v3/` |
| Observed files | `index.html`, `intro.html`, `search.html`, `detail.html`, `my-trees.html` |
| Reference locations | `docs/reference/PROTOTYPE_INDEX.md`; internal Gemini v3 page navigation. |
| HTML link/script references | `pages/gemini-v3/index.html` links `../../css/gemini-v3/index.css`; exact search found `../../css/gemini-v3/*` references from `pages/gemini-v3/search.html`, `detail.html`, `intro.html`, `my-trees.html`, and `index.html`. |
| Production impact | Not an active production dependency. It is a directly reachable static variant if deployed. |
| Classification | `prototype/reference/demo/variant — preserve` |
| Follow-up judgment | Preserve as historical UI exploration. |
| Additional conditions before any deletion/move | CTO approval; active navigation check; deployed URL exposure decision; reference index update plan; no deletion based only on apparent legacy status. |

### 8. `css/gemini-v3/`

| Item | Finding |
| --- | --- |
| Path | `css/gemini-v3/` |
| Observed files | `index.css`, `detail.css`, `search.css` surfaced by search. |
| Reference locations | `pages/gemini-v3/*`; `docs/reference/PROTOTYPE_INDEX.md`. |
| HTML link/script references | Version pages link CSS via `../../css/gemini-v3/...`. |
| Production impact | Not an active production dependency; active only for Gemini v3 reference pages. |
| Classification | `prototype/reference/demo/variant — preserve` |
| Follow-up judgment | Preserve with `pages/gemini-v3/`. |
| Additional conditions before any deletion/move | Same as `pages/gemini-v3/`; verify all directly reachable prototype pages before cleanup. |

### 9. `pages/v2/`

| Item | Finding |
| --- | --- |
| Path | `pages/v2/` |
| Observed files | `index.html`, `intro.html`, `search.html` surfaced by search. |
| Reference locations | `docs/reference/PROTOTYPE_INDEX.md`; internal v2 navigation. |
| HTML link/script references | `pages/v2/index.html` links `../../css/v2/base.css` and `../../css/v2/home.css`; exact search found `../../css/v2/*` references from `pages/v2/index.html`, `intro.html`, and `search.html`. |
| Production impact | Not an active production dependency. Direct static access may still exist. |
| Classification | `prototype/reference/demo/variant — preserve` |
| Follow-up judgment | Preserve as generic v2 design exploration. |
| Additional conditions before any deletion/move | CTO approval; active route audit; direct deployed URL policy decision; update prototype index and any docs that cite it. |

### 10. `css/v2/`

| Item | Finding |
| --- | --- |
| Path | `css/v2/` |
| Observed files | `base.css` and page-specific CSS such as `home.css` surfaced through HTML links; additional exact filenames should be listed by a tree command before any cleanup PR. |
| Reference locations | `pages/v2/index.html`, `pages/v2/intro.html`, `pages/v2/search.html`; `docs/reference/PROTOTYPE_INDEX.md`. |
| HTML link/script references | Version pages link CSS via `../../css/v2/...`. |
| Production impact | Not active production dependency; active only for `pages/v2/` reference pages. |
| Classification | `prototype/reference/demo/variant — preserve` |
| Follow-up judgment | Preserve with `pages/v2/`. |
| Additional conditions before any deletion/move | Same as `pages/v2/`; verify exact file list and all HTML links first. |

### 11. `pages/kimi-v2/` observed through broad `v2` search

| Item | Finding |
| --- | --- |
| Path | `pages/kimi-v2/` |
| Observed files | `home.html`, `intro.html`, `search.html`, `detail.html`, `editor.html`, `login.html`, `my-trees.html` surfaced by search. |
| Reference locations | `docs/reference/PROTOTYPE_INDEX.md`; internal Kimi v2 page links; assets under `assets/css/kimi-v2/` and `assets/js/kimi-v2/`. |
| HTML link/script references | Exact search found `assets/css/kimi-v2` references from Kimi v2 pages and `assets/js/kimi-v2` reference from `pages/kimi-v2/intro.html`. |
| Production impact | Not active production dependency. Included because the folder name contains `v2`. |
| Classification | `prototype/reference/demo/variant — preserve` |
| Follow-up judgment | Preserve. Do not include in deletion scope for this issue without a separate explicit task. |
| Additional conditions before any deletion/move | Separate CTO-approved Kimi v2 cleanup audit; exact CSS/JS/page dependency graph; check if any login/editor flows in Kimi v2 are useful as historical reference. |

### 12. `assets/css/kimi-v2/` and `assets/js/kimi-v2/` observed through broad `v2` search

| Item | Finding |
| --- | --- |
| Path | `assets/css/kimi-v2/`, `assets/js/kimi-v2/` |
| Observed files | CSS examples include `_variables.css`, `_components.css`, `home.css`, `login.css`, `search.css`, `detail.css`, `editor.css`, `my-trees.css`; JS example includes `assets/js/kimi-v2/intro.js`. |
| Reference locations | Kimi v2 pages; `docs/reference/PROTOTYPE_INDEX.md`. |
| HTML link/script references | `assets/css/kimi-v2` references found from `pages/kimi-v2/*`; `assets/js/kimi-v2` reference found from `pages/kimi-v2/intro.html`. |
| Production impact | Not active production dependency; supports Kimi v2 reference pages only. |
| Classification | `prototype/reference/demo/variant — preserve` |
| Follow-up judgment | Preserve with `pages/kimi-v2/`. |
| Additional conditions before any deletion/move | Separate Kimi v2 audit and CTO approval; confirm no active route or regression fixture consumes these assets. |

### 13. Docs references

| Item | Finding |
| --- | --- |
| Paths | `docs/reference/PROTOTYPE_INDEX.md`, `docs/design/PROTOTYPE_REFERENCE_POLICY.md`, `docs/design/design_index.md`, `docs/doc_index.md`, `docs/design/UI_POLISH_ROADMAP.md`, `docs/design/BUTTON_BADGE_CHIP_BASELINE.md`, and related docs surfaced by search. |
| Reference role | These docs either define preservation policy or cite version folders as design/reference artifacts. |
| Production impact | Documentation only. No runtime dependency. |
| Classification | `prototype/reference/demo/variant — preserve` for the referenced artifacts; docs themselves are active governance references. |
| Follow-up judgment | Do not remove doc references unless the underlying reference policy is intentionally changed. |
| Additional conditions before any deletion/move | CTO approval, doc index update, policy revision, and a clear migration/archival rationale. |

### 14. `package.json` scripts

| Item | Finding |
| --- | --- |
| Path | `package.json` |
| Observed scripts | `lint`, `build`, `test`, `verify`, batch/e2e/screenshot scripts, and `ci`. |
| Version folder references | No `gpt-v2`, `gemini-v2`, `gemini-v3`, `pages/v2`, `css/v2`, or `kimi-v2` script reference found in the inspected script block. |
| Production impact | No package script dependency on these version folders found in this pass. |
| Classification | No active production dependency found. |
| Additional conditions before cleanup | If cleanup is proposed later, also inspect the implementation of each script under `scripts/` because scripts may glob broad static paths even when `package.json` does not name folders directly. |

## Production reference summary

| Path group | Active production dependency found? | Internal variant dependency? | Static/deployed artifact risk? | Current action |
| --- | --- | --- | --- | --- |
| `pages/gpt-v2/` | No | Yes, internal prototype links | Yes | Preserve |
| `assets/gpt-v2/` | No | Possible prototype support | Yes | Preserve |
| `css/gpt-v2/` | No confirmed path | No | No confirmed path | No action |
| `pages/gemini-v2/` | No | Yes | Yes | Preserve |
| `css/gemini-v2/` | No | Yes, used by `pages/gemini-v2/` | Yes | Preserve |
| `pages/gemini-v2/*.css` | No | Unclear historical support | Yes | Preserve pending targeted audit |
| `pages/gemini-v3/` | No | Yes | Yes | Preserve |
| `css/gemini-v3/` | No | Yes, used by `pages/gemini-v3/` | Yes | Preserve |
| `pages/v2/` | No | Yes | Yes | Preserve |
| `css/v2/` | No | Yes, used by `pages/v2/` | Yes | Preserve |
| `pages/kimi-v2/` | No | Yes | Yes | Preserve |
| `assets/css/kimi-v2/`, `assets/js/kimi-v2/` | No | Yes, used by `pages/kimi-v2/` | Yes | Preserve |
| Docs references | No runtime dependency | Governance/reference dependency | No runtime risk | Preserve unless policy changes |

## Deletion / movement conditions for any future PR

Before any future deletion, archive move, route-block, or ignore-rule PR, require all of the following:

1. Explicit CTO approval for the named path.
2. Fresh full-tree grep on latest `origin/main` for exact path and filename references.
3. Verification that active production navigation, active HTML pages, active JS modules, tests, and build/verify scripts do not consume the path.
4. Confirmation that the path is not part of PR #7 or protected prototype/reference/demo/variant work.
5. Deployed static artifact decision: keep direct URL access, route-block, archive, or delete.
6. Documentation update plan for `docs/reference/PROTOTYPE_INDEX.md`, `docs/design/PROTOTYPE_REFERENCE_POLICY.md`, and any affected doc index.
7. Visual/reference preservation decision if the artifact documents a useful historical UI exploration.
8. Separate PR with no unrelated CSS, JS, Auth, API, Netlify, Vercel, Modal, or Cloudflare changes.

## Final judgment

This audit found no active production dependency into the requested version folders, but it also found that the folders are already governed as prototype / design variant / historical UI references. Therefore, the correct action is documentation and preservation, not deletion.

No deletion candidate is approved by this report. Any future cleanup must be separately scoped and explicitly approved.
