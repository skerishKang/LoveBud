# Shell Helpers Namespace Deps Alias Removal Audit

## Baseline

- main HEAD: `7875e5ce`
- #1698: OPEN
- open PR count: 0
- helper method aliases: 20/20 removed
- direct deps function aliases: 0
- namespace deps aliases: 1 (`shellHelpers`)

## Current Alias

Line 28 of `js/editor.js`:
```js
const shellHelpers = deps.shellHelpers;
```

## Usage Inventory

All 11 uses of `shellHelpers` follow the identical pattern: helper method alias + typeof guard. No pass-through, no shorthand, no optional chaining, no fallback chain.

| # | Current Pattern | Location | Role | Guard/Fallback | Proposed Direct Usage | Contract Coverage | Risk |
| -: | --------------- | -------- | ---- | -------------- | --------------------- | ----------------- | ---- |
| 1 | `const createEditorStartDependencyGuard = shellHelpers.createEditorStartDependencyGuard;` | L44 | Bootstrap dependency guard factory | `typeof … !== 'function'` → `report…('…missing')` then `return` | `const createEditorStartDependencyGuard = deps.shellHelpers.createEditorStartDependencyGuard;` | `editor-start-dependency-guard-contract.test.cjs:17` | LOW |
| 2 | `const createEditorStartDependencyChecker = shellHelpers.createEditorStartDependencyChecker;` | L46 | Dependency checker factory | `typeof … !== 'function'` → `report…('…missing')` then `return` | `const createEditorStartDependencyChecker = deps.shellHelpers.createEditorStartDependencyChecker;` | `editor-start-dependency-checker-contract.test.cjs:65` | LOW |
| 3 | `const createEditorRequiredGlobalWaiter = shellHelpers.createEditorRequiredGlobalWaiter;` | L52 | Global waiter factory | `typeof … !== 'function'` → `report…('…missing')` then `return` | `const createEditorRequiredGlobalWaiter = deps.shellHelpers.createEditorRequiredGlobalWaiter;` | `editor-startup-dependency-waiter-contract.test.cjs:58` | LOW |
| 4 | `const createEditorStartupShellApplier = shellHelpers.createEditorStartupShellApplier;` | L57 | Startup shell applier factory | `typeof … !== 'function'` → `report…('…missing')` then `return` | `const createEditorStartupShellApplier = deps.shellHelpers.createEditorStartupShellApplier;` | `editor-startup-shell-applier-contract.test.cjs:44` | LOW |
| 5 | `const createEditorCanvasEmptyGuideUpdater = shellHelpers.createEditorCanvasEmptyGuideUpdater;` | L63 | Canvas empty guide updater factory | `typeof … !== 'function'` → `report…('…missing')` then `return` | `const createEditorCanvasEmptyGuideUpdater = deps.shellHelpers.createEditorCanvasEmptyGuideUpdater;` | `editor-canvas-empty-guide-updater-contract.test.cjs:25` | LOW |
| 6 | `const createEditorSelectNodeHandler = shellHelpers.createEditorSelectNodeHandler;` | L70 | Node select handler factory | `typeof … !== 'function'` → `report…('…missing')` then `return` | `const createEditorSelectNodeHandler = deps.shellHelpers.createEditorSelectNodeHandler;` | (none specific) | LOW |
| 7 | `const createEditorSidebarStatusUpdater = shellHelpers.createEditorSidebarStatusUpdater;` | L76 | Sidebar status updater factory | `typeof … !== 'function'` → `report…('…missing')` then `return` | `const createEditorSidebarStatusUpdater = deps.shellHelpers.createEditorSidebarStatusUpdater;` | (none specific) | LOW |
| 8 | `const createEditorInitialMemoryProvider = shellHelpers.createEditorInitialMemoryProvider;` | L83 | Initial memory provider factory | `typeof … !== 'function'` → `report…('…missing')` then `return` | `const createEditorInitialMemoryProvider = deps.shellHelpers.createEditorInitialMemoryProvider;` | (none specific) | LOW |
| 9 | `const createEditorNextMemoryIdProvider = shellHelpers.createEditorNextMemoryIdProvider;` | L88 | Next memory ID factory | `typeof … !== 'function'` → `report…('…missing')` then `return` | `const createEditorNextMemoryIdProvider = deps.shellHelpers.createEditorNextMemoryIdProvider;` | (none specific) | LOW |
| 10 | `const createEditorInitialSelectionApplier = shellHelpers.createEditorInitialSelectionApplier;` | L93 | Initial selection applier factory | `typeof … !== 'function'` → `report…('…missing')` then `return` | `const createEditorInitialSelectionApplier = deps.shellHelpers.createEditorInitialSelectionApplier;` | (none specific) | LOW |
| 11 | `const createEditorReadyFinalizer = shellHelpers.createEditorReadyFinalizer;` | L98 | Ready finalizer factory | `typeof … !== 'function'` → `report…('…missing')` then `return` | `const createEditorReadyFinalizer = deps.shellHelpers.createEditorReadyFinalizer;` | (none specific) | LOW |

**Key observation:** All 11 usages are structurally identical — single property read from `shellHelpers.X`, assigned to a local const, followed by a typeof guard that checks the local variable name (NOT `shellHelpers.X`). The conversion from `shellHelpers.X` to `deps.shellHelpers.X` at the const assignment line preserves:
- The local variable name (unchanged)
- The typeof guard (references local var, not shellHelpers)
- The call sites (use local var, not shellHelpers)
- Load order (still after deps resolution, before startEditor)
- Guard behavior (unchanged)

## Contract Coverage

### Contracts that assert `const <var> = shellHelpers.<method>;` pattern in editor.js

| File | Line | Pattern Asserted | Must Update? |
| ---- | ---- | ---------------- | ------------ |
| `editor-post-bootstrap-alias-inventory-contract.test.cjs` | 16 | `const shellHelpers = deps.shellHelpers;` (expectedNamespaceAliases) | ✅ Yes → replace with empty expected list (0 remaining) |
| `editor-post-bootstrap-alias-inventory-contract.test.cjs` | 114-126 | `const <alias> = shellHelpers.<method>;` (forbidden list) | ✅ Already in forbidden list — no change needed |
| `editor-post-bootstrap-alias-inventory-contract.test.cjs` | 322-332 | `LoveBudEditorShellHelpers.<name> missing` (retained guards) | ✅ Guard messages use `LoveBudEditorShellHelpers.X` string — unchanged |
| `editor-post-bootstrap-alias-inventory-contract.test.cjs` | 345-358 | guarded boundaries by var name | ✅ Uses local var name, not shellHelpers — unchanged |
| `editor-entry-dependency-compatibility-inventory-contract.test.cjs` | 39-40 | Order: `const shellHelpers = deps.shellHelpers;` | ✅ Yes → remove this test or change to check `deps.shellHelpers.someRef` |
| `editor-entry-dependency-compatibility-inventory-contract.test.cjs` | 86 | `shellHelpers,` in returned alias list | ✅ Yes → remove from list (shellHelpers no longer needed as alias) |
| `editor-canvas-empty-guide-updater-contract.test.cjs` | 25 | `const createEditorCanvasEmptyGuideUpdater = shellHelpers.createEditorCanvasEmptyGuideUpdater` | ✅ Yes → change to `deps.shellHelpers.createEditorCanvasEmptyGuideUpdater` |
| `editor-start-dependency-guard-contract.test.cjs` | 17 | `const createEditorStartDependencyGuard = shellHelpers.createEditorStartDependencyGuard;` | ✅ Yes → change to `deps.shellHelpers.` prefix |
| `editor-startup-dependency-waiter-contract.test.cjs` | 58 | `const createEditorRequiredGlobalWaiter = shellHelpers.createEditorRequiredGlobalWaiter;` | ✅ Yes → change to `deps.shellHelpers.` prefix |
| `editor-start-dependency-checker-contract.test.cjs` | 65 | `const createEditorStartDependencyChecker = shellHelpers.createEditorStartDependencyChecker;` | ✅ Yes → change to `deps.shellHelpers.` prefix |
| `editor-startup-shell-applier-contract.test.cjs` | 44 | `const createEditorStartupShellApplier = shellHelpers.createEditorStartupShellApplier;` | ✅ Yes → change to `deps.shellHelpers.` prefix |
| `editor-required-global-waiter-contract.test.cjs` | 65 | `const createEditorRequiredGlobalWaiter = shellHelpers.createEditorRequiredGlobalWaiter;` | ✅ Yes → change to `deps.shellHelpers.` prefix |

### Contracts that are NOT affected (load `editor-shell-helpers.js` as module, not editor.js alias)

- `editor-current-moment-detail-opener-contract.test.cjs` — uses `vm.runInContext(shellHelpersSource, ...)`, not editor.js alias
- `editor-initial-selection-applier-contract.test.cjs` — same pattern (module load, not alias)
- `editor-next-memory-id-provider-contract.test.cjs` — same
- `editor-ready-finalizer-contract.test.cjs` — same
- `editor-shell-readiness-helper-contract.test.cjs` — same
- `editor-startup-context-contract.test.cjs` — different helper module, not shellHelpers
- `editor-bootstrap-missing-list-helper-contract.test.cjs` — checks guard messages only, not shellHelpers prefix

## Removal Strategy

**Approach: Single PR, direct production cleanup**

Change `js/editor.js`:
1. Remove line 28: `const shellHelpers = deps.shellHelpers;`
2. Lines 44-98: Change each `shellHelpers.X` to `deps.shellHelpers.X` at the const assignment (11 occurrences)

The typeof guards and call sites are unchanged — they reference the local variable name, not `shellHelpers`.

Update 8 contract files to expect `deps.shellHelpers.X` instead of `shellHelpers.X`.

**Exact conversion for each of the 11 lines (same pattern, repeated):**

```js
// Before:
const createEditorStartDependencyGuard = shellHelpers.createEditorStartDependencyGuard;

// After:
const createEditorStartDependencyGuard = deps.shellHelpers.createEditorStartDependencyGuard;
```

**Verification after change:**
```bash
git grep -nE 'const\s+shellHelpers\s*=\s*deps\.shellHelpers;' -- js/editor.js
# Expected: no result

git grep -nE '\bshellHelpers\b' -- js/editor.js
# Expected: no result (all converted to deps.shellHelpers.X)

node --check js/editor.js
# Expected: exit 0

node --test tests/contracts/*.test.cjs
# Expected: all pass

npm test
# Expected: 1846/1846 pass
```

## Recommendation

**Production cleanup ready: YES**

All three Case A conditions are satisfied:

1. ✅ All 11 usages are simple property reads (`shellHelpers.method`). No pass-through, no shorthand, no optional chaining, no fallback chain.
2. ✅ Converting to `deps.shellHelpers.method` preserves guard/fallback/load-order semantics identically — the typeof guard checks the local variable, not the source namespace.
3. ✅ 8 contract files will be updated in the same PR to assert `deps.shellHelpers.X` instead of `shellHelpers.X`. The guard message contracts (`editor-bootstrap-missing-list-helper`) and `editor-post-bootstrap-alias-inventory` guard boundary contracts use local variable names only, so they need no change.

**Contract-only PR needed first: NO**

All contract assertions directly test the `shellHelpers.X → method` pattern which becomes `deps.shellHelpers.X → method`. The typeof guard and call site contracts reference the local variable name, which is preserved. No new contract is needed to verify behavior that's currently untested.

**Sub-slice division needed: NO**

All 11 usages follow an identical structural pattern: `const <local> = <source>.<method>;` + typeof guard. There is no mixing of different responsibility types or access patterns. A single PR is safe.

**Recommended next slice:**

```
소이슈: [TECH DEBT] Remove editor shell helpers namespace deps alias
브랜치: refactor/editor-inline-shell-helpers-namespace-deps-alias
PR 제목: refactor(editor): inline shell helpers namespace deps alias
```

**Key difference from previous slices:** Unlike `editorTreeHelpers` (5 call sites, mix of shorthand/pass-through/property-read), `shellHelpers` is 11 identical const-assignment-with-guard patterns. The conversion is simpler but affects more lines (11 aliases + 8 contract files).
