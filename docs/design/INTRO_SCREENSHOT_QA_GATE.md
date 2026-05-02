# Intro screenshot QA gate

## Purpose

This document defines the screenshot review gate for Intro page changes.

The Intro page has several active workstreams: copy differentiation from Home, tree visual scale and composition, branch/node/chip readability, CTA hierarchy, motion, and responsive behavior. Those changes cannot be judged only by static code review. The final question is whether the rendered Intro page reads correctly as an explanation of LoveTree and whether it visually differs from Home while remaining part of the same product family.

This gate records what a reviewer must inspect before any Intro visual or copy PR is considered ready.

## Why this gate is needed

Intro has a different job from Home. Home can be the broad emotional entry point. Intro should explain what LoveTree is and how the product model works. If Intro uses similar hero language and similar visual rhythm to Home, users may not understand why Intro exists.

At the same time, Intro cannot drift into a disconnected marketing page. It must still look like LoveBud and must preserve shared page shell, typography tokens, CTA behavior, and responsive layout.

Because these judgments depend on rendered composition, a screenshot gate is required.

## Required screenshot targets

A verifier should capture or inspect at least these targets:

1. Desktop Intro hero at a wide viewport.
2. Tablet-ish Intro hero if the layout changes materially before mobile.
3. Mobile 375px Intro hero.
4. Desktop first fold including hero copy, CTA group, and tree visual.
5. Mobile first fold including hero copy, CTA group, and tree visual.

If a PR changes lower sections, the verifier should also inspect the modified section on desktop and mobile.

## What to check

### Hero role

The hero must read as Intro, not as a duplicate Home hero. The reviewer should check whether the copy explains LoveTree rather than only inviting the user to begin.

### Visual hierarchy

The headline, lead, CTA group, and tree visual must have a clear order. The user should not need to guess where to look first.

### Tree composition

The tree visual should support the LoveTree concept. Branches, nodes, chips, and labels should feel intentional. They should not become decorative noise or compete with the headline.

### Copy and visual alignment

If the copy explains emotional paths, first scenes, heart notes, or revisitable moments, the visual should not contradict that model. The tree scene should support the idea of connected moments.

### CTA hierarchy

The primary CTA should remain clearly primary. The secondary Browse CTA should remain available without competing for dominance.

### Responsive fit

On mobile, the hero must remain readable without horizontal overflow. The tree visual must not crowd the copy or create awkward clipping.

### Motion and reveal

If transition/reveal classes are present, they should not delay comprehension or create layout jumps. Reduced-motion behavior should not break visibility.

## Pass criteria

An Intro PR may pass this gate only if:

- the rendered page clearly differs in role from Home;
- the hero copy and visual communicate the LoveTree concept;
- desktop and mobile first folds are readable;
- CTA behavior is unchanged unless explicitly scoped;
- no horizontal overflow is visible;
- no fatal console errors appear during load;
- no unrelated runtime, Auth, API, Browse, My Trees, Editor, prototype, reference, demo, or variant files are changed.

## Fail criteria

An Intro PR should remain draft or be revised if:

- Intro still reads like a duplicate Home hero;
- the tree visual overwhelms or contradicts the explanatory copy;
- labels or chips become illegible at mobile width;
- CTA hierarchy becomes unclear;
- the screenshot shows clipping, overlap, or horizontal overflow;
- the PR changes unrelated app surfaces.

## Non-goals

This document does not implement any Intro copy, CSS, animation, routing, Auth, API, backend, package, workflow, PR #7, prototype/reference/demo/variant, PR #450, or Editor/#520 change.

## Issue relationship

This document supports Issue #588 as the screenshot-based QA gate for Intro work.

Refs #587
Refs #588
Refs #589
Refs #590
