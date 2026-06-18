# LoveBud Optional 3D/Orbit Prototype Plan

Refs #2692

This document establishes the audit findings, architecture surfaces, and implementation strategy for introducing the **Optional 3D/Orbit Moment Viewer** ("입체 보기").

---

## 1. Product Invariants

* **Opt-In Mode Only**: 3D/orbit viewing is strictly an optional layout mode toggled via user action.
* **Calm/Static Defaults**: The default general mode for tree viewing surfaces remains the existing 2D/static layout.
* **User-Facing Label**: `트리 보기 / 입체 보기`
* **Reduced Motion Fallback**: Users with `prefers-reduced-motion` enabled must receive a flat 2D layout fallback with no animation or 3D rotations.
* **Mobile Fallback**: Responsive viewport constraints must gracefully fall back to simplified CSS translations or static layouts on mobile/tablets to protect frame rates.
* **Visual Rhythm Alignment**: Introduction of 3D features must not degrade the existing 2D page grids or layout rhythms established in Browse/My Trees.

---

## 2. Target Surface Identification

To minimize boundary bleed-out, only three specific target surfaces are identified:

### A. Home Hero Banner (Landing)
* **Target File**: `index.html` (Hero banner collage area)
* **3D Scope**: A lightweight background container translating decorative moments using passive rotational angles.

### B. Browse Read-Only Tree Viewer
* **Target File**: `pages/tree.html` (Loaded from `/pages/search`)
* **3D Scope**: Orbit viewing of tree branches and moment cards in a read-only viewer context.

### C. My Trees Read-Only Tree Viewer
* **Target File**: `pages/tree.html` (Loaded from `/pages/my-trees` detail preview clicks)
* **3D Scope**: Appreciation path viewing only.

---

## 3. Surface Exclusions

* **Editor & Workbench**: `pages/editor.html` and `js/editor.js` workflows are strictly excluded. The 3D view mode does not apply to writing, modifying, or customizing canvas moments.
* **Scout AI Integrations**: No alterations are allowed to Scout runtime, provider, API, auth, or rate limit rules.

---

## 4. Technical Prototype Plan

* **CSS 3D / Transform-First**: High-performance rendering via CSS 3D transforms (`perspective`, `transform-style: preserve-3d`, `rotate3d`, `translate3d`).
* **WebGL/Three.js Exclusion**: WebGL renderers (`THREE.WebGLRenderer`), Three.js core libraries (`THREE.`), and orbit controller modules (`OrbitControls`) are excluded from initial slices to avoid bundle weight drift.
* **State Persistence**: A future optional phase may introduce localStorage scopes to persist mode preferences, only if confirmed safe.

---

## 5. Deployment Boundaries

* **Scout runtime changes**: none
* **Cloudflare env changes**: none
* **Production activation**: remains BLOCKED
