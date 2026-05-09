# Auth Line Ending and Formatting Audit

> **Status:** AUDIT_ONLY
> **Source:** Issue #78
> **Type:** Docs-only — no CRLF normalization, `.gitattributes`, JavaScript, Auth, or runtime changes

---

## 1. Purpose

This document records the line-ending and formatting audit plan for auth-related files, with `js/auth.js` as the primary target.

Issue #78 identifies `js/auth.js` as a high-risk shared runtime file. Any line-ending normalization must be handled as a dedicated format-only task so that reviewers can separate mechanical text changes from Auth behavior changes.

This PR does not normalize line endings, edit `.gitattributes`, modify JavaScript, or change Auth/runtime behavior.

---

## 2. Why `js/auth.js` Requires Line Ending Confirmation

`js/auth.js` is a central Auth runtime file. It controls or participates in:

- Auth bootstrap readiness;
- login/signup setup;
- logout/dropdown behavior;
- confirmed auth cache handling;
- Firebase session handling;
- protected-page callback registration;
- legacy compatibility globals and fallbacks.

Because the file is high-risk and large, a CRLF to LF conversion can produce a very large diff even when behavior is unchanged. That makes it easy to hide accidental logic edits. Therefore line-ending normalization must be isolated from all behavior changes.

---

## 3. `.gitattributes` Confirmation Requirement

Before any line-ending normalization PR, confirm whether the repository already declares line-ending policy in `.gitattributes`.

The audit should answer:

- Does `.gitattributes` exist?
- Does it set `text=auto` or explicit LF rules?
- Does it have JavaScript-specific line-ending rules?
- Would adding or changing `.gitattributes` affect many files outside Auth?

If `.gitattributes` needs modification, that should be a separate policy PR or an explicitly approved part of the format-only PR. It must not be mixed with Auth logic changes.

---

## 4. Format-Only Normalization Rule

CRLF to LF normalization must be done only in a format-only PR.

Allowed in a future format-only PR:

- line-ending normalization for the explicitly approved file set;
- optional `.gitattributes` update only if approved;
- no logic edits;
- no identifier changes;
- no whitespace cleanup beyond line-ending normalization unless explicitly approved.

Not allowed in the same PR:

- Auth behavior changes;
- alert replacement;
- token cache changes;
- namespace migration;
- fallback removal;
- `var` to `const` / `let` cleanup;
- duplicate declaration cleanup;
- Firebase config changes;
- page/script loading changes.

---

## 5. Required Verification Before Normalization

Before any implementation PR, run a read-only audit:

```bash
git ls-files --eol js/auth.js .gitattributes
file js/auth.js
```

If available on the platform, also inspect line endings with an editor or command that clearly distinguishes CRLF from LF.

Record:

- current `js/auth.js` EOL state;
- current `.gitattributes` state;
- whether the target file is mixed EOL, CRLF-only, or LF-only;
- whether normalization would touch only `js/auth.js` or additional files.

---

## 6. Required Verification After Normalization

A future format-only normalization PR must verify:

1. `git diff --check` passes.
2. `git diff --name-only origin/main...HEAD` contains only approved files.
3. The diff is line-ending/format-only and contains no semantic JavaScript edits.
4. Auth behavior is unchanged.
5. Login baseline still works.
6. Logout baseline still works.
7. Protected-page Auth gate baseline still works.
8. No fatal console errors appear in an approved browser verification target.

Because line-ending diffs can be noisy, reviewers should use whitespace-insensitive comparison where appropriate, but the final patch still needs normal Git review.

---

## 7. Auth Behavior Unchanged Principle

Line-ending normalization must not alter Auth behavior.

Preserve:

- `window.LoveBudAuthBootstrap` behavior;
- `window.registerOnAuthReady` behavior;
- confirmed auth cache behavior;
- Firebase `onAuthStateChanged` behavior;
- logout/dropdown behavior;
- login/signup form behavior;
- protected-page redirect behavior;
- legacy aliases and fallback paths.

If any behavior change is desired, open a separate implementation PR after the format-only work is complete.

---

## 8. Recommended Follow-up Split

Recommended sequence:

| Step | Scope | Notes |
|---|---|---|
| PR A | Audit docs only | This PR |
| PR B | Read-only EOL confirmation report | Optional if local tooling evidence is needed before normalization |
| PR C | Format-only normalization | Only approved files; no logic changes |
| PR D | Auth cleanup implementation | Separate PRs for `var` cleanup, alert replacement, token cache, namespace migration, or fallback reduction |

---

## 9. Guardrails

- Do not combine line-ending normalization with logic cleanup.
- Do not combine line-ending normalization with token cache cleanup.
- Do not combine line-ending normalization with alert replacement.
- Do not combine line-ending normalization with namespace migration.
- Do not combine line-ending normalization with fallback removal.
- Do not modify PR #7 or prototype/reference/demo/variant paths.
- Do not close Issue #78 from this audit-only work.

---

## 10. Next Recommended PR

The next safest step is a local read-only EOL confirmation report for `js/auth.js` and `.gitattributes`, followed by a separate format-only normalization PR only if the audit confirms CRLF or mixed line endings.

---

## Verification Checklist

- [ ] `git diff --check` passes.
- [ ] Changed files limited to `docs/security/AUTH_LINE_ENDING_FORMAT_AUDIT.md`.
- [ ] No CRLF normalization performed.
- [ ] No `.gitattributes` changes.
- [ ] No JavaScript changes.
- [ ] No Auth/runtime behavior changes.
- [ ] No close keywords for Issue #78.

---

## Related

Refs #78
