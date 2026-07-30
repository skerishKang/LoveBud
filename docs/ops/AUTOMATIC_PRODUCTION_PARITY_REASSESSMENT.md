# Automatic Production Parity Reassessment

**Issue:** #3766  
**Status:** Current ops assessment  
**Last updated:** 2026-07-30  
**Source base:** 4842a4d1f60c011132fb936323dd7b80423bf5ac  
**Parent:** #3699 — Keep OPEN  

---

## 1. Authority and evidence limits

This document reassesses the automatic `main` → Cloudflare Pages Production deployment reliability question after the canonical release manifest (`/.well-known/release.json`) was implemented and verified.

### Authority

- Serving-SHA observation is now implemented via the static build manifest (`/.well-known/release.json`).
- Post-merge Production verification follows `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`.
- This document does not authorize provider mutation, workflow changes, or Issue closure.

### Evidence limits

- Evidence is bounded to source inspection, CI results, and one observed Production manifest verification.
- No Cloudflare Dashboard, API, Wrangler, deployment logs, or provider secrets were accessed.
- One successful parity observation (`PRODUCTION_MANIFEST_VERIFIED` at #3764) does not prove ongoing automatic deployment reliability.

---

## 2. Solved capability: exact serving-SHA observation

Before the canonical manifest, verifying which Git SHA was serving Production required:

- Cloudflare Dashboard navigation (provider-dependent, secret-bearing);
- Wrangler API calls (credential-dependent);
- Or indirect observation via content inspection (imprecise, fragile).

**A. serving-SHA observability — IMPLEMENTED**

The static build now generates `/.well-known/release.json` with schema:

```json
{
  "release_sha": "<40-char lowercase hex>",
  "contract_version": "1"
}
```

Key properties:

| Property | Detail |
|---|---|
| Build integration | `scripts/build-static.js` via `npm run build` |
| SHA authority | `git rev-parse HEAD`, validated against `^[0-9a-f]{40}$` |
| Fail-closed | Build exits non-zero if SHA cannot be resolved |
| Cache policy | `Cache-Control: no-store` in `_headers` |
| Public URL | `https://lovebud.pages.dev/.well-known/release.json` |
| No private data | Only SHA + contract version; no deployment ID, timestamp, branch, or environment |

This solves the **observation** gap: any HTTP client can now determine the exact serving SHA without provider access. The manifest contract is documented at `docs/ops/RELEASE_SHA_MANIFEST_CONTRACT.md`.

---

## 3. Verified event: #3764

### Event

After PR #3762 (manifest implementation) was merged at commit `4842a4d1f60c011132fb936323dd7b80423bf5ac`, Issue #3764 verified Production parity.

### Evidence

Two uncached Production requests to `https://lovebud.pages.dev/.well-known/release.json` returned:

| Check | Result |
|---|---|
| HTTP 200 | PASS |
| Content-Type: application/json | PASS |
| Cache-Control: no-store | PASS |
| release_sha = `4842a4d1f60c011132fb936323dd7b80423bf5ac` | PASS |
| release_sha matches origin/main | PASS |
| No forbidden metadata | PASS |

**B. one-deployment parity observation — OBSERVED**

One merged main SHA was confirmed to be serving at Production. This is the first bounded parity observation and demonstrates that the manifest works as a verification tool.

### What this proves

- The manifest build → deploy → serve pipeline functions end-to-end for `4842a4d1`.
- The `Cache-Control: no-store` policy allows immediate observation.
- A PR-level Cloudflare Preview deployment is also generated for each branch, which could be used for pre-merge manifest verification if assigned.

### What this does not prove

- That every future `main` merge will automatically deploy and serve the correct SHA.
- That the automatic deployment pipeline will not stall, skip, or fail.
- That Cloudflare Pages will always activate the latest deployment on the production domain.

---

## 4. Unresolved automatic-deploy reliability question

**C. automatic deployment reliability — UNRESOLVED**

The core question from #3699 remains: does every `main` merge reliably result in the merged SHA being served at `https://lovebud.pages.dev/`?

One positive observation cannot answer this question. The following failure modes are still possible:

| Failure mode | Manifest detection | Observable? | Occurred? |
|---|---|---|---|
| Pages build succeeds but deployment is queued and not activated | Stale SHA served | Yes | Previously observed (#3699) |
| Pages build fails (non-zero exit) | Deployment blocked; previous SHA remains | Yes (manifest missing) | Not observed |
| Pages build succeeds but Git SHA resolution fails (fail-closed) | Build fails; deployment blocked | Yes (CI red) | Not observed |
| Domain alias points to older deployment | Stale SHA served | Yes | Not observed |
| CDN/proxy returns stale manifest despite `no-store` | Stale SHA served | Possible | Not observed |
| Cloudflare incident / platform failure | Unreachable or error | Partial (5xx) | Not observed |

The manifest makes **detection** possible for most failure modes, but it does not **prevent** or **repair** any of them.

---

## 5. Stale detection vs deployment repair

**D. deployment repair/mutation authority — NOT_AUTHORIZED**

The manifest provides **stale detection** only. It does not:

- Trigger a new deployment;
- Cancel a stuck deployment;
- Repair a failed build;
- Update the production alias;
- Purge a CDN cache;
- Change any Cloudflare resource.

The following table clarifies what the manifest is and is not:

| Capability | Manifest provides |
|---|---|
| Detect that Production is serving SHA X | Yes |
| Detect that SHA X differs from latest main | Yes (manual comparison) |
| Detect that manifest is missing (build failure) | Yes (404/error) |
| Automatically re-deploy when stale detected | No |
| Automatically repair build failure | No |
| Re-point production alias | No |
| Re-trigger failed Pages build | No |

Any deployment repair requires explicit owner-authorized actions outside this document's scope.

---

## 6. Bounded observation model for future merges

A systematic observation model would improve confidence without provider mutation. This document proposes the following model for a future child issue to implement as pure observation:

### Observation process (read-only)

1. A `main` merge occurs (SHA = M).
2. After a bounded propagation window (e.g. 3 minutes from merge timestamp), fetch `https://lovebud.pages.dev/.well-known/release.json`.
3. Classify the result:
   - `PRODUCTION_SHA_MATCH` — manifest SHA equals M.
   - `PRODUCTION_SHA_STALE` — manifest SHA differs from M.
   - `PRODUCTION_MANIFEST_MISSING` — manifest returns non-200 or invalid JSON.
   - `PRODUCTION_TEMPORARY_5XX` — Production returns HTTP 5xx.
   - `DEPLOYMENT_STATE_UNKNOWN` — fetch itself fails (network error, timeout).
4. Record the observation as a durable Issue comment with timestamp, SHA M, classification, and raw response summary (no secrets).
5. Stop after one observation per merge. Do not poll.

### Observation window

The propagation window must be generous enough to account for:

- Pages build time (typically 30–90 seconds for this repository);
- Deployment activation propagation (typically under 60 seconds after build);
- DNS / CDN propagation (typically under 30 seconds).

A 3-minute window from merge observation is a reasonable starting point. Evidence from repeated observations would allow refinement.

### Implementation constraints

This model is proposed for a future child issue. The current document does not authorize:

- Writing a GitHub Actions workflow or cron job;
- Creating a status check or deployment protector;
- Modifying `_headers`, build scripts, or CI configuration;
- Accessing Cloudflare API or Dashboard;
- Creating a webhook or notification system.

---

## 7. Evidence threshold for #3699 closure or narrowing

### Current status

- A (serving-SHA observability): **SOLVED** — manifest implemented and verified.
- B (one-deployment parity): **OBSERVED** — #3764 confirmed one match.
- C (automatic deploy reliability): **UNRESOLVED** — not proven.
- D (deployment repair): **NOT_AUTHORIZED** — outside scope.

### Recommendation

**NARROW_3699_SCOPE**

The original #3699 spanned both "detect what is serving" and "ensure automatic deployment." The manifest solves the detection portion. The remaining scope is: **Automatic deployment reliability — does every main merge result in the merged SHA serving at Production within a bounded window?**

### Proposed narrowed scope

If the Web CTO accepts narrowing, #3699 would be re-scoped to:

> **Automatic main-to-Production deployment reliability.**
>
> Evidence threshold for closure: N consecutive main merges where each merge SHA is observed at `https://lovebud.pages.dev/.well-known/release.json` within a bounded propagation window from the merge timestamp, with zero stale, missing, or unknown observations.
>
> N is not set by this document — the Web CTO determines the evidence bar based on operational risk tolerance.

### Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| `KEEP_3699_OPEN` | Too broad — the solved detection scope would remain intertwingled with the unresolved reliability question, making it harder to track remaining risk |
| `READY_TO_CLOSE_3699` | One successful deployment does not prove automatic deployment reliability. Multiple failures remain possible and unobserved |

---

## 8. Failure classifications

When inspecting Production parity via the manifest, use these canonical classifications:

| Code | Meaning | Observed? |
|---|---|---|
| `PRODUCTION_SHA_MATCH` | Manifest SHA equals the expected merge SHA | Yes (#3764) |
| `PRODUCTION_SHA_STALE` | Manifest SHA differs from the expected merge SHA | Not observed |
| `PRODUCTION_MANIFEST_MISSING` | `/.well-known/release.json` returns non-200, non-JSON, or invalid schema | Not observed |
| `PRODUCTION_TEMPORARY_5XX` | Production returns HTTP 5xx for any path | Not observed |
| `DEPLOYMENT_STATE_UNKNOWN` | Fetch fails entirely (network error, timeout, DNS failure) | Not observed |

### Usage rules

- Classifications are read-only observations. They do not trigger any automated action.
- A `PRODUCTION_SHA_STALE` or `PRODUCTION_MANIFEST_MISSING` observation should be recorded as a durable Issue comment and used for future reliability analysis.
- Repeated `PRODUCTION_SHA_STALE` observations would strengthen the case for a repair/mutation authority child issue.
- Repeated `PRODUCTION_SHA_MATCH` observations (N consecutive) would satisfy the closure threshold for the narrowed #3699.

---

## 9. Stop conditions

| Condition | Action |
|---|---|
| This document is written and reviewed | Stop |
| Draft PR is created and CI is green | Stop |
| Web CTO decides to narrow or keep #3699 | Stop (no further action from this issue) |
| Owner authorizes deployment repair scope | New child issue required |
| Stale SHA is observed at Production | Record in #3699 or a new child; stop (no provider mutation) |

---

## 10. Prohibited provider mutations

The following are explicitly **NOT AUTHORIZED** by this document:

- Cloudflare Dashboard or API access (viewing or mutating);
- Wrangler CLI deployment, rollback, or alias manipulation;
- Manual deployment trigger via GitHub Actions workflow_dispatch;
- Cache purge via Cloudflare API or Dashboard;
- DNS record changes;
- Workflow YAML changes (`.github/workflows/`);
- Source build script changes (`scripts/build-static.js`);
- `_headers` changes;
- Production environment variable changes;
- Any action that writes to Production, API, DB, or Auth.

---

## 11. Recommended next child

If the Web CTO accepts narrowing #3699, the next implementation child should be created:

### Child: Bounded observation of Production manifest parity

| Field | Value |
|---|---|
| Scope | Read-only observation of `/.well-known/release.json` after each main merge |
| Implementation | Manual or script-assisted; no workflow/Action changes |
| Required files | None (observations recorded as Issue comments) |
| Classification | `PRODUCTION_SHA_MATCH`, `PRODUCTION_SHA_STALE`, `PRODUCTION_MANIFEST_MISSING`, `PRODUCTION_TEMPORARY_5XX`, `DEPLOYMENT_STATE_UNKNOWN` |
| Propagation window | 3 minutes from merge timestamp (adjustable based on evidence) |
| Stop condition | N consecutive `PRODUCTION_SHA_MATCH` observations (N determined by Web CTO) |
| Prohibited | Provider mutation, workflow changes, automated polling, webhook creation |
| Outcome | N consecutive matches → #3699 eligible for closure under narrowed scope |

---

## Summary

| Dimension | Status |
|---|---|
| A — serving-SHA observability | IMPLEMENTED (`/.well-known/release.json`) |
| B — one-deployment parity | OBSERVED (#3764, SHA `4842a4d1`) |
| C — automatic deployment reliability | **UNRESOLVED** |
| D — deployment repair authority | NOT_AUTHORIZED |
| #3699 recommendation | **NARROW_3699_SCOPE** (detection solved; reliability remains) |

Refs #3699 — Keep OPEN
Refs #3764 — completed
Refs #3761 — completed
Refs #3673 — Keep OPEN
Refs #3425 — Keep OPEN
Refs #1882 — Keep OPEN
