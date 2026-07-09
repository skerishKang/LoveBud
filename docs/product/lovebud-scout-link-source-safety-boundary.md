# LoveBud Scout MVP Link-Source Safety Boundary

## 1. Purpose

Scout MVP is a LoveBud-native, user-provided public-link assistant that helps fans turn a public link into a translated, summarized, emotionally tagged LoveTree memory draft. The stronger product framing is a fan assistant, not a standalone translation app: a fan pastes a public link, LoveBud summarizes and translates the key points, suggests fan-relevant context and emotion tags, and lets the user save the result into their own LoveTree.

This document exists to define the **source / copyright / platform / storage boundary** for the first Scout MVP **before any implementation begins**. It is a safety and product boundary document, not an implementation document. It does not contain runtime code, fetcher logic, crawler logic, provider wiring, UI, CSS, schema, or migration.

The first implementation slice must remain a user-provided public-link assistant. It must not become a crawler, a scraper, a reposting system, or a copyright-bypass tool.

## 2. Allowed first-slice sources

The following are allowed as *source categories* for the first slice. They are listed as allowed categories only; the first slice must not fetch or request them automatically.

- public official notices
- public news article pages where a short summary and the source link are acceptable
- public YouTube metadata or user-visible page metadata, only if explicitly allowed by platform policy and by a later reviewed implementation path
- public RSS / news feed metadata, only if later reviewed against platform policy
- user-provided links only — Scout never discovers or auto-collects links on its own

Allowed means "eligible for a later reviewed implementation path", not "fetch now". Every allowed category above still requires the implementation gates in section 6 before any code fetches it.

## 3. Disallowed or blocked first-slice sources

The following are disallowed or blocked for the first slice:

- account-authenticated pages
- private communities
- paywalled content
- Weverse / Instagram / X / TikTok scraping unless an allowed official API or path is explicitly reviewed and accepted later
- full article copying
- full transcript copying
- lyrics copying
- image / video rehosting
- automated broad crawling
- monitoring dashboards
- impersonation or official partnership claims

If a platform later offers an official, policy-compliant API or path, it must be reviewed as a new implementation gate before it becomes allowed. Absence of an allowed official path means the source stays blocked.

## 4. Content handling boundary

### 4.1 What may be stored

- original source link
- short title or source label
- short generated summary
- short translated summary
- fan-relevant points
- emotion tags
- user-editable LoveTree memory draft
- timestamp of the user save action, only if existing product patterns already support it

Stored content must be the user's own editable draft, derived from a link the user provided, not a copy of the source.

### 4.2 What must not be stored

- full article text
- full social post text where policy or copyright risk exists
- full video transcript
- lyrics
- images or video files copied from the source
- raw scrape payloads
- private identifiers
- platform auth or session data

If a field is not in section 4.1, it is out of scope for storage in the first slice.

## 5. Attribution and user-facing requirements

- Always show the original source link.
- Make clear the memory draft is generated and user-editable.
- Do not imply official endorsement.
- Provide a way for the user to edit before saving.
- Do not hide the source behind generated text.

Generated content must be traceable back to the user-provided link. The source link is the source of truth for provenance; generated text is a draft, not a replacement for the source.

## 6. Implementation gates

Before any code implementation (fetcher, provider, storage, or UI), all of the following must be reviewed and accepted:

- source category selected
- allowed access path reviewed
- storage fields defined
- copyright / platform risk reviewed
- no private or authenticated content path
- safe error behavior defined
- rate-limit / quota plan defined
- user deletion / editing path considered
- tests planned

No fetcher or provider code may be written until these gates are accepted. This document is a prerequisite, not the implementation itself.

## 7. Explicit non-goals

- generic translation app
- full content archive
- reposting tool
- crawler
- social monitoring dashboard
- platform-authenticated scraper
- copyright bypass
- social likes / comments work
- #3361 / #3188 / #3075 work

These non-goals are hard boundaries for the first slice. Social likes/comments and the tree-level social runtime/client tracks (#3361, #3188, #3075) are explicitly out of scope for Scout MVP boundary work.

## 8. Suggested first child implementation after this doc

A later child issue may propose the first implementation prototype:

`[Scout][MVP] Prototype manual link-to-memory draft flow behind feature flag`

That later issue should remain blocked until this safety boundary is accepted. This document does not create that implementation issue; it only defines the boundary that must be accepted first.

## 9. Cross-links

- Refs #1882
