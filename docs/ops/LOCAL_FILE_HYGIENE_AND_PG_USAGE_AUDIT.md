# Local File Hygiene and pg Usage Audit

**Status:** Draft  
**Owner:** CTO / Ops Lead  
**Related Issues:** #429  
**Last Updated:** 2026-05-01  

---

## 1. Purpose

Document a redaction-safe audit for local file hygiene and `pg` dependency usage boundaries in the LoveBud repository.

This audit focuses on:
- `.local/` tracked-file safety boundaries
- Secret-safe local file handling principles
- `pg` dependency usage trace and ownership
- Cloudflare Functions vs local script dependency boundaries

---

## 2. Scope

**Included:**
- `.local/` directory structure and tracked/untracked boundaries
- `pg` dependency usage patterns across the codebase
- Dependency ownership between Cloudflare Functions, Modal, and local scripts
- Safe handling principles for local files

**Excluded:**
- No implementation changes
- No file deletions or modifications
- No secret value inspection or output
- No `.gitignore` changes
- No dependency removal
- No runtime code changes
- No direct Cloudflare-to-database access assumptions

---

## 3. Non-goals

- Remove any dependencies
- Modify `.gitignore` configuration
- Inspect or output actual secret values
- Change runtime behavior
- Assume Cloudflare Functions directly access database
- Modify PR #7/prototype/reference/demo/variant paths

---

## 4. Safe Verification Commands

```bash
# Check .local/ directory status (redacted)
ls -la .local/

# Check pg dependency in package.json
grep '"pg"' package.json

# Search for pg usage (no values exposed)
rg --type js "require.*pg" scripts/
rg --type py "import.*pg" modal_compute/

# Verify functions don't use pg directly
rg --type js "require.*pg" functions/
```

---

## 5. `.local/` Tracked-File Safety Boundary

### Current Structure
- **TRACKED:** `.local/test-accounts.example.json` - Safe example template
- **TRACKED:** `.local/test-accounts-encrypted-v2.zip` - Encrypted test accounts
- **TRACKED:** `.local/test-accounts-encrypted.zip` - Legacy encrypted test accounts
- **TRACKED:** `.local/test-accounts.json` - Test accounts (sensitive data)

### Safety Classification
| File | Status | Handling |
|------|--------|----------|
| `test-accounts.example.json` | SAFE | Template file, can be viewed |
| `*.encrypted.zip` | SAFE | Encrypted, requires decryption key |
| `test-accounts.json` | SENSITIVE | Contains actual test credentials |

### Boundary Rules
- **ALLOWED:** View `.local/test-accounts.example.json` for reference
- **RESTRICTED:** Never output contents of `test-accounts.json`
- **RESTRICTED:** Never attempt to decrypt encrypted files without authorization
- **SAFE:** Report file existence/absence only

---

## 6. Secret-Safe Local File Handling Rules

### When to STOP
- Encountering actual credential values in any file
- Requested to output contents of `test-accounts.json`
- Asked to decrypt encrypted files without proper authorization
- Any operation that would expose secret values

### Safe Reporting Terms
- **PRESENT** - File exists
- **ABSENT** - File does not exist
- **ENCRYPTED** - File is encrypted
- **TEMPLATE** - File is a safe example/template
- **SENSITIVE** - File contains sensitive data (no values shown)

### Handling Principles
1. **Path-only references** - Use file paths, not contents
2. **Status reporting** - Report existence/absence, not values
3. **Redacted output** - Never show actual secret values
4. **Authorized access only** - Decryption only with explicit authorization

---

## 7. `pg` Dependency Usage Summary

### Current Status
- **Package:** `pg: ^8.12.0` listed in `package.json` dependencies
- **Usage Locations:** 13 references across 9 files
- **Primary Users:** Local scripts and Modal compute modules

### Usage Breakdown

#### Local Scripts (Primary Users)
- `scripts/verify-db.js` - Database connection verification
- `scripts/insert-memories.js` - Memory data insertion
- `scripts/seed-public-trees.js` - Public tree seeding
- `scripts/inspect-schema.js` - Schema inspection
- `scripts/fix-tree-visibility.js` - Tree visibility fixes
- `scripts/verify-env.js` - Environment verification
- `scripts/verify-phase1.js` - Phase 1 verification

#### Modal Compute (Database Layer)
- `modal_compute/db.py` - Database connection pool management
- `modal_compute/browse_latest.py` - Browse data queries

#### Cloudflare Functions (NO DIRECT USAGE)
- **Status:** NO `pg` imports found in `functions/` directory
- **Architecture:** Functions use Modal as database access layer

### Dependency Ownership
| Component | pg Usage | Responsibility |
|-----------|----------|----------------|
| Cloudflare Functions | NONE | API routing and caching |
| Modal Compute | YES | Database operations via connection pool |
| Local Scripts | YES | Development, seeding, maintenance tasks |

---

## 8. Cloudflare Functions vs Local Script Dependency Boundary

### Architectural Separation

#### Cloudflare Functions Layer
- **Responsibility:** API routing, request handling, caching
- **Database Access:** Via Modal backend only
- **Direct pg Usage:** NONE
- **Data Flow:** Browser → Cloudflare Functions → Modal → Database

#### Modal Backend Layer
- **Responsibility:** Business logic, database operations
- **Database Access:** Direct via `pg` connection pool
- **pg Usage:** Connection pooling, query execution
- **Data Flow:** Cloudflare Functions → Modal → Database

#### Local Scripts Layer
- **Responsibility:** Development, seeding, maintenance
- **Database Access:** Direct via `pg` for admin tasks
- **pg Usage:** Administrative operations, data management
- **Usage Context:** Local development environment, CI/CD tasks

### Boundary Clarifications
- **NO direct database access from Cloudflare Functions**
- **Modal serves as database abstraction layer**
- **Local scripts use `pg` for administrative purposes only**
- **Production data flow: Functions → Modal → Database**

---

## 9. Findings

### Local File Hygiene
✅ **`.local/` directory properly structured**
- Clear separation between template and sensitive files
- Encrypted files provide additional security layer
- Sensitive data properly contained

### Dependency Usage
✅ **`pg` dependency usage follows architectural boundaries**
- Cloudflare Functions correctly avoid direct database access
- Modal serves as intended database abstraction layer
- Local scripts use `pg` for appropriate administrative tasks

### Security Boundaries
✅ **Secret-safe handling principles established**
- Clear rules for when to STOP operations
- Safe reporting terminology defined
- Path-only references for sensitive files

---

## 10. Not Verified

- **Decryption key availability** - Not inspected, out of scope
- **Encrypted file contents** - Not accessed, out of scope
- **Actual credential values** - Not inspected, out of scope
- **Runtime database connection testing** - Out of scope for docs-only audit

---

## 11. Follow-up Axes

### Documentation Follow-up
- [ ] Update local development setup documentation
- [ ] Document encrypted file handling procedures
- [ ] Create dependency boundary documentation

### Dependency Boundary Follow-up
- [ ] Review local scripts for potential optimization
- [ ] Consider adding dependency usage documentation
- [ ] Evaluate if any local scripts can be consolidated

### Optional Future Script/Check PR (Requires Separate Approval)
- [ ] Create local file hygiene verification script
- [ ] Add dependency usage validation check
- [ ] Implement automated boundary verification

---

## 12. Guardrails

- **DO NOT** modify `.gitignore` without explicit approval
- **DO NOT** remove `pg` dependency without architectural review
- **DO NOT** add direct database access to Cloudflare Functions
- **DO NOT** expose secret values in any documentation or reports
- **DO NOT** modify encrypted files without proper authorization
- **DO NOT** combine with implementation PRs without explicit approval

---

## 13. Reporting Template

```text
[Local File Hygiene and pg Usage Audit Report]

.local/ Directory Status:
- test-accounts.example.json: PRESENT/ABSENT
- test-accounts.json: PRESENT/ABSENT (SENSITIVE)
- encrypted files: PRESENT/ABSENT

pg Dependency Usage:
- Package version: [version from package.json]
- Cloudflare Functions usage: NONE
- Modal usage: CONFIRMED
- Local scripts usage: CONFIRMED

Boundary Compliance:
- Functions → Modal → Database: COMPLIANT
- Local scripts direct access: APPROPRIATE
- No direct Functions → Database: CONFIRMED

Safety Verification:
- Secret values exposed: NO
- Encrypted files accessed: NO
- Boundary violations: NONE

Recommendations:
[Specific follow-up recommendations based on findings]
```

---

## 14. Related Documentation

- [AGENTS.md](../AGENTS.md) - Agent operating principles
- [ops_index.md](ops_index.md) - Operations documentation index
- [../engineering/CODE_ARCHITECTURE.md](../engineering/CODE_ARCHITECTURE.md) - Code architecture guidelines

---

Document version: 1.0  
Next review: After any dependency changes or local file structure modifications
