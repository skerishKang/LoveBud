# Release SHA Manifest Contract

> **Status:** implemented — active build contract
> **Authority:** #3740 / PR #3744 — canonical public serving-SHA exposure boundary
> **Parent:** #3673 — Keep OPEN
> **Related:** #3761 — implementation child; #3734 — completed bounded smoke contract; #3725 — completed runtime health taxonomy
> **Base SHA:** `c959d031d3162942806b6c686ea3195a1729b1b3`

## Canonical endpoint

The single canonical public endpoint for release SHA exposure is:

```text
/.well-known/release.json
```

No other path, header, meta tag, or runtime endpoint serves as a release SHA authority. The text asset, response header, HTML meta tag, and runtime API endpoint are explicitly `DEFERRED_ALTERNATIVE` or `DEFERRED` per #3740.

## Schema

```json
{
  "release_sha": "<full 40-character lowercase hexadecimal Git commit SHA>",
  "contract_version": "1"
}
```

- `release_sha` — exact 40-character lowercase hex Git commit SHA of the deployed source. The full SHA is required for unambiguous release correlation.
- `contract_version` — bounded string `"1"` allowing future schema evolution without breaking existing consumers.

No additional fields are permitted. Prohibited fields include timestamp, branch name, actor/email, build URL, environment values, Cloudflare account/project/deployment IDs, and request IDs.

## Source of truth and deterministic SHA resolution

The SHA is resolved from the current checkout at build time using:

```bash
git rev-parse HEAD
```

The result is validated against the regex `^[0-9a-f]{40}$`. If the resolved value is not a valid 40-character hex string, the build fails.

Resolution rules:

1. `git rev-parse HEAD` — primary source, repository-derived.
2. No fallback to `GITHUB_SHA`, `CF_PAGES_COMMIT_SHA`, or any other CI/provider variable. The repository-derived SHA is the sole authority.
3. If `git rev-parse HEAD` fails or returns an invalid SHA, the build exits non-zero.

## Build integration point

The manifest is generated during `npm run build`, which executes `scripts/build-static.js`. Generation is part of the same script that performs the static existence check. No separate build step or orphan script is required.

## Public output location

Cloudflare Pages serves this repository with the repository root as the public directory. The manifest is written to:

```text
<repo-root>/.well-known/release.json
```

This corresponds to the public URL:

```text
https://lovebud.pages.dev/.well-known/release.json
```

## Fail-closed behavior

- If `git rev-parse HEAD` exits non-zero or produces output that does not match `^[0-9a-f]{40}$`, the build exits non-zero.
- No placeholder, default, or success-with-warning path exists. If the SHA cannot be determined, the build does not produce a manifest and the deploy is blocked.
- The contract test verifies fail-closed behavior by running the build script in a repository with no valid Git history.

## Cache policy

```text
/.well-known/release.json
  Cache-Control: no-store
```

`no-store` is chosen over `max-age=0, must-revalidate` because:

- The manifest must never be cached by any intermediary (browser, CDN, proxy).
- `no-store` provides the strongest freshness guarantee: every fetch reaches the origin.
- The manifest is a tiny JSON payload (under 200 bytes). The performance cost of revalidation is negligible.
- Stale SHA serving would silently undermine release correlation.

`stale-while-revalidate` is explicitly forbidden per #3740.

## Privacy and security boundary

Only two values are exposed:

- `release_sha` — a 40-character hex SHA that is already public in the Git repository.
- `contract_version` — a bounded string `"1"`.

No private metadata is exposed. The following are explicitly excluded:

- Cloudflare deployment ID (UUID format, not SHA)
- Build log content
- Environment variable values
- Database URLs
- Provider dashboard state
- Timestamps
- Branch names, actor names, emails
- Account/project IDs
- Request IDs

## Local verification

```bash
npm run build
node --test tests/contracts/release-sha-manifest-contract.test.cjs
```

The contract test:

1. Verifies the build script exists.
2. Runs `npm run build` and asserts the manifest is generated.
3. Parses the JSON and validates the schema.
4. Confirms `release_sha` is 40-character lowercase hex matching `git rev-parse HEAD`.
5. Confirms `contract_version` is `"1"`.
6. Verifies no forbidden metadata fields exist.
7. Checks `_headers` for the path-specific `Cache-Control: no-store` rule.
8. Tests fail-closed behavior with an invalid SHA context.
9. Removes the generated `.well-known/` directory after test so that no unauthorized diff remains in the working tree.

## CI verification

The manifest contract test runs as part of the existing `npm test` glob:

```bash
node --test tests/contracts/*.test.cjs
```

No CI workflow modification is required. The `verify-static` job in `.github/workflows/ci.yml` already runs `npm run build` followed by `npm test`, which covers the contract test.

## Post-merge Production verification

After merge to `main` and Cloudflare Pages auto-deploy:

1. Fetch `https://lovebud.pages.dev/.well-known/release.json`.
2. Confirm `content-type: application/json`.
3. Parse JSON and confirm schema matches §Schema.
4. Compare `release_sha` with the merged `main` HEAD.
5. Confirm `Cache-Control: no-store` is present in the response headers.
6. If the manifest is absent, stale, or incorrect, record the observation and stop. Do not serve stale content.

## Rollback

1. Revert the integration in `scripts/build-static.js`.
2. Remove `tests/contracts/release-sha-manifest-contract.test.cjs`.
3. Remove `docs/ops/RELEASE_SHA_MANIFEST_CONTRACT.md`.
4. Revert the `_headers` entry for `/.well-known/release.json`.
5. Merge the revert. Cloudflare Pages auto-deploys the revert.

## Stop conditions

- Decision document #3740 merged.
- Implementation child #3761 completed and merged.
- Contract test passes on `main`.
- Manifest is served at `/.well-known/release.json` with `Cache-Control: no-store` and `content-type: application/json`.
- No private payload exposure proven by contract test.
- `#3699` referenced but not closed.

---

*Refs #3761*
*Refs #3740 — completed*
*Refs #3734 — completed*
*Refs #3673 — Keep OPEN*
*Refs #3699 — Keep OPEN*
*Refs #3425 — Keep OPEN*
*Refs #1882 — Keep OPEN*
