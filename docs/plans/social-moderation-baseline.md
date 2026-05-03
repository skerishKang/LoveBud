# Social Moderation Baseline

Refs #758

## Purpose

Define the minimum moderation baseline that must be in place before public LoveTree social writing (likes, comments, shares) is enabled for any user.

This document is policy/planning only. No runtime implementation is included here.

---

## Core Principle

Public social writing must not ship without a moderation baseline. A LoveTree owner must always have final control over content appearing on their tree. Any abuse-control gap must be documented before the corresponding write feature is enabled.

---

## 1. Owner Hide / Delete Policy

### 1.1 Comment hiding

| Action | Who can perform | Trigger | Effect |
|---|---|---|---|
| Hide comment | Tree owner | Manual | Comment hidden from all non-owner viewers; author sees a hidden notice |
| Unhide comment | Tree owner | Manual | Comment restored to visible state |
| Bulk hide | Tree owner | Manual (multi-select) | Same as single hide, applied to selection |

**Rules:**
- Hiding is non-destructive; the comment record is retained.
- Hidden comments must not count toward public comment totals.
- Owner cannot hide their own comments through this path (use delete instead).

### 1.2 Comment deletion

| Action | Who can perform | Trigger | Effect |
|---|---|---|---|
| Delete comment | Tree owner | Manual | Comment soft-deleted; author sees a deletion notice |
| Hard delete | System/admin only | Abuse escalation | Comment permanently removed |

**Rules:**
- Owner-initiated deletion is always soft-delete at API level.
- Deleted comments must display a `[deleted]` placeholder to preserve thread continuity.
- Hard delete requires admin escalation path (see Section 5).

---

## 2. Author Edit / Delete Policy

### 2.1 Author edit

| Action | Who can perform | Window | Effect |
|---|---|---|---|
| Edit own comment | Comment author | Within 15 minutes of posting | Comment text updated; edit timestamp shown |
| Edit own comment | Comment author | After 15 minutes | NOT ALLOWED |

**Rules:**
- Edit window is 15 minutes from original post time.
- Edited comments must display an `(edited)` indicator.
- Edit history is not shown to public; it is retained for audit purposes only.
- Author cannot edit a comment that has been hidden by tree owner.

### 2.2 Author delete

| Action | Who can perform | Effect |
|---|---|---|
| Delete own comment | Comment author | Soft-delete; `[deleted]` placeholder shown |

**Rules:**
- Author delete is always soft-delete.
- Author delete is available at any time (no time window restriction).
- A deleted comment cannot be restored by the author; only an admin can restore via audit log.

---

## 3. Report / Flag Decision

### 3.1 Report categories

| Category | Label | Action on report |
|---|---|---|
| Spam | `spam` | Queued for review; comment hidden after 3 unique reports |
| Harassment | `harassment` | Queued for immediate review; comment hidden after 1 report |
| Inappropriate content | `inappropriate` | Queued for review; comment hidden after 3 unique reports |
| Impersonation | `impersonation` | Queued for review; no auto-hide |

**Rules:**
- A single user may report a comment once per category.
- Report counts are not shown to public.
- Auto-hide thresholds apply to aggregate unique-reporter counts, not total report events.
- Reported comments that are auto-hidden must be reviewed within 72 hours (policy SLA; not enforced at launch).

### 3.2 Report UI placement

- Report affordance: overflow menu (`⋮`) on each comment.
- Report flow: modal with category selection → confirmation → server-side flag.
- Reporter identity is not revealed to tree owner or comment author.

---

## 4. Abuse Control Requirements

The following abuse-control requirements must be in place before social writing is enabled:

| Requirement | Description | Status |
|---|---|---|
| Rate limiting | Max 10 comments per user per tree per hour | NOT IMPLEMENTED |
| Duplicate detection | Block identical comment text submitted within 60 seconds by same author | NOT IMPLEMENTED |
| Auth gate | Social write actions require authenticated session | EXISTING (auth-policy.js) |
| Spam keyword filter | Block comments matching known spam patterns | NOT IMPLEMENTED |
| Auto-hide threshold | Comments auto-hidden after N unique reports (see Section 3) | NOT IMPLEMENTED |
| Soft-delete retention | Deleted comment records retained for 90 days | NOT IMPLEMENTED |
| Audit log | Owner/author/admin actions on comments logged with actor + timestamp | NOT IMPLEMENTED |

**Policy rule:** Social writing must not ship until at minimum the following are implemented: Rate limiting, Auth gate (already exists), and Soft-delete retention.

---

## 5. Audit / Status Reporting Expectations

### 5.1 Audit log fields

Every moderation action must produce an audit log entry with:

| Field | Description |
|---|---|
| `action_type` | One of: `hide`, `unhide`, `owner_delete`, `author_delete`, `admin_delete`, `report`, `auto_hide`, `restore` |
| `actor_role` | One of: `owner`, `author`, `reporter`, `admin`, `system` |
| `target_comment_id` | Opaque reference; must not be a raw DB row ID in any report output |
| `timestamp` | ISO 8601 UTC |
| `reason_label` | Category label (see Section 3.1) or `manual` |

### 5.2 Status reporting rules

- Ops/admin reports must use aggregate status labels (`low`, `moderate`, `high`, `escalated`), not raw counts.
- Raw comment IDs, owner IDs, author IDs, reporter IDs, and tree IDs must not appear in any report output or ops log visible outside the system boundary.
- Report totals visible to tree owner are limited to: `No reports`, `Some reports`, `Under review`.

---

## 6. Implementation Sequencing

This document is planning-only. Implementation must follow this sequence:

| Phase | Scope | Depends on |
|---|---|---|
| **Phase 1** | Auth gate (already exists) + soft-delete schema + audit log schema | Schema migration |
| **Phase 2** | Rate limiting middleware | Phase 1 |
| **Phase 3** | Comment write API (create, soft-delete) | Phase 1, Phase 2 |
| **Phase 4** | Author edit API (within window) | Phase 3 |
| **Phase 5** | Owner hide/unhide/delete API | Phase 3 |
| **Phase 6** | Report/flag API + auto-hide threshold | Phase 3 |
| **Phase 7** | Comment read API + display UI | Phase 3 |
| **Phase 8** | Abuse controls: duplicate detection, spam filter | Phase 3 |
| **Phase 9** | Admin escalation path + hard delete | Phase 6 |

Each phase must be implemented and verified independently via fixed-slot browser verification with SHA match before the next phase begins.

**Social writing must not be enabled in production until Phase 1 through Phase 3 are complete and verified.**

---

## 7. Out of Scope

- Comment read/write UI implementation
- Social UI redesign
- Admin console implementation
- Browse ranking changes
- Any runtime JS/CSS/HTML/API/Auth/backend/DB changes in this planning document
- PR #7 / prototype / reference / demo / variant paths
- Browse selected hub / Issue #600 related files

---

## Status

- Planning: DRAFT
- Implementation: NOT STARTED
- Related issue: #758
- Parent completed: #622
