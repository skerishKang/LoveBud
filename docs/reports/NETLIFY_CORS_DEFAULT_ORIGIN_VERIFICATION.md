# Netlify CORS Default Origin Verification

> **Status:** VERIFIED_CURRENT_MAIN
> **Source:** Issue #224 CORS default allowed origins item
> **Type:** Docs-only verification report. No Netlify code, Cloudflare route, Modal, Auth, API, config, or runtime behavior changes.

---

## 1. Verification target

This report verifies whether the previously reported Netlify CORS default origin finding still applies on current `main`.

Targets checked:

| Target | Purpose |
|---|---|
| `netlify/functions/_lib/http.js` | Reported legacy Netlify helper file to verify. |
| `DEFAULT_ALLOWED_ORIGINS` | Reported default allowlist symbol to verify. |
| `CORS_ALLOWED_ORIGINS` | Environment variable / symbol usage to locate any moved CORS configuration. |
| `https://lovebud.pages.dev` | Current official user-facing origin that should be present where active CORS allowlists apply. |

Verification base:

```text
main SHA: 3df2b2a92521b50eb00c8073f1a781cfb4d211d2
```

---

## 2. Current main result

### 2.1 `netlify/functions/_lib/http.js`

Result: **does not exist on current main**.

The target path was checked directly and returned not found.

Interpretation:

- The specific reported Netlify helper file is not present in current main.
- A code fix to that file cannot be applied because the file is absent.
- The reported finding is stale for that exact path.

### 2.2 `DEFAULT_ALLOWED_ORIGINS`

Result: **not found on current main**.

Repository search for `DEFAULT_ALLOWED_ORIGINS` returned no current result.

Interpretation:

- The reported default allowlist symbol is not present in current main.
- The original finding is not currently actionable as a Netlify symbol-level code fix.

### 2.3 `CORS_ALLOWED_ORIGINS`

Result: **exists outside Netlify runtime code**.

Current main contains `CORS_ALLOWED_ORIGINS` in `modal_compute/config.py`, where the default value includes:

```text
https://lovebud.vercel.app,https://lovebud.pages.dev,https://lovebud.netlify.app
```

Interpretation:

- The active CORS configuration finding appears moved to Modal configuration, not Netlify helper code.
- The official Cloudflare Pages origin `https://lovebud.pages.dev` is included in the Modal default origin list.
- This report does not change or validate runtime CORS behavior; it only records current source-state verification.

### 2.4 `https://lovebud.pages.dev` under `netlify/**`

Result: **Netlify documentation references current active production path, not active Netlify runtime ownership**.

`netlify/functions/README.md` states that Netlify Functions are legacy / fallback / artifact only and not the current official production backend for `lovebud.pages.dev`. It also states that active route work belongs in Cloudflare Pages Functions and Modal compute.

Interpretation:

- Netlify is not the active production runtime path.
- The current active production path is Cloudflare Pages plus Modal.
- A Netlify CORS implementation PR would not affect the active runtime unless Netlify were separately reactivated, which is out of scope.

---

## 3. Applicability decision

| Question | Decision |
|---|---|
| Does `netlify/functions/_lib/http.js` exist? | No. |
| Does `DEFAULT_ALLOWED_ORIGINS` exist? | No. |
| Does `CORS_ALLOWED_ORIGINS` exist? | Yes, in Modal configuration, not Netlify helper code. |
| Is `https://lovebud.pages.dev` present in the active default origin list found in source? | Yes, in `modal_compute/config.py`. |
| Is the original Netlify helper finding still directly applicable? | No. It is stale for current main. |
| Is the finding moved? | Partially. The surviving CORS allowlist surface is Modal configuration. |
| Is a Netlify code fix needed for this item? | No, not for current main. |
| Is a separate legacy Netlify CORS PR required? | No, unless CTO separately reactivates or audits Netlify legacy functions. |

Decision summary:

The Issue #224 CORS default allowed origins item can be treated as **not applicable to current main as a Netlify code finding**. The original file and symbol are absent. The active runtime is Cloudflare Pages plus Modal, and the discovered active CORS allowlist surface already includes `https://lovebud.pages.dev` by default.

This report does not close Issue #224. It only provides evidence for marking this specific Netlify CORS item as stale / not applicable.

---

## 4. Code fix assessment

No code fix is needed for the reported Netlify helper finding because:

1. The target Netlify helper file does not exist on current main.
2. The target default symbol does not exist on current main.
3. Netlify is documented as legacy artifact only, not active production backend.
4. The active CORS allowlist surface found in current source is Modal configuration, and it includes the current official Cloudflare Pages origin.

Recommended handling:

- Mark the Netlify-specific CORS item as not applicable / stale in Issue #224 tracking.
- Do not create a Netlify implementation PR for this item.
- If future work audits active CORS behavior, scope it to Cloudflare Pages plus Modal and keep it separate from Netlify legacy cleanup.

---

## 5. Guardrails

This verification report does not authorize implementation changes.

Guardrails preserved:

- No Netlify implementation changes.
- No CORS policy changes.
- No Cloudflare route changes.
- No Modal changes.
- No Auth changes.
- No API behavior changes.
- No runtime behavior changes.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #319 through PR #331 modifications.
- Issue #224 remains open.

---

## 6. Verification notes

Commands / equivalent checks performed through GitHub source inspection:

```text
fetch current main SHA
check netlify/functions/_lib/http.js
search DEFAULT_ALLOWED_ORIGINS
search CORS_ALLOWED_ORIGINS
search lovebud.pages.dev under netlify-related sources
```

Results:

```text
netlify/functions/_lib/http.js: not found
DEFAULT_ALLOWED_ORIGINS: not found
CORS_ALLOWED_ORIGINS: found in modal_compute/config.py
https://lovebud.pages.dev: found in Modal default origin list and Netlify README context
```

---

## 7. This PR verification checklist

- [ ] `git diff --check`
- [ ] Changed files limited to Netlify CORS verification report docs/index links
- [ ] No JS/runtime/config changes
- [ ] No CORS behavior changes
- [ ] No close keywords for #224
