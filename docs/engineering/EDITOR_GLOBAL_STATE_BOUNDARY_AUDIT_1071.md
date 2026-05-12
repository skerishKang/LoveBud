# Editor Global State Boundary Audit

Issue: #1071

This audit records the first safe boundary for reducing broad Editor browser-global state usage. It is documentation-only and does not change Editor runtime behavior.

## Current concern

The Editor runtime still uses broad browser-global state and compatibility functions, including patterns such as:

```text
window.currentTreeData
window.currentTreeMemories
window.refreshMemories
window.updateDetailPanel
```

These globals are useful for compatibility, but direct reads and writes across multiple responsibilities make future extraction risky.

## Goal

Future implementation should consolidate current-tree state access behind a focused helper boundary before larger Editor refactors.

The first implementation should be no-behavior-change and should not attempt to rewrite the Editor entrypoint.

## Proposed boundary responsibilities

A future helper may own:

| Responsibility | Purpose |
| --- | --- |
| read current tree data | provide one safe access point for current tree metadata |
| write current tree data | preserve visibility defaults and compatibility behavior |
| read current tree memories | normalize and return current memory list consistently |
| write current tree memories | update the current memory list through one boundary |
| expose compatibility aliases | keep existing globals available while routing through helpers |

## Suggested helper shape

Names are illustrative only:

```text
getCurrentTreeData()
setCurrentTreeData(tree)
getCurrentTreeMemories()
setCurrentTreeMemories(memories)
refreshCurrentTreeMemories(options)
```

The implementation PR should preserve existing browser-global compatibility unless explicitly approved otherwise.

## Future implementation sequence

Recommended sequence:

1. Inventory all Editor current-tree global reads/writes.
2. Add focused helper functions without changing behavior.
3. Route a small set of callsites through the helper boundary.
4. Preserve compatibility globals.
5. Run static checks.
6. Use Editor browser smoke if runtime files change.

Do not combine this with data-loader extraction, canvas extraction, detail panel extraction, CSS relocation, or Auth/API/backend work.

## Required verification for implementation follow-up

If runtime files change, verify:

- Editor empty state;
- populated tree state;
- selected memory detail state;
- add memory flow if touched;
- edit/delete flow if touched;
- mobile 375px if UI state rendering is touched;
- no new blocking console errors.

## Forbidden scope

Do not use this audit to perform:

- broad `js/editor.js` rewrite;
- `pages/editor.html` script-order changes;
- module-system conversion;
- Auth/API/backend changes;
- Editor CSS relocation;
- product/UI redesign;
- prototype/reference/demo/variant cleanup.

## Closure condition

This audit is complete when a future implementation PR can route current-tree state access through a helper boundary without requiring broad Editor entrypoint changes.
