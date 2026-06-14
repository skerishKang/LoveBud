# LoveBud Editor Memory Atlas Preview Panel Note

Issue: #2501

This slice surfaces the existing read-only Memory Atlas projection and non-persistent preview helpers inside the editor detail experience.

Locked guardrails:

- preview only;
- no relationships are saved;
- based on selected memory fields;
- no AI inference;
- no network/API call;
- no DB or schema change;
- no Browse/Search behavior change;
- no Scout/provider work;
- no public graph/wiki publication.

Implementation shape:

- `pages/editor.html` loads the Memory Atlas projection helper, preview helper, and editor preview panel helper before `editor-detail-ui.js`.
- `editor-detail-view-mode-template.js` exposes `detailAtlasPreviewMount`.
- `editor-detail-ui.js` renders the panel only for the selected memory context and clears it for empty state.
- `editor-memory-atlas-preview-panel.js` is deterministic and can render into a supplied container without app bootstrap side effects.
