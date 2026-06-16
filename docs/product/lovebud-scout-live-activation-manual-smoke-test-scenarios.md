# LoveBud Scout Live Activation Manual Smoke Test Scenarios

**Issue context:**
- PR context: #2601
- Parent MVP: #1882

## Status Lock & Assertions
This document outlines operator-facing manual scenarios to be executed in a staging environment. It is **not an executable live test**.
- **No activation in this slice.**
- No executable live smoke test logic is provided.
- Real provider execution remains **disabled**.
- Real KV binding/read/write remains **disabled**.
- `kv_live` and `kv` mode enablement remains **disabled**.
- Endpoint default remains `stub`.
- Frontend source selector default remains `local_stub`.
- Endpoint client remains **disabled** by default.
- No `env.SCOUT_RATE_LIMIT_KV`, `env.KV`, `global.KV`, or `globalThis.KV` access is present.
- No KV `get`, `put`, `list`, or `delete` calls exist in executable code.
- No `DurableObject`, `D1Database`, `DB`, or `fetch` used.
- No provider SDK or external network used.
- No secrets or `process.env` exposed.
- No automatic allow on missing/malformed/stale/untrusted quota state.

## Related Safety Slices
- #2584 / #2585: KV skeleton activation gates.
- #2586 / #2588: KV live storage key/value schema and TTL policy.
- #2589 / #2592: disabled real-KV adapter interface scaffold without binding access.
- #2594 / #2596: disabled real-KV adapter result codes mapped into dependency safe-fail taxonomy.
- #2597 / #2598: Scout live rate-limit storage readiness matrix.
- #2599 / #2600: Scout live activation preflight checklist.

## Manual Smoke Test Scenarios

The following scenarios are manual/operator-facing checks that must be confirmed by a human operator:

### Preparation & Gate Checks
- [ ] **Pre-activation confirmation:** Verify all preflight checks are complete.
- [ ] **Staging-only activation confirmation:** Verify we are operating strictly in the staging environment.
- [ ] **Endpoint default remains stub before activation:** Confirm endpoint returns stub data without explicit configuration.
- [ ] **Frontend source selector remains local_stub before activation:** Verify the UI connects to the local stub.
- [ ] **Endpoint client remains disabled before activation:** Confirm no live network calls originate from the client automatically.

### Subsystem Verification (Post-Activation)
- [ ] **Auth-required request behavior:** Ensure requests lacking valid auth are properly rejected.
- [ ] **Missing/malformed auth behavior:** Ensure broken auth headers safe-fail reliably.
- [ ] **Rate-limit unavailable safe-fail behavior:** If the rate limit subsystem fails or is disconnected, ensure it fails closed (no unauthorized quota bypass).
- [ ] **Provider unavailable safe-fail behavior:** Ensure network/provider failures do not expose raw errors or stack traces.
- [ ] **KV unavailable safe-fail behavior:** Ensure KV binding absence or errors result in safe-fails.
- [ ] **No automatic allow on missing/malformed/stale/untrusted quota state:** Verify failure modes strictly enforce rejection.

### Data Privacy & Observability
- [ ] **No sensitive data in client-visible responses:** Validate the response payload via network tab.
- [ ] **No sensitive data in logs:** Confirm Cloudflare logs do not capture PII, raw headers, or full KV payloads.
- [ ] **Save-to-LoveTree remains user-reviewed and not automatic:** Confirm the user must explicitly opt-in to save generated output.
- [ ] **Source link remains visible:** Verify attribution back to the original content URL.
- [ ] **Original source content is not rehosted or stored in full:** Check the database/tree output to ensure raw extraction is not saved.

### Rollback & Record
- [ ] **Kill switch / rollback confirmation:** Turn off the activation flag and verify the system immediately reverts to safe defaults.
- [ ] **Post-activation smoke test pass/fail recording:** Document the results of this test in the designated operations channel before concluding the activation.
