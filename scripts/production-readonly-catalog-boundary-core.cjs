'use strict';

/**
 * Pure fail-closed Production-readonly catalog connection boundary.
 *
 * Source-only policy helpers. Does not open sockets in tests.
 * Never embeds hostnames or raw secret values in errors.
 *
 * Trust boundary notes:
 * - No forgeable boolean markers.
 * - Invocation plans store pg credentials only in a module-private Map
 *   keyed by an opaque non-enumerable handle created in this module.
 * - Generic adapter collect APIs never accept Production mode inputs.
 *
 * Refs #3570, #3458, #3569 (CLOSED)
 * Refs #3425 — Keep #3425 OPEN.
 * Refs #1882 — Keep #1882 OPEN.
 */

const fs = require('node:fs');
const net = require('node:net');
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
  PRODUCTION_CATALOG_HANDLE_INVALID: 'PRODUCTION_CATALOG_HANDLE_INVALID',
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

/**
 * Module-private store for opaque invocation handles (not forgeable via plain JSON).
 * WeakMap uses object identity — a JSON clone, spread clone, or structured plain object
 * cannot be used as a key. Only the exact handle object reference can resolve or release.
 */
const privateInvocationStore = new WeakMap();
const HANDLE_BRAND = Symbol('lovebud.productionReadonlyInvocation');

function fail(category) {
  const err = new Error(category);
  err.category = category;
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
 * KEY=VALUE parser. Dedicated Production secret files may contain ONLY the
 * dedicated key (plus blank/comment lines). Any other key fails closed.
 */
function parseSecretFileKeyValues(fileContents, options) {
  if (typeof fileContents !== 'string') {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  if (fileContents.length > MAX_SECRET_FILE_BYTES) {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  const dedicatedOnly = !options || options.dedicatedOnly !== false;
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
    if (dedicatedOnly && key !== DEDICATED_SECRET_KEY) {
      if (PROHIBITED_GENERIC_KEYS.includes(key)) {
        fail(FAILURE.PRODUCTION_CATALOG_GENERIC_DATABASE_URL_REJECTED);
      }
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
  return parseSecretFileKeyValues(text, { dedicatedOnly: true });
}

function loadDedicatedProductionReadonlyDatabaseUrl(repoRoot, secretFileRelPath) {
  const map = readSecretFileMap(repoRoot, secretFileRelPath);
  if (!map.has(DEDICATED_SECRET_KEY)) {
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_REQUIRED);
  }
  if (map.size !== 1) {
    // dedicatedOnly parser already rejects extra keys; belt-and-suspenders.
    fail(FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
  }
  const url = map.get(DEDICATED_SECRET_KEY);
  assertNonEmptyString(url, FAILURE.PRODUCTION_CATALOG_SECRET_REQUIRED);
  return url;
}

/**
 * Canonicalize hostname/IP forms for loopback detection.
 * Never throws host strings into error context.
 */
function canonicalizeHostForLoopbackCheck(rawHost) {
  if (typeof rawHost !== 'string' || !rawHost) return '';
  let h = rawHost.trim().toLowerCase();
  if (h.endsWith('.')) h = h.slice(0, -1);
  if (h.startsWith('[') && h.endsWith(']')) {
    h = h.slice(1, -1);
  }

  // IPv4-mapped IPv6: ::ffff:127.0.0.1 or ::ffff:7f00:1
  if (h.startsWith('::ffff:')) {
    const mapped = h.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) {
      return canonicalizeIPv4(mapped) || mapped;
    }
    // hex form like 7f00:1
    const hexParts = mapped.split(':');
    if (hexParts.length === 2) {
      const hi = parseInt(hexParts[0], 16);
      const lo = parseInt(hexParts[1], 16);
      if (Number.isFinite(hi) && Number.isFinite(lo)) {
        const a = (hi >> 8) & 255;
        const b = hi & 255;
        const c = (lo >> 8) & 255;
        const d = lo & 255;
        return `${a}.${b}.${c}.${d}`;
      }
    }
  }

  if (net.isIPv6(h)) {
    // Expand compressed IPv6 for ::1 comparison via URL/whatwg normalization.
    try {
      // Node normalizes some IPv6 forms via URL hostname.
      const u = new URL(`http://[${h}]/`);
      return (u.hostname || h).replace(/^\[|\]$/g, '').toLowerCase();
    } catch {
      return h;
    }
  }

  if (net.isIPv4(h) || looksLikeIPv4Alternate(h)) {
    const v4 = canonicalizeIPv4(h);
    if (v4) return v4;
  }

  // Decimal / hex whole-address IPv4 (e.g. 2130706433, 0x7f000001)
  const asInt = canonicalizeIPv4Integer(h);
  if (asInt) return asInt;

  return h;
}

function looksLikeIPv4Alternate(h) {
  // 127.1, 127.0.1, 0177.0.0.1, etc.
  return /^[0-9a-fx.]+$/i.test(h) && h.includes('.');
}

function parseIPv4Part(part) {
  if (typeof part !== 'string' || !part) return null;
  let n;
  if (/^0x[0-9a-f]+$/i.test(part)) {
    n = parseInt(part, 16);
  } else if (/^0[0-7]+$/.test(part)) {
    n = parseInt(part, 8);
  } else if (/^\d+$/.test(part)) {
    n = parseInt(part, 10);
  } else {
    return null;
  }
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/**
 * Canonicalize alternate IPv4 notations to dotted-decimal.
 * Returns null if not parseable as IPv4.
 */
function canonicalizeIPv4(input) {
  if (net.isIPv4(input)) {
    // Normalize leading zeros via parseInt of each octet.
    const parts = input.split('.').map((p) => parseInt(p, 10));
    if (parts.length === 4 && parts.every((n) => n >= 0 && n <= 255)) {
      return parts.join('.');
    }
  }

  const asInt = canonicalizeIPv4Integer(input);
  if (asInt) return asInt;

  const parts = String(input).split('.');
  if (parts.length < 1 || parts.length > 4) return null;
  const nums = [];
  for (const part of parts) {
    const n = parseIPv4Part(part);
    if (n === null) return null;
    nums.push(n);
  }

  // Expand short forms: a, a.b, a.b.c, a.b.c.d (POSIX inet_aton style).
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;
  if (nums.length === 1) {
    const n = nums[0];
    if (n > 0xffffffff) return null;
    a = (n >>> 24) & 255;
    b = (n >>> 16) & 255;
    c = (n >>> 8) & 255;
    d = n & 255;
  } else if (nums.length === 2) {
    if (nums[0] > 255 || nums[1] > 0xffffff) return null;
    a = nums[0];
    b = (nums[1] >>> 16) & 255;
    c = (nums[1] >>> 8) & 255;
    d = nums[1] & 255;
  } else if (nums.length === 3) {
    if (nums[0] > 255 || nums[1] > 255 || nums[2] > 0xffff) return null;
    a = nums[0];
    b = nums[1];
    c = (nums[2] >>> 8) & 255;
    d = nums[2] & 255;
  } else if (nums.length === 4) {
    if (nums.some((n) => n > 255)) return null;
    [a, b, c, d] = nums;
  } else {
    return null;
  }
  return `${a}.${b}.${c}.${d}`;
}

function canonicalizeIPv4Integer(input) {
  const s = String(input);
  let n;
  if (/^0x[0-9a-f]+$/i.test(s)) {
    n = parseInt(s, 16);
  } else if (/^\d+$/.test(s)) {
    n = parseInt(s, 10);
  } else {
    return null;
  }
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return null;
  const a = (n >>> 24) & 255;
  const b = (n >>> 16) & 255;
  const c = (n >>> 8) & 255;
  const d = n & 255;
  return `${a}.${b}.${c}.${d}`;
}

function isLoopbackHost(rawHost) {
  const h = canonicalizeHostForLoopbackCheck(rawHost);
  if (!h) return true;
  if (h === 'localhost') return true;
  if (h === '::1' || h === '0:0:0:0:0:0:0:1') return true;
  // Fully expanded forms containing only ::1
  if (net.isIPv6(h)) {
    // Compare against normalized ::1 via BigInt if possible
    try {
      const expanded = h;
      if (expanded === '::1') return true;
      // Strip zeros form
      if (/^(0{0,4}:){7}1$/.test(expanded) || expanded.endsWith(':0:0:0:0:0:0:1')) return true;
      if (expanded.replace(/^\[|\]$/g, '') === '::1') return true;
    } catch {
      /* ignore */
    }
  }
  const v4 = canonicalizeIPv4(h) || (net.isIPv4(h) ? h : null);
  if (v4) {
    const parts = v4.split('.').map((x) => Number(x));
    if (parts[0] === 127) return true;
  }
  return false;
}

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

  // Return plain pg fields only — no forgeable trust marker property.
  return {
    host,
    port,
    user: username,
    password,
    database,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  };
}

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
    const objectKind = KIND_BY_PREFIX[m[1]];
    const schema = m[2];
    const objectName = m[3];
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
    'connection',
    'roleMapping',
    'mode',
    '__productionReadonlyValidated',
  ];
  for (const key of banned) {
    if (Object.prototype.hasOwnProperty.call(options, key)) {
      fail(FAILURE.PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED);
    }
  }
}

function createOpaqueInvocationHandle(privatePayload) {
  const handle = Object.freeze({
    [HANDLE_BRAND]: true,
  });
  privateInvocationStore.set(handle, privatePayload);
  return handle;
}

function resolveOpaqueInvocationHandle(handle) {
  if (!handle || typeof handle !== 'object' || handle[HANDLE_BRAND] !== true) {
    fail(FAILURE.PRODUCTION_CATALOG_HANDLE_INVALID);
  }
  if (!privateInvocationStore.has(handle)) {
    fail(FAILURE.PRODUCTION_CATALOG_HANDLE_INVALID);
  }
  return privateInvocationStore.get(handle);
}

/**
 * Build a Production-readonly invocation plan from secret/role files only.
 * Public plan fields are sanitized; credentials live only in the private store.
 */
function buildProductionReadonlyInvocationPlan(repoRoot, options) {
  rejectCallerOverrides(options || {});
  const secretFile = options && options.secretFile;
  const roleMappingFile = options && options.roleMappingFile;
  assertNonEmptyString(secretFile, FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);

  const url = loadDedicatedProductionReadonlyDatabaseUrl(repoRoot, secretFile);
  const pgConfig = parseProductionReadonlyDatabaseUrl(url);
  const objects = loadFrozenAdoptionAllowlistObjects(repoRoot);
  const roleMapping = loadProductionRoleMapping(repoRoot, roleMappingFile);

  const handle = createOpaqueInvocationHandle({
    pgConfig,
    objects,
    roleMapping,
  });

  return Object.freeze({
    mode: MODE,
    disposableModePreserved: DISPOSABLE_MODE,
    dedicatedSecretKey: DEDICATED_SECRET_KEY,
    objectCount: objects.length,
    // Public names only (sanitized). Authoritative objects live in private store.
    objectNames: objects.map(
      (o) => `${o.object_kind.toLowerCase()}:${o.schema}.${o.object_name}`
    ),
    roleMappingClassCount: Object.keys(roleMapping).length,
    versionPolicy: Object.freeze({
      supported_major: 17,
      min_inclusive: 170000,
      max_exclusive: 180000,
    }),
    // Opaque handle — not a forgeable boolean marker / JSON-cloneable trust bit.
    handle,
  });
}

function getPrivateInvocationParts(plan) {
  if (!plan || typeof plan !== 'object') {
    fail(FAILURE.PRODUCTION_CATALOG_HANDLE_INVALID);
  }
  const payload = resolveOpaqueInvocationHandle(plan.handle);
  return {
    pgConfig: {
      host: payload.pgConfig.host,
      port: payload.pgConfig.port,
      user: payload.pgConfig.user,
      password: payload.pgConfig.password,
      database: payload.pgConfig.database,
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: payload.pgConfig.connectionTimeoutMillis || 10000,
    },
    objects: payload.objects,
    roleMapping: payload.roleMapping,
  };
}

function toPgClientConfigFromInvocationPlan(plan) {
  return getPrivateInvocationParts(plan).pgConfig;
}

/**
 * Release private payload for a plan handle using WeakMap object identity.
 * Only the exact branded handle object can delete. JSON clones, spread clones,
 * or forged branded-looking objects cannot invalidate the live payload.
 * Safe to call multiple times (idempotent — delete on WeakMap with non-existent key is no-op).
 */
function releaseInvocationPlan(plan) {
  if (plan && plan.handle && typeof plan.handle === 'object') {
    privateInvocationStore.delete(plan.handle);
  }
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
  getPrivateInvocationParts,
  toPgClientConfigFromInvocationPlan,
  releaseInvocationPlan,
  isLoopbackHost,
  canonicalizeHostForLoopbackCheck,
  canonicalizeIPv4,
};
