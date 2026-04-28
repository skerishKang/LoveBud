# LoveBud Cloudflare Pages Functions

> **Runtime Ownership**: Cloudflare Pages Functions  
> **Status**: Active same-origin API gateway

## Overview

This directory contains Cloudflare Pages Functions that serve as the **active same-origin API gateway** for LoveBud.

## API Flow

```
browser → /api/* → functions/api/** → Modal → Neon
```

- Browser makes requests to same-origin `/api/*` paths
- Cloudflare Pages Functions handle routing and proxying
- Modal compute layer handles business logic
- Neon PostgreSQL for data persistence

## Structure

- `functions/api/` - API route handlers and proxy logic
- `functions/api/memories/` - Memory-related endpoints
- `functions/api/trees/` - Tree-related endpoints

## Important Notes

- **Do not replace** this Cloudflare Pages Functions setup with Netlify or Vercel fallback behavior
- This is the primary production API gateway
- All new backend policy implementations should target this layer
- See `docs/ops/OPERATIONS.md` for detailed infrastructure documentation

## Related

- `docs/ops/OPERATIONS.md` - Infrastructure and deployment details
- `modal_compute/` - Modal compute layer (upstream)
- `netlify/` - Legacy artifact (see netlify/README.md)
