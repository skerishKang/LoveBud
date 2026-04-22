# Design System Strategy: The Ethereal Archive

## 1. Overview & Creative North Star: "The Digital Curator"
This design system moves away from the rigid, cold utility of traditional memory apps and toward a "Digital Curator" aesthetic. The goal is to evoke the feeling of an heirloom scrapbook—tactile, personal, and precious—reimagined through a modern, ethereal lens. 

We break the "template" look by rejecting strict vertical grids. Instead, we utilize **Intentional Asymmetry** and **Floating Composition**. Elements should feel as though they are gently drifting on a surface, anchored by delicate organic line art (vine motifs) rather than heavy containers. The high-contrast typography scale (Newsreader vs. Plus Jakarta Sans) creates a sophisticated editorial rhythm that feels high-end yet deeply intimate.

---

## 2. Colors: Tonal Depth & Soul
The palette is built on a foundation of warmth (`background: #fffbff`) and earthy grounding.

*   **The "No-Line" Rule:** 1px solid borders are strictly prohibited for defining sections. To separate the Hero from the Feature section, transition from `surface` to `surface-container-low`. Boundaries must be felt through tonal shifts, not drawn with lines.
*   **Surface Hierarchy & Nesting:** Treat the UI as stacked sheets of fine, semi-translucent paper.
    *   **Level 0:** `surface` (The base canvas).
    *   **Level 1:** `surface-container-low` (Secondary content zones).
    *   **Level 2:** `surface-container-highest` (High-priority interactive cards).
*   **The "Glass & Gradient" Rule:** To achieve the "dreamlike" feel, use Glassmorphism for floating UI (e.g., navigation bars or tooltips). Apply `surface` with 60% opacity and a `backdrop-filter: blur(20px)`.
*   **Signature Textures:** For primary CTAs and key highlights, use a subtle radial gradient transitioning from `primary` (#895757) to `primary-dim` (#7b4b4b). This adds "soul" and a sense of depth that flat fills lack.

---

## 3. Typography: Editorial Sophistication
We pair a high-contrast serif with a clean, modern sans-serif to bridge the gap between "sentimental" and "premium."

*   **Display & Headlines (Newsreader):** Use these for emotional storytelling. The `display-lg` (3.5rem) should be used sparingly to create focal points. Its organic, slightly irregular serifs reflect the "heartfelt" nature of the brand.
*   **Titles & Body (Plus Jakarta Sans):** Used for functional clarity. The wider letter-spacing in `label-md` and `title-sm` provides a clean, breathable counterpoint to the romanticism of the headlines.
*   **Hierarchy Note:** Always maintain a high ratio of white space around `display-md` text to allow the "ethereal" vibe to breathe.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too "digital." Here, we use light and layering to create presence.

*   **The Layering Principle:** Place a card using `surface-container-lowest` on top of a section using `surface-container-low`. The 2% difference in lightness creates a "Soft Lift" that feels natural and premium.
*   **Ambient Shadows:** When a floating effect is required (e.g., a memory card), use an extra-diffused shadow: `0 20px 40px rgba(59, 56, 38, 0.06)`. The tint is derived from `on-surface` (#3b3826) to ensure the shadow feels like a part of the environment, not a grey smudge.
*   **The "Ghost Border" Fallback:** If a container needs more definition, use a `1px` border of `outline-variant` at **15% opacity**. This creates a "suggestion" of a boundary rather than a hard wall.

---

## 5. Components

### Buttons
*   **Primary:** Rounded `full` (9999px). Background is the signature `primary` to `primary-dim` gradient. Text is `on-primary` (#ffffff).
*   **Secondary:** No fill. `1px` Ghost Border (outline-variant @ 20%). Text is `primary`.
*   **Interaction:** On hover, primary buttons should subtly scale (1.02x) and increase shadow diffusion. Avoid harsh color flashes.

### Memory Cards (Signature Component)
*   **Structure:** Use `rounded-md` (1.5rem) corners. The background must be `surface-container-highest`.
*   **Imagery:** Use a soft `inner-shadow` on images to make them feel "recessed" into the card, like a physical photo frame.
*   **Spacing:** Forbid divider lines. Use `1.5rem` of vertical padding between the image and the metadata (date/location).

### Organic Line Art (The Vine Motif)
*   **Implementation:** SVG line art using `outline` (#85816b) at 30% opacity. These vines should physically "connect" components (e.g., trailing from a header to a memory card) to reinforce the "tree" metaphor and guide the eye.

### Input Fields
*   **Style:** Minimalist. No box. A simple bottom border using `outline-variant` @ 50%. On focus, the border transitions to `primary` with a soft `surface-tint` glow.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical layouts where text sits to the left and images "float" slightly higher on the right.
*   **Do** lean into the `secondary` (#586954) earthy green for success states and nature-related iconography to maintain the "organic" theme.
*   **Do** use `rounded-xl` (3rem) for large section containers to mimic the soft, rounded forms of nature.

### Don't:
*   **Don't** use 100% black (#000000) for text. Always use `on-surface` (#3b3826) to maintain the soft, sentimental tone.
*   **Don't** use rigid 90-degree corners. Everything in this system must feel "held" and "soft."
*   **Don't** over-complicate with motion. If an element moves, it should have a slow, ease-in-out "drift" to match the ethereal North Star.