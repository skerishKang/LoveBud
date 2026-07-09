# Netlify Legacy Runtime Surface — Stale Host Policy (#3341)

> Issue: #3341
> Related: #3264, #3188, #3075, #1882
> Status: Audit + guardrail only. No production runtime change.

## Current production baseline

- **User-facing production:** `https://lovebud.pages.dev`
- **Intended runtime:** Cloudflare Pages (entry / `functions/`) + Modal (compute)
- **Neon PostgreSQL:** active database

## Stale / legacy surface

- `lovebud.netlify.app` and any `*.netlify.app` host is **legacy / stale**.
- It MUST NOT be used for:
  - `#3264` Gate A smoke (or any runtime smoke)
  - production validation
  - scenario testing
- The #3264 Gate A smoke runner now fails closed with
  `smokeStatus: BLOCKED_STALE_NETLIFY_API_BASE` if `GATE_A_API_BASE`
  points to a Netlify host.

## What remains (do NOT delete wholesale)

- `netlify/` directory — legacy artifact / fallback reference. Retained for
  archive decision; not the active production path.
- `functions/` directory — **active** Cloudflare Pages Functions. NOT Netlify.
  Do not classify or delete it as Netlify.
- `docs/conversation/full/*` (2026-04 dated logs) — historical records; kept
  as archive references.

## Dashboard / DNS cleanup

- Decommissioning the Netlify project, DNS records, or dashboard resources
  requires a **separate, explicit approval**. This task does NOT perform that.

## Operator guardrail summary

- If a smoke/preflight receives a Netlify API base, it blocks before any
  network call. No host value, token, ID, or credential is echoed.
