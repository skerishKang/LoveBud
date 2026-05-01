# Browser Verification Slot Assignment Gate

Status: Active ops guardrail
Owner: CTO / Ops Lead
Scope: browser, network, Auth, API, data-loaded, and fixed-slot verification prompts

## Purpose

This document closes a repeated workflow gap: browser verification tasks sometimes start without an explicit fixed test slot even when the target flow requires one.

The failure mode is not only executor error. It has two owners:

1. The task issuer did not assign a fixed slot before asking for browser verification.
2. The local/browser executor did not immediately classify the missing slot as a blocking prerequisite.

The fix is a mandatory slot decision gate before every browser/network verification prompt.

## Mandatory slot decision before prompt handoff

Before assigning any browser/network verification task, the requester must write one of these decisions into the task prompt or PR comment:

- `Final PASS target: PR Preview allowed`
- `Final PASS target: fixed slot assigned: testN`
- `Final PASS target: local-only allowed`
- `Final PASS target: not required because docs-only`

If none of those lines is present, the browser verifier must stop before opening URLs and report:

```text
Final status: BLOCKED_SLOT_DECISION_MISSING
Reason: browser/network verification requires an explicit final PASS target decision.
Required CTO action: assign a fixed slot, approve PR Preview as final PASS, approve local-only verification, or classify as docs-only.
```

## Automatic fixed-slot requirement

A fixed slot must be assigned before final PASS when any of these are true:

- Browse/Search verification depends on API or public data load.
- The test verifies network request timing, cache write, cache reuse, or prefetch behavior.
- The page is Auth-gated or account-bound: Editor, My Trees, Settings, Login, account flows.
- The PR Preview or branch preview is missing, DNS-blocked, MIME-broken, redirects to login unexpectedly, or has unknown SHA provenance.
- The verification requires stable domain behavior for Firebase/Auth/API/routing/clipboard/deep-link behavior.
- The task asks for merge-readiness based on browser behavior.

For these cases, a prompt that says only `Cloudflare Preview first` is insufficient. It must also say which fixed slot to use if preview is missing or invalid.

## Requester checklist

Before sending a browser verifier prompt, the requester must fill:

```text
Slot decision:
- Final PASS target:
- If fixed slot: testN / not applicable
- Test URL:
- Expected PR head SHA:
- Deployment SHA match required: YES/NO
- If PR Preview fails: use assigned fixed slot / stop and report / local-only partial
```

If the requester cannot assign a slot yet, do not ask for runtime PASS. Ask only for static review or URL discovery.

## Executor startup gate

At the start of a browser/network verification task, the executor must answer:

```text
1. Does this task require rendered browser/network behavior? YES/NO
2. Does it involve Auth/API/data/cache/prefetch/deep-link behavior? YES/NO
3. Is a final PASS target explicitly assigned? YES/NO
4. If fixed slot is required, which slot was assigned?
5. If no slot was assigned, stop with BLOCKED_SLOT_DECISION_MISSING.
```

Do not spend time trying guessed URLs when the slot decision is missing.

## Valid and invalid behavior

Valid:

- PR Preview works and the task explicitly allows PR Preview final PASS.
- Fixed slot is assigned and deployed SHA matches the expected PR head SHA.
- Local-only is explicitly allowed and report says `LOCAL_ONLY`.
- Docs-only verification proceeds from GitHub metadata without browser runtime claims.

Invalid:

- Trying guessed deployment hash URLs as if they are assigned targets.
- Using `/pr/<number>` paths as final PASS URLs.
- Searching for preview URLs for a long time when the task already requires a fixed slot.
- Reporting `NOT_VERIFIED` after preview failure when the correct action was to request or use a fixed slot.
- Using any fixed slot without explicit assignment.
- Assuming `test1` by habit.

## Standard blocked report

Use this exact short report when no slot decision exists:

```text
Browser verification blocked before runtime execution.

Final status: BLOCKED_SLOT_DECISION_MISSING
Reason:
- This task requires browser/network verification.
- The task did not explicitly approve PR Preview final PASS, local-only final PASS, or a fixed slot.
- Executor must not guess URLs or choose a fixed slot.

Required CTO action:
- Assign test1-test10, or
- explicitly approve PR Preview final PASS, or
- explicitly approve local-only verification, or
- reclassify the task as docs/static-only.

No code changes, commit, push, ready transition, merge, or issue close performed.
```

## Standard fixed-slot assignment block

When assigning a slot, use this minimal block:

```text
Fixed slot assignment:
- PR:
- Branch:
- Expected head SHA:
- Assigned slot:
- Test URL:
- Deploy PR head to assigned slot: YES
- Deployment SHA match required: YES
- Other slots allowed: NO
- Ready/merge/issue close allowed: NO unless separately instructed
```

## Standard browser verification prompt prefix

Every browser/network verification prompt should start with:

```text
Slot decision:
- Final PASS target: <PR Preview allowed | fixed slot assigned: testN | local-only allowed | docs-only no browser>
- Test URL: <url or not assigned>
- Expected head SHA: <sha>
- If PR Preview is invalid: <use assigned fixed slot | stop with BLOCKED_SLOT_DECISION_MISSING>
```

## Relationship to existing docs

This document does not replace:

- `TEST_PREVIEW_SLOTS.md`
- `LOCAL_BROWSER_VERIFICATION_STARTUP.md`
- `BROWSER_VERIFICATION_URL_POLICY.md`
- `AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md`

It adds the missing handoff gate that prevents slot assignment from being forgotten.

## Operational rule

No browser/network prompt should leave the CTO handoff without an explicit final PASS target decision.

No browser/network executor should proceed past startup without that decision.
