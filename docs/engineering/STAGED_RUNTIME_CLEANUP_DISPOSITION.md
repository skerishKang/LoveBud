# Staged Runtime Cleanup Disposition

> Status: disposition map only
> Related: #225
> Runtime impact: none

## 1. Purpose

This document maps Issue #225 staged runtime cleanup items to current owners and next steps.

This is a disposition map only. It does not authorize immediate implementation of any staged cleanup items.

## 2. Disposition Summary

### Stage 1: Auth/Login legacy fallback reduction
- Owner: TBD
- Status: Staged
- Next step: Separate owner issue/implementation tracker required before any implementation

### Stage 1: Editor fallback removal
- Owner: TBD
- Status: Staged
- Next step: Separate owner issue/implementation tracker required before any implementation

### Stage 2: Editor global state encapsulation
- Owner: TBD
- Status: Staged
- Next step: Separate owner issue/implementation tracker required before any implementation

### Stage 3: Optional bundler feasibility
- Owner: TBD
- Status: Staged
- Next step: Separate owner issue/implementation tracker required before any implementation

### Stage 4: Password policy strengthening
- Owner: TBD
- Status: Staged
- Next step: Separate owner issue/implementation tracker required before any implementation

## 3. Non-goals

This disposition map does not authorize:

- Modifying `js/auth.js`
- Modifying `js/editor.js`
- Removing any fallback implementations
- Adding EditorStore
- Converting to `type="module"`
- Adding Vite/Rollup or other bundlers
- Changing Cloudflare Pages routing or API
- Implementing password policy changes
- Modifying PR #7/prototype/reference/demo/variant paths

This document alone does not close Issue #225.

## 4. Closure Conditions

Issue #225 closure review is only possible after:

- Each stage has been assigned a separate owner issue/implementation tracker
- Implementation decisions have been made per stage
- Any implementation work has been tracked in separate PRs

## 5. Recommended Immediate Next Step

Add a comment to Issue #225 linking to this disposition map and decide whether to maintain #225 as an umbrella tracker.

