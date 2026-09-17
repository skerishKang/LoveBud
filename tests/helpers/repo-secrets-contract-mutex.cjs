'use strict';

/**
 * LoveBud — cross-process serialization for contract tests that read or write
 * the REAL repository `.secrets` directory (Refs #4382).
 *
 * Problem (#4382): `node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs
 * tests/contracts/*.test.cjs` runs test FILES in parallel processes. Several
 * contract files legitimately create and remove transient fixtures inside the
 * real `REPO/.secrets` (the Production-readonly boundary rejects any secret
 * path outside `.secrets`, so OS-isolated temp roots are not an option), while
 * `production-readonly-catalog-boundary-contract.test.cjs` snapshots the real
 * `.secrets` listing and asserts `deepEqual(after, before)`.
 *
 * A transient fixture created and removed by another file inside that snapshot
 * window makes that assertion fail with no source regression. That is the
 * observed `verify-static` flake (`.test-tmp-role-fail-<timestamp>`).
 *
 * Fix: every file that touches the real `.secrets` holds this exclusive
 * filesystem mutex for its duration, so those files never overlap. The
 * boundary snapshot semantics are preserved exactly — nothing in the assertion
 * is weakened.
 *
 * Properties:
 *   - exclusive across processes (atomic `mkdirSync` lock directory on the OS
 *     temp root, shared by every process on the machine);
 *   - reentrant inside one process, so nested acquisition never deadlocks;
 *   - fail-loud: acquisition timeout throws instead of silently racing;
 *   - self-healing: a lock whose owner process died, or whose owner identity
 *     was never written, is reclaimed instead of hanging the suite;
 *   - released on process exit so a failed file does not strand later files.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MUTEX_DIR = path.join(os.tmpdir(), 'lovebud-repo-secrets-contract-mutex');
const OWNER_FILE = path.join(MUTEX_DIR, 'owner.json');
const RETRY_INTERVAL_MS = 15;
const ACQUIRE_TIMEOUT_MS = 120000;
// Only used when the lock directory exists but no owner identity was written
// (crash between mkdir and owner write). A live owner is never aged out.
const UNIDENTIFIED_LOCK_STALE_MS = 60000;

const MUTEX_TIMEOUT_ERROR = 'REPO_SECRETS_CONTRACT_MUTEX_TIMEOUT';

let depth = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readOwner() {
  try {
    const parsed = JSON.parse(fs.readFileSync(OWNER_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the pid exists but is owned by another user.
    return Boolean(err && err.code === 'EPERM');
  }
}

/**
 * A lock is reclaimable only when we can prove the owner is gone:
 *   - owner identity present and its process no longer exists; or
 *   - owner identity absent/never written AND the lock directory is old.
 * A live owner always keeps the lock, no matter how long it holds it.
 */
function isReclaimable() {
  const owner = readOwner();
  if (owner && Number.isInteger(owner.pid)) {
    if (owner.pid === process.pid) return false;
    return !isProcessAlive(owner.pid);
  }
  try {
    return Date.now() - fs.statSync(MUTEX_DIR).mtimeMs > UNIDENTIFIED_LOCK_STALE_MS;
  } catch {
    // Lock directory disappeared; the caller should retry acquisition.
    return false;
  }
}

function tryAcquireOnce() {
  try {
    fs.mkdirSync(MUTEX_DIR);
  } catch (err) {
    if (err && err.code === 'EEXIST') return false;
    throw err;
  }
  try {
    fs.writeFileSync(
      OWNER_FILE,
      JSON.stringify({ pid: process.pid, acquiredAt: Date.now() }),
      'utf8'
    );
  } catch {
    // Owner identity is advisory; the directory itself is the lock.
  }
  return true;
}

function dropLock() {
  try {
    fs.rmSync(MUTEX_DIR, { recursive: true, force: true });
  } catch {
    // Best effort; a surviving lock is reclaimed by isReclaimable().
  }
}

function releaseOnExit() {
  if (depth > 0) {
    depth = 0;
    dropLock();
  }
}

process.on('exit', releaseOnExit);

/**
 * Acquire the exclusive real-`.secrets` contract mutex.
 * Reentrant within one process: nested calls only increment a counter.
 *
 * @returns {Promise<void>}
 */
async function acquireRepoSecretsContractMutex() {
  if (depth > 0) {
    depth += 1;
    return;
  }
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;
  for (;;) {
    if (tryAcquireOnce()) {
      depth = 1;
      return;
    }
    if (isReclaimable()) dropLock();
    if (Date.now() >= deadline) {
      const err = new Error(MUTEX_TIMEOUT_ERROR);
      err.code = MUTEX_TIMEOUT_ERROR;
      throw err;
    }
    await sleep(RETRY_INTERVAL_MS);
  }
}

/**
 * Release one level of the mutex. The filesystem lock is removed only when the
 * outermost level is released.
 *
 * @returns {void}
 */
function releaseRepoSecretsContractMutex() {
  if (depth === 0) return;
  depth -= 1;
  if (depth === 0) dropLock();
}

/**
 * Run `fn` while holding the exclusive real-`.secrets` contract mutex.
 *
 * @template T
 * @param {() => T | Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withRepoSecretsContractMutex(fn) {
  await acquireRepoSecretsContractMutex();
  try {
    return await fn();
  } finally {
    releaseRepoSecretsContractMutex();
  }
}

/**
 * Hold the mutex for the whole lifetime of the calling test file by
 * registering top-level `before`/`after` hooks.
 *
 * Use this in any contract file that reads or writes the real `REPO/.secrets`.
 *
 * @returns {void}
 */
function holdRepoSecretsContractMutexForFile() {
  const { before, after } = require('node:test');
  before(async () => {
    await acquireRepoSecretsContractMutex();
  });
  after(() => {
    releaseRepoSecretsContractMutex();
  });
}

module.exports = {
  MUTEX_TIMEOUT_ERROR,
  acquireRepoSecretsContractMutex,
  releaseRepoSecretsContractMutex,
  withRepoSecretsContractMutex,
  holdRepoSecretsContractMutexForFile,
};
