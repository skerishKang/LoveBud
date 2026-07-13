# LoveBud Canonical Appreciation Boundary Audit

## Baseline

| Field | Value |
| --- | --- |
| Issue | #3475 |
| Parent product issue | #1882 (keep OPEN) |
| Related social issues | #3075 moment-level (keep OPEN), #3188 tree-level (keep OPEN) |
| Audit type | Docs-only architecture / permission boundary audit |
| Current main SHA | `19141b5b9a3c11e79082540f8ba83f540d833017` |
| Includes merged PR | #3487 `feat(editor): clarify authoring shell state` |
| Stale PR reference only | #3469 head `8c69e62f126d64d0788d11f1fd77f7c27882a5d0` (CLOSED; no merge / no cherry-pick) |
| Runtime change in this PR | **None** |
| DB / SQL / migration requirement | **None** |

### Issue status requirements (this audit and successors)

- Keep **#3475 OPEN** until implementation slices land and Production visual verification is complete.
- Keep **#3075 OPEN**.
- Keep **#3188 OPEN**.
- Keep **#1882 OPEN**.
- Do **not** use `Closes` / `Fixes` / `Resolves` for #3475, #3075, #3188, or #1882 in this audit PR.

### Product decision (locked for implementation)

```text
Access state:      public | private
Interaction mode:  appreciation | edit
```

- `public` / `private` is **access / visibility**, not an interaction mode.
- Public Viewer route remains a separate public-safe entry surface.
- Editor appreciation (`data-editor-interaction-mode="view"`) and Public Viewer selected-moment UI should converge on **one canonical appreciation presentation grammar**.
- Editor authority, owner mutation handlers, private payload access, and Editor bootstrap must **not** be shared into Public Viewer.

### Shareable vs forbidden (locked)

| Shareable | Forbidden to share |
| --- | --- |
| selected-moment information architecture | Editor authority |
| presentation grammar | owner mutation handlers |
| safe display DTO mapping | edit / continue / connect / delete controls as shared defaults |
| empty / loading / error presentation states | private payload access |
| capability-driven display flags (route-computed) | owner-only state globals |
| pure presentation helpers | Editor route bootstrap |

---

## Executive summary

LoveBud currently expresses non-editing tree inspection through two routes:

1. **Public Viewer** — `pages/view.html` + `js/viewer/public-viewer-*`
2. **Editor appreciation** — `pages/editor.html` + Editor detail view templates under interaction mode `view`

They already share CSS class names and a similar selected-moment card skeleton, but they diverge in hierarchy completeness, knowledge/context surface, social write readiness, owner action chips, and data loaders.

PR **#3487** (now on main) closed several Editor-side authoring/appreciation boundary gaps (explicit mode toggle, edit-only floating toolbar, connect fail-closed, form inert, truthful tree metrics). It does **not** by itself unify Public Viewer presentation with Editor appreciation.

PR **#3469** remains a **stale closed PR**. Its Viewer findings are classified below as reference only. Whole-merge and cherry-pick of #3469 are forbidden.

This audit freezes the safe shared boundary and proposes five small implementation slices with explicit issue ownership.

---

## Evidence and methodology

- Read-only inspection of current `origin/main` at SHA above.
- Source files, templates, route pages, adapters, and focused contracts.
- No Production login, no Firebase token use, no tree/memory/comment/reaction writes.
- No runtime, CSS, HTML, template, API, Auth, Modal, SQL, or migration edits in this audit PR.
- Stale PR #3469 inspected via GitHub metadata and file list only (no checkout of that head into this worktree).

---

## A. Canonical appreciation structure

**Canonical reference:** Editor appreciation hierarchy (selected-moment detail view mode), not Public Viewer’s currently sparser template.

Product language uses **appreciation**; Editor runtime currently stores interaction mode as `view` / `edit` on `document.body[data-editor-interaction-mode]`.

### Structure inventory

| Component | Role in canonical appreciation | Editor source (current) | Public Viewer source (current) | Notes |
| --- | --- | --- | --- | --- |
| selected moment identity | title, badge, selected-node identity | `js/editor/templates/editor-detail-view-mode-template.js` (`#detailCurrentMomentTitle`, `#detailCurrentMomentBadge`); `js/editor/editor-detail-ui.js` / builders | `js/viewer/public-viewer-detail-view-mode-template.js`; `js/viewer/public-viewer-detail-ui.js` | Same DOM id family; badge copy differs |
| media / playback | thumbnail + play overlay | same Editor template `#detailImg` / `.play-btn`; Editor detail image boundary | Public Viewer detail image boundary in `public-viewer-detail-ui.js` | Shared visual grammar; separate update code |
| remembered date | “기억한 날” | `#detailDateText` in Editor template | `#detailDateText` in Viewer template | Shared field id |
| emotion tags | tag chips | `#detailTags` | `#detailTags` | Shared field id |
| connected context / knowledge | “연결된 지식” | `#detailEntitySearchMount` + knowledge UI modules | **Absent** from Viewer view-mode template | Major hierarchy gap |
| emotion memo | diary note | `#detailMemo` | `#detailMemo` | Shared field id |
| moment-level social | likes / comments on selected moment | `#momentReactionsCard` + Editor moment social runtime | `#momentReactionsCard` + `public-viewer-read-only-social-summary.js`, authenticated like/comment modules | Different control model; #3075 ownership |
| selected-node state | canvas selection drives detail | Editor canvas selection + detail orchestrator | Public canvas selection + public detail orchestrator | Route-owned selection state |
| loading / empty / error | empty guide / empty detail / load failures | Editor empty templates + shell | Viewer empty templates + public canvas error fallback | Presentation candidates; loaders route-owned |
| tree context / sidebar | tree title, flow summary, metrics | `js/editor/templates/editor-sidebar-template.js` | `js/viewer/templates/public-viewer-sidebar-template.js` | Different ownership/back links; tree social #3188 |
| owner authoring actions | edit / continue / connect | `#editMemoryBtn`, `#continueFromMomentBtn`, connect sections | not present (correct) | **EDITOR_AUTHORITY_ONLY** |

---

## B. Shared presentation candidate classification

Table headers required for implementation planning:

| component | Editor source | Viewer source | current divergence | safe shared boundary | authority risk | recommended action | classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| selected moment card shell | `editor-detail-view-mode-template.js` | `public-viewer-detail-view-mode-template.js` | Viewer missing knowledge block and action card; social markup differs | Pure markup + class grammar for identity/media/date/tags/memo | Low if no owner buttons | Converge Viewer hierarchy toward Editor shell without owner chips | SHARED_PRESENTATION_CANDIDATE |
| selected moment render model | Editor detail update paths | Public detail update paths | Parallel field mapping | Public-safe DTO: id, title, date, tags, memo, media urls, social counts | High if raw API row shared | Introduce pure render model + adapters | SHARED_RENDER_MODEL_CANDIDATE |
| media playback presentation | Editor detail image boundary | Public Viewer image boundary | Duplicated YouTube helpers | Display-only media model + play handler injection | Medium (XSS / unsafe URL) | Share sanitization/display helpers; keep player host route-owned | SHARED_PRESENTATION_CANDIDATE |
| knowledge / connected context | Editor knowledge UI | missing in Viewer template | Viewer omits section | Read-only knowledge display model if public payload allows | Medium (private entity leakage) | Public-safe display only after data audit | PUBLIC_SAFE_ONLY until payload proven |
| moment social summary | Editor moment social card | Viewer read-only summary + auth writers | Control ids and write paths differ | Counts + list presentation model | High if write bound into shared helper | Presentation only in #3475; writes stay #3075 | SHARED_PRESENTATION_CANDIDATE (read) / DO_NOT_SHARE (write) |
| tree-level social metrics | `#editorTreeReactions` + status boundary | tree-like / tree-comments modules + tree meta | Different mounts and readiness | Tree metric display model | High | Owned by #3188; not mixed into #3475 | ROUTE_SPECIFIC_ADAPTER / BELONGS_TO_3188 |
| edit / continue / connect | Editor templates + mode CSS + floating toolbar | n/a | Owner-only | none | Critical | Never import into Viewer | EDITOR_AUTHORITY_ONLY / DO_NOT_SHARE |
| interaction mode toggle | `editor-interaction-mode.js` + `editor.js` desktop toggle | Viewer owner “보기/편집” navigates to Editor | Product copy: appreciation vs public | Route-owned mode switch only | High | Keep Editor mode local; Viewer edit is navigation | ROUTE_SPECIFIC_ADAPTER |
| empty / loading / error presentation | Editor empty/guide templates | Viewer empty/error modules | Parallel copy | Status presentation states | Low | Share copy grammar optionally | SHARED_PRESENTATION_CANDIDATE |
| data loaders | Editor owner/private reads | Public tree adapter + public reads | Different payloads | none for shared module | Critical | Route-owned loaders only | DO_NOT_SHARE loaders |
| auth / tokens / Firebase user | Editor auth helpers | Viewer session for optional social write | Different needs | none | Critical | Never pass raw user/token into shared presentation | DO_NOT_SHARE |

---

## C. Permission matrix

Values describe **current implementation facts** observed in source, not product hopes.

Legend: `Y` allowed, `N` not allowed / not exposed, `P` partial / gated, `U` unknown / not verified in this audit.

| actor × capability | public data read | media play | reaction read | reaction write | comment read | comment write | edit | continue | connect | delete | visibility change | mode switch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| guest public viewer | Y public tree/memory via public path | Y | Y read-only summary | N guest note | Y list when loaded | N guest note | N | N | N | N | N | N |
| authenticated non-owner public viewer | Y public path | Y | Y | P auth like modules when enabled | Y | P auth comment composer when enabled | N | N | N | N | N | N |
| owner public viewer | Y public path (+ owner may also load private elsewhere) | Y | Y | P same public social modules | Y | P | N in Viewer | N | N | N | N in Viewer | P sidebar/top “편집” navigates to Editor |
| owner Editor appreciation (`view`) | Y owner tree load | Y | Y moment social UI present | P depends Editor social wiring / #3075 | Y | P | N controls hidden by mode CSS | N hidden | N hidden | N | N in appreciation UI | Y desktop 감상/편집 mode toggle |
| owner Editor edit (`edit`) | Y | Y | Y | P | Y | P | Y | Y | Y when CTA activatable | Y owner delete paths | Y tree visibility owner actions | Y |
| private tree owner | N Public Viewer for private trees (My Trees open routes private → Editor) | Y in Editor | Y in Editor | P | Y | P | Y in edit mode | Y | Y | Y | Y | Y |
| private tree non-owner / guest | N (no public payload) | N | N | N | N | N | N | N | N | N | N | N |

### Authoritative sources (permission)

| Concern | Authoritative source |
| --- | --- |
| Public route tree id | `js/viewer/viewer-route.js` (`treeId` query) |
| Public-safe browse/tree normalization | `js/api/public-tree-adapter.js` |
| Editor interaction mode | `js/editor/editor-interaction-mode.js` (`view`/`edit` only; invalid → `view`) |
| View-mode owner control hide | `css/editor/editor-mode-selection.css` selectors on `data-editor-interaction-mode="view"` |
| Floating toolbar edit-only | `js/editor/editor-floating-toolbar-visibility.js` (`interactionMode !== 'edit'`) |
| Connect fail-closed | `js/editor/editor-floating-toolbar-affordance.js` (`canActivateConnectButton`) |
| Viewer owner edit navigation | `js/viewer/public-canvas-init.js` (`canEdit` via `LoveBudTreeWorkspacePermission`) |
| Tree workspace can-edit | `js/shared/tree-workspace-permission.js` (referenced by Viewer init) |

---

## D. Route and entry matrix

| entry | current URL / target | current interaction mode | recommended target (product) | notes |
| --- | --- | --- | --- | --- |
| Browse card open | `view.html?treeId=…` via `search-card-renderer.js` | Public Viewer (appreciation only) | Public Viewer appreciation | Correct public-safe entry |
| Browse selected preview share link | `/pages/view.html?treeId=…` via `search-share-link.js` | Public Viewer | Public Viewer | Canonical shared link |
| Browse selected preview (in-page) | stays on `search.html` with `?tree=` selection | Browse preview hub | Browse preview (not full appreciation) | Selection URL sync is Browse concern (#3486), not Editor |
| My Trees primary card / open | public → `view.html?treeId=…&from=my-trees`; private → `editor?treeId=…&from=my-trees` | public: Viewer; private: Editor default appreciation (`view`) | Keep access-based split; label should not imply “public mode” | `my-trees-ui.js`, `my-trees-preview-hub.js` |
| My Trees hub “트리 열기” | same visibility split as above | same | Explicit “공개 화면 보기” vs “내 트리에서 보기” copy later | Primary open is not always Editor |
| My Trees “편집하기” | `editor?treeId=…&from=my-trees` | Editor; default mode is `view` until user toggles edit | Editor edit when product requires; currently deep link does not force `edit` | Edit deep link does not set `MODE_EDIT` automatically (source: default `_mode = view`) |
| My Trees mobile card activation | mobile click navigates `viewHref` (public→Viewer, private→Editor) | route-owned | same as desktop open policy | `my-trees-ui.js` `<480` |
| direct shared link | `view.html?treeId=…` (`from=shared` optional) | Public Viewer | Public Viewer | Fail closed if private / missing |
| Editor appreciation deep link | `editor?treeId=…` (no mode param) | starts `view` | appreciation | No `mode=` query observed |
| Editor edit deep link | same URL; no dedicated edit query | starts `view` unless runtime sets edit | optional future `mode=edit` (out of scope unless product requires) | Must not invent without product gate |
| browser Back/Forward | browser history of route pages | restored by page reload / SPA-less navigation | preserve route; do not invent shared history controller | Multi-page app |
| Public Viewer owner “편집” | navigates to Editor with treeId | leaves Viewer → Editor | keep as navigation, not shared mode bus | `public-canvas-init.js` |

---

## E. Access state vs interaction mode

### Locked model

```text
Access state:      public | private
Interaction mode:  appreciation | edit
```

### Runtime mapping today

| Product term | Runtime encoding | Location |
| --- | --- | --- |
| appreciation (Editor) | `data-editor-interaction-mode="view"` | `editor-interaction-mode.js`, mode CSS |
| edit (Editor) | `data-editor-interaction-mode="edit"` | same |
| public access | tree `visibility === 'public'` + Public Viewer route | adapter + My Trees / Browse open links |
| private access | tree not public; owner Editor path | My Trees open routes private → Editor |

### Sources that can read like “public is a mode” (do not rewrite in this PR)

| Observation | File / location | Classification |
| --- | --- | --- |
| Public Viewer sidebar kicker “공개 러브트리” | `public-viewer-sidebar-template.js` | Access/context label, not interaction mode — OK if not grouped with 감상/편집 |
| Owner Viewer shows 보기/편집 pair | sidebar owner mode + top mode group in `public-canvas-init.js` | Risk: presents Viewer vs Editor as peer modes for owners |
| Editor toggle labels 감상 모드 / 편집 모드 | `editor.js` `injectDesktopModeToggle` | Correct interaction-mode language |
| Card metrics include public social counts on My Trees | `my-trees-ui.js` | Tree-level social display (#3188 adjacency), not mode |

This audit does **not** change any of the above copy or controls.

---

## F. Data parity matrix

| field | public payload | owner payload | name divergence | public-safe derived needed | notes |
| --- | --- | --- | --- | --- | --- |
| tree id | yes (`id`) | yes | low | no | |
| tree title | yes | yes | low | sanitize/display | |
| tree visibility | yes (`visibility`) | yes | low | no | access state |
| moment id | yes | yes | low | no | |
| moment title | yes | yes | low | sanitize/display | |
| source / media URL | yes (`sourceUrl` normalized) | yes | camel/snake handled in adapter | sanitize + YouTube canonicalize | `public-tree-adapter.js` |
| thumbnail | yes | yes | low | canonicalize | |
| remembered date | `timestamp` in public normalize | owner may use richer fields | possible | display format only | |
| emotion tags | yes (`emotionTags` / `emotion_tags`) | yes | snake/camel normalized | no | |
| memo | yes | yes | low | XSS-safe text | |
| connected knowledge | **not in public Viewer template; public payload support U** | Editor knowledge UI | high | only if public API exposes safe labels | Do not invent private entity IDs on public DTO |
| like count / state | public read summary modules | Editor social | path differs | public counts vs private “reacted” state | reacted state needs auth |
| comment count / list | public read path modules | Editor social | path differs | public-safe author **display label** only | |
| author display label | social summary paths | owner social | U for all surfaces | required for public comments | never raw account id in UI |
| owner-only metadata | must not appear on public DTO | yes | — | strip on public adapter | fail closed |
| ownerId on browse normalize | currently present on normalized browse tree (`ownerId`) | yes | — | **risk** if rendered | Adapter includes `ownerId`; presentation must not treat as public display field |

### Private identifier leakage posture

- Public presentation and shared render models must not accept raw Firebase user, Authorization token, private tree object wholesale, DB row, or unfiltered API payload.
- `ownerId` may exist for client permission checks; it is **not** a display field for guests.
- Shared helpers may receive only a **public-safe render model** + **capability flags** computed by the route.

---

## G. Social scope separation

| Issue | Scope | Primary current surfaces | #3475 rule |
| --- | --- | --- | --- |
| **#3075** | moment-level likes / comments | Editor `#momentReactionsCard`; Viewer `public-viewer-read-only-social-summary.js`, `public-viewer-authenticated-like.js`, `public-viewer-authenticated-comment-composer.js` | May share **presentation** of counts/list layout; must not activate new social write endpoints inside #3475 |
| **#3188** | tree-level likes / comments | Editor `#editorTreeReactions` + status boundary; Viewer `public-viewer-tree-like.js`, `public-viewer-tree-comments.js`, tree meta mounts | Sidebar tree metrics owned by #3188; not mixed into appreciation selected-moment convergence |

### Why #3475 must not activate new social write endpoints

1. Write paths require auth, rate limits, ownership, and abuse controls tracked under social issues.
2. Mixing write activation into a presentation-unification PR multiplies review risk and regresses public-safe guarantees.
3. Public Viewer already has separate authenticated like/comment modules; completion and production wiring belong to #3075 (moment) and #3188 (tree).
4. #3475 success metric is **canonical selected-moment appreciation structure**, not social engagement completion.

### Sidebar tree metric vs selected-moment social

| Surface | Issue owner |
| --- | --- |
| selected moment reaction card | #3075 |
| whole-tree like / comment metrics in sidebar or tree meta | #3188 |
| Browse/My Trees card social counts | primarily #3188 / Browse social metrics work — not #3475 |

---

## H. PR #3487 current-state reflection

Merged on main as part of baseline SHA `19141b5b9…`.

| Topic | Current source fact | Classification for #3475 |
| --- | --- | --- |
| owner appreciation/edit transition | Desktop toggle 감상 모드 / 편집 모드 in `editor.js`; body attribute `view`/`edit` | RESOLVED_BY_3487 |
| edit → appreciation return | Mode toggle remains available; view mode re-applied via `setMode(MODE_VIEW)` | RESOLVED_BY_3487 |
| connect vs new moment | `connectExistingMoment` only clicks activatable `#connectExistingCtaBtn`; no continue/add-memory fallback | RESOLVED_BY_3487 |
| toolbar explicit edit-only | `interactionMode !== 'edit'` → hide | RESOLVED_BY_3487 |
| form inert lifecycle | memory form sets detail inert/aria-hidden (continuity contract) | RESOLVED_BY_3487 |
| unknown Editor tree metric hiding | truthful metrics hide when count null | RESOLVED_BY_3487 |
| Public Viewer hierarchy sparse vs Editor | still true in templates | STILL_OPEN |
| knowledge section on Public Viewer | still absent | STILL_OPEN |
| My Trees open label/path clarity | public vs private open split exists; copy still “트리 열기” | ROUTE_SPECIFIC / STILL_OPEN product polish |
| Production visual parity | not validated in this docs audit | VISUAL_VERIFICATION_PENDING |

**Do not re-file** historical screenshots claiming “no return to appreciation” as current Editor defects without re-checking main after #3487.

---

## I. PR #3469 Viewer findings (reference only)

Stale closed PR; head `8c69e62f126d64d0788d11f1fd77f7c27882a5d0`.  
**Forbidden:** `git merge`, `git cherry-pick`, whole-tree checkout of that head, reapplying its Viewer runtime bundle.

| #3469 theme | Files (examples) | Classification | Rationale |
| --- | --- | --- | --- |
| moment social card restructure | `public-viewer-detail-view-mode-template.js`, read-only social summary | BELONGS_TO_3075 / VALID_FINDING | Presentation may inform #3475 hierarchy; write behavior stays #3075 |
| comment readability / author / date | authenticated comment composer + social summary tests | BELONGS_TO_3075 | Social list readability not a Viewer/Editor authority merge |
| tree social mount | tree comments panel contracts, tree meta | BELONGS_TO_3188 | Tree-level surface |
| view-mode active-state clarity | commit message theme; Viewer/Editor mode UI | VALID_FINDING; parts SUPERSEDED_BY_MAIN via #3487 for Editor | Editor mode clarity largely superseded; Viewer owner 보기/편집 still relevant |
| Public Viewer sidebar hierarchy | `public-viewer-sidebar-template.js` | VALID_FINDING | Candidate for entry/context clarity under #3475 slices, not authority merge |
| date-label cache bust | `pages/view.html` version query noise | UNSUPPORTED_VISUAL_CHANGE / incidental | Not a boundary decision |
| mixed Editor + Browse + Viewer mega-pass | 47 files across domains | CONFLICTS_WITH_3475 / UNSAFE_AUTHORITY_MIXING | Whole PR is out of scope for #3475 staged slices |
| broad CSS product pass | `editor-product-ux-pass.css` etc. | UNSUPPORTED_VISUAL_CHANGE | Not audited for re-application |

---

## J. Recommended architecture

```text
        Canonical appreciation render model (pure data)
                         ↑
        ┌────────────────┴────────────────┐
        │                                 │
Editor appreciation adapter      Public Viewer public-safe adapter
(route-owned load + caps)        (route-owned load + caps)
        │                                 │
        └────────────────┬────────────────┘
                         ↓
        shared presentation template / helper
        (markup grammar + display-only rendering)
```

### Principles

1. **Public Viewer route remains separate** (`pages/view.html`).
2. **Editor authoring runtime is not imported into Public Viewer** (no `editor-memory-form` save, no interaction-mode mutation bus, no owner connect/delete handlers). Canvas geometry reuse already present on Viewer must not expand into authority reuse.
3. **Shared code is presentation-oriented and capability-driven.**
4. **Permission and data loading remain route-owned.**

### Allowed inputs to shared helpers

- public-safe render model fields (display strings, counts, media display URLs)
- capability flags (examples): `canEdit`, `canContinue`, `canConnect`, `canReact`, `canComment`, `canDelete`, `canSwitchMode`, `isOwner`, `isPublicRoute`
- i18n display helpers that only format strings

### Forbidden inputs to shared helpers

- raw Firebase user
- Authorization token / session cookie values
- Editor global mutable state
- owner mutation functions
- entire private tree object
- DB row
- unfiltered API payload

### Fail-closed capability computation

Capability flags are **computed by the route adapter**, not by shared presentation. Shared code treats missing flags as false.

---

## K. Implementation slices

### Slice 1 — Shared canonical appreciation render model / pure presentation boundary

| Field | Content |
| --- | --- |
| title | Shared canonical appreciation render model (pure) |
| goal | Define a public-safe selected-moment render model and presentation contract without moving routes |
| exact expected files | `docs/engineering/*` (if contract update), new pure helper under agreed path e.g. `js/shared/appreciation-render-model.js` (only after this audit merge), focused contracts under `tests/contracts/*appreciation*` |
| dependencies | This audit merged |
| non-goals | No route migration; no social write activation; no Editor import into Viewer; no CSS redesign |
| permission risks | Accidental inclusion of private fields / ownerId display |
| required tests | SOURCE_STATIC contracts for model fields, forbidden keys, capability fail-closed defaults |
| merge order | 1 (first) |
| issue ownership | #3475 |

### Slice 2 — Public Viewer selected-moment hierarchy convergence

| Field | Content |
| --- | --- |
| title | Public Viewer selected-moment hierarchy convergence |
| goal | Align Viewer detail hierarchy with Editor appreciation shell (identity, media, date, tags, memo, optional knowledge display) without owner controls |
| exact expected files | `js/viewer/public-viewer-detail-view-mode-template.js`, `js/viewer/public-viewer-detail-ui.js`, related Viewer CSS under `css/viewer/*` or visitor-viewer only if required, Viewer contracts |
| dependencies | Slice 1 |
| non-goals | No Editor runtime import; no edit/continue/connect; no #3075 write completion; no #3188 tree social redesign |
| permission risks | Rendering private knowledge; enabling owner chips |
| required tests | public-viewer detail template contracts; public-safe field assertions; regression that owner buttons remain absent |
| merge order | 2 |
| issue ownership | #3475 |

### Slice 3 — My Trees / Browse explicit entry routes

| Field | Content |
| --- | --- |
| title | Explicit entry routes for appreciation vs edit vs public view |
| goal | Make My Trees (and related entry labels) distinguish public Viewer open, owner Editor appreciation, and edit without inventing a third interaction mode |
| exact expected files | `js/my-trees/my-trees-preview-hub.js`, `js/my-trees/my-trees-ui.js`, `pages/my-trees.html` (copy only if needed), related contracts; Browse share path only if label/docs require |
| dependencies | Slice 1 (optional); product copy approval |
| non-goals | No Viewer/Editor detail reimplementation; no social write; no automatic `mode=edit` without product gate |
| permission risks | Private tree opened on Public Viewer; public tree forced into owner-only tools for guests |
| required tests | My Trees href matrix contracts; private→Editor, public→Viewer assertions; mobile activation |
| merge order | 3 |
| issue ownership | #3475 (or a child issue if orchestration prefers) |

### Slice 4 — Moment social interaction completion

| Field | Content |
| --- | --- |
| title | Moment social interaction completion |
| goal | Complete moment-level like/comment read/write UX under auth rules |
| exact expected files | Editor moment social modules; Viewer `public-viewer-authenticated-like.js`, `public-viewer-authenticated-comment-composer.js`, `public-viewer-read-only-social-summary.js`; API client reaction helpers as already owned by social work |
| dependencies | Auth session guarantees; existing social API contracts |
| non-goals | Tree-level social; #3475 hierarchy-only work; do not block appreciation presentation on write readiness |
| permission risks | Guest write, private id leakage, CSRF/auth gaps |
| required tests | #3075-focused contracts for states, guest fail-closed, auth write boundaries |
| merge order | Parallel after Slice 2 presentation freeze, **not** mixed into Slice 2 |
| issue ownership | **#3075** |

### Slice 5 — Tree social sidebar surface

| Field | Content |
| --- | --- |
| title | Tree social sidebar surface |
| goal | Truthful tree-level like/comment metrics and panels |
| exact expected files | Editor sidebar tree reactions; Viewer tree-like / tree-comments; tree meta mounts; Browse card counts only if same tree-level API contract |
| dependencies | Tree social API/schema readiness under #3188 docs |
| non-goals | Selected-moment card redesign; #3475 presentation merge |
| permission risks | Showing synthetic zeros; write without auth |
| required tests | #3188 contracts for hide-unknown, public read, write gates |
| merge order | Parallel; independent of Slices 1–3 |
| issue ownership | **#3188** |

### Optional Slice 6 — Production visual verification gate

| Field | Content |
| --- | --- |
| title | Canonical appreciation Production visual verification |
| goal | Cloudflare Preview / fixed test slot screenshots comparing Editor appreciation vs Public Viewer after Slices 1–2 |
| exact expected files | none required (ops evidence only) or verification note under docs/reports if process requires |
| dependencies | Slices 1–2 merged; Preview URL policy |
| non-goals | New features |
| permission risks | None if read-only browsing of public fixtures |
| required tests | Manual checklist + browser verification entrypoint docs |
| merge order | After Slice 2 |
| issue ownership | #3475 (verification), keep issue OPEN until done |

---

## L. Non-goals and safety boundaries

- No runtime / CSS / HTML / template / API / Auth / Modal / DB / SQL / migration changes in **this** audit PR.
- No Production writes or logins.
- No merge or cherry-pick of stale PR **#3469**.
- No broad Viewer redesign outside staged slices.
- No activation of new social write endpoints under #3475.
- No import of Editor authority into Public Viewer.
- No closing of #3475, #3075, #3188, or #1882 by this audit alone.

---

## M. Related existing docs and tests

| Artifact | Relevance |
| --- | --- |
| `docs/reports/PUBLIC_VIEWER_DETAIL_UI_DECOMPOSITION_AUDIT.md` | Viewer detail responsibility map |
| `docs/engineering/lovebud-changeability-production-parity-audit.md` | Change-risk foundation |
| `docs/engineering/PUBLIC_VIEWER_SHELL_SPLIT_AUDIT.md` | Viewer shell split |
| `docs/engineering/PUBLIC_TREE_ADAPTER_BOUNDARY_AUDIT.md` | Public adapter boundary |
| `docs/product/lovebud-appreciation-order-contract.md` | Appreciation order product contract |
| `tests/contracts/editor-authoring-shell-continuity-3483.test.cjs` | #3487 fail-closed continuity |
| `tests/contracts/editor-mode-action-clarity-contract.test.cjs` | Mode clarity |
| `tests/contracts/public-viewer-*` | Viewer social/detail contracts |
| `tests/routes/public-viewer-*` | Viewer route guards |

---

## N. Open issue maintenance

| Issue | State after this audit |
| --- | --- |
| #3475 | **OPEN** — implementation slices + visual verification pending |
| #3075 | **OPEN** — moment social |
| #3188 | **OPEN** — tree social |
| #1882 | **OPEN** — parent product |

---

## O. Audit decision

**Classification:** `ISSUE3475_CANONICAL_APPRECIATION_BOUNDARY_AUDIT_READY`

Next action: orchestrator reviews this doc, then schedules Slice 1 (pure render model) without social write activation and without stale PR #3469 reuse.
