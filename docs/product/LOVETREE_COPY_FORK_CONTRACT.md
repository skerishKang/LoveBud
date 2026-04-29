# LoveTree Copy / Fork Contract

> **Status:** CONTRACT_PLANNING
> **Source:** Issue #84  
> **Type:** Docs-only audit and API contract planning — no implementation in this document

---

## 1. Purpose

This is the first planning document for the public LoveTree copy/fork feature tracked in Issue #84.

Before any backend endpoint, frontend UI, or database migration is written, this document fixes the API contract, ownership rules, lineage requirements, auth requirements, and verification criteria that any implementation must satisfy.

### Share/View vs. Copy/Fork

| Concept | What it does | Ownership change |
|---|---|---|
| **Share link / view link** | Lets another user read a public tree without any ownership | None — original owner unchanged |
| **Copy / fork** | Creates a new independent tree owned by the acting user, sourced from a public tree | Yes — new tree owned by acting user |

This document covers copy/fork only. Share/view links are a separate concern.

---

## 2. Product Flow

```
[User on Search Preview or public Detail page]
        ↓
[Sees public LoveTree]
        ↓
[Clicks "내 트리로 가져오기" or equivalent copy/fork button]
        ↓
┌────────────────────┐   ┌────────────────────┐
│  logged-out user      │   │  logged-in user       │
│  → login flow         │   │  → new owned tree       │
│  → return to action   │   │     created            │
└────────────────────┘   └────────────────────┘
                                      ↓
                        [Copied tree: independently editable]
                        [Source tree: unchanged]
                        [→ Redirect to editor or my-trees]
```

---

## 3. Scope for First Implementation

| Item | In scope | Out of scope |
|---|---|---|
| Public source trees | ✅ | — |
| Private / non-public source trees | — | ❌ Copy forbidden |
| Granting edit rights on original tree | — | ❌ Not granted |
| Upstream sync / merge-back | — | ❌ Not supported |
| Collaborative editing | — | ❌ Not supported |
| Real-time branch divergence tracking | — | ❌ Not supported |

---

## 4. Candidate API Contract

> All items in this section are **candidates**. Final endpoint path and schema require backend review before PR B.

### 4.1 Endpoint Candidates

| Candidate | Notes |
|---|---|
| `POST /api/trees/:id/fork` | Preferred — resource-scoped, RESTful |
| `POST /api/trees/fork` | Acceptable alternative if router structure requires flat path |

### 4.2 Request Schema Candidate

```json
{
  "sourceTreeId": "<string, required>",
  "title": "<string, optional — override title; default: source title + ' (복사본)'>",
  "visibility": "<string, optional — must comply with active product policy and Plus/private rules>"
}
```

### 4.3 Response Schema Candidate

```json
{
  "copiedTreeId": "<string>",
  "forkedFromTreeId": "<string>",
  "editUrl": "<string, optional — redirect/edit URL candidate>"
}
```

### 4.4 Idempotency / Double-Click Guard Candidates

| Mechanism | Notes |
|---|---|
| Idempotency key in request header | Prevents duplicate tree creation on retry |
| Disabled UI state on submit | Frontend guard; backend must also deduplicate |
| Short duplicate suppression window | e.g., 5s window per `(userId, sourceTreeId)` pair |

---

## 5. Ownership and Auth Requirements

| Requirement | Value |
|---|---|
| Auth state | Authenticated user required |
| Unauthenticated action | Login redirect; return to copy/fork action after login |
| New tree owner | Current authenticated user |
| Source owner rights | **Not transferred** to copied tree owner |
| Copied memories scope | Owned by / scoped to copied tree owner, not source owner |
| Token path | `firebase.auth().currentUser.getIdToken()` (on-demand; see `AUTH_TOKEN_CACHE_DEPENDENCY_AUDIT.md`) |

---

## 6. Data Copy Requirements

| Data item | Copy rule |
|---|---|
| Core tree metadata | Copy where available (title, description, cover, tags) |
| Title | Apply safe suffix: `(복사본)` unless user overrides |
| Public memories / moments | Copy all public moments associated with source tree |
| Private memories | **Do not copy** private moments that are not visible to the acting user |
| Source lineage | Persist `forkedFromTreeId` or `sourceTreeId` on new tree record |
| Original tree | **Unchanged** — no mutation on source |

---

## 7. Policy Constraints

| Constraint | Rule |
|---|---|
| Non-public source | Copy forbidden; return `403` or `409` with clear error |
| Copied tree default visibility | Follow active product visibility policy |
| Private storage selection | Must comply with Plus/private storage rules |
| Grandfather / private policy conflict | Requires follow-up confirmation before PR B implementation |
| Abuse / spam guard | Rate limiting on fork endpoint; TBD in PR B |

---

## 8. Runtime Ownership

| Layer | Role |
|---|---|
| Browser | Same-origin `/api/*` requests only |
| Cloudflare Pages Functions | Router: `functions/api/[[path]].js` — active implementation target |
| Modal backend | Implementation candidate for heavy compute (tree/memory copy logic) |
| Netlify | **Not** an active implementation target for this feature |
| Vercel | **Not** official production entry for this feature |

---

## 9. UI Placement Candidates

> UI implementation is deferred to a separate PR (PR D). This section records placement candidates only.

| Placement | Trigger context |
|---|---|
| Search Preview / 감상 허브 sidebar | User previewing a public tree in Search |
| Public detail page (`pages/detail.html`) | User viewing full public tree detail |

### Button Label Candidates

| Label | Register / tone |
|---|---|
| `내 트리로 가져오기` | Friendly, possession-oriented |
| `복제해서 수정하기` | Action-oriented, edit-forward |
| `이 트리 포크하기` | Technical, developer-register |

Final label selection requires product/UX review before PR D.

---

## 10. Verification Checklist

For use in PR B (backend) and PR E (end-to-end runbook) verification:

- [ ] Authenticated user can copy a public tree → new tree appears in my-trees
- [ ] Copied tree contains expected memories / moments
- [ ] Original source tree is unchanged after copy
- [ ] `forkedFromTreeId` / `sourceTreeId` is persisted on copied tree record
- [ ] Logged-out user is redirected to login; returns to copy action after login
- [ ] Non-public / private source tree copy returns `403` or `409` gracefully
- [ ] Double-click / duplicate submission does not create two trees
- [ ] No Search URL state regression after fork action
- [ ] No PR #7 / prototype / reference / demo changes
- [ ] No Auth/API/runtime behavior changes in this PR

---

## 11. Recommended PR Split

| PR | Scope | Notes |
|---|---|---|
| **PR A** | Audit / API contract docs (this PR) | Fix contract before implementation |
| **PR B** | Backend / API endpoint | `POST /api/trees/:id/fork` implementation; Modal compute if needed |
| **PR C** | Contract tests / route mapping tests | Verify endpoint behavior against PR A spec |
| **PR D** | Search Preview or public detail UI action | Frontend button + login redirect flow |
| **PR E** | End-to-end verification docs / runbook update | Smoke test checklist, post-deploy verification |

---

## 12. Guardrails

- **No backend/API implementation in this PR.** `functions/api/[[path]].js` and `modal_compute/` are read-only.
- **No frontend UI implementation in this PR.** `pages/*.html` and JS files are unchanged.
- **No database/schema migration in this PR.**
- **No Auth/runtime/token/cache behavior changes in this PR.**
- **No Netlify or Vercel runtime changes.**
- **No prototype/reference/demo/variant file changes.**
- **Issue #84 remains open** — this document does not close, fix, or resolve it.

---

## 13. Verification Checklist (This PR)

- [ ] `git diff --check` passes
- [ ] Changed files limited to `docs/product/LOVETREE_COPY_FORK_CONTRACT.md`
- [ ] No code/config/test/runtime changes
- [ ] No `close`/`fixes`/`resolves` keywords for #84 in this document
