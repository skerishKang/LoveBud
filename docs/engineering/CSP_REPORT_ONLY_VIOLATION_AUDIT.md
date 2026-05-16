# PR-D-04 Prep: CSP Report-Only Violation Category Audit

Base SHA: `fdb4ecb0fc4273a3017e23d2f04c49aa33847b31`

Tracking issue: `#1203`

Related PRs:

- PR #1233: CSP Report-Only `_headers` candidate — currently draft/hold
- PR #1235: Search `getSharedUtils()` runtime hotfix — currently draft/hold pending browser smoke

## Executive decision

Do not move from report-only CSP to enforcing CSP yet.

The first PR-D-03 browser/Cloudflare validation surfaced two different classes of findings:

1. **Expected CSP report-only violations** that identify future hardening work.
2. **One fatal Search runtime error** that is not caused by CSP enforcement and must be fixed before PR-D-03 can be merged.

This document classifies those findings so the next implementation work can be split safely.

## Findings classification

| Finding category | Current interpretation | Blocking PR-D-03? | Next action |
| --- | --- | --- | --- |
| `Content-Security-Policy-Report-Only` header present | Expected target of PR #1233 | No, if confirmed on preview | Keep report-only only |
| Enforcing `Content-Security-Policy` header absent | Required for PR #1233 | No, if confirmed absent | Do not add enforcing CSP yet |
| Inline script reports | Expected because active pages still use some inline bootstraps/templates | No by itself | Inventory and extract one active route at a time |
| Inline event handler reports | Expected where HTML strings contain `onload`/`onerror` or legacy inline handlers | No by itself | Migrate active production handlers to `addEventListener` or delegated handlers |
| Inline style reports | Expected because active components rely on inline styles and JS style mutation | No by itself | Keep `style-src 'unsafe-inline'` during report-only phase |
| External Google Fonts/Firebase/YouTube/media origins | Expected dependency class | No, if not blocked | Keep in allowlist until runtime inventory is complete |
| `/pages/search` `ReferenceError: getSharedUtils is not defined` | Fatal runtime bug surfaced during smoke; not caused by `_headers` | Yes | Fix separately before PR #1233 merge |

## Current blocker

The current blocker is not a CSP policy violation. It is a fatal Search runtime error:

```text
ReferenceError: getSharedUtils is not defined
```

Static review found that `js/search/search-preview-renderer-builders.js` calls and exports `getSharedUtils`, but the function was missing from the file. A separate PR should fix that runtime error before PR #1233 is re-tested.

## Expected report-only violation categories

### 1. Inline event handlers in active Search preview media

Known active candidate:

- `js/search/search-preview-media-helper.js`

Risk pattern:

```html
<img ... onerror="..." onload="...">
```

This does not automatically prove active XSS because the handlers are static strings produced by project code, but CSP enforcement would block inline event handlers. This should become a later runtime PR after the Search fatal error is fixed.

Recommended future split:

- PR-D-04: migrate Search preview image `onerror` / `onload` inline handlers to delegated JS listeners or post-render binding.
- Required smoke: `/pages/search`, card preview, image fallback, YouTube thumbnail fallback, no fatal console errors.

### 2. Inline styles and style mutation

The current report-only candidate intentionally keeps:

```text
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
```

Reason:

- many active UI templates use inline `style="..."`
- Home hero thumbnail logic sets CSS custom properties at runtime
- Search preview templates contain inline style strings

Do not remove `'unsafe-inline'` from `style-src` until inline styles are inventoried and reduced route by route.

### 3. Inline scripts

PR-D-02 extracted active Home inline scripts from `index.html`, but other active pages may still include inline bootstraps, templates, or module initialization code.

Future work should not broadly rewrite all pages at once. Each extraction needs:

- one active route target
- one external JS file or existing module target
- CI
- browser/runtime smoke
- no protected reference/prototype/variant edits

### 4. External origins

Initial report-only CSP keeps broad allowances where needed:

- `script-src`: `https://www.gstatic.com` for Firebase SDK scripts
- `style-src`: `https://fonts.googleapis.com`
- `font-src`: `https://fonts.gstatic.com data:`
- `frame-src`: YouTube / YouTube no-cookie
- `img-src` / `media-src` / `connect-src`: broad `https:` during inventory phase

Do not tighten these until runtime Network panel evidence is collected on Cloudflare preview.

## Recommended next sequence

1. Keep PR #1233 draft/hold.
2. Merge Search hotfix PR after `/pages/search` smoke passes.
3. Re-run PR #1233 Cloudflare preview validation.
4. If PR #1233 passes, merge report-only CSP.
5. Open a focused Search preview inline event handler migration PR.
6. Re-run Search/Browse/browser smoke.
7. Only after several report-only passes, consider moving from report-only to enforcing CSP.

## Future implementation candidates

| Candidate | Priority | Suggested PR type | Browser smoke required |
| --- | --- | --- | --- |
| Search preview image `onload` / `onerror` inline handlers | High | runtime JS | Yes |
| Remaining active inline page bootstraps | Medium | runtime JS/HTML | Yes |
| Inline style inventory | Medium | docs/audit first | No for audit, yes for runtime |
| Narrow `img-src` and `connect-src` origins | Later | CSP config | Yes |
| Enforcing CSP | Last | CSP config | Yes, full smoke |

## Do not do now

- Do not enforce CSP.
- Do not remove `style-src 'unsafe-inline'`.
- Do not remove broad `img-src https:` / `connect-src https:` before runtime origin inventory.
- Do not edit protected reference/prototype/demo/variant paths.
- Do not mix CSP config changes with Search runtime fixes.
- Do not merge PR #1233 until Search runtime is clean.

## Required report-only smoke after Search hotfix

When PR #1233 is re-tested, report:

- preview URL
- tested SHA
- report-only CSP header present
- enforcing CSP header absent
- Home page load
- Login page load without actual sign-in
- Search/Browse page load
- public tree/detail preview
- fatal console errors
- report-only violation categories only, no private payloads
- sensitive log exposure: none

## CTO judgment

The report-only CSP approach is still valid, but it is now blocked by a separate Search runtime defect that must be resolved first. The report-only violations are useful inventory signals, not reasons to abandon PR-D. They should be converted into small, route-specific hardening PRs.

Refs #1203
