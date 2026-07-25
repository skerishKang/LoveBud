# UI Screenshot and CTO Visual Review Policy

> **Hard governance:** `MVP_AGENT_GOVERNANCE.md`  
> **UI fast lane:** `../project/UI_RAPID_ITERATION_LANE.md`  
> **Role model:** `../project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`

Refs #901.  
Refs #588.  
Refs #681.

## Purpose

Functional verification and subjective visual judgment are different activities.

Executors can verify that a page loads, controls work, routes open, and no fatal errors appear. Final judgment about visual hierarchy, brand fit, spacing, density, alignment, illustration quality, and perceived polish belongs to the Web CTO/user.

Screenshots are evidence, not a universal pre-merge ceremony.

## Risk-based screenshot requirements

### U0 — Copy-only

Pre-merge screenshots are normally not required.

Use a screenshot only when:

- copy wraps or truncates unpredictably;
- localization length may affect layout;
- the exact rendered state cannot be inferred from the diff.

Final check: narrow Production copy confirmation.

### U1 — Visual-only

Pre-merge screenshots are optional.

Use them when:

- the visual result is difficult to infer from the selector/value delta;
- clipping, contrast, overflow, or alignment risk is material;
- several breakpoints can be affected;
- the Web CTO requests a visual comparison.

Final check: Production visual confirmation by Web CTO/user.

### U2 — Structural UI

Screenshots or equivalent rendered evidence are normally useful for the affected states and viewports.

Capture only what the contract can affect. Desktop and mobile are both required only when both can plausibly change.

### U3 — Runtime-sensitive UI

Screenshots are required when browser/runtime state is part of acceptance, alongside functional/auth/console/network evidence.

## Executor role

Executors may report:

```text
SCREENSHOT_CAPTURED
PAGE_LOADED
CTA_CLICK_WORKS
ROUTE_TARGET_MATCHED
NO_FATAL_CONSOLE_ERRORS
NO_HORIZONTAL_OVERFLOW
MOBILE_STATE_CAPTURED
SECRET_PRIVATE_EXPOSURE_NO
```

They may report concrete visible facts:

```text
button is visible
card title wraps to two lines
panel is open
label appears above the node
mobile screenshot shows one column
```

They do not make final subjective claims such as:

```text
VISUAL_PASS
UI_APPROVED
BRAND_ALIGNED
LAYOUT_LOOKS_GOOD
READY_FROM_VISUAL_QA
```

Use instead:

```text
SCREENSHOT_READY_FOR_CTO_UI_REVIEW
VISUAL_JUDGMENT_REQUIRED
```

## Evidence environment

Preview/fixed slot is optional evidence unless explicitly assigned. Its absence is not a screenshot blocker.

The current default is:

```text
focused pre-merge checks
→ safe merge
→ Production screenshot/visual confirmation when the class requires it
```

Local screenshots may be used for UI Lab or structural reference, with evidence limitations reported for auth/API/runtime-dependent pages.

## Safe capture

Do not expose:

- actual email or credential;
- token, cookie, session, Authorization header;
- private UID, tree ID, memory ID, owner ID, or database row;
- raw private URL or request/response payload;
- secret-file/password-manager contents.

Use sanitized test data, crops, and redacted labels.

## Suggested evidence by class

| Class | Default screenshot evidence |
|---|---|
| U0 | none pre-merge; narrow Production confirmation |
| U1 | optional before/after; Production visual check |
| U2 | affected desktop/mobile/state screenshots |
| U3 | affected runtime states plus functional evidence |

## Report template

```text
UI Evidence Report

Target:
- PR/Issue:
- UI class:
- exact head or Production merge SHA:
- evidence level:

Functional facts:
- page load:
- route/action:
- console/network:
- overflow:
- secret/private exposure:

Screenshots:
- required by contract: YES / NO
- desktop: CAPTURED / NOT_REQUIRED / MISSING
- mobile: CAPTURED / NOT_REQUIRED / MISSING
- close crop: CAPTURED / NOT_REQUIRED / MISSING

Visible facts:
- ...

Executor status:
- SCREENSHOT_READY_FOR_CTO_UI_REVIEW
- FUNCTIONAL_EVIDENCE_READY_VISUAL_NOT_REQUIRED
- EVIDENCE_PARTIAL
```

## Acceptance

This policy is satisfied when:

1. screenshot effort matches U0/U1/U2/U3 risk;
2. functional facts are separated from subjective judgment;
3. final visual judgment remains with Web CTO/user;
4. low-risk UI is not delayed by mandatory preview/fixed-slot or unnecessary screenshot matrices.

Refs #3664.  
Refs #3662.  
Refs #1882 — Keep OPEN.
