# Environment Naming and Runtime Terminology Audit

## Purpose

Audit `NETLIFY_DATABASE_URL` usage locations and meaning in a secret-safe manner. Review README, AGENTS, and docs runtime terminology for alignment with current operational baseline. Establish consistent terminology: Cloudflare Pages + Modal + Neon as active runtime, Netlify/Vercel as legacy/transitional artifacts. This is a docs-only audit - no environment variable rename, code/config changes, migration, or runtime structure changes.

## Safe Verification Commands

Commands that do not output actual values:

```bash
# Environment variable usage trace
git grep -n "NETLIFY_DATABASE_URL" -- ':!*.env' ':!*.local*'
git grep -n "DATABASE_URL" -- ':!*.env' ':!*.local*'

# Runtime terminology scan
git grep -n "Netlify" README.md AGENTS.md docs
git grep -n "Vercel" README.md AGENTS.md docs
git grep -n "Cloudflare" README.md AGENTS.md docs
git grep -n "Modal" README.md AGENTS.md docs
git grep -n "Neon" README.md AGENTS.md docs
```

## Usage Category Summary

### NETLIFY_DATABASE_URL Usage

| Category | Files | Impact | Rename Risk | Notes |
|----------|-------|--------|-------------|-------|
| Scripts | `scripts/*.js`, `scripts/*.bat`, `scripts/*.ps1` | High | High | Broad script ecosystem uses legacy name |
| Docs | `docs/ops/*.md`, `docs/migration/*.md` | Medium | Medium | Documentation references and examples |
| Engineering | `docs/engineering/*.md` | Medium | Medium | Architecture docs reference legacy naming |
| Reports | `docs/reports/*.md` | Low | Low | Historical reports contain legacy references |

### Runtime Terminology Distribution

| Platform | Current Status | Doc Frequency | Alignment |
|----------|----------------|---------------|-----------|
| Cloudflare Pages | **Active runtime entry** | High | ✅ Consistent |
| Modal | **Active runtime compute** | High | ✅ Consistent |
| Neon | **Active persistence** | Medium | ✅ Consistent |
| Netlify | **Legacy artifact** | High | ⚠️ Mixed legacy references |
| Vercel | **Transitional fallback** | Medium | ⚠️ Mixed transitional references |

## Terminology Alignment Notes

### Current Consistent Usage

**Active Runtime Components:**
- Cloudflare Pages: "active runtime entry", "same-origin `/api/*` router", "static frontend"
- Modal: "active runtime compute", "browse summary", "private/community read/write"
- Neon: "active persistence", "PostgreSQL database", "data storage"

**Legacy/Transitional Components:**
- Netlify: "legacy artifact", "removal candidate", "not active production backend"
- Vercel: "deprecated transitional fallback", "upstream under audit", "secondary adapter"

### Areas Needing Alignment

1. **Script Environment Variable Names**
   - Many scripts still reference `NETLIFY_DATABASE_URL` as primary
   - Active runtime uses Modal, but variable name suggests Netlify ownership
   - Impact: High - script ecosystem broad usage

2. **Documentation Examples**
   - Several docs still use Netlify-first examples for environment setup
   - Migration docs reference Netlify-to-Modal transitions
   - Impact: Medium - documentation guidance only

3. **Historical Report References**
   - Past reports contain Netlify/Vercel as if they were active
   - Some security docs still list Netlify as potential active target
   - Impact: Low - historical context

## Follow-up Axes and Guardrails

### Axes for Future Work

1. **Environment Variable Naming (High Impact)**
   - Current: `NETLIFY_DATABASE_URL` used across scripts/docs
   - Desired: Platform-agnostic naming (e.g., `DATABASE_URL`, `POSTGRES_URL`)
   - Guardrail: Do not rename without separate implementation approval
   - Prerequisite: Modal runtime stability confirmed

2. **Script Modernization (High Impact)**
   - Current: Scripts assume Netlify-first environment
   - Desired: Platform-agnostic script patterns
   - Guardrail: Maintain backward compatibility during transition
   - Prerequisite: Environment variable naming decision

3. **Documentation Refresh (Medium Impact)**
   - Current: Mixed legacy/active terminology
   - Desired: Consistent active runtime terminology
   - Guardrail: Preserve historical context in appropriate sections
   - Prerequisite: Runtime terminology alignment complete

4. **Security Posture Alignment (Low Impact)**
   - Current: Some security docs reference legacy platforms as active
   - Desired: Clear distinction between active vs legacy platforms
   - Guardrail: Do not change actual security configurations
   - Prerequisite: Platform ownership clearly documented

### Guardrails for This Audit

- **No Implementation Changes**: This audit documents current state only
- **No Environment Variable Rename**: `NETLIFY_DATABASE_URL` rename requires separate approval
- **No Runtime Structure Changes**: Current Cloudflare + Modal + Neon stack preserved
- **No Secret Exposure**: All verification commands are safe (no value output)
- **PR #7/Prototype Protection**: Do not touch prototype/reference/demo/variant paths
- **Issue Isolation**: Do not modify issues #464, #450, or UI PRs #460/#462/#463

### Decision Points Requiring CTO Input

1. **Environment Variable Rename Strategy**
   - Keep `NETLIFY_DATABASE_URL` for compatibility?
   - Migrate to platform-agnostic naming?
   - Timeline for rename implementation?

2. **Script Transition Approach**
   - Gradual migration with backward compatibility?
   - Clean break with new script patterns?
   - Migration tooling vs manual updates?

3. **Documentation Update Priority**
   - Focus on operational docs first?
   - Update all references simultaneously?
   - Preserve historical context vs clean slate?

## Current State Summary

- **Active Runtime**: Cloudflare Pages + Modal + Neon (consistent across docs)
- **Legacy References**: Netlify/Vercel still referenced in scripts/docs
- **Environment Variables**: `NETLIFY_DATABASE_URL` widely used despite Modal active runtime
- **Security Posture**: Clear distinction between active vs legacy needed in some docs
- **Implementation Impact**: High for variable rename, medium for doc updates, low for terminology alignment

## Verification Commands for Future Audits

```bash
# Re-run after any changes to verify alignment
git grep -n "NETLIFY_DATABASE_URL" -- ':!*.env' ':!*.local*' | wc -l
git grep -n "active runtime" docs/ | grep -v "legacy\|transitional"
git grep -n "legacy.*Netlify\|Netlify.*legacy" docs/
git grep -n "transitional.*Vercel\|Vercel.*transitional" docs/
```

This audit provides the baseline for any future environment variable naming or script modernization work. No changes are implemented in this audit - it documents current state and provides guardrails for future implementation decisions.
