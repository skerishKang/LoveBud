# DB Migration Identity, Ordering, and Checksum Contract

Status: second small slice of Issue #3458. This is a **source-only** contract definition and test. It defines the immutable identity, ordering, canonical path ownership, and byte-exact checksum rules for canonical migrations, and documents what the repository source can and cannot prove.

This document does **not** apply SQL, open a database connection, add a canonical migration, activate the canonical stream, or fabricate applied history.

## Baseline

| Field | Value |
| --- | --- |
| Repository | `skerishKang/LoveBud` |
| Baseline `origin/main` SHA | `80fbbf666de9fd726bc392eb19b7eeccfa211c01` |
| Issue | #3458 |
| Validator | `scripts/migration-provenance-core.cjs` (`validateMigrationManifest`, `compareLedger`, `evaluateProvenance`) |
| Contract test | `tests/contracts/db-migration-identity-order-checksum-contract.test.cjs` |
| Canonical manifest | `db/migration-provenance/canonical-migrations.json` (`status = ADOPTION_REQUIRED`, `migrations = []`) |

## Migration ID

Format:

```text
YYYYMMDDHHMMSS_slug
```

Enforced pattern: `^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*$` (`MIGRATION_ID_PATTERN`).

Strict rules:

- The timestamp is exactly **14 digits** (`YYYYMMDDHHMMSS`).
- Timestamps use a **UTC naming convention** (the timestamp encodes the moment the migration ID is minted, in UTC).
- A single underscore separates the timestamp from the slug.
- The slug is **lowercase**; uppercase is rejected.
- The slug is the established **lowercase kebab-case** form: one or more `[a-z0-9]` segments joined by single dashes (e.g. `example-one`). Whitespace and underscores inside the slug are rejected by the enforced pattern.
- The full ID matches the canonical file basename (see Canonical path).
- An ID, once minted, is **never reused**.
- Changing an ID is treated as a **new migration**, never an in-place rename.
- Renaming a historical migration ID is prohibited.

Note on slug convention: the enforced pattern permits kebab-case (dash) slugs and rejects underscores inside the slug. This matches the established contract and its existing fixtures (e.g. `20260713090000_example-one`). A snake_case slug recommendation diverges from the enforced pattern; this slice preserves the established contract rather than changing ID semantics. Any future change to the slug convention must update the validator, this document, and the existing fixtures together.

Validator error: `MIGRATION_ID_INVALID`. Duplicate ID: `MIGRATION_ID_DUPLICATE`.

## Canonical path

A canonical migration exists only at:

```text
db/migrations/<migration_id>.sql
```

Enforced by `validateMigrationManifest`:

- The manifest `canonical_directory` is fixed to `db/migrations`; any other declared value fails closed (`MIGRATION_CANONICAL_DIRECTORY_INVALID`). The exact path is derived from this fixed value, never from the manifest-declared directory.
- The path must be exactly `db/migrations/<migration_id>.sql` — a single direct child of the canonical directory.
- The path must use the `.sql` extension.
- The path basename without `.sql` must equal the migration ID.
- Nested directories, `.` segments, duplicate slashes, path traversal (`..` segments), and absolute paths are rejected.
- Duplicate paths across entries are rejected.

Prohibited:

- A canonical migration under `scripts/`.
- A canonical migration under `docs/ops/` (or any documentation directory).
- Arbitrary absolute or relative traversal paths.
- Any extension other than `.sql`.
- A path whose basename does not match the migration ID.

Validator errors: `MIGRATION_CANONICAL_DIRECTORY_INVALID` (canonical_directory is not `db/migrations`), `MIGRATION_PATH_NON_CANONICAL` (outside the canonical tree, nested directory, `.` segment, duplicate slash, traversal, absolute path, or wrong extension), `MIGRATION_PATH_ID_MISMATCH` (basename differs from ID), `MIGRATION_PATH_DUPLICATE` (same path used twice), `MIGRATION_PATH_INVALID` (empty path), `MIGRATION_SOURCE_MISSING` (declared file absent), `MIGRATION_SOURCE_UNSAFE` (path escapes the repository root).

## Ordering

- The manifest `migrations` array is ordered by migration ID **strictly ascending**.
- Because every ID begins with a fixed-width 14-digit UTC timestamp, lexicographic ascending order enforces chronological (timestamp) ordering.
- Duplicate IDs are prohibited (`MIGRATION_ID_DUPLICATE`).
- Duplicate paths are prohibited (`MIGRATION_PATH_DUPLICATE`).
- Timestamp reversal is prohibited: inserting an older ID after a newer one fails (`MIGRATION_ORDER_INVALID`).
- Declared dependencies must reference earlier entries only (`MIGRATION_DEPENDENCY_ORDERING`), must exist (`MIGRATION_DEPENDENCY_UNKNOWN`), must not be self-references (`MIGRATION_DEPENDENCY_SELF`), and must not repeat (`MIGRATION_DEPENDENCY_DUPLICATE`).

Source-only verifiable now:

- Array order is strictly ascending by ID.
- No duplicate ID, no duplicate path.
- Declared dependency ordering/existence within the manifest.

Requires an applied ledger history (not verifiable from source alone):

- Whether an already-applied migration was inserted out of historical order in a target environment.
- Whether a past insertion violated ordering at apply time.

## Checksum

- Algorithm: **SHA-256**.
- Encoding: `sha256:` prefix followed by **lowercase 64-hex** characters (`SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/`).
- The checksum is computed over the **raw bytes** of the entire SQL file.
- **No normalization** is applied: newlines, whitespace, comments, and BOM are hashed exactly as present.
- Therefore each of the following changes the checksum and fails closed with `MIGRATION_SOURCE_CHECKSUM_MISMATCH`:
  - LF ↔ CRLF conversion;
  - adding or removing a trailing newline;
  - adding a trailing space;
  - adding or editing a comment;
  - adding or removing a UTF-8 BOM;
  - changing a single byte.
- An applied migration must **not** be modified. A required correction is a **new forward-fix migration** with a new ID and new checksum, never an in-place edit.

Rejected checksum forms (`MIGRATION_CHECKSUM_INVALID`): uppercase hex, 63 or 65 characters, non-hex characters, and a wrong algorithm declaration (e.g. `sha1:`).

Ledger evidence comparison (`compareLedger`) rejects, with synthetic evidence and no database:

- same ID with a different checksum → `GATE_EDITED_MIGRATION`;
- unknown applied ID → `GATE_UNKNOWN_APPLIED_MIGRATION`;
- missing expected ID → `GATE_MISSING_APPLIED_MIGRATION`;
- reordered applied IDs → `GATE_REORDERED_MIGRATION`;
- duplicate ledger record → `GATE_DUPLICATE_APPLIED_MIGRATION`;
- malformed record → `GATE_LEDGER_RECORD_INVALID`.

## Immutability boundary

Provable from repository source alone (this slice):

- The manifest checksum matches the current bytes of each declared canonical file.
- ID format, canonical path ownership, `.sql` extension, basename/ID agreement, and ascending order rules.
- Synthetic ledger-evidence mismatch detection (edited/unknown/missing/reordered/duplicate) using bounded synthetic evidence.
- The committed canonical manifest remains `ADOPTION_REQUIRED` with two catalogued migrations (catalog population is distinct from adoption).

Not provable from repository source alone (requires a separately approved read-only adoption baseline and target evidence):

- The historical checksum actually applied in Production.
- Whether a file was renamed in the past.
- The actual applied time, runner, tool, or environment.
- The existence of an actual ledger relation in a target database.

## Fail-closed behavior

While the canonical manifest is `ADOPTION_REQUIRED` (and the expected-schema manifest is not `ACTIVE`), `evaluateProvenance` returns `FAIL_CLOSED` with `GATE_ADOPTION_BASELINE_REQUIRED`. An empty manifest is structurally valid but never authorizes a target environment and must never be read as an empty Production schema.

## Synthetic fixture method

The contract test creates throwaway canonical repository layouts under the OS temporary directory (`os.tmpdir()` + `fs.mkdtempSync`), writes fixture `.sql` files with explicit byte content, runs the validator against the temporary root, and removes every temporary directory on completion. No `.sql` fixture is committed to the repository (which would otherwise be detected by the schema-change inventory guard). No database is used.

## Production / Database / SQL Boundary

| Question | Answer |
| --- | --- |
| SQL executed | No |
| Database accessed | No database connection was opened |
| Production mutation | No |
| Secrets used | No `DATABASE_URL` or secret value was used |
| Canonical migration added | No |
| Canonical stream activated | No (`status` remains `ADOPTION_REQUIRED`; 2 catalogued migrations, no runner activation) |
| Ledger relation DDL written | No |
| Existing migration file modified | No |

## Protected Issues

Refs #3458 - Keep #3458 OPEN.

Refs #3425 - Keep #3425 OPEN.

Refs #3435 - Keep #3435 OPEN.

Refs #3437 - Keep #3437 OPEN.

Refs #1882 - Keep #1882 OPEN.
