# Auth & Data Cache Key Inventory

Status: active documentation
Last synced for: Issue #78 cache key audit

---

## 1. Purpose

This document inventories all hardcoded cache key strings used in the LoveBud auth and data caching layers. The inventory tracks:

- Key names and their purposes
- Where keys are read/written
- Potential duplication candidates for centralization

This is documentation-only. No runtime changes or key renames are performed in this PR.

---

## 2. Auth Cache Keys

### `lovebud_auth_cache`

**Purpose**: Stores confirmed authenticated user information (uid, displayName, email).

**Type**: Stringified JSON object

**Structure**:
```json
{
  "uid": "string",
  "displayName": "string",
  "email": "string"
}
```

**Used in**:
- `js/auth.js:303-317` - `getCachedAuthUser()`
- `js/auth.js:319-333` - `setConfirmedAuthCache()`
- `js/auth.js:335-345` - `clearConfirmedAuthCache()`

---

### `lovebud_auth_confirmed`

**Purpose**: Boolean flag indicating the auth cache has been confirmed valid by Firebase.

**Type**: String `'true'` or absent

**Used in**:
- `js/auth.js:308` - Check before trusting auth cache
- `js/auth.js:328` - Set on confirmed auth
- `js/auth.js:341` - Cleared on logout

---

### `lovebud_auth_token`

**Purpose**: Stores Firebase ID token with expiration for authenticated API calls.

**Type**: Stringified JSON object

**Structure**:
```json
{
  "uid": "string",
  "token": "string",
  "expiresAt": "number (timestamp)"
}
```

**Used in**:
- `js/auth.js:347-361` - `getCachedAuthToken()`
- `js/auth.js:383-392` - `persistConfirmedAuthSession()`
- `js/auth.js:337-343` - `clearConfirmedAuthCache()`

---

## 3. Data Cache Keys

### `lovebud_trees_cache`

**Purpose**: Caches user's tree list for my-trees page.

**Type**: Stringified JSON object

**Structure**:
```json
{
  "data": [...],
  "timestamp": "number"
}
```

**Used in**:
- `js/auth.js:416-422` - Write on preload
- `pages/my-trees.html` - Read for initial render

---

### `tree_detail_` (prefix)

**Purpose**: Caches individual tree detail data.

**Type**: Prefix for `tree_detail_<treeId>` keys

**Structure**:
```json
{
  "data": {...},
  "timestamp": "number"
}
```

**Used in**:
- `js/auth.js:434-440` - Write on preload first tree detail

---

### `tree_memories_` (prefix)

**Purpose**: Caches individual tree memories data.

**Type**: Prefix for `tree_memories_<treeId>` keys

**Structure**:
```json
{
  "data": [...],
  "timestamp": "number"
}
```

**Used in**:
- `js/auth.js:441-446` - Write on preload first tree memories

---

## 4. Hardcoded Key Duplication Candidates

The following string constants are defined in multiple locations or should be centralized:

### Current Duplication Points

| Key | Defined In | Used In | Recommendation |
|-----|-----------|---------|----------------|
| `AUTH_CACHE_KEY` | `js/auth.js:97` | Multiple | Central export |
| `AUTH_CONFIRMED_KEY` | `js/auth.js:98` | Multiple | Central export |
| `AUTH_TOKEN_KEY` | `js/auth.js:99` | Multiple | Central export |
| `lovebud_trees_cache` | `js/auth.js` inline | `js/auth.js` | Constant export |
| `tree_detail_` prefix | `js/auth.js:434` inline | `js/auth.js:434-435` | Constant export |
| `tree_memories_` prefix | `js/auth.js:441` inline | `js/auth.js:441-442` | Constant export |

---

## 5. Key Usage Summary Table

| Key | Read | Write | Clear | Purpose |
|-----|------|-------|-------|---------|
| `lovebud_auth_cache` | ✓ | ✓ | ✓ | User info cache |
| `lovebud_auth_confirmed` | ✓ | ✓ | ✓ | Auth confirmation |
| `lovebud_auth_token` | ✓ | ✓ | ✓ | Firebase ID token |
| `lovebud_trees_cache` | ✓ | ✓ | (shared) | Trees list |
| `tree_detail_<id>` | - | ✓ | (shared) | Tree detail |
| `tree_memories_<id>` | - | ✓ | (shared) | Tree memories |

---

## 6. Notes for Centralization (Follow-up PR)

A follow-up PR should:

1. Create `js/cache-constants.js` or `js/cache-keys.js`
2. Export all key strings as named constants
3. Update all imports across auth and data modules
4. Maintain backward compatibility during transition

---

## 7. References

- Issue #78: Auth cache key audit
- `js/auth.js` - Primary usage location
- PR #303 - Auth cache dependency audit