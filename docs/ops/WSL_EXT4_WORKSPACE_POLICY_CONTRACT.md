# WSL ext4 workspace policy integration contract

This temporary contract tracks the repository-entrypoint integration of `docs/ops/WSL_EXT4_WORKSPACE_POLICY.md` into `AGENTS.md` and `docs/ops/PATHS_AND_SHELLS.md`.

Required integration:

- Windows-native remains the default local execution environment.
- WSL remains explicit opt-in only.
- Once WSL is authorized, Node-heavy development and validation must run under `$HOME/worktrees` on WSL ext4.
- `/mnt/*` is storage, archive, backup, and read-only comparison only.
- Native Windows workers are not subject to the WSL ext4 path rule.
- Existing mounted worktrees are preserved until migration is verified and user-approved for deletion.

Refs #1882 — Keep OPEN.
