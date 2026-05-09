# Primary RGBA Token Usage Audit

Issue: #224 checklist item 2
Branch: `audit/primary-rgba-token-usage`
Baseline: `main` at `ce9898a067bf63eed9b282158bcd5d1ea141ffa8`

## Scope

This pass maps hard-coded primary RGB usages only. It does not change runtime CSS, does not introduce new color tokens, and does not perform broad search/replace.

Primary literal searched:

- `rgba(144, 73, 81, X)`
- compact equivalent: `rgba(144,73,81,X)`
- same primary RGB channels: `144, 73, 81` / `144,73,81`

Primary source token today:

- `--primary: #904951`
- `--primary-vibrant: #b85c66`
- `--primary-soft: #d4a5a9`
- `--outline-variant: rgba(144, 73, 81, 0.12)`
- `--eyebrow-line-color: rgba(144, 73, 81, 0.42)`

There is not yet a global `--primary-rgb` token on `main`, so this audit intentionally avoids proposing a broad replacement.

## Checked files

Primary target:

- `css/global.css`

Active production CSS surfaced by the primary RGB search and included in this pass:

- `css/global.css`
- `css/global/header.css`
- `css/global/tokens.css`
- `css/index.css`
- `css/index-visual.css`
- `css/login.css`
- `css/detail.css`
- `css/settings.css`
- `css/intro/hero.css`
- `css/intro/value.css`
- `css/intro/how-to.css`
- `css/editor/sidebar.css`
- `css/editor/overrides.css`
- `css/editor/canvas.css`
- `css/editor/memory-form.css`
- `css/editor/detail-panel.css`
- `css/search/tree-card.css`
- `css/search/hero-controls.css`
- `css/search/growing-trees.css`
- `css/search/preview-sidebar.css`
- `css/search/results-skeleton.css`
- `css/my-trees/header.css`

Out-of-scope hits also surfaced:

- `quiet/home.html`
- `quiet/home-desktop.html`
- JavaScript-rendered style strings under `js/`
- archived conversation docs under `docs/conversation/`

Those are not modified by this pass.

## Usage count

File-level usage sites found in active production CSS: **22 files**.

Confirmed high-density files:

- `css/global.css`: 25 literal primary RGBA occurrences confirmed in shared controls, badges, chips, focus rings, save status, and shadows.
- `css/global/header.css`: 25 literal primary RGBA occurrences confirmed in nav, language menu, profile dropdown, mobile toggle, avatar, and dropdown polish.
- `css/global/tokens.css`: 2 token-definition occurrences confirmed and treated as already tokenized source definitions.

The remaining active CSS files are mapped below at selector/area level. No occurrence-level replacement was attempted in this audit PR.

## Classification key

1. **Safe candidate**: likely replaceable by an existing semantic CSS variable or by a future `--primary-rgb` token with low visual risk.
2. **Hold**: visual regression risk; defer until a page-specific PR with browser smoke or screenshot comparison.
3. **Excluded**: outside active production CSS scope, prototype/reference/demo/variant-like review surface, archived docs, or JS-rendered style strings.
4. **Already tokenized / no selector action**: current value is already a token definition or selector already consumes an existing token.

## Usage map

| File | Primary RGB usage pattern | Classification | Notes / next action |
| --- | --- | --- | --- |
| `css/global/tokens.css` | `--outline-variant`, `--eyebrow-line-color` definitions | 4 | Already central token definitions. If a future Phase 1 adds `--primary-rgb`, these definitions can be rewritten there, not selector-by-selector. |
| `css/global.css` | Shared `.btn-*`, `.cta-appreciation`, `.card-appreciation`, `.save-status-indicator`, `--control-*`, `.tag-chip`, badges, `.emotion-tag-refined` | 1 / 2 / 4 | Selector-level control variables already exist for part of the file. Shadows, hover elevation, badges, and focus rings should not be mass-replaced without visual smoke. |
| `css/global/header.css` | `.nav-links`, `.lang-menu-trigger`, `.user-dropdown-*`, `.user-avatar-*`, `.mobile-nav-toggle`, profile dropdown polish | 2 | Header/profile polish is highly visible and alpha-sensitive. Defer to a dedicated header-token PR and smoke header states on desktop/mobile. |
| `css/index.css` | Home eyebrow line, note border, outline CTA border/shadow/glow, feature cards, preview cards, intro entry underline | 1 / 2 | `0.42` eyebrow line can likely use `--eyebrow-line-color`. CTA glow/shadow and preview card borders should be held for visual smoke. |
| `css/index-visual.css` | Home visual scene and decorative rose tints | 2 | Decorative visual layer. Hold until Home visual regression pass. |
| `css/login.css` | Input focus ring, redirect notice, signup badge, form error notice | 1 / 2 | Low-tint notices may be safe candidates. Focus ring and error states require interaction smoke. |
| `css/detail.css` | Detail chips, hero/meta borders, diary container border, growth dot halo | 1 / 2 | Static borders are candidates; growth halo and diary tone should be smoke-tested. |
| `css/settings.css` | Close button border, intro card border, intro icon background | 1 / 2 | Simple borders are candidates; card/icon emphasis should be checked on mobile. |
| `css/intro/hero.css` | Eyebrow line, hero visual border, tree scene, stem shadow, moment chip, CTA gradients/shadows/focus | 1 / 2 | Eyebrow line is a safe candidate. CTA gradients/shadows and animated tree scene should be held. |
| `css/intro/value.css` | Value cards, mini chips, mini play, line/node/bubble/photo decorations | 2 | Dense decorative miniature UI; hold for page-specific visual PR. |
| `css/intro/how-to.css` | Intro badges, cards, hover shadows, animated mini-scenes, memo/tree nodes | 2 | Animation and card polish are alpha-sensitive. Hold for visual comparison. |
| `css/editor/canvas.css` | Canvas dotted background, empty guide border, empty guide eyebrow | 2 | Canvas grid and empty-state card affect editor workspace tone; defer to editor visual smoke. |
| `css/editor/overrides.css` | Status cards, visibility pills, buttons, canvas/paper tone, node cards, memory mode chips, form notes | 2 | High-density editor polish. Do not mass-replace; split by editor surface. |
| `css/editor/sidebar.css` | Sidebar controls and editor support surfaces | 2 | Editor control tone should be handled with editor-specific smoke. |
| `css/editor/memory-form.css` | Memory form chips, hints, borders, active states | 2 | Form state colors need interaction smoke. |
| `css/editor/detail-panel.css` | Detail panel cards, states, borders, note accents | 2 | Detail panel is stateful; hold until targeted editor PR. |
| `css/search/tree-card.css` | Search result cards, tags, preview controls, card accents | 2 | Search result card visual hierarchy is sensitive. Hold for search visual smoke. |
| `css/search/hero-controls.css` | Search hero controls, filter affordances, focus/hover states | 2 | Controls require keyboard and hover smoke. |
| `css/search/growing-trees.css` | Growing trees cards and badges | 2 | Browse visual cards; hold for Browse smoke. |
| `css/search/preview-sidebar.css` | Preview sidebar card/chip/background accents | 2 | Preview/sidebar layout and tonal hierarchy should be tested together. |
| `css/search/results-skeleton.css` | Skeleton/loading tint accents | 1 / 2 | Could be tokenized, but should confirm loading contrast and shimmer feel. |
| `css/my-trees/header.css` | My Trees header controls and badges | 2 | My Trees creation/settings policy UI is user-facing; hold for targeted page smoke. |
| `quiet/home.html`, `quiet/home-desktop.html` | Quiet/static alternate HTML surfaces | 3 | Outside active CSS target for this pass. No edits. |
| `js/*` style strings | Runtime-rendered inline style strings | 3 | Outside CSS-only audit. Should be handled only in a JS/CSS responsibility cleanup issue. |
| `docs/conversation/*` | Archived conversation text containing historical snippets | 3 | Documentation archive only. No edits. |

## Recommended follow-up plan

### Phase 1: token-only groundwork

Add a narrowly scoped token such as `--primary-rgb: 144, 73, 81` only after design approval. This should be a token-only PR and should not update selectors in the same PR.

### Phase 2: low-risk shared selectors

After Phase 1, replace only clearly equivalent shared selectors and token definitions first:

- `--outline-variant`
- `--eyebrow-line-color`
- low-risk chip/badge borders where the current alpha already matches a semantic token

### Phase 3: page-specific visual PRs

Handle these as separate visual PRs:

- Header/profile dropdown
- Home/Intro visual polish
- Search/Browse cards and preview sidebar
- Editor canvas/sidebar/detail panel
- Login/settings interaction states

Each page PR should include browser smoke or screenshots for the affected states.

## Test notes

Docs-only audit PR. No CSS, JS, HTML, API, auth, Cloudflare, Modal, Firebase, or database code changed.

Tests skipped because this PR creates documentation only.

## Non-changes confirmed

- No CSS replacements were made.
- No new color token was introduced.
- No UI redesign was performed.
- `main` was not modified directly.
- PR #7 was not modified.
- prototype/reference/demo/variant areas were not modified.
