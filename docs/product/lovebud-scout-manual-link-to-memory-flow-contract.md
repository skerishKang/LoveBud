# LoveBud Scout MVP Manual Link-to-Memory Draft Flow Contract

## 1. Purpose

This document defines the **manual link-to-memory draft flow contract** for the first Scout MVP slice. It is a contract-only definition: it establishes the user-facing flow and the safety boundary for turning a user-provided public link into an editable LoveTree memory draft.

It contains no runtime code, no fetcher, no crawler, no scraper, no provider wiring, no UI, no CSS, no schema, and no migration. Implementation remains blocked until the gates in this document and in the inherited safety boundary are accepted.

This contract is the child of the Scout link-source safety boundary (#3364 / #3365) and the parent Scout product issue (#1882). It must be read together with those documents.

## 2. Scope

In scope for this contract:

- the ordered user flow from pasting a public link to reviewing and saving a draft
- the allowed flow states and their transitions
- the required visible fields on the review surface
- the edit-before-save requirement
- the source attribution / provenance rule
- the blocked-source states
- the storage boundary inherited from #3365

Out of scope for this contract: any implementation, any automatic fetching, any provider calls, and any UI code. Those require separate, later-reviewed implementation issues.

## 3. Inherited safety boundary (#3365 / #3364)

This flow contract **inherits** the Scout MVP link-source safety boundary defined in `docs/product/lovebud-scout-link-source-safety-boundary.md` (#3364 / #3365, parent #1882). Every rule below is subordinate to that boundary.

In particular, this flow must:

- accept **only manual, user-provided public links**
- perform **no crawler, no scraper, and no automatic source discovery**
- store only the fields allowed in the #3365 content-handling boundary (section 4.1)
- never store the fields forbidden in #3365 (section 4.2)
- respect the #3365 blocked-source categories and implementation gates

If this contract and #3365 ever disagree, #3365 wins.

## 4. Core constraints

### 4.1 Manual user-provided public link only

The only input to this flow is a link the user pastes or types themselves. Scout never discovers, suggests, or auto-collects links.

### 4.2 No crawler / no scraper / no automatic source discovery

The flow must not crawl, scrape, or auto-discover any source. There is no background fetch, no link graph, and no monitoring. The link is inert until the user explicitly submits it for validation.

### 4.3 Feature-flag or prototype gating expectation

This flow must ship behind a feature flag or prototype gate. It must not be reachable in production unless the gate is explicitly enabled through a later reviewed activation path. The gate is a hard prerequisite; absence of an enabled gate means the flow is not active.

## 5. Flow states

The flow moves through the following explicit states. Each state has a defined entry condition and the allowed next states.

- `empty` — no link submitted yet. Next: `validating` (on user submit).
- `validating` — the submitted link is being checked for public-link eligibility and basic safety. Next: `unsupported source`, `ready-to-review`, or `safe error / retry`.
- `unsupported source` — the link is recognized but not eligible under the #3365 boundary (for example a platform without a reviewed allowed path). Terminal until the user submits a different link; next: `validating`.
- `ready-to-review` — the link passed basic eligibility and the generated draft fields are available for the user to inspect. Next: `save-ready` (after edit-before-save review), `validating` (new link), or `safe error / retry`.
- `save-ready` — the user has reviewed and edited the draft and chosen to save. Next: persisted memory draft, or `safe error / retry` on failure.
- `safe error / retry` — a recoverable failure occurred (network, transient validation, or save failure). The user may retry or submit a different link. No raw error detail is shown.

Transitions must never jump from `empty` to `ready-to-review` or `save-ready` without passing through `validating`. `unsupported source` and `safe error / retry` must not expose raw/private detail.

## 6. Required visible fields

On the review surface (`ready-to-review` and `save-ready`), the following fields must be visible to the user:

- original source link
- short source label / title
- short summary
- translated summary
- fan-relevant points
- emotion tags
- editable LoveTree memory draft

All generated fields must be clearly presented as generated and editable, not as source content. The original source link remains visible and is the source of truth for provenance.

## 7. Edit-before-save requirement

The user must be able to edit the draft before saving. The flow must not save automatically. `save-ready` is reachable only after the user has had the opportunity to edit the editable LoveTree memory draft and the other generated fields. Editing is a required step, not an optional one.

## 8. Source attribution / provenance

- The original source link is always shown.
- The memory draft is clearly marked as generated and user-editable.
- No official endorsement is implied.
- The generated draft is traceable back to the user-provided link.
- The source link is the provenance source of truth; generated text is a draft, not a replacement for the source.

## 9. Blocked states

The flow must move into a blocked state (shown to the user with safe copy only) when the submitted link falls into any of the following categories inherited from #3365:

- `private` — private or account-only content
- `authenticated` — requires login / session
- `paywalled` — paid or metered access
- `platform-risk` — platform policy or copyright risk without a reviewed allowed path
- `full-content archive risk` — risk of full-text / full-transcript / full-media archival

Blocked states must not fetch, store, or surface the blocked content. They must not expose raw/private detail.

## 10. Storage boundary (inherited from #3365)

Stored content is limited to the #3365 allowed set: original source link, short title or source label, short generated summary, short translated summary, fan-relevant points, emotion tags, and the user-editable LoveTree memory draft.

The following must not be stored: full article text, full social post text where risk exists, full video transcript, lyrics, copied images or video, raw scrape payloads, private identifiers, or platform auth/session data.

The stored result is the user's own editable draft derived from a link they provided, not a copy of the source.

## 11. Safe error copy only

Every error shown to the user must be safe copy: non-technical, non-leaking, and free of raw error messages, stack traces, URLs with secrets, tokens, cookies, session values, or any private identifier. Retry is offered without exposing the underlying failure detail.

## 12. Explicit non-goals

- generic translation app
- crawler / scraper / automatic source discovery
- reposting tool
- full content archive
- copyright bypass
- provider / LLM wiring
- Firebase / auth / runtime changes
- DB schema / migration
- storage implementation
- production smoke against real platforms
- real YouTube / Instagram / X / Weverse / news requests
- social likes / comments work
- #3188 / #3075 work

## 13. Cross-links

- Refs #3373
- Refs #1882
- Refs #3365
- Refs #3364
