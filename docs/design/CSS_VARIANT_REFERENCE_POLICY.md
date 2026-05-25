# CSS Variant Reference Policy

> **Refs:** #1499  
> **Status:** Active policy — do not remove or supersede without a product/design decision.

---

## Overview

This repository contains two distinct categories of CSS:

| Category | Description | Examples |
|---|---|---|
| **Active Runtime CSS** | Imported by production pages; subject to cleanup, tokenization, and normalization | `css/global.css`, `css/index.css`, `css/editor.css`, etc. |
| **Design Reference / Variant Archive** | Historical design variants preserved for reference; **not** imported by production pages | `css/v2/`, `css/gemini-v2/`, `css/gemini-v3/`, `assets/css/kimi-v2/` |

---

## Variant Archive Directories

The following directories are **design reference archives** and must be treated as such:

- `css/v2/`
- `css/gemini-v2/`
- `css/gemini-v3/`
- `assets/css/kimi-v2/`

These directories were **intentionally retained** as design reference / variant archives. They are **not** accidental duplicates, dead code, or cleanup candidates.

---

## Rules for Future Audits and Cleanup Tasks

### ✅ Allowed — Active Runtime CSS only

The following operations apply **only** to CSS files that are actively imported by production pages:

- CSS cleanup and dead code removal
- Design token extraction and substitution
- Variable normalization
- Import chain restructuring

### ❌ Prohibited — Variant Archive CSS

The following operations are **prohibited** on variant archive directories without an explicit product/design promotion decision:

- Deletion of files or directories
- Merging into active stylesheets
- Token rewriting or normalization
- Consolidation with other variant directories
- Modification of the active stylesheet import chain based on archive content

### 🔍 Audit Classification Step (Required)

Before any CSS audit or cleanup task, auditors **must** first classify each CSS file as either:

1. **Active / Imported** — verify the file is referenced in an import chain from a production HTML page
2. **Reference / Archive** — file exists in a known variant archive directory (see list above)

Only Active/Imported CSS is in scope for cleanup.

---

## Zero-Byte and Placeholder Files

Zero-byte (empty) CSS files within variant archive directories may serve as:

- **Archive markers** — intentionally retained to document the existence of a design iteration
- **Directory retention stubs** — preventing the directory from being removed by Git

Such files **must not** be deleted solely because they are empty or unreferenced. Their presence is intentional.

---

## Promotion of a Variant to Active Runtime

If a future product or design decision determines that a variant should become the active stylesheet, the following process applies:

1. Open a dedicated PR with a clear product/design rationale
2. Update the import chain in the relevant HTML pages
3. Remove or update the README in the promoted directory to reflect its new active status
4. Update this policy document accordingly

This is the **only** acceptable path for modifying variant archive CSS.

---

## Background

This policy was introduced in response to Issue #1499, where variant CSS directories were mistakenly identified as cleanup candidates. The v2, gemini-v2, gemini-v3, and kimi-v2 CSS directories are **intentional design reference archives**, not accidental duplicates or leftover dead code.
