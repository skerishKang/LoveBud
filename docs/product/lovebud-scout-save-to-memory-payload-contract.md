# LoveBud Scout MVP Save-to-Memory Payload Contract

## 1. Purpose

This document defines the **save-to-memory payload contract** for the Scout MVP manual link-to-memory flow. It is the next step after the manual link-to-memory draft flow contract (#3373 / #3375): once a user has reviewed and edited a Scout draft, this contract fixes the *shape* and *safety boundary* of the payload that gets saved as a LoveTree memory draft.

It is a contract-only definition. It contains no runtime code, no UI, no route, no fetcher, no crawler, no scraper, no provider wiring, no Firebase/auth/runtime change, no DB schema/migration, no storage implementation, and no production smoke. Implementation remains blocked until the gates in this document and in the inherited boundaries are accepted.

This contract is a child of the parent Scout product issue (#1882) and inherits the manual link-to-memory flow contract (#3373 / #3375) and the link-source safety boundary (#3364 / #3365). It must be read together with those documents.

## 2. Inherited boundaries

This payload contract is subordinate to:

- the link-source safety boundary (#3364 / #3365) — source/content/storage/attribution rules
- the manual link-to-memory draft flow contract (#3373 / #3375) — states, visible fields, edit-before-save, blocked states

If this contract disagrees with #3365 or #3375, those documents win.

## 3. Draft-to-memory payload shape

The payload carried from a reviewed Scout draft into a LoveTree memory draft is a plain object with two clearly separated groups (see section 4):

- `generated` — suggestion fields produced by Scout from the user-provided link
- `reviewed` — fields the user actually accepted/edited and that are saved

The saved memory draft is built only from `reviewed`. The `generated` group is the source of the suggestion; it is not the save record by itself.

Illustrative shape (no implementation, names are contract-only):

```
{
  generated: {
    sourceLink,
    sourceLabel,
    summary,
    translatedSummary,
    fanContext,
    emotionTags,
    draftText
  },
  reviewed: {
    sourceLink,
    sourceLabel,
    summary,
    translatedSummary,
    fanContext,
    emotionTags,
    memoryDraft
  }
}
```

## 4. Generated suggestion vs user-reviewed save

- **generated suggestion fields** are Scout-produced values shown to the user for review. They may be edited or discarded.
- **user-reviewed save fields** are the values the user explicitly accepted or edited before pressing save.
- Only `reviewed` fields are persisted. `generated` is advisory only.
- A field absent from `reviewed` after review must not be synthesized into the saved memory draft by the save layer.

This separation prevents silent promotion of unedited generated content into the saved record.

## 5. Required / optional / forbidden fields

### 5.1 Required

- `sourceLink` (original user-provided public link)
- `sourceLabel` (short source label / title)
- `memoryDraft` (user-editable LoveTree memory draft text)

### 5.2 Optional

- `summary` (short generated summary)
- `translatedSummary` (short translated summary)
- `fanContext` (fan-relevant points)
- `emotionTags` (emotion tags)

### 5.3 Forbidden

- full article text
- full social post text where policy or copyright risk exists
- full video transcript
- lyrics
- images or video files copied/rehosted from the source
- raw scrape payloads
- private identifiers
- platform auth or session data
- any raw/private value (see section 9)

## 6. Source link preservation

The original `sourceLink` provided by the user must be preserved verbatim in the saved payload. It is the provenance source of truth. The save layer must not rewrite, shorten, or replace it with generated text.

## 7. Source attribution visibility

The saved memory draft must keep the source visible and attributable:

- the original source link is shown
- the draft is marked as generated and user-editable
- no official endorsement is implied
- generated content is traceable back to the user-provided link

## 8. Content storage prohibitions

The following must not be stored in the payload or in any derived memory record:

- full scraped content
- full article / full post / full transcript / lyrics / paywalled content
- image / video rehosting (no copied media)
- any field outside section 5.1 / 5.2

Storage is limited to the #3365 allowed set: original source link, short title or source label, short generated summary, short translated summary, fan-relevant points, emotion tags, and the user-editable LoveTree memory draft.

## 9. No raw / private values

The payload and the contract must never contain:

- raw/private IDs
- tokens
- cookies
- auth headers
- API base URLs
- dashboard URLs
- DB rows
- private logs
- request / response bodies

Safe error copy only: no raw error detail, stack trace, secret, or private identifier is ever placed into the payload or shown to the user.

## 10. Summary / translation / fan-context / emotion-tag mapping

The generated `summary`, `translatedSummary`, `fanContext`, and `emotionTags` map into the `reviewed` memory draft only through explicit user review/edit. Mapping is a copy-into-draft step, not a storage of source content. None of these fields may carry full source content.

## 11. User review / edit requirement before save

Saving is allowed only after the user has reviewed and (where applicable) edited the `reviewed` fields. The save layer must not auto-save generated content without review. This inherits the edit-before-save requirement from #3375.

## 12. Safe text length and truncation posture

All generated/reviewed text fields have a safe maximum length. When a field exceeds the limit, it is truncated with safe copy (no mid-token leakage of private data) and the user is given the chance to edit before save. Truncation must never produce or retain raw/private values.

## 13. Behavior prohibitions (no implementation signals)

This contract defines no behavior, only boundaries:

- no crawler behavior
- no scraper behavior
- no fetcher behavior
- no provider behavior
- no LLM provider wiring
- no Firebase change
- no auth change
- no runtime change
- no storage implementation
- no DB schema change
- no production smoke
- no real platform request (no real YouTube / Instagram / X / Weverse / news request)

## 14. Future implementation handoff boundaries

When implementation begins later, it must be split into separate child issues, each gated and reviewed:

- UI child — renders review surface and edit controls
- route child — server/client entry that accepts the reviewed payload
- storage child — persists only the allowed #3365 fields
- provider / fetcher child — only if ever explicitly allowed and reviewed later, behind its own gate

Each child must re-accept this payload contract and the inherited #3365 / #3375 boundaries before code is written.

## 15. Explicit non-goals

- generic translation app
- crawler / scraper / automatic source discovery
- reposting tool
- full content archive
- copyright bypass
- provider / LLM wiring
- Firebase / auth / runtime changes
- DB schema / migration / storage implementation
- production smoke against real platforms
- real platform requests
- social likes / comments work (#3188 / #3075 out of scope)

## 16. Cross-links

- Refs #3379
- Refs #1882
- Refs #3373
- Refs #3375
- Refs #3364
- Refs #3365
- Refs #3188
- Refs #3075
