# WSL ext4 Workspace Policy

**Status: CURRENT SOURCE OF TRUTH** for LoveBud work that is explicitly assigned to a WSL workstation.

This policy does not change the repository-wide default of native Windows + PowerShell for Windows workers. It defines the mandatory filesystem boundary when a task is explicitly assigned to WSL.

## 1. Operating rule

When a worker runs LoveBud under WSL, the active Git clone/worktree and all heavy development commands must live on the WSL internal Linux filesystem.

Preferred root:

```text
$HOME/worktrees/<task-name>
```

Do not run active development from Windows-mounted paths such as:

```text
/mnt/c/**
/mnt/d/**
/mnt/g/**
/mnt/*
```

Windows-mounted paths may be used only for source preservation, original assets, backups, exported screenshots, ZIP archives, and final artifacts.

## 2. Commands prohibited under `/mnt/*`

The following must not run from a Windows-mounted worktree:

```text
npm ci
npm install
npm test
npm run lint
npm run typecheck
npm run build
npm run db:check
Playwright
local development server
large repository-wide grep/find/copy operations
```

The reason is filesystem behavior, not product correctness: Node dependency trees and test suites perform large numbers of small-file operations, which are substantially slower on DrvFS-mounted Windows paths.

## 3. Environment matrix

```text
Native Windows worker
→ Windows path
→ PowerShell 7
→ Windows-native Node/toolchain

Explicit WSL worker
→ $HOME/worktrees path
→ bash
→ Linux Node/toolchain
→ WSL internal ext4 filesystem
```

Do not infer one environment from tool identity, computer number, or a historical path. Confirm the actual OS, shell, path, and filesystem before execution.

## 4. Required preflight for WSL tasks

Before dependency installation or tests:

```bash
pwd
findmnt -T . -o TARGET,SOURCE,FSTYPE,OPTIONS
df -T .
node --version
npm --version
git branch --show-current
git rev-parse HEAD
git status --short
```

Required outcome:

```text
path is not /mnt/*
filesystem is WSL internal ext4 or equivalent Linux filesystem
repository-authorized Node major is active
working branch/HEAD matches task authority
```

The migration itself must not change the repository Node major. Use `.nvmrc`, `.node-version`, `package.json` engines, CI workflow, or the task contract as authority.

## 5. New WSL worktrees

Create new active WSL worktrees under:

```text
$HOME/worktrees
```

Example:

```bash
mkdir -p "$HOME/worktrees"
git clone https://github.com/skerishKang/LoveBud.git "$HOME/worktrees/LoveBud-<task>"
```

For parallel work, use one writer per branch and one separate ext4 worktree per task.

Do not share `node_modules` between active branches. Do not symlink `node_modules` from another worktree as the steady-state policy. Run a clean `npm ci` in each ext4 workspace unless the task contract explicitly defines another immutable dependency authority.

## 6. Migrating an in-progress `/mnt/*` worktree

Do not restart or discard the task. Preserve the old worktree until the new ext4 workspace is proven.

Required sequence:

```text
1. Stop only processes whose cwd belongs to the old worktree.
2. Record old path, branch, HEAD, status, staged and unstaged changes.
3. Preserve local commits with `git bundle create --all`.
4. Preserve staged and unstaged changes as binary patches.
5. Record untracked files and copy only task-authorized source files.
6. Clone the bundle into `$HOME/worktrees`.
7. Restore the GitHub origin and fetch current refs.
8. Apply staged and unstaged patches in the correct order.
9. Compare old/new status, changed paths, stats, and file hashes.
10. Confirm ext4 and the repository-authorized Node version.
11. Run a fresh `npm ci`; do not copy or symlink old `node_modules`.
12. Confirm package and lockfile did not drift because of migration.
13. Resume the original task from its interruption point.
14. Keep the old Windows-mounted worktree until user-approved cleanup.
```

Do not use broad `rsync` of an entire worktree as the primary restore method. It can copy generated artifacts and loses staged/unstaged intent. Use `git bundle` + patches + an explicit untracked-file allowlist.

## 7. Process safety

Never use broad process termination such as:

```text
pkill node
pkill npm
killall
```

List candidate processes, inspect `/proc/<pid>/cwd`, and terminate only exact PIDs whose cwd belongs to the target worktree.

## 8. Validation behavior on ext4

Run full gates sequentially unless the task explicitly authorizes safe parallel execution.

Avoid artificial short shell timeouts around valid repository tests. Collect the real TAP/test command completion and exit code.

Prefer exact paths and `git grep` over repeated broad filesystem traversal.

For DB tasks, environment migration does not expand authority. Existing prohibitions on local PostgreSQL, Docker, provider access, Production access, or DB-engine execution remain in force.

## 9. Cleanup policy

The old `/mnt/*` worktree is a safety backup until all of the following are true:

```text
branch and starting HEAD were reproduced
staged/unstaged/untracked work was preserved
old/new file hashes match
fresh ext4 npm ci succeeded
assigned task resumed successfully
actual task commit and normal push succeeded
```

Even then, do not delete the old worktree automatically. Preserve it until the user explicitly approves cleanup.

## 10. Required migration report

```text
Marker:
LOVEBUD_WSL_WORKSPACE_READY
or
LOVEBUD_WSL_WORKSPACE_BLOCKED

Computer / worker:
Old path:
New path:
Branch:
Old HEAD:
New starting HEAD:
Old status:
New restored status:
Uncommitted changes preserved:
Old/new hashes equal:
Node version:
Filesystem:
npm ci:
package.json drift:
package-lock drift:
Old worktree preserved:
Implementation resumed:
Task commit/push:
PR changed:
Merge:
Deploy:
```

## 11. Standing interpretation

```text
Windows worker
→ stay native Windows

WSL worker
→ active development only under $HOME/worktrees on ext4

/mnt/*
→ preservation and artifact storage only
```

This policy is repository-wide for future explicitly assigned WSL work. Task-specific contracts may narrow it further but may not silently return heavy Node work to `/mnt/*`.

Refs #3865.
Refs #1882 — keep open.
