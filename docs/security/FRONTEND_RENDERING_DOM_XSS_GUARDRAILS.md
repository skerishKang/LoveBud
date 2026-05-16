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

If a future renderer legitimately needs dynamic HTML, add a small safe helper or extend the test with a narrow allowlist and a comment explaining the safe boundary.
