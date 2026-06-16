# LoveBud Scout Live Integration Test Harness Readiness Audit

> This is a docs/contracts-only readiness audit for #2557. It audits only the `live integration test harness` blocker from #2522. It does not implement a harness, does not run live integration tests, and does not close #1882.

## 1. Scope

- This is a docs/contracts-only readiness audit.
- This issue audits only the `live integration test harness` blocker.
- This issue does not implement a live integration test harness.
- This issue does not run live integration tests.
- This issue does not enable any live provider execution.
- This issue does not close #1882.
- This issue does not authorize live integration test implementation work.
- Closing this issue does not authorize live execution.

## 2. Parent / dependency map

- #1882 remains open.
- #2522 blocker map is the parent blocker inventory.
- #2524 already covered `runtime Firebase auth enforcement`.
- #2526 already covered `persistent rate-limit storage`.
- #2528 already covered `runtime cost/quota monitor`.
- #2530 already covered `runtime abuse reporting`.
- #2538 already covered `provider-specific real adapter`.
- #2557 covers only `live integration test harness`.

## 3. Current safe defaults

- Endpoint default remains `stub`.
- Frontend default remains `local_stub`.
- Live endpoint client remains disabled.
- No live integration test execution is enabled.
- No harness is added.
- No live test fetch/network call is added.
- No live test credentials are read.
- No test API key/env secret usage is added.
- No DB/API/schema changes are made.
- No test runner is registered.

## 4. Future live integration test harness prerequisites

The following checklist describes the conditions a future implementation issue must satisfy before any live integration test harness is built:

- explicit opt-in test harness flag (e.g. `SCOUT_RUN_LIVE_TESTS`)
- explicit not-run-by-default policy
- test environment allowlist (branches, CI jobs, or manual operators)
- dedicated test credential source policy (separate from production credentials)
- network isolation policy (sandbox/VPC/IP allowlist)
- sandboxed test budget and cost cap
- rate-limit storage integration for tests
- Firebase auth enforcement for the test runner
- provider error taxonomy mapping for test failures
- observability/log redaction policy for test runs
- kill switch / rollback policy for tests
- test data isolation (no production data exposure)
- teardown and cleanup policy after each run
- CI workflow gating (manual approval, branch protection, audit trail)
- timeout policy per test and per suite
- retry policy for transient test failures
- no frontend secret exposure
- documentation for safe local invocation

## 5. Runtime non-goals

This issue explicitly forbids the following runtime behavior:

- no live integration test execution
- no harness implementation
- no test fetch/network
- no live test credential access
- no provider SDK
- no prompt construction runtime
- no retry runtime
- no timeout runtime
- no streaming runtime
- no model selection runtime
- no response parsing runtime
- no cost accounting runtime
- no endpoint behavior change
- no frontend live endpoint enablement
- no database/schema changes
- no Browse/Search/#1661 work

## 6. Future issue recommendation

Any future implementation issue should be split into smaller, independently closable units before a real harness is attempted. Recommended units:

- live integration test harness contract interface (input, output, lifecycle)
- opt-in flag and config validation
- test credential deployment checklist
- network isolation and sandbox setup
- test budget and cost cap policy
- only after those are closed, live integration test harness may be implemented

## 7. Closure policy

- #2557 may close when this readiness audit document and its companion contract test are merged.
- Closing #2557 does not authorize live integration test execution.
- #1882 remains open until the real-live Scout blockers are satisfied or an explicit not-planned decision is made.
- #2557 is a docs/contracts-only milestone; it does not flip any runtime feature flag.
