# Legacy Authorized Domain Cleanup Decision Record

Refs #266

## Purpose

This document provides a decision record for Firebase Authentication authorized domain cleanup as part of #266 security posture review. It classifies current authorized domains by category and determines cleanup actions without making actual Firebase Console changes.

## Current Active Runtime

The current active runtime is **Cloudflare Pages + Modal**:

- **Production domain**: `lovebud.pages.dev`
- **Active API path**: browser → same-origin `/api/*` → Cloudflare Pages Functions → Modal → Neon
- **Legacy platforms**: Netlify and Vercel are not active deployments/fallbacks

## Domain Categories

### Production Domains
- `lovebud.pages.dev` - Active production domain (REQUIRED)
- `skerishkang.github.io` - GitHub Pages (potential legacy, needs evaluation)

### Cloudflare Preview Domains
- Pattern: `*.lovebud.pages.dev` - PR preview domains (REQUIRED for PR testing)
- Pattern: `*.pages.dev` - Cloudflare Pages preview domains (REQUIRED)

### Fixed Test Slot Domains
- Fixed test slot domains documented in `TEST_PREVIEW_SLOTS.md` (if any)
- These are controlled environments for specific testing scenarios

### Legacy Netlify/Vercel Domains
- Pattern: `*.netlify.app` - Netlify deployment domains (LEGACY)
- Pattern: `*.vercel.app` - Vercel deployment domains (LEGACY)
- These were previous deployment targets but are now legacy artifacts

### Localhost/Dev Domains
- `localhost:*` - Local development (REQUIRED for local testing)
- `127.0.0.1:*` - Local development (REQUIRED for local testing)
- `*.local` - Local development patterns (REQUIRED)

## Verification Questions

### Which domains are required?
- `lovebud.pages.dev` - Production access
- `*.lovebud.pages.dev` - PR preview testing
- `localhost:*` / `127.0.0.1:*` - Local development
- Fixed test slot domains (if documented)

### Which are legacy?
- `*.netlify.app` domains
- `*.vercel.app` domains
- Potentially `skerishkang.github.io` (needs CTO decision)

### Which need CTO decision?
- `skerishkang.github.io` - Determine if still needed for GitHub Pages fallback
- Any fixed test slot domains not documented in `TEST_PREVIEW_SLOTS.md`

## Evidence Policy

**Domain category/status listing only**:
- List domain patterns and their classification
- Include verification status (REQUIRED/LEGACY/NEEDS_DECISION)
- Do not include secret/session/token data
- Do not include actual authorized domain lists from Firebase Console
- Do not include OAuth client IDs or API keys

**Allowed evidence**:
- Domain pattern classifications
- Runtime architecture documentation
- Deployment history from docs
- PR preview URL patterns

**Forbidden evidence**:
- Firebase Console screenshots with sensitive data
- OAuth client configuration details
- API keys or secrets
- Session tokens or cookies

## Outcomes

### VERIFIED_REQUIRED
Domains confirmed as required for current operations:
- `lovebud.pages.dev`
- `*.lovebud.pages.dev`
- `localhost:*` / `127.0.0.1:*`

### NEEDS_LEGACY_DOMAIN_REMOVAL
Domains classified as legacy candidates pending authorized owner confirmation:
- `*.netlify.app` domains
- `*.vercel.app` domains

### NEEDS_CTO_DECISION
Domains requiring CTO evaluation:
- `skerishkang.github.io` - GitHub Pages fallback necessity

### BLOCKED_BY_OWNER_ACCESS
Domains that cannot be removed due to access restrictions:
- Domains owned by external services
- Domains requiring service provider intervention

## Console Change Process

**Separate approval required**:
- This PR documents the decision only
- No Firebase Console changes in this PR
- Actual domain removal requires separate CTO approval
- Console changes should be done by authorized personnel only
- Document any console changes in separate follow-up

**Change sequence**:
1. This PR documents the decision record
2. CTO approves actual console changes
3. Authorized personnel perform console changes
4. Update this document with actual changes made

## Relationship to #266

This decision record addresses one of the remaining security gaps identified in #266:

- **Gap**: Legacy authorized domains from previous deployment targets
- **Impact**: Potential security surface area expansion
- **Resolution**: Documented cleanup process with CTO approval required
- **Status**: Decision documented, execution pending separate approval

## Safety Guardrails

- Refs #266 (non-completing reference)
- No Firebase Console changes in this PR
- No secret/session/token values included
- No runtime/config/workflow changes
- No actual domain removal without separate approval
- Documentation-only approach for security review
