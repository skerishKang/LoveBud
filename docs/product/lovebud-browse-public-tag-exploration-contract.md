# LoveBud Browse Public Tag Exploration Contract

## Status and scope
This document serves as an audit and planning contract for the future implementation of public tag exploration on the LoveBud Browse (Search) page.
* **Status**: Proposed/Planning Contract (No active code implementation in UI, API, or database schema has been introduced in this slice).
* **Scope**: This contract maps the current public tag source fields, defines the boundaries between public and owner-only metadata, establishes the URL query contracts, outlines the tag normalization policies, defines keyboard/accessible UX specifications, and proposes the next backend API implementation prerequisites.
* **Non-Goals**: No DB/API/schema/UI code implementation is included in this phase. No Scout work is authorized or performed.

## Current public tag source audit
Based on our codebase audit of [search-public-metadata-helper.js](file:///mnt/g/Ddrive/BatangD/task/workdiary/LoveBud-3123-public-tag-contract/js/search/search-public-metadata-helper.js#L86-L117) and [public-tree-adapter.js](file:///mnt/g/Ddrive/BatangD/task/workdiary/LoveBud-3123-public-tag-contract/js/api/public-tree-adapter.js#L210-L211):
* **Source Fields**: The Browse card currently extracts tags from `tree.emotionTags` and `tree.tags` via the helper method `getPublicTags(tree)`.
* **Summary Payload Dependency**: Rendering the public tag chips on the Browse cards is fully supported by the existing public tree summary payload (no memories hydration/preloading is required for showing the tags in the list view).
* **Missing/Invalid Values Handling**: Empty, null, or whitespace-only tags are skipped. Standard filters strip leading `#` characters and discard tags matching raw internal identities (UUID-like structures, owner strings) or internal markers (starting with `__`).

## Explicit owner-only metadata exclusion
* **Excluded Fields**: The fields `groupName` (and legacy `group_name`) and `keywords` introduced in `Refs #2882` are strictly categorized as owner-only metadata and MUST NOT be exposed or utilized in any public tag exploration features.
* **Integrity Guardrail**: Under no circumstances should owner-only metadata be leaked to public search pages, card components, filter states, or URL query parameters.

## Public eligibility and privacy boundary
* **Privacy Enforcement**: Only public trees (`visibility = 'public'`) and their corresponding public moments/memories can be exposed in tag searches.
* **Server-Side Safety**: Any future implementation must guarantee public eligibility at the database query level on the server to prevent data leakage of private trees or private memories.

## Canonical URL contract
We propose the addition of a new query parameter to manage tag filtering, keeping it separate from search queries:
* **Proposed Parameter Key**: `tag`
* **Canonical URL Example**: `https://lovebud.pages.dev/pages/search.html?tag=설렘`
* **Casing**: Encoded and normalized values (e.g. URI-encoded string of the normalized tag).

## Tag normalization contract
To prevent index fragmentation, tag exploration must enforce the following normalization rules:
1. **Trim**: Remove leading and trailing whitespace.
2. **Whitespace Collapsing**: Replace consecutive internal spaces with a single space ` `.
3. **Leading Hash**: Strip any leading `#` symbol.
4. **Unicode Normalization**: Apply Unicode Normalization Form C (`NFC`) to unify decomposed characters.
5. **Casing**: Normalize comparisons using lowercase representation internally, while preserving the casing of the first encountered tag variation for UI display.
6. **Maximum Length**: Restrict tag values to a maximum length of 30 characters.
7. **XSS Protection**: All tags rendered in HTML MUST be properly escaped via `escapeHtml()` to prevent injection.

## Search, sort, clear, back/forward behavior
* **Selection State**: Clicking a tag chip updates the `tag` URL search param and marks the chip as active.
* **Clear State**: A clear button or clicking the active tag chip again removes the `tag` parameter from the URL and resets the filter state.
* **Back/Forward Navigation**: The browser's back and forward buttons must trigger standard `popstate` handling, restoring the tag search state directly from the URL query params.
* **Query Hierarchy**: When both general text query `q` and `tag` are present, they should behave as an intersection (AND) filter.
* **Sort Preservation**: Existing sorting options (`sort=latest`, `sort=popular`, `sort=views`, `sort=likes`) must be preserved when tags are toggled.

## Accessibility and keyboard behavior
* **Interactive Elements**: Tag elements on cards must be structured using HTML5 button elements or custom elements with `role="button"` and `tabindex="0"`.
* **Accessible Name**: Tag chips must expose a clear accessible name (e.g., `aria-label="태그 #설렘 탐색"`).
* **Keyboard Handler**: Toggling tag chips must support activation using the `Enter` and `Space` keys.

## Empty, loading, and failure states
* **Loading State**: While fetching tag-filtered trees, the results grid must show the standard skeleton grid.
* **Empty State**: If no trees match the selected tag, a distinct empty state must invite the user to reset filters.
* **Failure State**: If the network fetch fails, it must fallback cleanly without crash and display a graceful error state.

## API and pagination feasibility
* **Current Backend Limitation**: The current public summary API query in [public_reads.py](file:///mnt/g/Ddrive/BatangD/task/workdiary/LoveBud-3123-public-tag-contract/modal_compute/public_reads.py#L212-L252) does not support database-level tag filtering.
* **Client-Side Filtering Pitfalls**: Filtering on the client side is highly inefficient and incorrect for pagination because it can only filter the limited set of retrieved summary trees (low coverage, broken page sizes, and potential privacy leaks).
* **Required Data Contract**: The backend `/api/community/trees` endpoint must accept a `tag` query parameter and perform server-side database filtering (`WHERE ...`).

## Explicit non-goals
* No UI tag click handler execution.
* No backend or middleware API parameter integration code in this planning phase.
* No DB schema modifications or SQL migration scripts.
* No Scout token or provider transport work.

## Narrow follow-up implementation slice
To proceed safely, the immediate follow-up task should be:
* **Focus**: Backend: Implement `tag` query parameter support in `modal_compute/public_reads.py` (specifically within the SQL queries of `fetch_latest_public_tree_snapshots`) to enable database-level tag filtering before any UI changes are made.

## Test and production-validation plan
* **Contract Test**: Run node-based assertions on file paths, manifest properties, and the existence of this exploration contract document.
* **Staging Verification**: Deploy to a Cloudflare Pages preview branch, populate staging DB with mock trees containing tags, and test URL param query validation.

## References
* Refs #3123 (Browse tag search planning)
* Refs #2981 (Public metadata helpers)
* Refs #3121 (Tree summary API contract)
* Refs #2882 (Owner-only metadata boundaries)
* Refs #1882 (Browse page URL state management)
