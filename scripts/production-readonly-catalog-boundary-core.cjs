'use strict';

/**
 * Pure fail-closed Production-readonly catalog connection boundary.
 *
 * Source-only policy helpers for a future Phase B collection child.
 * Does not open sockets, does not load real Production secrets in tests,
 * and never embeds hostnames or raw secret values in errors.
 *
 * Refs #3570, #3458, #3569 (CLOSED)
 * Refs #3425 — Keep #3425 OPEN.
 * Refs #1882 — Keep #1882 OPEN.
 */

const fs = require('node:fs');
const path = require('node:path');

const MODE = 'PRODUCTION_READONLY_CATALOG';
const DISPOSABLE_MODE = 'DISPOSABLE_CI';
const DEDICATED_SECRET_KEY = 'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL';
const ADOPTION_PLAN_CONTRACT =
  'db/migration-provenance/adoption-baseline-collection-plan-contract.json';
const BOUNDARY_CONTRACT =
  'db/migration-provenance/production-readonly-catalog-boundary-contract.json';

const FAILURE = Object.freeze({
  PRODUCTION_CATALOG_INPUT_INVALID: 'PRODUCTION_CATALOG_INPUT_INVALID',
  PRODUCTION_CATALOG_SECRET_REQUIRED: 'PRODUCTION_CATALOG_SECRET_REQUIRED',
  PRODUCTION_CATALOG_SECRET_FILE_INVALID: 'PRODUCTION_CATALOG_SECRET_FILE_INVALID',
  PRODUCTION_CATALOG_GENERIC_DATABASE_URL_REJECTED:
    'PRODUCTION_CATALOG_GENERIC_DATABASE_URL_REJECTED',
  PRODUCTION_CATALOG_URL_INVALID: 'PRODUCTION_CATALOG_URL_INVALID',
  PRODUCTION_CATALOG_TLS_REQUIRED: 'PRODUCTION_CATALOG_TLS_REQUIRED',
  PRODUCTION_CATALOG_LOOPBACK_REJECTED: 'PRODUCTION_CATALOG_LOOPBACK_REJECTED',
  PRODUCTION_CATALOG_SERVER_VERSION_UNSUPPORTED:
    'PRODUCTION_CATALOG_SERVER_VERSION_UNSUPPORTED',
  PRODUCTION_CATALOG_ALLOWLIST_REQUIRED: 'PRODUCTION_CATALOG_ALLOWLIST_REQUIRED',
  PRODUCTION_CATALOG_ROLE_MAPPING_REQUIRED: 'PRODUCTION_CATALOG_ROLE_MAPPING_REQUIRED',
  PRODUCTION_CATALOG_ROLE_MAPPING_INVALID: 'PRODUCTION_CATALOG_ROLE_MAPPING_INVALID',
  PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED: 'PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED',
  PRODUCTION_CATALOG_POLICY_INVALID: 'PRODUCTION_CATALOG_POLICY_INVALID',
});

const GRANTEE_CLASSES = Object.freeze([
  'PUBLIC',
  'APPLICATION',
  'AUTHENTICATED',
  'SERVICE',
  'OWNER_CLASS',
]);

const PROHIBITED_GENERIC_KEYS = Object.freeze([
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
]);

const LOOPBACK_HOSTS = Object.freeze(new Set(['localhost', '127.0.0.1', '::1']));
const ALLOWED_SSLMODE = Object.freeze(new Set(['require', 'verify-ca', 'verify-full']));
const PROHIBITED_SSLMODE = Object.freeze(new Set(['disable', 'allow', 'prefer']));
const MAX_URL_LENGTH = 4096;
const MAX_SECRET_FILE_BYTES = 64 * 1024;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const OBJECT_NAME_RE =
  /^(table|view|materialized_view):([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/;

const KIND_BY_PREFIX = Object.freeze({
  table: 'TABLE',
  view: 'VIEW',
  materialized_view: 'MATERIALIZED_VIEW',
});

function fail(category) {
  const err = new Error(category);
  err.category = category;
  // Never attach secret/url/path payloads.
  err.context = {};
  throw err;
}

function assertNonEmptyString(value, category) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    fail(category || FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
  }
}

function loadJsonFile(absPath, category) {
  let raw;
  try {
    raw = fs.readFileSync(absPath);
  } catch {
    fail(category || FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
  }
  if (raw.length > MAX_SECRET_FILE_BYTES) {
    fail(category || FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    return JSON.parse(text);
  } catch {
    fail(category || FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
  }
}

function loadBoundaryContract(repoRoot) {
  const abs = path.resolve(repoRoot, BOUNDARY_CONTRACT);
  const doc = loadJsonFile(abs, FAILURE.PRODUCTION_CATALOG_POLICY_INVALID);
  if (!doc || doc.mode !== MODE || doc.dedicated_secret_key !== DEDICATED_SECRET_KEY) {
    fail(FAILURE.PRODUCTION_CATALOG_POLICY_INVALID);
  }
  return doc;
}

/**
 * Resolve and confine a secret/config file path under repo/.secrets/.
 * Rejects absolute escapes, symlinks, and non-files without leaking paths.
 */
function resolveSecretsRelativeFile(repoRoot, relPath) {
  assertNonEmptyString(relPath, FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  if (path.isAbsolute(relPath)) {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  const normalized = relPath.replace(/\\/g, '/');
  if (
    normalized.includes('\0') ||
    normalized.includes('..') ||
    normalized.startsWith('/') ||
    !normalized.startsWith('.secrets/')
  ) {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  const root = path.resolve(repoRoot);
  const secretsRoot = path.resolve(root, '.secrets');
  const abs = path.resolve(root, normalized);
  if (abs !== secretsRoot && !abs.startsWith(`${secretsRoot}${path.sep}`)) {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  let st;
  try {
    st = fs.lstatSync(abs);
  } catch {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  if (!st.isFile() || st.isSymbolicLink()) {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  // Extra realpath confinement (Windows/Unix).
  let realFile;
  let realSecrets;
  try {
    realFile = fs.realpathSync(abs);
    realSecrets = fs.realpathSync(secretsRoot);
  } catch {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  if (realFile !== realSecrets && !realFile.startsWith(`${realSecrets}${path.sep}`)) {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  return abs;
}

/**
 * Minimal KEY=VALUE parser for ignored secret files.
 * Supports optional single/double quotes; rejects exports, multiline, duplicates.
 * Never returns values for non-requested keys to callers that only need presence checks.
 */
function parseSecretFileKeyValues(fileContents) {
  if (typeof fileContents !== 'string') {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  if (fileContents.length > MAX_SECRET_FILE_BYTES) {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  const map = new Map();
  const lines = fileContents.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^export\s+/i.test(trimmed)) {
      fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
    }
    if (map.has(key)) {
      fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
    }
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (value.includes('\n') || value.includes('\r') || value.includes('\0')) {
      fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
    }
    map.set(key, value);
  }
  return map;
}

function readSecretFileMap(repoRoot, relPath) {
  const abs = resolveSecretsRelativeFile(repoRoot, relPath);
  let raw;
  try {
    raw = fs.readFileSync(abs);
  } catch {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  if (raw.length > MAX_SECRET_FILE_BYTES) {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  return parseSecretFileKeyValues(text);
}

/**
 * Load dedicated Production-readonly database URL only.
 * Generic DATABASE_URL presence alone is rejected (no fallback).
 */
function loadDedicatedProductionReadonlyDatabaseUrl(repoRoot, secretFileRelPath) {
  const map = readSecretFileMap(repoRoot, secretFileRelPath);
  for (const banned of PROHIBITED_GENERIC_KEYS) {
    // Presence of generic keys is allowed in the file, but must not be used as fallback.
    // If dedicated key is missing, still reject even if generic exists.
    void banned;
  }
  if (!map.has(DEDICATED_SECRET_KEY)) {
    // Distinguish generic-only case without reading generic value into output.
    const hasGeneric = PROHIBITED_GENERIC_KEYS.some((k) => map.has(k));
    if (hasGeneric) {
      fail(FAILURE.PRODUCTION_CATALOG_GENERIC_DATABASE_URL_REJECTED);
    }
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_REQUIRED);
  }
  const url = map.get(DEDICATED_SECRET_KEY);
  assertNonEmptyString(url, FAILURE.PRODUCTION_CATALOG_SECRET_REQUIRED);
  return url;
}

function isLoopbackHost(host) {
  if (!host) return true;
  const h = String(host).toLowerCase();
  if (LOOPBACK_HOSTS.has(h)) return true;
  if (h.startsWith('127.')) return true;
  return false;
}

/**
 * Pure URL validator / normalizer for Production-readonly catalog mode.
 * Returns a pg Client config object with a private validation marker.
 * Never includes the raw URL in thrown errors.
 */
function parseProductionReadonlyDatabaseUrl(urlString) {
  if (typeof urlString !== 'string' || !urlString || urlString.length > MAX_URL_LENGTH) {
    fail(FAILURE.PRODUCTION_CATALOG_URL_INVALID);
  }
  if (urlString.includes('\0') || urlString.includes('\n') || urlString.includes('\r')) {
    fail(FAILURE.PRODUCTION_CATALOG_URL_INVALID);
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    fail(FAILURE.PRODUCTION_CATALOG_URL_INVALID);
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    fail(FAILURE.PRODUCTION_CATALOG_URL_INVALID);
  }
  if (parsed.hash) {
    fail(FAILURE.PRODUCTION_CATALOG_URL_INVALID);
  }

  const username = decodeURIComponent(parsed.username || '');
  const password = decodeURIComponent(parsed.password || '');
  const host = parsed.hostname || '';
  const databasePath = (parsed.pathname || '').replace(/^\//, '');
  const database = databasePath.split('/')[0] || '';

  if (!username || !password || !host || !database) {
    fail(FAILURE.PRODUCTION_CATALOG_URL_INVALID);
  }
  if (database.includes('@') || database.includes(':')) {
    fail(FAILURE.PRODUCTION_CATALOG_URL_INVALID);
  }
  if (isLoopbackHost(host)) {
    fail(FAILURE.PRODUCTION_CATALOG_LOOPBACK_REJECTED);
  }

  // Reject credential-bearing nested params / unexpected unsafe options.
  for (const key of parsed.searchParams.keys()) {
    const lower = key.toLowerCase();
    if (
      lower === 'password' ||
      lower === 'passfile' ||
      lower === 'sslrootcert' ||
      lower === 'sslkey' ||
      lower === 'sslcert'
    ) {
      fail(FAILURE.PRODUCTION_CATALOG_URL_INVALID);
    }
  }

  const sslmode = (parsed.searchParams.get('sslmode') || '').toLowerCase();
  const sslFlag = (parsed.searchParams.get('ssl') || '').toLowerCase();
  if (PROHIBITED_SSLMODE.has(sslmode) || sslFlag === 'false' || sslFlag === '0') {
    fail(FAILURE.PRODUCTION_CATALOG_TLS_REQUIRED);
  }
  if (!ALLOWED_SSLMODE.has(sslmode) && sslFlag !== 'true') {
    fail(FAILURE.PRODUCTION_CATALOG_TLS_REQUIRED);
  }

  let port = 5432;
  if (parsed.port) {
    port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      fail(FAILURE.PRODUCTION_CATALOG_URL_INVALID);
    }
  }

  return Object.freeze({
    __productionReadonlyValidated: true,
    host,
    port,
    user: username,
    password,
    database,
    ssl: Object.freeze({ rejectUnauthorized: true }),
    connectionTimeoutMillis: 10000,
  });
}

/** Pure major-17 version policy for Production-readonly mode. */
function isSupportedProductionServerVersionNum(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) return false;
  return n >= 170000 && n < 180000;
}

function assertSupportedProductionServerVersionNum(value) {
  if (!isSupportedProductionServerVersionNum(value)) {
    fail(FAILURE.PRODUCTION_CATALOG_SERVER_VERSION_UNSUPPORTED);
  }
}

/**
 * Load frozen adoption allowlist as adapter object descriptors.
 * Caller override of objects is never accepted here.
 */
function loadFrozenAdoptionAllowlistObjects(repoRoot) {
  const abs = path.resolve(repoRoot, ADOPTION_PLAN_CONTRACT);
  const contract = loadJsonFile(abs, FAILURE.PRODUCTION_CATALOG_ALLOWLIST_REQUIRED);
  const list = contract.reviewed_object_allowlist;
  if (!Array.isArray(list) || list.length < 1) {
    fail(FAILURE.PRODUCTION_CATALOG_ALLOWLIST_REQUIRED);
  }
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      fail(FAILURE.PRODUCTION_CATALOG_ALLOWLIST_REQUIRED);
    }
    const name = item.name;
    if (typeof name !== 'string' || !OBJECT_NAME_RE.test(name)) {
      fail(FAILURE.PRODUCTION_CATALOG_ALLOWLIST_REQUIRED);
    }
    const m = name.match(OBJECT_NAME_RE);
    const prefix = m[1];
    const schema = m[2];
    const objectName = m[3];
    const objectKind = KIND_BY_PREFIX[prefix];
    if (!objectKind) fail(FAILURE.PRODUCTION_CATALOG_ALLOWLIST_REQUIRED);
    if (item.kind && item.kind !== objectKind) {
      fail(FAILURE.PRODUCTION_CATALOG_ALLOWLIST_REQUIRED);
    }
    const key = `${schema}.${objectName}.${objectKind}`;
    if (seen.has(key)) fail(FAILURE.PRODUCTION_CATALOG_ALLOWLIST_REQUIRED);
    seen.add(key);
    out.push({
      schema,
      object_name: objectName,
      object_kind: objectKind,
    });
  }
  return out;
}

/**
 * Load role mapping from an ignored secrets-boundary JSON file.
 * Synthetic keys only in fixtures; raw role names never logged.
 */
function loadProductionRoleMapping(repoRoot, relPath) {
  if (relPath === undefined || relPath === null || relPath === '') {
    fail(FAILURE.PRODUCTION_CATALOG_ROLE_MAPPING_REQUIRED);
  }
  const abs = resolveSecretsRelativeFile(repoRoot, relPath);
  const doc = loadJsonFile(abs, FAILURE.PRODUCTION_CATALOG_ROLE_MAPPING_INVALID);
  const mapping = doc.role_mapping || doc;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    fail(FAILURE.PRODUCTION_CATALOG_ROLE_MAPPING_INVALID);
  }
  const keys = Object.keys(mapping);
  if (keys.length === 0 || keys.length > 64) {
    fail(FAILURE.PRODUCTION_CATALOG_ROLE_MAPPING_INVALID);
  }
  const out = {};
  const seen = new Set();
  for (const key of keys) {
    if (typeof key !== 'string' || !IDENT_RE.test(key) || key.length > 63) {
      fail(FAILURE.PRODUCTION_CATALOG_ROLE_MAPPING_INVALID);
    }
    const lower = key.toLowerCase();
    if (seen.has(lower)) {
      fail(FAILURE.PRODUCTION_CATALOG_ROLE_MAPPING_INVALID);
    }
    seen.add(lower);
    const cls = mapping[key];
    if (typeof cls !== 'string' || !GRANTEE_CLASSES.includes(cls)) {
      fail(FAILURE.PRODUCTION_CATALOG_ROLE_MAPPING_INVALID);
    }
    out[key] = cls;
  }
  if (!seen.has('public')) {
    out.public = 'PUBLIC';
  }
  return out;
}

function rejectCallerOverrides(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    fail(FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
  }
  const banned = [
    'objects',
    'object_allowlist',
    'sql',
    'query',
    'client',
    'manageTransaction',
    'password',
    'host',
    'user',
    'database',
    'port',
    'connectionString',
    'databaseUrl',
    'DATABASE_URL',
  ];
  for (const key of banned) {
    if (Object.prototype.hasOwnProperty.call(options, key)) {
      fail(FAILURE.PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED);
    }
  }
}

/**
 * Build a complete Production-readonly invocation package (no network).
 * Used by CLI before optional future connect, and by source-static tests.
 */
function buildProductionReadonlyInvocationPlan(repoRoot, options) {
  rejectCallerOverrides(options || {});
  const secretFile = options && options.secretFile;
  const roleMappingFile = options && options.roleMappingFile;
  assertNonEmptyString(secretFile, FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);

  const url = loadDedicatedProductionReadonlyDatabaseUrl(repoRoot, secretFile);
  const connection = parseProductionReadonlyDatabaseUrl(url);
  const objects = loadFrozenAdoptionAllowlistObjects(repoRoot);
  const roleMapping = loadProductionRoleMapping(repoRoot, roleMappingFile);

  return Object.freeze({
    mode: MODE,
    disposableModePreserved: DISPOSABLE_MODE,
    dedicatedSecretKey: DEDICATED_SECRET_KEY,
    objectCount: objects.length,
    objects,
    roleMapping,
    connection,
    versionPolicy: Object.freeze({
      supported_major: 17,
      min_inclusive: 170000,
      max_exclusive: 180000,
    }),
  });
}

function stripValidatedConnectionForClient(connection) {
  if (!connection || connection.__productionReadonlyValidated !== true) {
    fail(FAILURE.PRODUCTION_CATALOG_URL_INVALID);
  }
  return {
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password,
    database: connection.database,
    ssl: connection.ssl,
    connectionTimeoutMillis: connection.connectionTimeoutMillis || 10000,
  };
}

module.exports = {
  MODE,
  DISPOSABLE_MODE,
  DEDICATED_SECRET_KEY,
  ADOPTION_PLAN_CONTRACT,
  BOUNDARY_CONTRACT,
  FAILURE,
  GRANTEE_CLASSES,
  PROHIBITED_GENERIC_KEYS,
  MAX_URL_LENGTH,
  loadBoundaryContract,
  resolveSecretsRelativeFile,
  parseSecretFileKeyValues,
  readSecretFileMap,
  loadDedicatedProductionReadonlyDatabaseUrl,
  parseProductionReadonlyDatabaseUrl,
  isSupportedProductionServerVersionNum,
  assertSupportedProductionServerVersionNum,
  loadFrozenAdoptionAllowlistObjects,
  loadProductionRoleMapping,
  rejectCallerOverrides,
  buildProductionReadonlyInvocationPlan,
  stripValidatedConnectionForClient,
  isLoopbackHost,
};
