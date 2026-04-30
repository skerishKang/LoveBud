# Frontend Rendering XSS Boundary Audit

## Purpose
- Audit-only map for #417.
- Identify user-controlled fields and rendering surfaces.
- No sanitizer adoption, no renderer rewrite, no behavior change.

## Rendering Surfaces
- pages/detail.html and related JS
- pages/search.html and Search/Browse card/preview JS
- pages/editor.html and editor preview/detail JS
- pages/my-trees.html and tree list/card JS
- js/api/public-tree-adapter.js
- js/utils/normalize.js

## User-Controlled Fields
- title
- memo/note
- quote
- artist
- emotion tags
- source URL
- thumbnail URL
- tree/memory labels
- comments (if applicable)

## Sink Classification
- textContent
- innerHTML
- template string interpolation
- URL attributes
- image/thumbnail attributes
- dataset attributes
- Markdown-like or rich text paths

## Audit Questions
- Which paths use textContent vs innerHTML?
- Which fields enter HTML strings?
- Which URLs are canonicalized?
- Which helpers escape or normalize fields?
- Which fixes are page-specific vs shared helper fixes?

## Follow-Up Split
- PR A: docs-only coverage map
- PR B: representative malicious text contract/smoke tests
- PR C: shared escape/helper usage if justified
- PR D: page-specific renderer fixes one page at a time

## Guardrails
- No broad renderer rewrite
- No sanitizer dependency
- No API response shape change
- No Search/Auth/Editor cleanup mixed in
- No PR #7/prototype/reference/demo/variant changes