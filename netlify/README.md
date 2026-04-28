# LoveBud Netlify (Legacy)

> **Runtime Ownership**: Legacy artifact only  
> **Status**: Removal candidate pending CTO approval/audit

## Overview

This directory contains Netlify-related configurations and functions that are **legacy artifacts**.

## Status

- **Not an active fallback** - Do not rely on Netlify for production traffic
- **Not a target for new backend policy implementation** - Do not add new runtime logic here
- **Removal candidate** - Pending explicit CTO approval before removal

## Current Contents

- `netlify/functions/` - Legacy serverless functions (kept for reference)
- `netlify.toml` - Legacy configuration (kept for reference)

## Important Notes

- **Do not add new runtime logic** to this directory without explicit CTO approval
- This is kept as a **reference/audit trail** only
- Active runtime is Cloudflare Pages + Modal (see `functions/README.md`)
- Any Netlify-specific functionality should be migrated to Cloudflare Pages Functions

## Migration Path

If you encounter Netlify-specific code that appears active:
1. Check `functions/README.md` for the current active gateway
2. Consult `docs/ops/OPERATIONS.md` for infrastructure details
3. Do not modify Netlify code without CTO approval

## Related

- `functions/README.md` - Active Cloudflare Pages Functions gateway
- `docs/ops/OPERATIONS.md` - Infrastructure documentation
- `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md` - Migration history
