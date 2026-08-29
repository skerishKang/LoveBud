'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const RECON_FAILURE = Object.freeze({
  INPUT_INVALID: 'INPUT_INVALID',
  PRIVATE_OUTPUT_PATH_INVALID: 'PRIVATE_OUTPUT_PATH_INVALID',
  PRIVATE_OUTPUT_EXISTS: 'PRIVATE_OUTPUT_EXISTS',
  PRIVATE_OUTPUT_TRAVERSAL: 'PRIVATE_OUTPUT_TRAVERSAL',
  PRIVATE_OUTPUT_OUTSIDE_SECRETS: 'PRIVATE_OUTPUT_OUTSIDE_SECRETS',
  PRIVATE_OUTPUT_PARENT_MISSING: 'PRIVATE_OUTPUT_PARENT_MISSING',
  SECRETS_INPUT_TRAVERSAL: 'SECRETS_INPUT_TRAVERSAL',
  SECRETS_INPUT_OUTSIDE: 'SECRETS_INPUT_OUTSIDE',
  SECRETS_ROOT_SYMLINK: 'SECRETS_ROOT_SYMLINK',
  BASELINE_MISMATCH: 'BASELINE_MISMATCH',
  HEAD_UNRESOLVABLE: 'HEAD_UNRESOLVABLE',
  ROLE_MAPPING_MUTATED: 'ROLE_MAPPING_MUTATED',
  ROLE_MAPPING_INVALID: 'ROLE_MAPPING_INVALID',
  POLICY_ROLE_UNRESOLVABLE: 'ROLE_MAPPING_RECONCILIATION_POLICY_ROLE_UNRESOLVABLE',
  GRANTEE_UNRESOLVABLE: 'ROLE_MAPPING_RECONCILIATION_GRANTEE_UNRESOLVABLE',
  UNEXPECTED: 'UNEXPECTED',
});

function isPathInsideDir(child, parent) {
  const rel = path.relative(parent, child);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function fail(category) {
  const e = new Error(category);
  e.category = category;
  throw e;
}

function assertSecretsRootValid(repoRoot) {
  const secretsDir = path.resolve(repoRoot, '.secrets');
  // If .secrets does not exist, realpath check not needed (will fail elsewhere)
  if (!fs.existsSync(secretsDir)) return;
  try {
    const st = fs.lstatSync(secretsDir);
    if (st.isSymbolicLink()) {
      fail(RECON_FAILURE.SECRETS_ROOT_SYMLINK);
    }
  } catch {}
  try {
    const real = fs.realpathSync(secretsDir);
    if (real !== secretsDir) {
      // If realpath differs and is outside repo or not equal, fail
      const repoReal = (() => { try { return fs.realpathSync(repoRoot); } catch { return repoRoot; }})();
      if (!isPathInsideDir(real, repoReal) && real !== repoReal) {
        // Real secrets outside repo → fail
        fail(RECON_FAILURE.SECRETS_ROOT_SYMLINK);
      }
      // If .secrets is symlink to outside, real will be outside .secrets path
      if (real !== secretsDir) {
        // Check if still inside repo but different inode - treat as symlink
        // On POSIX, symlink will cause real != secretsDir
        fail(RECON_FAILURE.SECRETS_ROOT_SYMLINK);
      }
    }
  } catch (e) {
    if (e && e.category) throw e;
  }
}

/**
 * Validate --private-output-file strictly under .secrets/**
 * Contract: parent directory MUST already exist, no recursive creation.
 * Raw traversal segment checked before normalization.
 * .secrets root itself must not be symlink.
 */
function validatePrivateOutputPath(repoRoot, relPath) {
  assertSecretsRootValid(repoRoot);
  if (typeof relPath !== 'string' || !relPath) fail(RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID);
  const trimmed = relPath.trim();
  if (!trimmed) fail(RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID);
  if (path.isAbsolute(trimmed)) fail(RECON_FAILURE.PRIVATE_OUTPUT_OUTSIDE_SECRETS);
  if (trimmed.includes('\0')) fail(RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID);
  // Raw traversal check before normalize (so a/../b is not hidden)
  const converted = trimmed.replace(/\\/g, '/');
  const rawParts = converted.split('/');
  if (rawParts.includes('..')) fail(RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL);
  if (rawParts.includes('.') && rawParts.some((p, i) => p === '.' && i !== 0)) {
    // Allow leading ./ but not embedded ./ that could be used to obscure? Still reject if contains ..
    // For strict, also reject single dot segments that hide traversal? Keep simple: only .. is fatal
  }
  const normalized = path.posix.normalize(converted);
  if (!normalized.startsWith('.secrets/')) fail(RECON_FAILURE.PRIVATE_OUTPUT_OUTSIDE_SECRETS);
  if (normalized.includes('..')) fail(RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL);
  if (normalized === '.secrets' || normalized === '.secrets/') fail(RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID);
  const abs = path.resolve(repoRoot, normalized);
  const secretsDir = path.resolve(repoRoot, '.secrets');
  if (!isPathInsideDir(abs, secretsDir)) fail(RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL);
  const parent = path.dirname(abs);
  if (!fs.existsSync(parent)) fail(RECON_FAILURE.PRIVATE_OUTPUT_PARENT_MISSING);
  let cur = parent;
  let nearestExisting = null;
  while (cur && cur.length >= secretsDir.length) {
    if (fs.existsSync(cur)) { nearestExisting = cur; break; }
    const p = path.dirname(cur);
    if (p === cur) break;
    cur = p;
  }
  if (nearestExisting) {
    let realNearest, realSecrets;
    try { realNearest = fs.realpathSync(nearestExisting); } catch { fail(RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL); }
    try { realSecrets = fs.existsSync(secretsDir) ? fs.realpathSync(secretsDir) : secretsDir; } catch { realSecrets = secretsDir; }
    if (!isPathInsideDir(realNearest, realSecrets) && realNearest !== realSecrets) {
      fail(RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL);
    }
    try {
      const realParent = fs.realpathSync(parent);
      if (!isPathInsideDir(realParent, realSecrets) && realParent !== realSecrets) {
        fail(RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL);
      }
    } catch {}
  }
  if (fs.existsSync(abs)) {
    try {
      const realTarget = fs.realpathSync(abs);
      const realSecrets = fs.existsSync(secretsDir) ? fs.realpathSync(secretsDir) : secretsDir;
      if (!isPathInsideDir(realTarget, realSecrets)) fail(RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL);
    } catch {}
    fail(RECON_FAILURE.PRIVATE_OUTPUT_EXISTS);
  }
  return abs;
}

/**
 * Validate input file strictly under .secrets/** with realpath check
 */
function validateSecretsInputPath(repoRoot, relPath) {
  assertSecretsRootValid(repoRoot);
  if (typeof relPath !== 'string' || !relPath) fail(RECON_FAILURE.INPUT_INVALID);
  const trimmed = relPath.trim();
  if (!trimmed) fail(RECON_FAILURE.INPUT_INVALID);
  if (path.isAbsolute(trimmed)) fail(RECON_FAILURE.SECRETS_INPUT_OUTSIDE);
  if (trimmed.includes('\0')) fail(RECON_FAILURE.INPUT_INVALID);
  const converted = trimmed.replace(/\\/g, '/');
  const rawParts = converted.split('/');
  if (rawParts.includes('..')) fail(RECON_FAILURE.SECRETS_INPUT_TRAVERSAL);
  const normalized = path.posix.normalize(converted);
  if (!normalized.startsWith('.secrets/')) fail(RECON_FAILURE.SECRETS_INPUT_OUTSIDE);
  if (normalized.includes('..')) fail(RECON_FAILURE.SECRETS_INPUT_TRAVERSAL);
  const abs = path.resolve(repoRoot, normalized);
  const secretsDir = path.resolve(repoRoot, '.secrets');
  if (!isPathInsideDir(abs, secretsDir)) fail(RECON_FAILURE.SECRETS_INPUT_TRAVERSAL);
  if (!fs.existsSync(abs)) fail(RECON_FAILURE.INPUT_INVALID);
  const relParts = path.relative(secretsDir, abs).split(path.sep);
  let cur = secretsDir;
  for (const part of relParts) {
    cur = path.join(cur, part);
    try {
      const st = fs.lstatSync(cur);
      if (st.isSymbolicLink()) {
        const real = fs.realpathSync(cur);
        const realSecrets = fs.existsSync(secretsDir) ? fs.realpathSync(secretsDir) : secretsDir;
        if (!isPathInsideDir(real, realSecrets) && real !== realSecrets) {
          fail(RECON_FAILURE.SECRETS_INPUT_TRAVERSAL);
        }
      }
    } catch (e) {
      if (e && e.category) throw e;
    }
  }
  try {
    const realAbs = fs.realpathSync(abs);
    const realSecrets = fs.existsSync(secretsDir) ? fs.realpathSync(secretsDir) : secretsDir;
    if (!isPathInsideDir(realAbs, realSecrets) && realAbs !== realSecrets) {
      fail(RECON_FAILURE.SECRETS_INPUT_TRAVERSAL);
    }
  } catch {}
  return abs;
}

/**
 * Pure: compute unmapped grantees (case-insensitive, PUBLIC always mapped)
 */
function computeUnmappedGrantees(grantees, roleMapping) {
  if (!Array.isArray(grantees)) return [];
  const map = new Map();
  if (roleMapping && typeof roleMapping === 'object') {
    for (const k of Object.keys(roleMapping)) {
      map.set(String(k).toLowerCase(), true);
    }
  }
  map.set('public', true);
  const seen = new Set();
  const unmapped = [];
  for (const g of grantees) {
    if (typeof g !== 'string' || !g) continue;
    const key = g.toLowerCase();
    if (map.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    unmapped.push(g);
  }
  unmapped.sort((a, b) => a.localeCompare(b));
  return unmapped;
}

/**
 * Build private artifact object (minimal)
 * Preserves raw rolname; validates non-empty, no NUL, UTF-8 byte bound, count bound.
 * Allows leading/trailing spaces for quoted PostgreSQL roles.
 */
function buildPrivateArtifact(unmappedGrantees) {
  if (!Array.isArray(unmappedGrantees)) fail(RECON_FAILURE.INPUT_INVALID);
  const cleaned = [];
  // PostgreSQL NAMEDATALEN = 64, identifier max bytes = 63 (excluding terminator)
  const MAX_BYTES = 63;
  for (const v of unmappedGrantees) {
    if (typeof v !== 'string') fail(RECON_FAILURE.INPUT_INVALID);
    if (v.length === 0) fail(RECON_FAILURE.INPUT_INVALID);
    if (v.includes('\0')) fail(RECON_FAILURE.INPUT_INVALID);
    const byteLen = Buffer.byteLength(v, 'utf8');
    if (byteLen === 0 || byteLen > MAX_BYTES) fail(RECON_FAILURE.INPUT_INVALID);
    // Do NOT reject leading/trailing spaces – quoted identifiers may contain them
    cleaned.push(v);
    if (cleaned.length > 256) fail(RECON_FAILURE.INPUT_INVALID);
  }
  cleaned.sort((a, b) => a.localeCompare(b));
  return {
    format_version: '1.0',
    unmapped_grantees: cleaned,
  };
}

/**
 * Exclusive-create write (fail if exists, no overwrite, parent must exist).
 */
function writePrivateArtifactExclusive(absPath, artifact) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) fail(RECON_FAILURE.INPUT_INVALID);
  const keys = Object.keys(artifact);
  if (keys.length !== 2 || !keys.includes('format_version') || !keys.includes('unmapped_grantees')) {
    fail(RECON_FAILURE.INPUT_INVALID);
  }
  if (artifact.format_version !== '1.0') fail(RECON_FAILURE.INPUT_INVALID);
  if (!Array.isArray(artifact.unmapped_grantees)) fail(RECON_FAILURE.INPUT_INVALID);
  for (const k of Object.keys(artifact)) {
    if (/password|host|database|username|url|sql|provider/i.test(k)) fail(RECON_FAILURE.INPUT_INVALID);
  }
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) fail(RECON_FAILURE.PRIVATE_OUTPUT_PARENT_MISSING);
  let fd;
  try {
    fd = fs.openSync(absPath, 'wx', 0o600);
  } catch (err) {
    if (err && err.code === 'EEXIST') fail(RECON_FAILURE.PRIVATE_OUTPUT_EXISTS);
    fail(RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID);
  }
  try {
    fs.writeSync(fd, JSON.stringify(artifact, null, 2) + '\n');
  } finally {
    try { fs.closeSync(fd); } catch {}
  }
  return true;
}

/**
 * Build sanitized shared stdout (no raw grantee, no raw OID)
 */
function buildSharedOutput(unmappedGranteeCount, privateArtifactWritten, collectionSessionCount) {
  const count = Number(unmappedGranteeCount);
  if (!Number.isInteger(count) || count < 0 || count > 10000) fail(RECON_FAILURE.INPUT_INVALID);
  const sessionCount = Number(collectionSessionCount);
  if (!Number.isInteger(sessionCount) || sessionCount < 0 || sessionCount > 2) fail(RECON_FAILURE.INPUT_INVALID);
  return {
    format_version: '1.0',
    outcome: 'ROLE_MAPPING_RECONCILIATION_READY',
    collection_session_count: sessionCount,
    unmapped_grantee_count: count,
    private_artifact_written: Boolean(privateArtifactWritten),
    schema_mutation: 'NONE',
    data_mutation: 'NONE',
    credential_change: 'NONE',
    privilege_change: 'NONE',
  };
}

function computeDigest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

module.exports = {
  RECON_FAILURE,
  validatePrivateOutputPath,
  validateSecretsInputPath,
  computeUnmappedGrantees,
  buildPrivateArtifact,
  writePrivateArtifactExclusive,
  buildSharedOutput,
  computeDigest,
  isPathInsideDir,
  assertSecretsRootValid,
};
