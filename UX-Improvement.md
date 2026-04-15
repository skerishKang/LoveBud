# LoveBud Editor UX Improvements

## Changes Implemented
- Added outside‑click and **Esc** key handling to close the add‑memory form.
- Implemented focus‑trap so Tab navigation cycles within the form inputs.
- Added auto‑scroll to newly created memory nodes and a temporary highlight animation (`new-node-highlight`).
- Updated CSS with the highlight animation keyframes.
- Cleaned up event listener management to avoid memory leaks.

These changes make the inline memory‑addition form feel more natural without altering the existing `createMemory` flow.
