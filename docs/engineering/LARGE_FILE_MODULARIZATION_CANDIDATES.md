# Large File Modularization Candidates

Issue: #408

This document records the initial LoveBud large-file modularization inventory for files that exceed or approach the 500-line reviewability threshold.

This is an audit document only. It does not authorize refactors, file moves, ES module conversion, bundler adoption, route movement, CSS relocation, or runtime behavior changes.

## Purpose

LoveBud prefers reviewable, owner-scoped files so parallel agents can inspect and change work safely. Large files are not automatically bad, but they increase review cost and make unrelated behavior easier to mix.

This inventory is intended to:

- make large or near-large operating files visible,
- route each candidate to its existing owner issue or domain,
- prevent broad refactors created only from line-count pressure,
- define allowed next steps and forbidden scope before implementation,
- preserve runtime-sensitive verification requirements.

## Safe refresh commands

Run these from a clean worktree. They print paths and counts only; they do not inspect secrets or local-only files.

```bash
# Operating source files over or near the 500-line reviewability threshold.
find js css pages functions modal_compute scripts -type f \
  \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.py' -o -name '*.ps1' \) \
  -not -path './node_modules/*' \
  -not -path './.local/*' \
  -not -path './.git/*' \
  -print0 \
  | xargs -0 wc -l \
  | sort -nr

# Runtime-focused subset.
wc -l js/editor.js modal_compute/app.py 'functions/api/[[path]].js' css/editor/overrides.css 2>/dev/null

# Secret-safe tracked-file check; path names only.
git ls-files '.local' 'docs/ops/qa-credential-bundle' '*.zip' '*.age'
```

Do not print `.env`, `.local`, credential, token, cookie, session, or private payload values.

## Classification labels

| Status | Meaning |
| --- | --- |
| `OK_AS_IS` | Large but stable, clear owner, no near-term pressure. |
| `WATCH` | Near threshold or moderately large; monitor before nearby work grows it. |
| `AUDIT_NEEDED` | Large and ownership boundaries should be documented before implementation. |
| `EXTRACTION_CANDIDATE` | Large plus active symptoms, repeated edits, mixed responsibilities, or existing owner tracker. |

Line count alone is never enough to justify extraction.

## Initial candidate inventory

The line-count bands below are based on GitHub content inspection and should be refreshed with the safe commands above before any implementation PR.

| File | Line band | Owner domain | Current status | Existing tracker | Recommended next step | Forbidden scope | Verification if implementation occurs |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `js/editor.js` | 1000+ | Editor runtime shell | `EXTRACTION_CANDIDATE` | #225, #422, #518-#521 | Continue audit-first split by one responsibility: data loading, detail UI handoff, canvas orchestration, fallback aliases, or global state cleanup. | No broad rewrite, no `pages/editor.html` rewrite, no Auth/API/backend/package/workflow changes, no PR #7/prototype changes. | Fixed test slot required for Editor runtime; desktop + mobile 375px; empty/populated/selected-memory states; no fatal console errors. |
| `modal_compute/app.py` | 500+ | Modal backend route and owner write/read orchestration | `AUDIT_NEEDED` | #423 | Continue staged repository/query split after contract tests. Public read extraction is done; owner read/write boundaries remain. | No route decorator movement without explicit approval; no broad Modal route migration; do not combine DB/auth/validation changes with route movement. | Backend contract tests plus runtime/API verification for affected routes; fixed slot or production public-read observation as scoped. |
| `css/editor/overrides.css` | 500+ | Editor CSS override/cascade layer | `EXTRACTION_CANDIDATE` | #419, #513-#517 | Continue role-based relocation only after selector family audit and browser visual verification. | No broad editor redesign, no selector rename/removal without proof, no JS/runtime changes, no Browse/Search/My Trees changes. | Editor visual smoke: empty, populated, selected memory, inline edit, add memory form, mobile 375px, no fatal console errors. |
| `functions/api/[[path]].js` | Near 500 | Cloudflare Pages Functions API gateway/proxy | `WATCH` | #470, #473, future gateway-specific tracker if needed | Keep stable after request correlation and diagnostics docs. Create a gateway audit only if additional route/proxy logic grows materially. | No gateway rewrite, no request/auth behavior change, no package/workflow/config changes from #408. | Public API smoke and Auth/API fixed-slot verification for affected route groups. |
| `pages/editor.html` | Likely 500+ or near threshold | Editor page shell and script order | `WATCH` | #422, #518-#521 | Do not split from #408 alone. Treat any shell/script-order change as runtime-sensitive Editor work. | No page rewrite, no script reorder without `SCRIPT_LOAD_ORDER.md` review, no CSS/JS behavior mix unless scoped. | Fixed test slot; Editor load, auth state, selected/empty states, mobile smoke. |
| `pages/search.html` | Likely near threshold | Search/Browse page shell | `WATCH` | #424, #456 | Keep under Search/Browse owner trackers; do not create a duplicate extraction issue unless shell grows further. | No Search adapter/API/UI state changes bundled together; no broad Search rewrite. | Browse/Search data-backed smoke requires fixed slot or explicitly scoped production public observation. |
| `js/search-preview-renderer.js` | Candidate by ownership pressure, exact count to refresh | Search preview renderer | `AUDIT_NEEDED` | #424 | Route future extraction to #424; one helper family at a time. | No `updatePreview` behavior change without browser smoke; no API/adapter changes in same PR. | Search/Browse preview browser smoke with selected preview and mobile state. |
| `js/auth.js` | Candidate by historical ownership pressure, exact count to refresh | Auth bootstrap/session/cache | `AUDIT_NEEDED` | #78 | Use Auth/Login active provider transition plan before any split. | No provider switch, token handling change, or login redirect behavior change from #408. | Fixed test slot; login/logout/protected page flows; no token/cookie/session value exposure. |
| `docs/ops/*` long runbooks | 500+ possible | Ops documentation | `OK_AS_IS` or `WATCH` | owning issue per runbook | Long docs are acceptable when they are source-of-truth runbooks; split only when navigation suffers. | Do not split docs in a way that hides guardrails or weakens startup instructions. | Docs-only review; no runtime verification required. |

## Owner routing notes

### Editor

`js/editor.js`, `pages/editor.html`, and editor CSS candidates must not be handled by a broad large-file cleanup PR. Route them to the active Editor trackers:

- #225 for fallback/global-state cleanup framing.
- #422 and #518-#521 for editor detail UI responsibility boundaries.
- #419 and #513-#517 for editor CSS override relocation and consolidation.

### Modal

`modal_compute/app.py` is the current Modal route shell and owner/private route orchestration file. It should continue through #423 staged split work. Public read helper extraction has already begun, but owner read/write and route ownership require separate contract tests and runtime verification.

### Cloudflare gateway

`functions/api/[[path]].js` is a gateway/proxy file. It now carries request ID propagation, Modal route mapping, upstream/degraded headers, and method/unhandled-route responses. Keep it stable unless a gateway-specific issue approves a narrow extraction.

### Search/Browse

Search/Browse large-file pressure should not create duplicate work. Route preview renderer work to #424 and performance/loading work to #456. Data-backed browser verification must follow fixed-slot or explicitly scoped production-observation rules.

### Auth

Auth large-file pressure must route through #78 and the Auth/Login active provider transition plan. Do not refactor token/session logic from a line-count audit alone.

### Docs

Long docs can be acceptable when they are source-of-truth operating runbooks. For docs, line count is secondary to discoverability, index placement, and whether the document mixes unrelated ownership domains.

## Recommended follow-up sequence

1. Keep #408 as the standing visibility tracker until this inventory lands.
2. Do not create new implementation issues for files that already have owner trackers.
3. For each implementation follow-up, require one owner domain and one responsibility boundary per PR.
4. Refresh exact line counts before implementation.
5. Require browser/runtime/fixed-slot verification only when runtime-sensitive files change.

## Closure criteria for #408

#408 can be closed after this inventory is merged if the CTO accepts that:

- candidates are visible in one document,
- owner routing prevents broad refactors,
- existing trackers own the implementation paths,
- no behavior change occurred in the audit PR,
- future extraction remains one issue/PR per owner domain and responsibility boundary.

## Guardrails

- No implementation changes.
- No file moves.
- No ES module conversion.
- No bundler adoption.
- No runtime behavior changes.
- No Auth/API/Search/My Trees/Editor behavior changes from this audit.
- No package/workflow/config changes.
- No PR #7/prototype/reference/demo/variant changes.
- No secret/token/cookie/session/credential/private payload inspection or output.
