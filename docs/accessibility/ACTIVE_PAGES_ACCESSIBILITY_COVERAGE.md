# Active Pages Accessibility Coverage Matrix

## Purpose

This is an audit-only coverage matrix. No ARIA, CSS, JS behavior, keyboard behavior, or screen-reader implementation changes are made in this PR. The document exists to split future accessibility implementation into narrow, verifiable PR scopes.

## Page Coverage Matrix

| Page | Primary Interactive Controls | Accessible-name Risk | Keyboard Navigation Risk | Focus Visibility Risk | Dynamic State Announcement Risk | Auth/API/Runtime Sensitivity | Suggested Follow-up Owner/Scope | Verification Requirement |
|------|-----------------------------|----------------------|--------------------------|----------------------|--------------------------------|------------------------------|--------------------------------|------------------------|
| index.html | Hero CTA buttons, shared header nav, menu button, home-intro-entry link | LOW - Hero CTAs have visible text, menu button may need aria-label | MEDIUM - Menu button keyboard navigation, tab order through hero | MEDIUM - Focus ring visibility on hero buttons | LOW - Static content, hero trees loaded via JS | LOW - Public page, no auth | Icon-only button accessible-name PR | Desktop browser smoke, mobile 375px smoke |
| pages/intro.html | Hero CTA buttons, shared header nav, how-to cards, value items, visual-only elements | MEDIUM - Visual-only tree scenes (aria-hidden="true" present), decorative elements | LOW - Standard link navigation | MEDIUM - Focus ring on visual-only cards (should not receive focus) | LOW - Static content, i18n applied on load | LOW - Public page, no auth | Icon-only button accessible-name PR, cross-page visual-only elements | Desktop browser smoke, mobile 375px smoke |
| pages/search.html | Search input, filter chips, tree cards, preview sidebar, preview mobile close, shared header nav | HIGH - Filter chips (span elements, not buttons), tree cards (button structure), preview sidebar | HIGH - Filter chips may not be keyboard accessible, tree card navigation, preview sidebar toggle | MEDIUM - Focus ring on tree cards, preview sidebar | MEDIUM - Search results loaded dynamically, preview state changes | MEDIUM - Public page, API calls for trees | Search/Browse card accessibility PR, icon-only button accessible-name PR | Desktop browser smoke, mobile 375px smoke, keyboard-only navigation pass |
| pages/detail.html | Back button, detail view chip, video player, connected fragments, shared header nav | MEDIUM - Back button has visible text, detail view chip, video player controls | MEDIUM - Video player keyboard navigation, connected fragments navigation | MEDIUM - Focus ring on video player, connected fragments | MEDIUM - Detail content loaded dynamically via URL params | MEDIUM - Public page, API calls for detail | Dropdown/modal keyboard behavior PR, screen-reader name/role/value spot check | Desktop browser smoke, mobile 375px smoke, keyboard-only navigation pass |
| pages/login.html | Google login button, email login button, signup form, email auth modal, shared header nav | MEDIUM - Google login button has icon + text, email auth modal (role="dialog" present) | MEDIUM - Email auth modal keyboard trap, form navigation, modal close | MEDIUM - Focus ring on modal, form inputs | HIGH - Login/signup validation feedback, auth state changes, redirect notice | HIGH - Auth-gated, Firebase auth, API calls | Login/signup validation feedback PR, dropdown/modal keyboard behavior PR | Desktop browser smoke, mobile 375px smoke, keyboard-only navigation pass, screen-reader name/role/value spot check |
| pages/my-trees.html | Sort select, create tree button, tree cards, create tree modal, shared header nav | MEDIUM - Sort select (native select), create tree button, create tree modal (role="dialog" present) | MEDIUM - Create tree modal keyboard trap, tree card navigation | MEDIUM - Focus ring on modal, tree cards | HIGH - Tree list loaded dynamically, loading/error/empty states, modal state changes | HIGH - Auth-gated, API calls for trees | My Trees empty/loading/error state announcement PR, dropdown/modal keyboard behavior PR | Desktop browser smoke, mobile 375px smoke, keyboard-only navigation pass, screen-reader name/role/value spot check |
| pages/editor.html | Sidebar buttons, canvas toolbar, add memory form, detail panel, rename modal, shared header nav | HIGH - Canvas toolbar buttons, add memory form, detail panel, rename modal, memory actions | HIGH - Canvas interaction, form navigation, modal keyboard trap, memory edit/delete actions | HIGH - Focus ring on canvas nodes, form inputs, modal | HIGH - Canvas state changes, memory form validation, save status announcements, detail panel mode switches | HIGH - Auth-gated, API calls for tree/memories, complex state management | Editor-specific accessibility PR, dropdown/modal keyboard behavior PR, form/control labeling PR | Desktop browser smoke, mobile 375px smoke, keyboard-only navigation pass, screen-reader name/role/value spot check |
| pages/settings.html | Settings close button, logout button, shared header nav | LOW - Settings close button has aria-label, logout button has visible text | LOW - Standard button navigation | LOW - Focus ring on buttons | LOW - Static content, logout action | HIGH - Auth-gated, Firebase auth | Settings page form/control labeling PR | Desktop browser smoke, mobile 375px smoke |

## Cross-page Findings

### Header/nav/shared controls
- **Risk**: Shared header menu button may lack accessible name (icon-only)
- **Current state**: Menu button uses `<span class="material-symbols-outlined">menu</span>` without visible text
- **Impact**: HIGH - Affects all pages
- **Follow-up scope**: Icon-only button accessible-name PR

### Icon-only buttons
- **Risk**: Multiple icon-only buttons across pages (menu, close, edit, delete, add, etc.)
- **Current state**: Some have aria-label, some may not
- **Impact**: HIGH - Affects navigation, modals, forms
- **Follow-up scope**: Icon-only button accessible-name PR

### Cards/list items
- **Risk**: Tree cards in search/my-trees use button structure but may lack proper accessible name
- **Current state**: Cards have title/description but button element may need aria-label
- **Impact**: MEDIUM - Affects search/browse, my-trees
- **Follow-up scope**: Search/Browse card accessibility PR

### Forms/validation
- **Risk**: Login/signup forms, create tree form, add memory form may lack proper validation feedback
- **Current state**: Email auth modal has error message with role="alert" and aria-live="polite"
- **Impact**: HIGH - Affects login, my-trees, editor
- **Follow-up scope**: Login/signup validation feedback PR, form/control labeling PR

### Modals/dropdowns
- **Risk**: Email auth modal, create tree modal, rename modal may have keyboard trap issues
- **Current state**: Modals have role="dialog" and aria-modal="true"
- **Impact**: HIGH - Affects login, my-trees, editor
- **Follow-up scope**: Dropdown/modal keyboard behavior PR

### Loading/error/empty states
- **Risk**: My-trees loading/error/empty states may not be announced to screen readers
- **Current state**: States use visible text but may lack aria-live regions
- **Impact**: MEDIUM - Affects my-trees
- **Follow-up scope**: My Trees empty/loading/error state announcement PR

### Language/i18n text states
- **Risk**: i18n text changes may not be announced to screen readers
- **Current state**: i18n applied via JS, no aria-live on language switch
- **Impact**: LOW - Affects all pages with i18n
- **Follow-up scope**: Separate i18n accessibility PR (lower priority)

### Mobile viewport focus behavior
- **Risk**: Focus may be lost on mobile viewport changes or modal close
- **Current state**: No explicit focus management on mobile
- **Impact**: MEDIUM - Affects all pages on mobile
- **Follow-up scope**: Part of each page-specific PR

## Follow-up Split Proposal

### 1. Icon-only button accessible-name PR
- **Scope**: Add aria-label to all icon-only buttons across all pages
- **Files**: index.html, pages/*.html, js/shared-header.js
- **Verification**: Desktop browser smoke, mobile 375px smoke, screen-reader name check
- **Risk**: LOW - No runtime/Auth/API changes

### 2. Login/signup validation feedback PR
- **Scope**: Ensure login/signup forms have proper validation feedback with aria-live regions
- **Files**: pages/login.html, js/login/*.js, js/auth/*.js
- **Verification**: Desktop browser smoke, mobile 375px smoke, keyboard-only navigation pass, screen-reader announcement check
- **Risk**: MEDIUM - Auth-gated, requires browser or Cloudflare/test-slot validation

### 3. Dropdown/modal keyboard behavior PR
- **Scope**: Ensure all modals/dropdowns have proper keyboard trap, focus management, and ARIA attributes
- **Files**: pages/login.html, pages/my-trees.html, pages/editor.html, js/auth/*.js, js/my-trees/*.js, js/editor/*.js
- **Verification**: Desktop browser smoke, mobile 375px smoke, keyboard-only navigation pass
- **Risk**: MEDIUM - Auth-gated, requires browser or Cloudflare/test-slot validation

### 4. Editor-specific accessibility PR
- **Scope**: Canvas keyboard navigation, memory form accessibility, detail panel announcements
- **Files**: pages/editor.html, js/editor/*.js
- **Verification**: Desktop browser smoke, mobile 375px smoke, keyboard-only navigation pass, screen-reader name/role/value spot check
- **Risk**: HIGH - Auth-gated, complex state, requires browser or Cloudflare/test-slot validation

### 5. Search/Browse card accessibility PR
- **Scope**: Tree card accessible name, keyboard navigation, filter chip accessibility
- **Files**: pages/search.html, js/search/*.js, css/search/*.css
- **Verification**: Desktop browser smoke, mobile 375px smoke, keyboard-only navigation pass
- **Risk**: MEDIUM - Public page, API calls, requires browser or Cloudflare/test-slot validation
- **Note**: Must not overlap with already merged Browse visual work (PR #476) unless explicitly scoped

### 6. My Trees empty/loading/error state announcement PR
- **Scope**: Add aria-live regions to loading/error/empty states in my-trees
- **Files**: pages/my-trees.html, js/my-trees/*.js
- **Verification**: Desktop browser smoke, mobile 375px smoke, screen-reader announcement check
- **Risk**: MEDIUM - Auth-gated, requires browser or Cloudflare/test-slot validation

### 7. Settings page form/control labeling PR
- **Scope**: Ensure settings page form controls have proper labels and descriptions
- **Files**: pages/settings.html, js/settings.js
- **Verification**: Desktop browser smoke, mobile 375px smoke, screen-reader label check
- **Risk**: LOW - Auth-gated, simple form

## Guardrails

- **Do not add ARIA mechanically**: Only add ARIA when native HTML semantics are insufficient
- **Do not combine accessibility fixes with visual redesign**: Keep accessibility PRs separate from visual changes
- **Do not change runtime/Auth/API/Search/My Trees/Editor behavior from audit alone**: Runtime-sensitive changes require browser or Cloudflare/test-slot validation
- **Runtime-sensitive changes require browser or Cloudflare/test-slot validation**: Auth-gated pages and API-dependent pages must be verified in browser or test slot
- **Search/Browse accessibility implementation must not overlap with already merged Browse visual work**: PR #476 (fallback tree preview) is already merged; do not re-open visual work unless explicitly scoped
- **PR #7/prototype/reference/demo/variant must remain untouched**: No changes to prototype or demo files
- **PR #450/YouTube PoC files must remain untouched**: No changes to YouTube PoC files

## Verification Matrix

### Static document review
- [ ] Document covers all active pages
- [ ] Page coverage matrix is complete
- [ ] Cross-page findings are identified
- [ ] Follow-up scopes are separated
- [ ] Guardrails are documented

### git diff --check
- [ ] No whitespace errors
- [ ] No trailing whitespace
- [ ] No tab/space mixing issues

### Docs-only changed files
- [ ] Only docs/accessibility/ACTIVE_PAGES_ACCESSIBILITY_COVERAGE.md added
- [ ] Optional: docs/doc_index.md or docs/engineering/engineering_index.md link addition (minimal)
- [ ] No HTML files changed
- [ ] No CSS files changed
- [ ] No JS files changed
- [ ] No runtime files changed
- [ ] No Auth/API/backend files changed
- [ ] No package/workflow files changed

### Future desktop browser smoke requirement
- [ ] Icon-only button accessible-name PR
- [ ] Login/signup validation feedback PR
- [ ] Dropdown/modal keyboard behavior PR
- [ ] Editor-specific accessibility PR
- [ ] Search/Browse card accessibility PR
- [ ] My Trees empty/loading/error state announcement PR
- [ ] Settings page form/control labeling PR

### Future mobile 375px smoke requirement
- [ ] Icon-only button accessible-name PR
- [ ] Login/signup validation feedback PR
- [ ] Dropdown/modal keyboard behavior PR
- [ ] Editor-specific accessibility PR
- [ ] Search/Browse card accessibility PR
- [ ] My Trees empty/loading/error state announcement PR
- [ ] Settings page form/control labeling PR

### Future keyboard-only navigation pass
- [ ] Login/signup validation feedback PR
- [ ] Dropdown/modal keyboard behavior PR
- [ ] Editor-specific accessibility PR
- [ ] Search/Browse card accessibility PR
- [ ] My Trees empty/loading/error state announcement PR

### Future screen-reader/name/role/value spot check
- [ ] Icon-only button accessible-name PR
- [ ] Login/signup validation feedback PR
- [ ] Editor-specific accessibility PR
- [ ] Search/Browse card accessibility PR
- [ ] My Trees empty/loading/error state announcement PR
- [ ] Settings page form/control labeling PR

### Future no-fatal-console-error check where JS behavior changes are made
- [ ] Icon-only button accessible-name PR (if JS changes)
- [ ] Login/signup validation feedback PR
- [ ] Dropdown/modal keyboard behavior PR
- [ ] Editor-specific accessibility PR
- [ ] Search/Browse card accessibility PR
- [ ] My Trees empty/loading/error state announcement PR
- [ ] Settings page form/control labeling PR (if JS changes)

## Related

Refs #414
