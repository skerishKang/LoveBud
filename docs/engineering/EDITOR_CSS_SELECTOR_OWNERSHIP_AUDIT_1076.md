# Editor CSS Selector Ownership Audit

Issue: #1076

This is an audit-only document for future `css/editor/overrides.css` relocation work. It does not authorize selector movement, selector removal, runtime behavior changes, or visual redesign.

## Purpose

`css/editor/overrides.css` is a large Editor override/cascade layer. Before moving rules into smaller files, selector ownership should be classified by responsibility so future PRs can remain narrow and verifiable.

## Selector ownership buckets

Use these buckets when reviewing or moving selectors.

| Bucket | Meaning | Future PR shape |
| --- | --- | --- |
| shell/layout | outer Editor page shell, grid, panel placement, spacing | CSS-only relocation with full Editor visual smoke |
| canvas | tree canvas, SVG branch layer, node placement, viewport controls | CSS-only relocation plus canvas empty/populated/selected checks |
| detail panel | current moment panel, view mode, edit mode, metadata rows | CSS-only relocation plus selected-memory and inline-edit checks |
| memory form | add/next memory form, inputs, buttons, validation hints | CSS-only relocation plus add-memory form checks |
| responsive/mobile | mobile breakpoints and small-screen overrides | CSS-only relocation plus 375px smoke |
| hidden/compatibility | selectors that preserve current hide/show or legacy compatibility behavior | do not remove without runtime evidence and owner approval |
| temporary override | patch-style selector added to override another file | resolve only after cascade source and visual evidence are known |

## Recommended inventory format

Future implementation PRs should include a selector table like this:

| Selector family | Bucket | Current file | Proposed target | Risk | Required visual state |
| --- | --- | --- | --- | --- | --- |
| `.editor-shell ...` | shell/layout | `css/editor/overrides.css` | `css/editor/layout.css` | medium | desktop + mobile |
| `.memory-node ...` | canvas | `css/editor/overrides.css` | `css/editor/canvas.css` | high | populated + selected |

## Future relocation sequence

Recommended sequence:

1. Refresh current selector inventory.
2. Pick one bucket only.
3. Move selectors without renaming them.
4. Preserve import order and cascade behavior.
5. Run static checks.
6. Run Editor visual smoke on an approved preview/fixed slot if runtime UI files are affected.
7. Report verified and unverified states separately.

Do not combine selector relocation with JavaScript, API, Auth, Modal, or page-shell behavior changes.

## Required visual states for implementation follow-up

A relocation PR should verify:

- Editor empty state;
- populated tree state;
- selected memory state;
- inline edit state;
- add memory form state;
- mobile 375px state;
- no new blocking console errors.

## Forbidden scope

Do not use this audit to perform:

- broad Editor redesign;
- selector renaming/removal;
- JavaScript behavior changes;
- `pages/editor.html` script-order changes;
- Browse/Search/My Trees CSS changes;
- global token rewrites;
- prototype/reference/demo/variant cleanup.

## Closure condition

This audit can be considered complete when future Editor CSS relocation work has a clear selector-bucket checklist and no longer relies on line count alone as the extraction reason.
