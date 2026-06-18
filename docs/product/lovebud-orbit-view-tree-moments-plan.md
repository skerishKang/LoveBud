# LoveBud Tree-Internal 3D Moment Orbit View Plan

Refs #2692

## Overview

This document defines the product scope, technical direction, fallback strategies, and implementation slices for the **Tree-Internal 3D Moment Orbit View Mode** ("입체 보기").

### Core Scope Definitions

* **Scope**: planning/contract only
* **Runtime behavior change**: none
* **Editor behavior change**: none
* **Data model change**: none
* **Cloudflare env change**: none
* **Production activation**: blocked

---

## 1. Product Priorities & Scope Boundaries

### Priority 1: Tree-Internal Moment Orbit View
The first implementation slice focuses strictly on viewing the moments within an opened tree in a 3D orbit space.
* **User-facing label**: `트리 보기 / 입체 보기`
* **Opt-in & Read-only**: The 3D view mode is opt-in (users toggle it manually) and read-only.
* **Default State**: Existing normal tree/moment view remains the default experience.
* **Editor Flow**: Existing editing/canvas creation workflow remains entirely unchanged.
* **Target Surfaces**: The mode applies to opened tree viewing surfaces:
  * Trees opened from Browse (`/pages/search`)
  * Trees opened from My Trees (`/pages/my-trees`)

### Later Priorities (Deferred)
* **Home Hero 3D Preview**: Later priority, not part of the initial implementation.
* **My Trees Appreciation/Continue-Viewing Hub 3D Preview**: Later priority, not part of the initial implementation.

### Boundary with #2678
* **#2678 Boundary**: #2678 aligns the 2D desktop rhythm of My Trees continue-viewing preview hub.
* **Non-Replacement**: The 3D orbit view mode target must not replace or disrupt the My Trees list-page preview hub layout established by #2678.

---

## 2. Technical Direction & Architecture

* **CSS 3D / Transform-First**: High-performance layout using native CSS 3D transforms (`perspective`, `transform-style: preserve-3d`, `translate3d`, `rotate3d`).
* **WebGL/Three.js**: Explicitly excluded initially to keep the bundle size small and load-times fast. No WebGL/Three.js libraries will be introduced in the early slices.
* **Token Reuse**: Reuse existing card/moment visual CSS tokens to maintain semantic coherence.
* **No New Data Model**: Relies entirely on the existing client-side JSON/data payload representation of moments and trees.
* **localStorage Persistence**: Optional localStorage persistence for user view mode preferences may be added in a later scoped implementation slice, only if determined to be safe and isolated.

---

## 3. Fallbacks & Accessibilities

* **Reduced-Motion Fallback**: Users with `prefers-reduced-motion` enabled must receive a flat 2D layout fallback with minimal/no animation.
* **Mobile Fallback**: Safe, layout-appropriate fallback or simplified animations for mobile and low-performance devices to ensure scrolling and orientation interactions remain lightweight.

---

## 4. Implementation Slices

1. **docs/contract plan** (Current Slice)
2. **Surface Identification**: Identify existing tree-viewer surface component boundaries (`tree.html` / `tree-viewer.js`).
3. **Read-Only Orbit Prototype**: Build a basic interactive 2D-to-3D transform container for tree moments.
4. **Browse/My Trees Viewer Parity**: Wire up the opt-in toggle (`입체 보기`) on both Browse detail view and My Trees detail view.
5. **Home Hero Preview**: (Later) Add 3D/orbit visual previews on the intro/landing page hero banner.
6. **Appreciation/Continue-Viewing Hub Preview**: (Later) Add preview capabilities on My Trees dashboard preview hub.

---

## 5. Completion Rules

* This PR does not complete #2692.
* #2692 remains open until the prototype path is implemented or explicitly superseded.

---

## 6. Guardrails & Constraint Invariants

* **Protected Issues**: No automatic closing keywords (`Closes`, `Fixes`, `Resolves`) for #2692 or any protected issue such as #1882.
* **Scout Integration**: No changes to Scout runtime, provider, API, auth, or rate limits.
* **Cloudflare Activation**: Production activation remains BLOCKED.
