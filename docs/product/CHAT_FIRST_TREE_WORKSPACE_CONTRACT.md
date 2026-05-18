# Chat-First Tree Workspace Contract

## Status

- **Experimental concept** — not runtime default, not replacing current editor
- Based on [Issue #1321](https://github.com/skerishKang/LoveBud/issues/1321)
- Image mockups in [`docs/image-gpt/`](../image-gpt/) for layout and mood reference only
- This document is a **product/UX contract**, not an implementation instruction
- Follow-up isolated UI shell PRs must stay within the scope defined here

## Background

- The current editor assumes users already understand trees, moments, and branches. This creates a barrier for new users.
- Goal: lower the entry burden by making the **first interaction conversation-driven**.
- After a conversation starts, the UI expands into a tree/moment workspace.
- **Not a GPT UI clone** — the core value is connecting conversational input to LoveBud's tree/moment/branch structure.
- The concept image set (`chat-first-desktop-start.png`, `chat-first-desktop-workspace.png`, etc.) visualises this flow. The specific copy in those images is placeholder, not final product copy.

## Core Principles

1.  **Conversation is an entry point, not the destination.** The result must be visualised as tree/moment/branch structures.
2.  **Must not look like a simple diary app.**
3.  **Must not look like a fan-dedicated app** (e.g., celebrity fandom use only).
4.  Core interaction domains: **relationships, moments, memories, choices, pattern exploration**.
5.  First implementation must be an **isolated UI shell with mock data**.
6.  Existing editor and runtime are **not changed** by this work.
7.  All mockup images in `docs/image-gpt/` are **layout/atmosphere references only** — their copy is not final.

## Desktop UX

### Entry State

- Centered conversation card
- Short guidance text
- Input field
- 3–4 suggested actions (e.g., "start a new tree", "continue a tree", "explore moments")

### After First Input

| Area | Proportion | Content |
|------|-----------|---------|
| Left workspace | ~80% | Tree/moment search, current tree summary, moment browser, tree visualisation, selected moment card |
| Right chat panel | ~20% | Conversation history, suggestions/questions, input field |

### Transition Triggers

- First message submitted
- Suggested action clicked
- "Continue existing tree" selected

## Mobile UX

- **No 8:2 split** — that layout does not fit mobile screens.
- Default state: conversation-centric.
- Navigation via **tabs or segmented control**:
  - Chat
  - Tree
  - Moments
- Bottom sheet may be used for expanded views.

### Default State

- Chat area: 70–80% of screen
- Thin strip at bottom showing current connected moment summary

### Expanded State

- Bottom sheet reveals moment card + mini tree visualisation
- `chat-first-mobile-workspace.png` represents the **expanded state**, not the default state

## Image Interpretation Rules

1.  Image files in `docs/image-gpt/` are **layout and mood references only**.
2.  Text/copy inside images is **not final product copy**.
3.  Do not reproduce the diary-style conversation shown in images exactly — actual conversations must connect to tree creation, moment addition, moment search, branch proposals, and pattern analysis.
4.  Final copy requires separate design work.

## MVP Scope

- **Mock data only** — no real DB or API integration
- **No real AI/LLM analysis**
- Conversation input triggers UI transition
- Desktop split layout (80/20)
- Mobile tab / bottom sheet layout
- Display tree/moment/branch examples
- Static search UI or fake filtering allowed
- **No save/edit/delete** functionality

## Out of Scope

- Replacing the current editor
- Changing the public viewer
- DB schema changes
- `modal_compute` / API changes
- Auth changes
- Actual billing/paywall implementation
- Actual AI/LLM connection
- Production default route changes
- Using issue close keywords (`close`, `fix`, `resolve`, etc.)

## Monetisation Potential (Evaluation Only — Not Implemented)

- AI relationship record workspace
- Relationship flow analysis mode
- Advanced moment search / summarisation mode
- Branch proposal and retrospection mode
- Interactive tree exploration screen for paid users
- **Decision on monetisation deferred until UX experimentation is complete**

## Acceptance Criteria

- [x] Contract exists at `docs/product/CHAT_FIRST_TREE_WORKSPACE_CONTRACT.md`
- [x] Issue #1321 context and PR #1322 image set are referenced
- [x] Desktop and mobile UX are defined separately
- [x] Image reference status is clearly documented
- [x] MVP scope and out-of-scope items are clear
- [x] No existing runtime, backend, schema, or test files are affected
