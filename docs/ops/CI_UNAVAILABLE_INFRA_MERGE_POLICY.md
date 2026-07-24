# CI Unavailable Infrastructure Merge Policy

> **Status:** owner-approved governance policy
>
> Owner approval provenance: Issue #3642.
>
> Canonical authority: `docs/ops/MVP_AGENT_GOVERNANCE.md`.

## Purpose

GitHub Actions status must distinguish a real code or test failure from a workflow that never executed because the CI infrastructure was unavailable.

Private-repository Actions billing exhaustion, GitHub service outages, and runner allocation failures must not be reported as code failures when no relevant workflow step ran.

## State classification

### `CI_GREEN`

All required workflow jobs ran and completed successfully.

This is the normal merge path.

### `CI_EXECUTED_FAILURE`

At least one relevant lint, build, test, or verification step actually ran and failed.

This is a hard merge blocker. The infrastructure-unavailable exception must not be used.

### `CI_PENDING_EXECUTION`

A relevant workflow job is queued, in progress, or otherwise expected to run normally.

This is a temporary merge blocker. Do not relabel ordinary queueing or active execution as infrastructure unavailability.

### `CI_UNAVAILABLE_INFRA`

No relevant workflow step ran because of a confirmed infrastructure condition, including:

- GitHub Actions minutes or paid credits exhausted,
- billing or spending-limit enforcement,
- GitHub Actions service outage,
- GitHub-hosted runner allocation failure,
- another externally confirmed runner/platform failure that prevented execution.

A red workflow shell, job record with no steps, or failure created before runner execution may support this classification. A failing test step does not.

`CI_UNAVAILABLE_INFRA` is not evidence that the code passed. It is also not a code failure.

## Alternative-evidence merge path

A PR classified as `CI_UNAVAILABLE_INFRA` may be squash-merged only when every applicable requirement below is satisfied:

1. The exact PR head SHA is recorded and rechecked immediately before merge.
2. The current base/main SHA, merge base, ahead/behind state, commit list, changed files, and remote diff are reviewed.
3. Risk-appropriate focused or local automated tests pass on the exact reviewed head when such tests are available.
4. No reviewed code defect or unresolved blocking review finding remains.
5. The PR records:
   - the `CI_UNAVAILABLE_INFRA` classification,
   - the confirmed infrastructure reason,
   - which workflow steps did not run,
   - the alternative evidence used,
   - any verification limitation.
6. The merge uses the expected head SHA and squash merge.

Do not require unrelated infrastructure, Docker, PostgreSQL, browser, preview, or production verification solely to imitate the complete repository workflow. Verification must remain proportional to the PR's actual changed scope and risk classification.

## Cases that remain blocked

The alternative path does not permit merge when:

- a relevant lint, build, test, or verification step actually failed,
- a relevant check is genuinely queued or running,
- the reason for non-execution is unknown or ambiguous,
- the PR head changed after review and was not re-reviewed,
- the available alternative evidence is insufficient for the changed scope,
- a blocking code-review finding remains,
- the change requires separate owner approval under production data, schema, or security rules.

## Repository visibility

Making the repository public is not required to use this policy.

Repository visibility is a separate product, security, intellectual-property, and operational decision. It must not be changed solely to obtain free CI minutes without a dedicated public-readiness review.

## Reporting language

Use the following exact terms:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

Do not describe `CI_UNAVAILABLE_INFRA` as "tests failed." State that the workflow did not execute and identify the confirmed infrastructure reason.

Refs #3642
Refs #3442
Refs #1882
