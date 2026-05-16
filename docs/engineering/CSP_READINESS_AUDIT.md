# PR-D-01: CSP Readiness Audit

Base SHA: `8c8c7bc16d0de1f83100134420523dd507f13054`

Tracking issue: `#1203`

Previous security sequence:

- PR-A: targeted sink hardening
- PR-B1/B2: sanitizer consolidation and iframe/source URL hardening
- PR-C-01: active Settings logout inline `onclick` migrated
- PR-C-02: remaining inline `onclick` results classified as protected reference/variant or historical docs

## Executive decision

Do not add a strict production Content Security Policy header yet.

Recommendation: **perform CSP readiness work in staged steps** before enforcing production CSP.

Reason:

1. The repository currently has no obvious Cloudflare Pages `_headers` file or `wrangler.toml` CSP configuration.
2. Active production pages still include inline `<script>` blocks, especially `index.html`.
3. Active pages load third-party resources such as Google Fonts and Firebase SDK scripts.
4. A strict CSP without preparation can break Home, Auth, i18n, Search/Browse, and Firebase flows even when CI is green.
5. Browser/runtime verification is required before any enforcing header is merged.

## Current header/config finding

Static GitHub inspection did not find an active CSP header configuration in the expected locations:

- `_headers`: not present
- `public/_headers`: not present
- `wrangler.toml`: not present
- repository search for `Content-Security-Policy` / `CSP` / `script-src` / `style-src`: no active runtime CSP configuration found

This means the first CSP work should document readiness constraints and prepare an enforcement path, not immediately enforce a policy.

## Active blockers to strict CSP

### 1. Inline scripts remain in active production page(s)

`index.html` contains multiple inline `<script>` blocks after external script loading. These include:

- dynamic hero tree thumbnail fetch and style update logic
- hero video UI activation/deactivation logic
- `window.LovetreePageShell.initSharedPage(...)`

A CSP such as `script-src 'self'` would block these inline scripts unless moved into external JS files, protected with nonces/hashes, or kept under `'unsafe-inline'` temporarily.

### 2. Inline dynamic style mutation remains part of current UI behavior

The Home hero thumbnail script dynamically sets CSS custom properties, for example `--moment-image`, based on fetched public tree thumbnails. This is a runtime behavior concern and must be smoke-tested if CSP or style restrictions are introduced.

### 3. Third-party script/style origins are required

Active pages load external resources, including:

- Google Fonts stylesheet: `https://fonts.googleapis.com/...`
- Google Fonts font files: `https://fonts.gstatic.com/...`
- Firebase SDK scripts: `https://www.gstatic.com/firebasejs/...`

Any production CSP must explicitly allow the required origins, or the site will break.

### 4. API and media origins need runtime confirmation

Current frontend behavior can use:

- same-origin `/api/*`
- YouTube embeds / thumbnails
- image/media URLs from public tree data after sanitizer normalization
- Firebase/Auth network calls

A CSP should not be enforced until runtime network dependencies are observed and categorized.

## Recommended staged plan

| Phase | Action | Merge type | Browser smoke required |
| --- | --- | --- | --- |
| D-01 | CSP readiness audit | docs-only | no |
| D-02 | Extract active inline Home scripts into external JS file(s) | runtime JS/HTML | yes |
| D-03 | Add CSP report-only candidate in deployment/header config | runtime/deploy config | yes |
| D-04 | Tune allowlist from report-only/browser findings | config | yes |
| D-05 | Enforce CSP only after report-only shows no blocking violations | config | yes |

## Proposed initial report-only CSP shape

This is **not ready for enforcement** and should not be merged as production blocking policy without runtime validation.

```text
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' https://www.gstatic.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' data: https:;
  media-src 'self' https:;
  frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;
  connect-src 'self' https:;
  base-uri 'self';
  object-src 'none';
  frame-ancestors 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

Notes:

- `style-src 'unsafe-inline'` may be temporarily required because the site uses inline style attributes and JS style mutation in multiple active components.
- `img-src https:` is broad but likely required until public media origins are inventoried.
- `connect-src https:` is broad but safer for initial report-only observation because Firebase/Auth/API dependencies need runtime confirmation.
- No report endpoint is defined here because the project does not yet have a CSP reporting endpoint documented.

## Do not do now

Do not immediately add an enforcing CSP such as:

```text
script-src 'self'; style-src 'self'; object-src 'none'
```

This would likely break active production pages because of inline scripts, Google Fonts, Firebase scripts, and external media/embed dependencies.

## Required runtime smoke for future CSP PRs

Before merging any CSP-affecting runtime/config PR:

- deployed SHA matches PR head SHA
- Home page loads
- shared header renders
- Login page loads
- Firebase Auth initialization does not fail
- Search/Browse page loads
- Browse cards render
- Public tree/detail preview opens
- YouTube thumbnail/embed fallback still works
- Settings page loads
- no fatal console errors
- no CSP blocking errors for required runtime resources
- no raw token/session/cookie/private payload/log exposure

## Local/browser executor handoff

Future PR-D runtime/config work requires browser/deployment verification that cannot be completed by static GitHub inspection alone:

1. Observe Network panel on production or Cloudflare preview.
2. List required script/style/font/connect/img/frame origins without printing private payloads.
3. Confirm whether Cloudflare Pages supports `_headers` in this repository layout.
4. Verify whether a preview deployment exposes the candidate header.
5. Report only aggregate origin categories and CSP violation types.

## CTO judgment

PR-D should start with this audit and then move to small, verifiable runtime extractions. The safest next implementation PR is likely extracting the active Home inline scripts from `index.html` into a dedicated external JS file, while preserving behavior.

Security risk from no CSP: **medium hardening gap**

Compatibility risk from immediate strict CSP: **high**

Recommended next implementation: **extract active Home inline scripts before CSP enforcement**

Refs #1203
