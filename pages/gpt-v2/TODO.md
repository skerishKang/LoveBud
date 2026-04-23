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

## Observed QA issues
- [x] `start.html` was previously placeholder-like and has been replaced with a Korean draft
- [ ] `start.html` still needs to match the uploaded reference image more closely in spacing, decorative collage density, and lower-section content
- [ ] `editor.html` currently has overlapping memory cards on the deployed domain
- [ ] `editor.html` is missing the reference-image rhythm: left info panel, centered tree composition, and right-side composer density are all too sparse
- [ ] `editor.html` needs a safer layout so card overlap does not break at common desktop sizes

## Next fixes
- [ ] Make `intro.html` visually closer to the provided reference image
- [ ] Make `browse.html` card density and right-side hub closer to the provided reference image
- [ ] Rebuild `editor.html` to better match the provided reference image
- [ ] Extend shared CSS for missing browse/editor-specific classes
- [ ] Decide which existing project JS can be reused safely in `gpt-v2`
- [ ] Add page-level JS only where existing shared JS cannot be reused
- [ ] Verify all pages on deployed domain and local environment
- [ ] Compare each `gpt-v2` page against the uploaded reference images and reduce visual drift

## Notes
- Current `gpt-v2` pages are still HTML/CSS-first experimental drafts.
- Existing production JS has not been fully connected yet.
- Remaining work should be done with visual QA against the provided reference images.
