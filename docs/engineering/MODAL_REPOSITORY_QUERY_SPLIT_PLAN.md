# Modal Repository and Query Split Plan

> **Status:** STRATEGY_PLANNING
> **Source:** Issue #223
> **Type:** Docs-only planning — no implementation in this document

---

## 1. Purpose

This document defines a staged strategy for splitting `modal_compute/app.py` helper functions into dedicated repository/query modules while preserving the current route handler surface.

This is a **planning document only**. No Modal runtime code, route handlers, DB queries, auth behavior, or deploy configuration changes are made in this document.

---

## 2. Current Modal Runtime Boundary

### Route Handler Surface

`modal_compute/app.py` currently serves as both:
1. **Route handler surface** — 11 FastAPI route decorators (`@web_app.get`, `@web_app.post`)
2. **Query helper repository** — Various helper functions for DB operations

### Current Route Handlers

| Route | Method | Handler Function |
|---|---|---|
| `/modal/health` | GET | n/a (health check) |
| `/modal/browse/latest` | GET | `fetch_latest_public_tree_snapshots` |
| `/modal/browse/growing` | GET | `fetch_growing_public_tree_snapshots` |
| `/modal/community/memories` | GET | `fetch_public_memories` |
| `/modal/memories/{memory_id}` | GET | `fetch_public_memory` |
| `/modal/trees/{tree_id}` | GET | `fetch_public_tree` |
| `/modal/private/trees` | GET | `fetch_user_trees` |
| `/modal/private/trees` | POST | `create_owner_tree` |
| `/modal/private/trees/{tree_id}` | GET | `fetch_owner_tree` |
| `/modal/private/memories` | GET | `fetch_owner_memories` |
| `/modal/private/memories` | POST | `create_owner_memory` |

### Route Handler Responsibility Boundary

**For the purpose of this split plan:**

- Route decorators (`@web_app.get`, `@web_app.post`) **must remain in `app.py`** until separately approved
- Helper functions can be extracted to separate modules
- Route handlers call helper functions, not direct DB queries

---

## 3. Candidate Responsibility Groups

The current helper functions in `app.py` can be organized into these groups:

### 3.1 Public Read Query Helpers

Functions that only read public data (no auth required):

| Function | Purpose |
|---|---|
| `fetch_latest_public_tree_snapshots(limit, sort)` | Latest public trees with 3+ memories |
| `fetch_growing_public_tree_snapshots(limit)` | Growing trees with 1-2 memories |
| `fetch_public_memories(tree_id, limit)` | Public memories |
| `fetch_public_memory(memory_id)` | Single public memory |
| `fetch_public_tree(tree_id)` | Public tree metadata |

### 3.2 Owner/Private Read Helpers

Functions that read owner-scoped data (auth required, no write):

| Function | Purpose |
|---|---|
| `fetch_user_trees(owner_id, limit)` | User's trees with memory counts |
| `fetch_owner_tree(tree_id, owner_id)` | Single owner tree |
| `fetch_owner_memories(owner_id, tree_id, limit)` | Owner's memories |

### 3.3 Private Write Helpers

Functions that create/update data (auth required + write access):

| Function | Purpose |
|---|---|
| `create_owner_tree(owner_id, payload)` | Create new tree |
| `create_owner_memory(owner_id, payload)` | Create new memory |
| `delete_owner_tree(tree_id, owner_id)` | Delete tree (not currently in app.py) |
| `delete_owner_memory(memory_id, owner_id)` | Delete memory (not currently in app.py) |

### 3.4 Ownership/Auth Helper Boundary

Functions that enforce ownership and auth:

- `require_firebase_user` — from `modal_compute.auth`
- `require_plus_for_private_storage` — from `modal_compute.auth`
- Any custom ownership checks in write helpers

### 3.5 Response Shaping / Serialization Boundary

Functions that normalize DB responses:

| Function | Purpose |
|---|---|
| `normalize_row(row, stage_override)` | Normalize tree row |
| `normalize_memory_row(row)` | Normalize memory row |
| `normalize_tree_row(row, memory_count)` | Normalize tree + count |
| `_to_isoformat(dt)` | Datetime serialization |
| `estimate_stage(memory_count)` | Stage estimation |

---

## 4. Potential Future Split Targets

Based on the responsibility groups above, potential module splits:

### Option A: Keep All in app.py (Current State)

No split — all helpers remain in `app.py`.

- Pros: No refactor risk
- Cons: Harder to test in isolation

### Option B: Extract Public Reads Only

```python
# modal_compute/public_reads.py
def fetch_latest_public_tree_snapshots(limit, sort):
    ...

def fetch_growing_public_tree_snapshots(limit):
    ...
```

- Pros: Clear separation for public data
- Cons: Requires test coverage

### Option C: Extract Private Writes

```python
# modal_compute/private_writes.py
def create_owner_tree(owner_id, payload):
    ...

def create_owner_memory(owner_id, payload):
    ...
```

- Pros: Clear ownership boundary
- Cons: Requires careful auth integration

### Option D: Full Repository Pattern

```python
# modal_compute/repositories.py     # Public reads
# modal_compute/private_writes.py # Owner writes  
# modal_compute/ownership.py     # Ownership helpers
# modal_compute/app.py          # Route handlers only
```

- Pros: Maximum modularity
- Cons: Significant refactor, requires staged rollout

---

## 5. Staged Implementation Path

### Stage 1 — Docs Strategy (This PR)

- Document current structure
- Define split boundaries
- Set guardrails

### Stage 2 — Backend Contract Coverage

- Add test coverage for current helper functions
- Verify existing behavior before extraction
- No code changes

### Stage 3 — Public Read Extraction

- Extract public read helpers to `modal_compute/public_reads.py`
- Keep route handlers calling helpers
- Verify all browse/community routes work

### Stage 4 — Private Write Extraction

- Extract private write helpers to `modal_compute/private_writes.py`
- Keep auth checks in `modal_compute/auth.py` or helper modules
- Verify auth-gated routes work

### Stage 5 — Ownership Helper Extraction

- Extract ownership logic to `modal_compute/ownership.py` (if applicable)
- Verify unauthorized access blocked

### Stage 6 — app.py Thinning

- Only after all stages verified
- `app.py` contains only route decorators and handler wiring
- No direct DB query logic in `app.py`

---

## 6. Guardrails

### Do Not

- Move route decorators out of `app.py` without separate approval
- Change DB query behavior (SQL, parameters, joins)
- Change auth/ownership logic
- Change validation rules
- Change schema or migrations
- Change Modal deploy configuration
- Print secrets or credentials

### Preserve

- Route handler surface (11 routes)
- Current auth requirements per route
- Response schema compatibility
- Idempotency of read queries

---

## 7. Verification Matrix Before Implementation

Before any extraction (Stage 3 or later), verify:

| Test Case | Expected Behavior |
|---|---|
| Public trees read | Latest/growing trees returned with correct data |
| Community trees read | Public memories returned |
| Private owner reads | Owner's trees/memories returned |
| Private writes | New tree/memory created |
| Unauthorized access | 401/403 for protected routes |
| Modal route import smoke | All route handlers respond |
| Contract tests | Tests pass for extracted modules |

---

## 8. References

- Issue #223: Modal compute backend audit tracking
- `modal_compute/app.py` — Current route handlers and helpers
- `modal_compute/auth.py` — Auth enforcement
- `modal_compute/db.py` — DB connection
- `modal_compute/validation.py` — Input validation

---

## 9. Verification Checklist (This PR)

- [ ] `git diff --check` passes
- [ ] Changed files limited to Modal split planning docs/index links
- [ ] No Python/runtime/API/config changes
- [ ] No `close`/`fixes`/`resolves` keywords for #223 in this document