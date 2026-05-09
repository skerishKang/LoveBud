# netlify/ — Legacy / Fallback / Artifact (NOT Active Production Backend)

## Role

`netlify/functions/*` and `netlify/sql/*` are **legacy, fallback, and artifact files only**.

They are **not** the active production backend for this project.

## Active Production Path

`lovebud.pages.dev` production path is:

```
Cloudflare Pages (functions/) → Modal compute (modal_compute/)
```

This folder does **not** serve production traffic.

## Ownership Rules

- **Do not implement new backend policy in Netlify.** All new auth, API, and backend policy must be implemented in `functions/api/[[path]].js` and `modal_compute/`.
- **Do not delete, move, or reactivate** any file in this folder without CTO approval.
- **Do not represent Netlify as the active production backend** in documentation or code.
- Vercel is also **not** an official production entry for this project.

## Contents

- `netlify/functions/` — legacy Netlify Functions (see `netlify/functions/README.md`)
- `netlify/sql/` — legacy schema/seed artifacts (see `netlify/sql/README.md`)
