# Frontend Rendering DOM XSS Guardrails

## Purpose

This document defines the rendering contract for user-controlled LoveBud fields in frontend UI code.

The goal is not to redesign renderers or replace all `innerHTML` usage. The goal is to make future Editor, Public Viewer, Tree Viewer, and shared UI changes fail review or tests when user-controlled data is routed into HTML sinks without an explicit safe boundary.

## User-controlled fields

Treat the following values as user-controlled unless a caller proves they are static product copy:

- LoveTree title, label, description, visibility text, and owner-facing metadata.
- Memory title, memo, note, quote, diary content, and localized display text derived from saved tree or memory records.
- Emotion tags, custom labels, dates typed or imported by a user, and source names.
- Thumbnail URLs, source URLs, image alt text, embed URLs, and other media metadata.
- Any API payload, local draft value, imported fixture, or browser storage value that can be created or edited outside the current renderer.

## Safe rendering defaults

Use these defaults for all new UI work:

- Text nodes: assign with `textContent`.
- Form fields: assign with `value`.
- URLs and media sources: validate or normalize first, then use `setAttribute`, `src`, `href`, or a named URL helper.
- Lists and repeated UI: create elements with `document.createElement`, then assign text through `textContent`.
- Dataset values: store identifiers or normalized values only; do not store private payloads.

## `innerHTML` policy

`innerHTML`, `outerHTML`, and `insertAdjacentHTML` are allowed only for one of these cases:

1. Static templates that contain no user-controlled interpolation.
2. HTML fragments where every interpolated user-controlled value is passed through an explicit escaping helper such as `escapeHtml` before entering the string.
3. Narrow legacy renderers that already have a documented safe boundary and are covered by a contract test.

Do not interpolate these objects or fields directly into HTML strings:

- `tree`, `treeData`, `currentTree`, `memory`, `memories`, `node`, `item`, `record`, `payload`, `draft`, `formData`, `tag`, `title`, `memo`, `note`, `quote`, `diary`, `thumbnail`, `sourceUrl`, `url`, or `label`.

When HTML is unavoidable, make the boundary visible in the code review diff by using a named helper. Reviewers should be able to see that escaping, URL validation, or static-template-only rendering is intentional.

## Review checklist

Before approving frontend render changes, check:

- Does the diff add `innerHTML`, `outerHTML`, or `insertAdjacentHTML`?
- Does the sink contain template interpolation or string concatenation?
- Could the value come from a tree, memory, diary, tag, date, thumbnail, source URL, localized payload, local draft, API payload, or browser storage?
- If yes, is the value assigned through `textContent`, validated URL attributes, DOM node creation, or an explicit escaping helper?
- Does the change avoid printing credential-bearing values, private payloads, or database connection details in UI logs, comments, tests, or reports?

## Contract-test boundary

The contract test for this policy scans representative high-risk frontend files. It is intentionally conservative: it does not ban all `innerHTML`, but it fails on obvious direct interpolation of user-controlled field names into HTML sinks without a safe helper.

Statement windows are bounded, multiline and template-aware: the whole sink assignment is analysed, not just the line the sink token sits on, so a safety change deeper inside a multi-line template cannot slip past the guard.

If a future renderer legitimately needs dynamic HTML, add a small safe helper or extend the test with a narrow allowlist and a comment explaining the safe boundary.

## Sink inventory and the two-layer guard (#4533)

Every `innerHTML`, `outerHTML` and `insertAdjacentHTML` occurrence under `js/**` is inventoried in `docs/security/frontend-dom-sink-inventory-4533.json`, re-derived from the exact checked-in tree on every run.

### Layer 1 — per-file sink count

`tests/contracts/dom-xss-renderer-guardrail-contract.test.cjs` signs a per-file sink count. It catches a new sink, a removed sink, or a file receiving its first sink. It is necessary but not sufficient: a count-only guard cannot see a same-count edit, so the two guards below exist.

### Layer 2 — sink-level semantics

`tests/contracts/frontend-dom-xss-guardrails.test.cjs` re-derives every sink, compares the identity multiset with the inventory 1:1, and classifies each sink. Identity is `path :: sinkType :: #occurrence :: statementDigest` over the whitespace-normalised statement — line numbers are recorded for humans only, and a same-count semantic degradation changes the digest and fails.

All active sinks must be classified. `ACTIVE_REVIEW_NEEDED_COUNT` must be `0`: a new active sink that lands in `review_needed` fails the test rather than being waved through as a one-line `"safe"` entry.

Classification vocabulary:

| classification | meaning |
|---|---|
| `CLEAR_CONTAINER` | right-hand side is an empty string literal |
| `STATIC_TRUSTED_TEMPLATE` | no user-controlled value reaches the sink |
| `EXPLICIT_ESCAPED_DYNAMIC` | every user value passes `escapeHtml` / `textContent` / `createTextNode` / `setAttribute` |
| `SANITIZED_URL_DYNAMIC` | every user value passes `sanitizeUrl` / `safeUrl` / `normalizeUrl` |
| `APPROVED_RENDERER_BOUNDARY` | delegated to a helper whose bounded call chain reaches an escaping boundary |
| `REVIEW_NEEDED` | user-controlled value with no provable safe boundary |
| `DORMANT_OR_MOCK` | sink on a non-active surface; recorded, never counted as active Product acceptance |

### Approved renderer boundaries

An approved renderer boundary is explicit and narrow: the helper name must resolve to a real definition whose body, or whose bounded callee chain, reaches an explicit escaping boundary. A helper that stops escaping stops being approved. The boundary is never granted by a variable name or by a file-level `"safe"` label alone.

Provenance is only ever used to prove safety. A value resolved from an i18n/application-text definition (`tText`, `t`, `getSearchCopy`, a literal) is not user-controlled; provenance alone can never turn an unproven sink into an accepted one.

### Active, dormant and mock surfaces

Surface is freshly derived, never inherited from an older document:

- `ACTIVE_PRODUCT` — the file is loaded by a reachable Product page (root page, a `_redirects` canonical target, an inbound href, or a non-self-referential `pages/<name>` reference).
- `DORMANT_UNLINKED` — loaded only by an unreachable page, or by no page at all (for example the legacy root Search duplicates and `js/viewer/public-tree-viewer.js`).
- `MOCK_PROTOTYPE` — a prototype/PoC runtime that no active page reaches (for example `js/chat-first-workspace.js`, whose only loader `pages/chat-first-workspace.html` has no inbound navigation).

Direct URL access is not navigation: a page a user could type in manually is still `DORMANT_UNLINKED` when nothing in the active product links or routes to it. Dormant and mock sinks stay in the inventory, and their semantic verdict stays visible, but they are never mixed into active Product safety acceptance.

### What fails the test

- a new, removed or edited sink (Layer 1 count, Layer 2 identity)
- same-count escape removal, and same-count replacement of an approved renderer
- any active sink classified `REVIEW_NEEDED`
- an inventory total or classification that no longer matches a fresh derivation
