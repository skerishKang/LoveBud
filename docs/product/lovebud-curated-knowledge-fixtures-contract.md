# LoveBud Curated Knowledge Fixtures Contract

## Fixture Purpose

Phase 2 static curated validation only. This fixture corpus provides a minimal, deterministic dataset for contract validation and read-only lookup by downstream tasks (#3078). It contains no runtime UI, API, DB, or migration logic.

## Fixture File Location

```
data/knowledge/curated-knowledge-fixtures.v1.json
```

## Entity Shape

Each entity object contains the following required fields:

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | string | Globally unique across fixture |
| `type` | string | One of 7 allowed: `person`, `group_or_organization`, `work`, `video_or_source`, `place`, `event`, `concept` |
| `canonicalName` | string | Non-empty, unique across fixture |
| `aliases` | string[] | Array; no overlap with `canonicalName` or other aliases |
| `summary` | string | Non-empty |
| `sourceRefs` | object[] | Minimum 1 entry; each has non-empty `label` and `url` |
| `publicationState` | string | `draft` or `published` |
| `createdAt` | string | ISO-8601 UTC timestamp |
| `updatedAt` | string | ISO-8601 UTC timestamp |

## Relation Shape

Each relation object contains the following required fields:

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | string | Globally unique across fixture |
| `from` | string | References an existing entity `id` |
| `to` | string | References an existing entity `id` |
| `relationType` | string | One of: `member_of`, `part_of`, `created_by`, `released_on`, `related_to` |
| `sourceRefs` | object[] | Minimum 1 entry; each has non-empty `label` and `url` |
| `visibility` | string | `public` or `private` |
| `createdBy` | string | Fixed editorial identifier `editorial_fixture`; no email, UID, or account identifiers |
| `ownershipBoundary` | string | Fixed value `knowledge_hub_editorial` |

## Validation Rules

1. **Entity type allowlist**: Only the 7 types listed above are permitted.
2. **Entity uniqueness**: All `id` values unique; all `canonicalName` values unique; no alias collides with any `canonicalName` or other alias.
3. **Required fields**: Every entity has all required fields present and non-empty (except `aliases` which may be empty array).
4. **ISO-8601 dates**: `createdAt` and `updatedAt` must parse as valid ISO-8601 UTC timestamps.
5. **sourceRefs**: At least one entry per entity/relation; each entry has non-empty `label` and `url`.
6. **publicationState**: Must be `draft` or `published`.
7. **Relation type allowlist**: Only the 5 relation types listed above.
8. **Relation endpoints**: `from` and `to` must reference existing entity `id`s.
9. **Relation required fields**: All fields present; `visibility` is `public` or `private`; `createdBy` equals `editorial_fixture`; `ownershipBoundary` equals `knowledge_hub_editorial`.

## Visibility and Private/Draft Non-Discovery Rules

- Entities with `publicationState: "draft"` MUST NOT be endpoints of `visibility: "public"` relations.
- Relations with `visibility: "private"` MUST NOT appear in public discovery results.
- `createdBy` and `sourceRefs` MUST NOT contain email addresses, Firebase-like UIDs, account identifiers, or owner-local metadata.
- Private entity references MUST NOT be used as endpoints in public relations.
- Negative fixtures in the contract test verify these constraints by mutating the fixture clone and asserting validation failure.

## Source Provenance Rules

- All `sourceRefs` use editorial fixture references pointing to `https://example.com/knowledge-fixture-reference`.
- No real celebrity data, real fandom data, scraping, or AI-generated facts are imported.
- Fixture is curated example corpus only.

## Account Identifier Prohibition

- No email addresses.
- No Firebase UIDs (`firebase:...`, `uid:...`, etc.).
- No account identifiers, tokens, passwords, or owner-local metadata.
- `createdBy` uses the fixed string `editorial_fixture`.

## Non-Goals

- Runtime UI components or rendering
- API endpoints, DB schema, or migration scripts
- External lookup, scraping, or automated AI entity creation
- Production data import or real-world data synchronization
- Any runtime bundle inclusion or automatic API exposure

## Downstream Dependencies

- **#3078**: Uses this fixture as read-only lookup source only.
- **#3079 and beyond**: Public rendering must re-apply visibility rules (`publicationState` + `visibility`) at query time.

---

*Refs #3077 / Refs #3068 / Refs #1882*