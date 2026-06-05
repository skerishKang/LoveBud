# LoveBud Scout — MVP Readiness and Implementation Boundary

> Audit document for [#1882](https://github.com/skerishKang/LoveBud/issues/1882) — Phase 0: readiness/boundary only.
> This document defines what LoveBud Scout is, what it is not, and where the first implementation must stay within.

---

## 1. Product Framing

LoveBud Scout is **not** a generic translation app or a K-pop news aggregator. It is a LoveBud-native fan assistant.

**Core positioning:**

> Fans paste a public link. LoveBud summarizes and translates the key points, suggests fan-relevant context and emotion tags, then lets the user save it into their LoveTree.

This keeps LoveBud's identity as a **fan emotion and memory archive**. Scout is the assistant that turns new public fan content into a saved LoveTree moment — it does not replace the manual journaling flow, it complements it.

### Why Scout fits LoveBud

- LoveBud already stores moments with emotion tags, titles, and free-text notes.
- Fans already want to record reactions to external content (comeback announcements, tour news, interviews).
- A Scout entrypoint gives fans a practical reason to return between manual journaling sessions.
- The output is a **LoveTree moment draft**, not a standalone article or translation — it lives inside the user's personal tree.

### Positioning statement

```
LoveBud = fan emotion and memory archive
LoveBud Scout = the assistant that turns new public fan content into a saved LoveTree moment
```

---

## 2. MVP User Flow

```
1. User pastes a public URL
        ↓
2. Scout checks if the link is fetchable/parseable
        ↓
3. Content is fetched (metadata + user-visible text only)
        ↓
4. Scout generates:
   - short summary
   - translation (if not in user's language)
   - fan-relevant context/highlights
   - suggested emotion tags
        ↓
5. User reviews and edits the draft
        ↓
6. User saves as a LoveTree moment
        ↓
7. Original source link is stored and displayed
```

### Actors

| Actor | Role |
|-------|------|
| LoveBud user | Provides the link, reviews the draft, owns the saved moment |
| LoveBud Scout (frontend) | Orchestrates fetch → suggest → review → save flow |
| Fetch provider | Retrieves metadata + text from the public URL |
| AI suggestion provider | Generates summary, translation, emotion tags |

### MVP entrypoint

- A "+ Scout" button or paste zone in the editor, alongside the existing "add memory" flow.
- Not a separate app or route — Scout lives inside the existing LoveTree editor.

---

## 3. Explicit Non-Goals (First MVP)

These are **not** part of the first implementation:

- ❌ Generic translator app (Papago/DeepL/Google Translate competitor)
- ❌ Automatic crawling, monitoring, or notification of new content
- ❌ Full-article or full-video rehosting / storage
- ❌ Platform policy circumvention tools
- ❌ Artist / private / fanclub-only content scraping
- ❌ Weverse / Instagram / X / TikTok platform scraping outside allowed access paths
- ❌ Rehosting official videos, images, lyrics, or transcripts
- ❌ K-pop-wide monitoring dashboard or news feed
- ❌ Official partnership or endorsement claims
- ❌ Replacing the manual "add memory" flow — Scout is additive, not a replacement

---

## 4. Safety / Policy / Copyright Boundary

### 4.1 Source restrictions

| Allowed | Prohibited |
|---------|------------|
| User-provided public links only | Automated bulk link submission |
| Public YouTube videos (watch page) | Private / unlisted videos |
| Public news articles (no paywall) | Paywalled / login-required content |
| Official agency announcements | Fanclub-only / membership-only content |
| Public social media posts (user's own or explicitly shareable) | DM / private message content |

### 4.2 Content storage policy

| What | Policy |
|------|--------|
| Full original text | ❌ Do not store. Only metadata + summary. |
| Summary (AI-generated) | ✅ Stored as part of the moment draft, user-edited before save |
| Translation (AI-generated) | ✅ Stored as part of the moment draft, user-edited before save |
| Emotion tags (AI-suggested) | ✅ Stored as moment emotion tags, user-edited before save |
| Original source URL | ✅ Stored and displayed in the moment |
| Images / video | ❌ Not stored. Only the URL is kept. |
| Fetch timestamp | ✅ Stored for rate-limiting and debugging |

### 4.3 Copyright and attribution

- Scout only fetches **user-visible text** and **public metadata** — not copyrighted full works.
- The saved moment is a **personal memory draft** (summary + tags), not a republished article.
- The original source link is always displayed so the user can refer back.
- Users may not republish Scout-generated content outside LoveBud without attribution.
- If a publisher requests removal, the affected moments can be flagged and the source link disassociated.

### 4.4 Platform policy compliance

- Each fetch source must be reviewed before enabling.
- Respect `robots.txt` and `X-Robots-Tag` headers.
- Respect `Crawl-Delay` and rate-limit recommendations.
- No automated login / session reuse for content fetching.
- Content from known-content-platform APIs (YouTube Data API, etc.) must comply with their ToS.

---

## 5. Technical Boundary

### 5.1 Frontend-only prototype (Phase 1)

The first prototype can be entirely frontend:

- User enters a URL in the editor.
- Frontend calls a **fetch provider** (e.g., a serverless function or third-party API) that returns page metadata + user-visible text.
- Frontend sends the text to an **AI suggestion provider** for summary, translation, tags.
- Frontend presents the draft to the user for review/edit.
- Frontend saves the moment via existing LoveBud API (`POST /moments` or equivalent).

### 5.2 Backend / API requirements for expansion

- Fetch provider route or serverless function (e.g., Cloudflare Worker / Pages Function)
  - Accepts a URL, returns title, description, user-visible text, OG metadata
  - Rate-limited per user / per IP
  - Blocked for prohibited domains
- AI suggestion provider route or function integration
  - Accepts text + language, returns summary, translation, emotion tags
  - Model cost tracking
- Storage model for Scout drafts (if separate from moments)

### 5.3 Rate limiting

| Limit | Suggested value |
|-------|----------------|
| Fetches per user per hour | 20 |
| AI suggestions per user per hour | 20 |
| Total drafts per user per day | 50 |
| Concurrent fetches per user | 1 |

### 5.4 Storage model questions

See section 6 below. Initial approach: store Scout output as a regular LoveTree moment with additional optional metadata (source URL, fetch timestamp, AI-generated fields). No separate Scout-specific table needed for Phase 1.

### 5.5 Existing schema connection

LoveTree moments already have:
- `id`, `tree_id`, `title`, `memo`, `emotion_tags`, `created_at`, `updated_at`
- `source_url` field (may need to be added or reuse existing link field)
- `is_ai_generated` flag (may need to be added)

The Scout moment fits into this schema with minimal additions.

---

## 6. Data Model Questions

| Question | Decision needed | Suggested answer |
|----------|----------------|------------------|
| Should Scout drafts be separate from saved moments? | Yes — user can discard without creating a moment | Store drafts in memory or `localStorage`; saved moments go to API |
| Should source URL be stored? | Yes — attribution and user reference | Add `source_url` field to moment schema if not present |
| Should summary/translation be stored separately from memo? | Concatenate or store in memo with labeling | `memo` can hold "Summary: ...\nTranslation: ..." or use a structured field |
| Should AI-suggested tags be distinguished from user-edited tags? | Optional — user overwrites before save | `emotion_tags` stores the final (user-edited) value |
| Should AI-generated content be flagged? | Yes — for debugging and quota tracking | Add `generated_by: "scout-v1"` or `is_ai_generated: true` field |
| Should attribution be displayed in the moment? | Yes — source link visible in moment detail | Already covered by `source_url` field |

---

## 7. Implementation Phases

```
Phase 0: [THIS AUDIT] — Boundary, policy, scope definition
  Output: this document, issue #1882 refinement, sub-issues for Phase 1

Phase 1: Manual Link + User-Entered Text MVP
  - User pastes a URL or pastes text directly
  - No fetch provider yet — user provides the text themselves
  - AI suggestion generates summary, translation, tags from user-provided text
  - User reviews and saves as LoveTree moment
  - Existing API, no schema changes
  - Feature-flag gated

Phase 2: Metadata Extraction
  - Fetch provider integrated (serverless function)
  - URL → metadata + user-visible text extraction
  - Rate limiting applied
  - Prohibited domain blocking

Phase 3: AI Summary / Tag Suggestion
  - AI provider integrated for summary, translation, emotion tag generation
  - Model cost tracking
  - Fallback behavior when AI is unavailable

Phase 4: Save-to-LoveTree Integration
  - Full Scout flow inside editor
  - source_url stored
  - is_ai_generated flag
  - Draft persistence (localStorage)
  - Edit-before-save UX complete
```

---

## 8. Acceptance Criteria for Moving to Implementation

Before any code is written for Phase 1, the following must be confirmed:

- [ ] **MVP scope confirmed** — Phase 1 is "manual paste, AI suggestion, edit, save". No fetch provider yet.
- [ ] **Prohibited sources confirmed** — Explicit list of domains/content types that Scout will never fetch.
- [ ] **Storage policy confirmed** — What is stored, what is not stored, retention policy for drafts.
- [ ] **UI entrypoint confirmed** — Where in the editor the Scout button/paste zone appears.
- [ ] **API boundary confirmed** — Use existing moment creation API, no new endpoints needed for Phase 1.
- [ ] **Feature flag confirmed** — Scout is behind a feature flag, off by default for Phase 1 testing.
- [ ] **Implementation sub-issues created** — One issue per Phase, each scoped to a single deployable PR.

---

## References

- [#1882 Original product issue](https://github.com/skerishKang/LoveBud/issues/1882)
- [#2200 This audit sub-issue](https://github.com/skerishKang/LoveBud/issues/2200)
- `docs/product/MVP_SCOPE.md` — existing LoveBud MVP scope
- `docs/product/PRODUCT_IDENTITY.md` — existing product identity docs
- `docs/product/VISIBILITY_AND_PRIVATE_STORAGE_POLICY_REVIEW.md` — storage policy precedent
