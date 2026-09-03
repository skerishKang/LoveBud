# LoveBud Scout Engine Transport Contract
#1882 S4A

S4A implements a bounded server-only transport from the LoveBud Scout Product Adapter
to the Padiem AI Engine `/internal/v1/execute` completed-run endpoint.

## Topology

```text
LoveBud Scout
  ↓
Padiem AI Engine
  ↓
Padiem AI Core
  ↓
B14
  ↓
Provider/model
```

LoveBud does NOT create direct Core, Provider, or B14 runtime paths.

## Server-Owned Identity

The following fields are server-owned and cannot be overridden by browser input:

- `app_id = lovebud-scout`
- `agent.id = scout-suggestion-v1`
- `agent.title = LoveBud Scout Suggestion`
- `agent.description = Generates bounded fan-domain suggestions from normalized Scout product intent`
- `agent.system_instruction = ...`
- `agent.task_type = general`
- `agent.optimize_for = balanced`
- `agent.max_tokens = derived from normalized Scout Product maxOutputLength, bounded by the server to a maximum of 500`

Scout/fan-domain semantics remain LoveBud-owned through:

- `agent.id`
- `agent.title`
- `agent.description`
- `agent.system_instruction`
- LoveBud Product Adapter contract

Generic B14 routing vocabulary remains:

- `task_type = general`
- `optimize_for = balanced`

Service identity headers constructed server-side:

- `X-Padiem-Engine-Caller`
- `X-Padiem-Engine-Credential`

## Request Shape

```json
{
  "app_id": "lovebud-scout",
  "agent": { ... server-owned ... },
  "messages": [
    { "role": "user", "content": "..." }
  ]
}
```

Allowed optional fields: `session_id`, `additional_system_context`, `trace_id`, `execution_context`, `context_permission`, `context_permission_required`

For S4A, `context_permission` and `context_permission_required` are ABSENT.

## Response Shape

Engine returns:

```json
{
  "ok": true,
  "answer": "{\"titleSuggestion\":\"...\",\"summarySuggestion\":\"...\",...}"
}
```

Engine error envelope (canonical):

```json
{
  "ok": false,
  "error": {
    "code": "...",
    "message": "...",
    "retryable": false,
    "metadata": null
  }
}
```

LoveBud projects ONLY:

- `titleSuggestion` (max 50 chars)
- `summarySuggestion` (max 200 chars)
- `translationSuggestion` (max 500 chars)
- `emotionTags` (max 4 tags, each max 20 chars)
- `memoSuggestion` (max 500 chars)
- `safetyNote` (max 300 chars)

The following are NEVER surfaced to the Product output:

- `route`
- `provider`
- `model`
- `Engine metadata`
- `context_permission diagnostics`
- `Core Evidence internals`
- `credential`
- `service identity`
- `raw Engine response`
- `retryable`
- `metadata`

## sourceUrl Policy

In S4A, `sourceUrl` is ATTRIBUTION ONLY. No URL fetch occurs.

## Fail-Closed

- Missing Engine service binding → `ENGINE_BINDING_MISSING`
- Engine binding exists but caller identity or credential missing → `ENGINE_CREDENTIAL_MISSING`
- Engine request fails → bounded Scout error envelope
- Engine response invalid → bounded Scout error envelope
- Engine answer parse fails → bounded Scout error envelope

No fallback to direct Provider, stub, or Core runtime.

Engine transport is independent of legacy Provider LIVE mode.

## Preserved Behaviors

- `local_stub = DEFAULT`
- `endpoint_client = EXPLICIT OPT-IN`
- `DIRECT_PROVIDER_RUNTIME_REMOVED = NO`
- `ENGINE_RUNTIME_ACTIVATED = NO` (source-only; runtime binding not activated)
- `B14_RUNTIME_ACTIVATED = NO`
- `CORE_EXTENSION_CREATED = NO`

## Activation

Source-only opt-in via:

```
SCOUT_ENGINE_TRANSPORT_ENABLED=true
```

Runtime binding and private credential activation require separate CENTRAL authorization.

## Files

- `functions/api/scout/scout-engine-transport.js`
- `functions/api/scout/suggest.js`
- `tests/contracts/scout-engine-transport-contract.test.cjs`
- `tests/contracts/scout-engine-endpoint-wiring-contract.test.cjs`
- `tests/test-layer-classification.json`

Refs #1882
Keep #1882 open
