# GPT v2 TODO

## Current status
- [x] `pages/gpt-v2/home.html` created
- [x] `pages/gpt-v2/intro.html` created
- [x] `pages/gpt-v2/start.html` created
- [x] `pages/gpt-v2/browse.html` created
- [x] `pages/gpt-v2/editor.html` created
- [x] `css/gpt-v2/common.css` created
- [x] `start.html` -> `editor.html` CTA link connected
- [x] Deployed-domain QA started with `start` and `editor`

## Working order
1. Match the uploaded reference images more closely with HTML/CSS
2. Stabilize spacing, layering, and responsive behavior on deployed pages
3. Only after visual parity is acceptable, connect reusable JS/features

## Observed QA issues
- [x] `start.html` was previously placeholder-like and has been replaced with a Korean draft
- [ ] `start.html` still needs to match the uploaded reference image more closely in spacing, decorative collage density, and lower-section content
- [ ] `editor.html` previously had overlapping memory cards on the deployed domain
- [ ] `editor.html` still needs stronger reference-image rhythm: left info panel weight, centered tree composition, and right-side composer density
- [ ] `editor.html` still needs decorative object/detail pass to resemble the provided reference image more closely
- [ ] `browse.html` is still too sparse compared with the uploaded reference image
- [ ] `intro.html` is still too simplified compared with the uploaded reference image

## Next visual fixes
- [ ] Refine `start.html` toward the uploaded reference image
- [ ] Refine `editor.html` toward the uploaded reference image
- [ ] Refine `browse.html` toward the uploaded reference image
- [ ] Refine `intro.html` toward the uploaded reference image
- [ ] Extend shared CSS for missing page-specific classes only after visual comparison

## JS phase (after visual parity)
- [ ] Decide which existing project JS can be reused safely in `gpt-v2`
- [ ] Add page-level JS only where existing shared JS cannot be reused
- [ ] Verify all pages on deployed domain and local environment with interactions enabled

## Notes
- Current `gpt-v2` pages are still HTML/CSS-first experimental drafts.
- Existing production JS has not been fully connected yet.
- Remaining work should continue with visual QA against the provided reference images.
