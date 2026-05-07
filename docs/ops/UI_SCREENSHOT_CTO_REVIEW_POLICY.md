# UI Screenshot CTO Review Policy

Refs #901
Refs #588
Refs #681

## Purpose

LoveBud UI work must separate functional browser verification from visual judgment.

Browser/model executors are useful for confirming that a deployed page loads, routes work, controls respond, and no fatal errors appear. They are not the final authority for subjective UI quality, visual hierarchy, brand fit, screenshot composition, label alignment, or whether an illustration reads correctly.

For UI-sensitive issues and PRs, the executor must provide screenshot evidence and safe observations. The CTO/UI Lead reviews the screenshots directly and makes the final visual judgment.

## Rule

For UI-sensitive work:

```text
Executor/browser model: verify function, capture evidence, report safe facts.
CTO/UI Lead: inspect screenshots and make the visual judgment.
```

A model/executor report may say that a button clicked, a route opened, a panel rendered, a screenshot was captured, or no fatal console errors appeared. It must not be treated as sufficient proof that the UI looks correct.

## Why this policy exists

Recent visual review showed that a tree illustration could pass prior model-style wording while still visibly failing the intended perception: labels/chips looked detached from branch-tip anchors.

This type of issue cannot be closed by generic wording such as:

```text
looks good
visual pass
tree reads well
labels feel anchored
```

unless the CTO/UI Lead has inspected screenshots and accepted that claim.

## Applies to

Use this policy for UI-sensitive work including:

- Intro/Home hero visuals;
- tree illustration, branch, node, label, chip, and animation semantics;
- Browse card and selected preview visual hierarchy;
- My Trees card hierarchy and visual noise;
- Editor visual layout and affordance placement;
- Login/Auth visual hierarchy;
- mobile 375px layout screenshots;
- any visual claim involving brand tone, composition, spacing, density, alignment, or readability.

## Does not replace functional verification

This policy does not remove browser verification.

Runtime-sensitive PRs still require the existing gates when applicable:

- fixed slot or valid Cloudflare deployment;
- deployed SHA match;
- real browser;
- login-capable test account where needed;
- route/action checks;
- fatal console/network check;
- desktop/mobile smoke;
- secret/private-safe reporting.

The difference is that visual approval is not delegated to the verifier.

## Required executor behavior

For UI PRs, executor prompts must request screenshots explicitly.

Required evidence should include whichever are relevant:

```text
- desktop full-page or first-fold screenshot
- component close crop
- mobile 375px screenshot
- before screenshot when available
- after screenshot
- safe viewport labels
- safe state labels only
```

Executors must avoid exposing:

```text
actual email
password
token
session
cookie
header
private UID
tree ID
owner ID
memory ID
copied tree ID
DB row value
raw private URL
raw request/response payload
credential file contents
password manager contents
```

## Allowed executor conclusions

Executors may report functional and evidence status:

```text
SCREENSHOT_CAPTURED
DEPLOYED_SHA_MATCH
PAGE_LOADED
CTA_CLICK_WORKS
ROUTE_TARGET_MATCHED
NO_FATAL_CONSOLE_ERRORS
NO_HORIZONTAL_OVERFLOW
MOBILE_SCREENSHOT_CAPTURED
SECRET_PRIVATE_EXPOSURE_NO
```

Executors may report visible facts without making final judgment:

```text
label appears above the node
label appears far from branch tip
button is visible
panel is open
card title is truncated
mobile screenshot shows two rows
```

## Forbidden final visual conclusions by executor alone

Unless the CTO/UI Lead has inspected and accepted the screenshot, executor reports must not final-pass claims such as:

```text
VISUAL_PASS
UI_APPROVED
BRAND_ALIGNED
TREE_READS_AS_ORGANIC
LABELS_FEEL_ANCHORED
LAYOUT_LOOKS_GOOD
READY_FROM_VISUAL_QA
```

Instead use:

```text
SCREENSHOT_READY_FOR_CTO_UI_REVIEW
VISUAL_JUDGMENT_REQUIRED
```

## Required PR status vocabulary

Use these statuses for UI-sensitive PRs:

```text
FUNCTIONAL_BROWSER_PASS_SCREENSHOT_PENDING
SCREENSHOT_READY_FOR_CTO_UI_REVIEW
CTO_UI_REVIEW_PASS
CTO_UI_REVIEW_NEEDS_FIX
CTO_UI_REVIEW_BLOCKED_SCREENSHOTS_MISSING
```

A UI PR should not be marked ready/merge based only on model visual judgment.

## PR prompt template addition

Every UI-sensitive implementation or browser verification prompt should include:

```text
UI screenshot review rule:
- Do not make final visual-quality judgment.
- Verify functionality only.
- Capture required screenshots safely.
- Report concrete visible facts and evidence status.
- Final UI judgment belongs to CTO/UI Lead after screenshot review.
```

## Report template

```text
UI Verification Evidence Report

Target:
- PR:
- Issue:
- URL:
- Expected SHA:
- Deployed SHA:
- SHA match:

Functional checks:
- Page load:
- Route/action behavior:
- Fatal console errors:
- Horizontal overflow:
- Secret/private exposure:

Screenshot evidence:
- Desktop screenshot: CAPTURED / MISSING / LOCAL_ONLY
- Close crop: CAPTURED / MISSING / LOCAL_ONLY
- Mobile 375px: CAPTURED / MISSING / LOCAL_ONLY

Observed visible facts:
- ...

Executor final status:
- SCREENSHOT_READY_FOR_CTO_UI_REVIEW
- or FUNCTIONAL_BROWSER_PASS_SCREENSHOT_PENDING
- or CTO_UI_REVIEW_BLOCKED_SCREENSHOTS_MISSING
```

## Acceptance criteria

This policy is satisfied when future UI-sensitive prompts and PR reports separate:

1. functional verification by browser/model executor;
2. screenshot evidence capture;
3. final visual judgment by CTO/UI Lead.

No UI issue should be closed as visually complete only because a model or executor said it looked good.
