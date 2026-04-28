# Page Transition Reveal Coverage Map

## Purpose

Document the current coverage and classification of page transition and reveal effects for active non-editor pages in LoveBud/LoveTree. This serves as the foundation for implementing consistent page enter transitions and upward text reveals across the application.

## Current Coverage Map

| Page | Current Transition/Reveal | Status | Notes |
|------|---------------------------|--------|-------|
| `index.html` | `.reveal` based scroll reveal | ✅ Implemented | Scroll-triggered text reveals on home page |
| `pages/intro.html` | Tree grow animation only | ❌ No shared transition | Has tree-specific animation, lacks page enter transition |
| `pages/login.html` | No shared page enter transition | ❌ Missing | Direct content visibility |
| `pages/search.html` | No shared page enter transition | ❌ Missing | Direct content visibility |
| `pages/detail.html` | No shared page enter transition | ❌ Missing | Direct content visibility |
| `pages/my-trees.html` | No shared page enter transition | ❌ Missing | Direct content visibility |

## Page Type Classification

### Public Static-ish Pages
- `index.html` - Landing page with existing scroll reveals
- `pages/intro.html` - Onboarding page with tree animation

### Public Data-loading Pages
- `pages/search.html` - Browse/search with API data loading
- `pages/detail.html` - Detail view with runtime content

### Protected/Auth-pending Pages
- `pages/login.html` - Authentication entry point
- `pages/my-trees.html` - User dashboard requiring auth

### Detail/Runtime Placeholder Pages
- `pages/detail.html` - Content replaced at runtime via API

## Risk Notes

### Search Skeleton Visibility
- **Risk**: Delayed skeleton visibility could hurt perceived performance
- **Requirement**: Skeleton must remain immediately visible
- **Implementation**: Page transition should not interfere with skeleton display

### Detail Placeholder Runtime Replacement
- **Risk**: Page transition could conflict with runtime content replacement
- **Requirement**: Smooth handoff from placeholder to actual content
- **Implementation**: Transition should complete before or coordinate with API content loading

### My Trees Auth-pending Visibility
- **Risk**: Auth state changes could cause flicker during transition
- **Requirement**: Stable visibility during auth state resolution
- **Implementation**: Transition should account for auth-pending state

### Login Redirect Notice/Auth Modal Flow
- **Risk**: Transition could interfere with redirect notices or auth modals
- **Requirement**: Auth flows must remain functional
- **Implementation**: Avoid overlay that blocks auth interactions

### Reduced Motion Support
- **Requirement**: Must respect `prefers-reduced-motion`
- **Implementation**: Provide reduced-motion alternatives for all transitions

### Click-blocking Prevention
- **Risk**: Transition overlay could block user interactions
- **Requirement**: No click-blocking overlays
- **Implementation**: Transitions should not interfere with button clicks or form interactions

## Proposed PR Sequence

### PR 1: Docs-only Coverage Map (Current)
- Add this coverage documentation
- Classify pages by transition risk
- Establish implementation guidelines

### PR 2: Shared Transition Assets-only
- Create reusable transition CSS/JS assets
- Implement reduced-motion support
- Add utility classes for page transitions
- No page-specific implementations

### PR 3: Home/Intro/Browse Opt-in
- Apply transitions to `index.html` (enhance existing)
- Add transitions to `pages/intro.html`
- Add transitions to `pages/search.html`
- Focus on public pages with lower risk

### PR 4: Login/Detail/MyTrees Opt-in
- Apply transitions to `pages/login.html`
- Apply transitions to `pages/detail.html`
- Apply transitions to `pages/my-trees.html`
- Implement after smoke validation of PR 3

## Non-goals

- **No Editor changes**: Editor pages are out of scope
- **No Auth runtime changes**: Authentication logic remains unchanged
- **No Search runtime changes**: Search functionality remains unchanged
- **No API/backend changes**: No server-side modifications
- **No prototype/reference/demo/variant changes**: Focus on production pages only

## Acceptance Criteria for Future Implementation

### Reduced Motion Support
- All transitions must respect `prefers-reduced-motion: reduce`
- Provide meaningful alternatives for reduced motion users
- Test with browser reduced motion settings

### No Click-blocking Overlay
- Transition elements must not block user interactions
- Buttons, forms, and links remain clickable during transitions
- No full-page overlays that prevent interaction

### No Skeleton Delay
- Page skeletons must remain immediately visible
- Transitions should not delay skeleton appearance
- Maintain perceived performance for data-loading pages

### No Auth-pending Flicker Regression
- Auth state changes must not cause visual flicker
- Smooth transitions during auth resolution
- Stable visibility for auth-pending states

### Page-specific Smoke Checklist
- **Search**: Skeleton visibility, API loading coordination
- **Detail**: Placeholder-to-content handoff, runtime replacement
- **My Trees**: Auth state handling, pending state stability
- **Login**: Redirect notice compatibility, modal flow preservation
- **Intro**: Tree animation coordination, page enter timing
- **Home**: Enhanced scroll reveal coordination

## Implementation Guidelines

### CSS Architecture
- Use CSS custom properties for consistent timing
- Implement transition utilities as reusable classes
- Ensure mobile-first responsive behavior

### JavaScript Coordination
- Coordinate with existing page load events
- Handle race conditions with API content loading
- Provide hooks for page-specific transition timing

### Testing Strategy
- Test with reduced motion preferences
- Verify click interactions during transitions
- Test auth state flows
- Validate skeleton and placeholder behavior
- Mobile viewport testing

### Performance Considerations
- Use CSS transforms for better performance
- Avoid layout thrashing during transitions
- Consider GPU acceleration where appropriate
- Monitor transition impact on page load metrics

## Related Issues

- Refs #242: Audit and document page transition reveal coverage
- Refs #239: Page transition reveal implementation planning
