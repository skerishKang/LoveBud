# Snake Case and Camel Case Compatibility Audit

> Status: audit only
> Related: #407
> Runtime impact: none

## 1. Purpose

Issue #407 tracks the audit of transitional `snake_case` and `camelCase` compatibility layers before any cleanup, fallback removal, API response contract change, cache migration, or adapter boundary change.

The current browser-facing target is flat `camelCase` for normalized view models, while selected `snake_case` inputs remain accepted at adapter and normalization boundaries for compatibility with legacy API responses or cached records.

This document inventories known compatibility locations, classifies fallback paths, and defines guardrails and verification requirements for any future implementation PR.

This document does not authorize implementation, behavior changes, cache migration, adapter fallback removal, server response changes, or page data-loading changes.

## 2. Current compatibility locations

| Location | Compatibility role | Known transitional fields or shapes | Current classification |
| --- | --- | --- | --- |
| `js/utils/normalize.js` | Shared normalization fallback layer for tree/memory-like records. | `tree_id`, `parent_id`, `source_url`, `source_type`, `emotion_tags`, `created_at`, `updated_at`, `user_id`, `memory_count`, `is_archived` | Required for now. Removable later only after API/cache alignment and contract tests prove no callers rely on it. |
| `js/api/public-tree-adapter.js` | Public tree adapter boundary for Search/Browse/public tree response shapes. | legacy `{ data }` wrappers plus `tree_id`, `created_at`, `owner_id`, `emotion_tags`, `representative_thumbnail`, `representative_memory_source_url` | Long-term adapter boundary for external/public response tolerance unless a separate contract plan narrows it. |
| `tests/api-contract-transitional.test.js` | Contract guard for transitional API response compatibility. | Transitional snake/camel contract expectations. | Required test evidence before cleanup. Do not remove without replacement coverage. |
| `tests/contracts/public-tree-adapter-module.test.js` | Public tree adapter module contract guard. | Adapter import/export and shape behavior. | Required as adapter guard. |
| `tests/contracts/public-tree-view-model-camelcase.test.js` | Canonical public tree view-model shape guard. | CamelCase output contract. | Required as canonical target guard. |
| `docs/engineering/API_CONTRACT.md` | Existing API contract documentation. | Documents canonical and transitional expectations. | Reference documentation; update only in a docs-only PR if future implementation changes the contract. |

## 3. Fallback field inventory

| Field or shape | Current fallback surface | Target/canonical shape | Classification | Removal condition |
| --- | --- | --- | --- | --- |
| `tree_id` | `js/utils/normalize.js`, `js/api/public-tree-adapter.js` | `treeId` or page-specific canonical camelCase field | Required for now | Only after browser API responses, caches, and adapter tests prove camelCase-only inputs. |
| `parent_id` | `js/utils/normalize.js` | `parentId` | Removable later | Requires cache and API response alignment evidence. |
| `source_url` | `js/utils/normalize.js` | `sourceUrl` | Required for now | Requires memory/source consumers and cache records to be camelCase-only. |
| `source_type` | `js/utils/normalize.js` | `sourceType` | Required for now | Requires memory/source consumers and cache records to be camelCase-only. |
| `emotion_tags` | `js/utils/normalize.js`, `js/api/public-tree-adapter.js` | `emotionTags` | Required for now | Requires API/cache/public adapter evidence. |
| `created_at` | `js/utils/normalize.js`, `js/api/public-tree-adapter.js` | `createdAt` | Required for now | Requires API/cache and public tree response evidence. |
| `updated_at` | `js/utils/normalize.js` | `updatedAt` | Removable later | Requires API/cache alignment evidence. |
| `user_id` | `js/utils/normalize.js` | `userId` | Removable later | Requires API/cache alignment evidence. |
| `memory_count` | `js/utils/normalize.js` | `memoryCount` | Removable later | Requires API/cache and list/card consumer evidence. |
| `is_archived` | `js/utils/normalize.js` | `isArchived` | Removable later | Requires API/cache and archive-state consumer evidence. |
| `owner_id` | `js/api/public-tree-adapter.js` | `ownerId` | Long-term adapter boundary unless upstream is guaranteed | Public API/public tree adapter may continue accepting it as external tolerance. |
| `representative_thumbnail` | `js/api/public-tree-adapter.js` | `representativeThumbnail` | Long-term adapter boundary unless upstream is guaranteed | Requires Search/Browse/public tree view model test coverage before narrowing. |
| `representative_memory_source_url` | `js/api/public-tree-adapter.js` | `representativeMemorySourceUrl` | Long-term adapter boundary unless upstream is guaranteed | Requires Search/Browse/public tree view model test coverage before narrowing. |
| legacy `{ data }` wrapper | `js/api/public-tree-adapter.js` | unwrapped response/view-model input | Long-term adapter boundary or removable later by evidence | Requires API response contract and adapter tests showing wrapper is no longer returned. |

## 4. Dependency and risk classification

| Consumer area | Risk if fallback is removed prematurely | Required evidence before implementation |
| --- | --- | --- |
| Search/Browse | Public tree cards, thumbnails, emotion tags, copy/fork-adjacent data, or preview state can regress if public tree adapter compatibility is narrowed too early. | Browser smoke or fixed-slot check for Search/Browse plus public tree adapter contract tests. |
| Detail | Detail data loading can fail if normalized tree/memory fields are missing expected camelCase values. | Detail page validation and relevant contract tests. |
| Editor | Editor save/load/update flows can regress if memory/source/tree normalization changes. | Editor-specific validation, preferably fixed-slot if Auth/API/data is involved. |
| My Trees | Auth/API/data-sensitive list or action flows can regress if user/tree/memory fields change. | Fixed-slot validation and My Trees contract/page checks. |
| Browser cache | Persisted legacy records can still contain snake_case if older cache entries exist. | Cache migration or invalidation plan before removing fallback. |
| Modal/API responses | Server responses may still include snake_case fields. | Backend contract plan before changing `modal_compute/` response normalization. |

## 5. Classification summary

| Compatibility path | Classification | Rationale |
| --- | --- | --- |
| Shared normalizer snake_case field acceptance | Required for now / removable later by evidence | It protects browser code from mixed legacy/cache/API shapes. |
| Public tree adapter legacy wrapper and snake_case acceptance | Long-term adapter boundary unless narrowed by evidence | Public/Search/Browse response tolerance is a safer adapter responsibility than scattered page reads. |
| Canonical camelCase output contract | Required long-term | Browser modules should consume normalized camelCase view models. |
| Direct snake_case reads outside adapters/normalizers | Not allowed for new code | New code should use normalized camelCase and keep fallback reads at adapter boundaries. |
| Backend/API snake_case response tolerance | Requires separate backend contract plan | Do not change server response shape from this audit issue. |
| Cache migration or invalidation | Separate implementation concern | Do not remove fallbacks before persisted records are addressed. |

## 6. Audit answers

| Audit question | Current disposition |
| --- | --- |
| Which API responses still return snake_case fields to the browser? | Unknown from this docs-only audit; must be verified by API contract tests or backend response audit before cleanup. |
| Which cache records still persist snake_case fields? | Unknown; assume possible legacy cached records until a cache audit, migration, or invalidation plan proves otherwise. |
| Which pages/modules still depend on fallback behavior? | Search/Browse, Detail, Editor, My Trees, and shared normalization surfaces are risk areas. Treat dependency as possible until tests/browser checks prove otherwise. |
| Which fallback fields can be safely removed only after server/cache alignment? | Shared normalizer fallbacks such as `parent_id`, `updated_at`, `user_id`, `memory_count`, `is_archived` may be candidates, but only after evidence. |
| Which compatibility paths must remain as long-term adapter boundaries? | Public tree adapter tolerance for public response wrappers and public tree snake_case fields should remain unless a separate public response contract plan narrows it. |
| Are tests or contract checks needed before removing any fallback path? | Yes. Add/maintain contract tests and page-specific validation before removing fallback paths. |

## 7. Future PR split

| Future PR | Scope | Allowed files | Forbidden files |
| --- | --- | --- | --- |
| Compatibility inventory closure | Docs-only | `docs/engineering/**` | JS/runtime/cache/API files |
| Canonical camelCase contract test PR | Tests only | specific `tests/**` contract files | runtime behavior, API response changes, cache migration |
| Cache audit or invalidation plan | Docs/test/implementation only if separately approved | scoped cache docs/tests or explicit cache files | broad runtime rewrites, unrelated UI/Auth/Search refactors |
| Narrow adapter cleanup | One adapter/fallback path only | exact adapter/normalizer file approved by CTO | backend response changes, page rewrites, unrelated modules |
| Backend response alignment | Separate backend contract plan | scoped `modal_compute/**` only if explicitly approved | browser adapter cleanup in same PR |

## 8. Verification requirements for future implementation

Any future implementation that removes or narrows compatibility behavior must include:

- `git diff --check` PASS;
- exact changed-file list;
- relevant contract tests for canonical camelCase output;
- transitional contract tests removed only with replacement coverage;
- Search/Browse browser smoke if public tree adapter behavior changes;
- Detail validation if detail loading is affected;
- Editor validation if memory/source/tree normalization affects editor flows;
- My Trees fixed-slot validation if user/tree/data flows are affected;
- cache migration or invalidation plan if persisted records may contain snake_case;
- backend/API response contract review before changing `modal_compute/` outputs;
- deployed SHA verification for runtime-sensitive PRs.

## 9. Guardrails

- Do not remove snake_case compatibility from this issue alone.
- Do not change API response shape from this issue alone.
- Do not modify `modal_compute/` response normalization without a separate backend contract plan.
- Do not change Search/Browse behavior without browser smoke.
- Do not change Editor or Detail data loading behavior without page-specific validation.
- Do not combine this with Auth fallback cleanup.
- Do not combine this with Editor global-state cleanup.
- Do not combine this with Netlify/Vercel legacy artifact work.
- Do not touch PR #7.
- Do not touch prototype/reference/demo/variant paths.
- Do not include secret, token, session, cookie, private key, credential, or private payload values in reports.

## 10. Current recommendation

Keep existing snake_case compatibility fallbacks in place for now.

Treat camelCase as the canonical browser-facing normalized output target, but preserve adapter and normalizer tolerance until API responses, browser cache records, page consumers, and contract tests prove the fallback paths are unused or safely migratable.

The safest next step after this audit is a narrow contract-test PR for canonical camelCase browser view models, not fallback removal.

## 11. Acceptance criteria mapping

| #407 acceptance criterion | Status in this audit |
| --- | --- |
| All known compatibility fallback locations are inventoried. | Covered in sections 2 and 3. |
| Each fallback path is classified as required, removable later, or long-term adapter boundary. | Covered in sections 3 and 5. |
| Any implementation follow-up has explicit allowed files, forbidden files, and verification requirements. | Covered in sections 7 and 8. |
| No behavior change occurs in the audit-only phase. | Guardrail preserved; this is docs-only. |

## Related

Refs #407
