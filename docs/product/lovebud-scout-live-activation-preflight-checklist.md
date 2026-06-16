# LoveBud Scout Live Activation Preflight Checklist

**Issue context:**
- PR context: #2599
- Parent MVP: #1882

## Status Lock & Assertions
This slice strictly defines the preflight checklist for future activation and implements no runtime changes.
- **No activation in this slice.**
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

## Preflight Checklist

Before any staging or production live activation, the following must be manually verified and approved:

### 1. Scope & Environments
- [ ] **Parent MVP scope confirmation:** Changes align exactly with #1882 constraints.
- [ ] **Staging vs production distinction:** Staging endpoints and production endpoints are clearly separated and independently configurable.
- [ ] **Manual activation approval requirement:** Explicit approval is required before changing any environment variable to activate live mode.

### 2. Configuration & Secrets
- [ ] **Required env/config names and ownership:** All required configuration variables are documented with designated owners.
- [ ] **Secret storage and rotation policy:** Credentials (e.g., Firebase, Provider API keys) are stored securely and rotation policies are defined.

### 3. Subsystem Readiness
- [ ] **Auth verifier readiness:** Firebase Admin SDK or equivalent is fully implemented and securely handles verification.
- [ ] **Rate-limit storage readiness:** The `checkRateLimit` implementation correctly interacts with the underlying storage.
- [ ] **KV binding readiness:** Cloudflare KV bindings are configured and tested.
- [ ] **Provider execution readiness:** The LLM provider integration is thoroughly tested for performance and safety.
- [ ] **Endpoint client readiness:** The frontend-to-endpoint client can authenticate and handle live responses properly.
- [ ] **Frontend source selector readiness:** The UI safely toggles to the live source only when the environment permits.

### 4. Operations & Safety
- [ ] **Observability and logging readiness:** Proper monitoring is active to detect failures, leaks, and quota breaches.
- [ ] **Privacy/no-leak review:** Data storage policies ensure no PII or sensitive data is leaked or retained longer than necessary.
- [ ] **Copyright/content storage review:** Storage of any provider output complies with content storage restrictions.
- [ ] **Rollback/kill switch plan:** A clear, tested procedure is available to immediately disable live execution and revert to `stub`.
- [ ] **Post-activation smoke test plan:** A defined set of tests to be run manually immediately after activation.

### Blocking Conditions
Activation **MUST** be blocked if any of the following are true:
- The staging environment has not passed a full end-to-end integration test.
- Any secret is hardcoded or exposed in the repository.
- The kill switch cannot be activated within 5 minutes.
- The privacy/no-leak review is incomplete or failed.
