# PR-B2-07: Public Tree Adapter sanitizeUrl Policy Review

Base SHA: `7058c83a28e6d209e008d48ccb1c5bc5459ed15e`

Tracking issue: `#1203`

Target file:

- `js/api/public-tree-adapter.js`

Canonical source:

- `js/utils/security.js`
- `window.LoveBudSecurity.sanitizeUrl`

## Executive decision

Do not replace the public tree adapter local `sanitizeUrl` with canonical `LoveBudSecurity.sanitizeUrl` yet.

Recommendation: **KEEP local compatibility policy for now**.

Rationale:

1. The adapter local policy is materially different only for protocol-less or protocol-relative URLs.
2. Strict canonical migration may break legacy thumbnails or source URLs if stored data lacks an explicit protocol.
3. The current adapter policy still parses through `new URL()` and does not create a known DOM XSS bypass by itself.
4. Search/viewer rendering paths already add downstream URL sanitization in the DOM insertion layer, so this adapter remains a normalization/compatibility layer rather than the final sink guard.
5. Any strict migration should be staged after production data audit confirms there are no protocol-less stored values.

## Current local implementation

Current adapter implementation:

```js
function sanitizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.toString();
  } catch (e) {
    return '';
  }
}
```

Observed behavior:

- `null`, `undefined`, empty/falsy input -> `''`
- Values starting with `http` are passed into `new URL(...)`
- Values not starting with `http` are treated as host/path-like values and normalized by prepending `https://`
- Parse failure -> `''`

## Canonical policy

Canonical `window.LoveBudSecurity.sanitizeUrl` policy:

- trims input
- requires explicit `http://` or `https://`
- parses with `new URL(raw)`
- checks parsed protocol is exactly `http:` or `https:`
- rejects non-absolute, malformed, `javascript:`, `data:`, `blob:`, `vbscript:`, protocol-relative, and relative URLs

## Policy difference matrix

| Input type | Adapter local policy | Canonical policy | Compatibility impact |
| --- | --- | --- | --- |
| `https://example.com/a.jpg` | accept | accept | none |
| `http://example.com/a.jpg` | accept | accept | none |
| `example.com/a.jpg` | prepend `https://` and accept if valid | reject | strict migration can remove legacy media |
| `//cdn.example.com/a.jpg` | can normalize into an HTTPS URL shape | reject | strict migration can remove legacy media |
| `/relative/a.jpg` | likely parse failure after prepend | reject | low |
| `javascript:alert(1)` | parse failure after prepend | reject | no known bypass |
| `data:text/html,...` | parse failure after prepend | reject | no known bypass |
| malformed URL | reject | reject | none |

## Internal adapter usage

`sanitizeUrl` is currently used only through public-tree-adapter URL canonicalization helpers:

- `canonicalizeYouTubeSourceUrl(url)`
- `canonicalizeYouTubeThumbnailUrl(url, fallbackSourceUrl)`

Concrete call sites:

1. source URL fallback sanitization in `canonicalizeYouTubeSourceUrl`
2. thumbnail URL sanitization in `canonicalizeYouTubeThumbnailUrl`
3. fallback source URL sanitization in `canonicalizeYouTubeThumbnailUrl`
4. safe thumbnail return after `isYouTubeHost` check

The adapter normalizes these public data fields:

- `representativeThumbnail`
- `representative_thumbnail`
- `thumbnail`
- `representativeMemorySourceUrl`
- `representative_memory_source_url`
- `sourceUrl`
- `source_url`
- memory `thumbnail`
- memory `sourceUrl` / `source_url`

## Runtime/data compatibility analysis

### Modern data

Current editor and YouTube utility behavior is expected to produce full HTTPS YouTube URLs, such as:

- `https://www.youtube.com/embed/<videoId>`
- `https://i.ytimg.com/vi/<videoId>/hqdefault.jpg`

For this modern data path, local and canonical policies should behave the same.

### Legacy data

Legacy/prototype/migration-era data may not be guaranteed to have explicit protocol prefixes because:

- `public-tree-adapter.js` exists specifically as a transitional compatibility layer.
- It handles `{ data }` wrappers and snake_case fields.
- Backend/API payload validation historically did not guarantee full URL normalization at every boundary.
- Public browse snapshot fields can pass through raw thumbnail/source candidates.

Therefore, protocol-less values such as `example.com/image.jpg` or CDN-like thumbnail paths cannot be ruled out without a production DB sample audit.

### Strict migration break risk

If the adapter immediately switches to canonical `LoveBudSecurity.sanitizeUrl`, any protocol-less stored URL currently salvaged by the adapter would become `''`.

Expected UI impacts:

- Browse card representative thumbnails may disappear.
- Search preview media fallback may degrade.
- Public tree preview may show no-media fallback where legacy media previously rendered.
- CI can remain green while production/browser media rendering regresses.

## Security analysis

The current local policy is not ideal as a canonical project-wide URL policy, but it is acceptable as a compatibility adapter for this data boundary.

Security considerations:

- All accepted values are passed through `new URL(...)`.
- Non-http schemes such as `javascript:` and `data:` do not survive this implementation as executable schemes because non-`http` inputs are prepended with `https://` and malformed candidates fall into `catch`.
- Explicit `http://` and `https://` values are accepted by both local and canonical policies.
- The primary difference is not scheme-bypass; it is protocol-less value recovery.
- Downstream DOM insertion paths should still apply canonical sink sanitization before `img src` or `iframe src` insertion.

Residual risk:

- Protocol-relative or host-like attacker-controlled external URLs may still resolve to external HTTPS resources.
- This is a media-origin/content-policy concern, not a direct DOM XSS finding from the adapter alone.
- CSP and stricter media allowlisting belong in later PR-D/CSP readiness work, not in this compatibility migration.

## Recommended strategy

### Current PR-B2-07 recommendation

**KEEP local policy.**

No immediate runtime code change is recommended in `js/api/public-tree-adapter.js`.

### Do not do now

Do not blindly replace this:

```js
const u = new URL(url.startsWith('http') ? url : `https://${url}`);
```

with this:

```js
window.LoveBudSecurity.sanitizeUrl(url)
```

because canonical policy rejects protocol-less values and may break existing public media.

### Staged migration path

| Phase | Action | Required condition |
| --- | --- | --- |
| 0 | Keep adapter local compatibility sanitizer | current state |
| 1 | Production DB audit for protocol-less `thumbnail` / `source_url` values | DB read access required |
| 2 | Add backend/API response normalization if needed | backend changes allowed in separate PR |
| 3 | Add compatibility tests with protocol-less fixtures | before any behavior change |
| 4 | Consider canonical-first wrapper with explicit compatibility fallback | only after audit |
| 5 | Strict canonical-only migration | only after protocol-less count is verified as zero or migrated |

## If a future modification PR is opened

Minimum test coverage before migration:

- adapter accepts modern full HTTPS YouTube source and thumbnail URLs
- adapter rejects `javascript:` and `data:` candidates
- adapter behavior for protocol-less URL is explicitly documented in tests
- legacy protocol-less fixture either remains supported or is deliberately migrated
- Browse card thumbnail smoke with a legacy protocol-less fixture
- Public preview media fallback smoke

Runtime smoke required:

- Search/Browse page loads
- representative thumbnails still render for modern data
- representative thumbnails still render or gracefully fall back for legacy protocol-less fixture
- public tree preview opens
- no fatal console errors
- no raw token/session/cookie/private payload/log exposure
- deployed SHA matches PR head SHA

## Local/browser executor handoff

The following items cannot be completed through static GitHub inspection alone:

1. Production DB sample audit
   - Check whether `memories.thumbnail`, `memories.source_url`, tree representative thumbnail fields, or public snapshot payloads contain protocol-less URLs.
   - Do not print raw private/user payloads. Return only aggregate counts and sanitized examples such as value shape categories.

2. Browser/runtime smoke
   - Verify Browse/Search card thumbnails.
   - Verify public tree preview media behavior.
   - Verify console has no fatal runtime errors.
   - Verify no sensitive payloads appear in logs.

## Final CTO judgment

Current policy should remain unchanged until production data compatibility is known.

- Security risk: **low / no confirmed bypass**
- Compatibility risk from strict migration: **medium to high**
- Urgency: **low**
- Recommended next action: **docs-only audit PR now; staged migration only after data audit**

Refs #1203
