# LoveBud Agent Instruction Policy

> Repository-wide policy for agent guidance sources.
> Defines the canonical instruction hierarchy and when tool-specific
> docs may be added.

## 1. Purpose

LoveBud uses multiple agents and operators in parallel. To prevent
silent divergence in safety / scope / validation rules, this document
fixes the **agent instruction source hierarchy** for the repository.

## 2. Canonical source

- The canonical repository-wide agent guidance is the root `AGENTS.md`.
- All agents and operators must read `AGENTS.md` first.
- Any tool-specific guidance must defer to `AGENTS.md` on conflicts.

## 3. Current state

- The root `.codex` marker file is **not used** and is no longer
  tracked. Agents must not depend on it.
- `CLAUDE.md` and `CODEX.md` are **not** the canonical repository
  source of truth for LoveBud. They are tool-side configuration files
  and may exist or be absent locally without affecting the repository
  contract.
- When repository-wide guidance changes, update `AGENTS.md` (and this
  policy document if the hierarchy itself changes). Do not duplicate the
  same rules into a new `CLAUDE.md` / `CODEX.md` / similar file.

## 4. When tool-specific guidance may be added

A new tool-specific document may be added only when ALL of the
following are true:

- It documents **actual configuration or execution** required by a
  specific tool that is not already covered by `AGENTS.md` or this
  policy.
- It does not contradict `AGENTS.md`. If a conflict exists,
  `AGENTS.md`'s repository-wide safety / scope / validation principles
  take precedence.
- It does not instruct runtime or deployment behavior changes. Behavior
  changes must be split into a separate issue and PR.

New tool-specific docs should live under `docs/ops/` with a descriptive
filename and must cross-link back to `AGENTS.md` and this policy.

## 5. Non-goals

This policy does **not**:

- Change any runtime behavior.
- Change any Cloudflare / Pages / Wrangler configuration.
- Change Scout, auth, API, DB, or functions code.
- Introduce new dependencies.
- Modify `.gitignore`.

## 6. Issue hygiene

When opening issues or PRs that reference this policy:

- Use `Refs #2714` for this policy/structure issue.
- Use `Refs #1882` for the parent product issue.
- **Never** use `Closes #1882`, `Fixes #1882`, or `Resolves #1882`.
  Parent product issues are tracked separately from this hygiene work.

Refs #2714
Refs #1882
