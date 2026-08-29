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
  BASELINE_MISMATCH: 'BASELINE_MISMATCH',
  HEAD_UNRESOLVABLE: 'HEAD_UNRESOLVABLE',
  ROLE_MAPPING_MUTATED: 'ROLE_MAPPING_MUTATED',
  UNEXPECTED: 'UNEXPECTED',
});

function isPathInsideDir(child, parent) {
  const rel = path.relative(parent, child);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Validate --private-output-file strictly under .secrets/**
 * fail-closed for outside, traversal, absolute outside, symlink escape, existing file.
 * @param {string} repoRoot - absolute repo root
 * @param {string} relPath - user supplied relative path
 * @returns {string} absolute path if valid
 */
function validatePrivateOutputPath(repoRoot, relPath) {
  if (typeof relPath !== 'string' || !relPath) {
    const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID);
    e.category = RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID;
    throw e;
  }
  const trimmed = relPath.trim();
  if (!trimmed) {
    const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID);
    e.category = RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID;
    throw e;
  }
  if (path.isAbsolute(trimmed)) {
    const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_OUTSIDE_SECRETS);
    e.category = RECON_FAILURE.PRIVATE_OUTPUT_OUTSIDE_SECRETS;
    throw e;
  }
  // must start with .secrets/ and not contain ..
  const normalized = path.posix.normalize(trimmed.replace(/\\/g, '/'));
  if (!normalized.startsWith('.secrets/')) {
    const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_OUTSIDE_SECRETS);
    e.category = RECON_FAILURE.PRIVATE_OUTPUT_OUTSIDE_SECRETS;
    throw e;
  }
  if (normalized.includes('..')) {
    const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL);
    e.category = RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL;
    throw e;
  }
  // reject if normalized path escapes via leading .secrets/../
  if (normalized === '.secrets' || normalized === '.secrets/') {
    const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID);
    e.category = RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID;
    throw e;
  }
  // Additional checks: no absolute, no empty segment
  if (trimmed.includes('\0')) {
    const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID);
    e.category = RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID;
    throw e;
  }
  const abs = path.resolve(repoRoot, normalized);
  const secretsDir = path.resolve(repoRoot, '.secrets');
  // Ensure secretsDir exists string check
  // Check is inside dir via relative
  if (!isPathInsideDir(abs, secretsDir) && abs !== secretsDir) {
    const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL);
    e.category = RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL;
    throw e;
  }
  // Symlink escape check: if parent directory exists, ensure realpath stays inside
  try {
    const parent = path.dirname(abs);
    // If parent exists, check realpath
    if (fs.existsSync(parent)) {
      const realParent = fs.realpathSync(parent);
      const realSecrets = fs.existsSync(secretsDir) ? fs.realpathSync(secretsDir) : secretsDir;
      if (!isPathInsideDir(realParent, realSecrets) && realParent !== realSecrets) {
        const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL);
        e.category = RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL;
        throw e;
      }
      // If target exists as symlink, reject
      if (fs.existsSync(abs)) {
        // existing file => will be handled as EXISTS below, but also symlink escape
        try {
          const realTarget = fs.realpathSync(abs);
          if (!isPathInsideDir(realTarget, realSecrets)) {
            const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL);
            e.category = RECON_FAILURE.PRIVATE_OUTPUT_TRAVERSAL;
            throw e;
          }
        } catch {}
      }
    }
  } catch (err) {
    if (err && err.category) throw err;
    // ignore fs errors for non-existent paths
  }
  // Reject if file already exists (no overwrite)
  if (fs.existsSync(abs)) {
    const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_EXISTS);
    e.category = RECON_FAILURE.PRIVATE_OUTPUT_EXISTS;
    throw e;
  }
  return abs;
}

/**
 * Pure: compute unmapped grantees (case-insensitive key compare, PUBLIC always mapped)
 * @param {string[]} grantees - raw grantees from catalog (e.g., ['alice','PUBLIC'])
 * @param {object} roleMapping - private role mapping object { key: class }
 * @returns {string[]} sorted unique unmapped grantees (as provided case)
 */
function computeUnmappedGrantees(grantees, roleMapping) {
  if (!Array.isArray(grantees)) return [];
  const map = new Map();
  if (roleMapping && typeof roleMapping === 'object') {
    for (const k of Object.keys(roleMapping)) {
      map.set(String(k).toLowerCase(), true);
    }
  }
  // PUBLIC is always considered mapped (per adapter)
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
 */
function buildPrivateArtifact(unmappedGrantees) {
  if (!Array.isArray(unmappedGrantees)) unmappedGrantees = [];
  // Only allow raw identifier, ensure no credential material
  const CRED_RE = /password|postgres:\/\/|postgresql:\/\/|^host$|^database$|^username$/i;
  const cleaned = unmappedGrantees
    .filter((v) => typeof v === 'string' && v && v.length <= 64 && /^[A-Za-z0-9_@.\-]+$/.test(v))
    .filter((v) => !CRED_RE.test(v))
    .slice(0, 256);
  cleaned.sort((a, b) => a.localeCompare(b));
  return {
    format_version: '1.0',
    unmapped_grantees: cleaned,
  };
}

/**
 * Exclusive-create write (fail if exists, no overwrite). Uses wx flag.
 */
function writePrivateArtifactExclusive(absPath, artifact) {
  // Validate artifact does not contain credential material
  const json = JSON.stringify(artifact, null, 2);
  if (/password|postgres:\/\/|postgresql:\/\/|host|database/i.test(json) && artifact.unmapped_grantees && artifact.unmapped_grantees.some((x) => /password|postgres/i.test(String(x)))) {
    const e = new Error(RECON_FAILURE.INPUT_INVALID);
    e.category = RECON_FAILURE.INPUT_INVALID;
    throw e;
  }
  // Ensure parent exists
  const dir = path.dirname(absPath);
  fs.mkdirSync(dir, { recursive: true });
  // exclusive create
  let fd;
  try {
    fd = fs.openSync(absPath, 'wx', 0o600);
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_EXISTS);
      e.category = RECON_FAILURE.PRIVATE_OUTPUT_EXISTS;
      throw e;
    }
    const e = new Error(RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID);
    e.category = RECON_FAILURE.PRIVATE_OUTPUT_PATH_INVALID;
    throw e;
  }
  try {
    fs.writeSync(fd, JSON.stringify(artifact, null, 2) + '\n');
  } finally {
    try { fs.closeSync(fd); } catch {}
  }
  // Ensure file is not added to git (ignored) - we rely on .gitignore
  return true;
}

/**
 * Build sanitized shared stdout (no raw grantee)
 */
function buildSharedOutput(unmappedGranteeCount, privateArtifactWritten) {
  const count = Number(unmappedGranteeCount);
  if (!Number.isInteger(count) || count < 0 || count > 10000) {
    const e = new Error(RECON_FAILURE.INPUT_INVALID);
    e.category = RECON_FAILURE.INPUT_INVALID;
    throw e;
  }
  return {
    format_version: '1.0',
    outcome: 'ROLE_MAPPING_RECONCILIATION_READY',
    collection_session_count: 1,
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
  computeUnmappedGrantees,
  buildPrivateArtifact,
  writePrivateArtifactExclusive,
  buildSharedOutput,
  computeDigest,
  isPathInsideDir,
};
