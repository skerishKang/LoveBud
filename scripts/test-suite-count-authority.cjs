'use strict';

// Canonical test-suite count authority (Issue #3838 / parent #3425).
//
// Derives the global default-CI test-layer counts from fixed repository-owned
// sources (tests/test-layer-classification.json, tests/ci-test-group-registry.json,
// package.json scripts.test). This module is the single canonical numeric
// authority that the reporter and count-consuming contracts must agree with.
//
// Guarantees:
//   - deterministic: no timestamps, randomness, environment, or order dependence
//   - fail closed on malformed, duplicate, unknown, stale, or overriding input
//   - fixed repository paths only: no caller-selected path, no count override
//   - no network, child process, filesystem write, or console output from core
//   - deep-frozen detached result
//
// Lockstep invariant: the enumeration/classification rules in this module are an
// independent re-derivation of scripts/report-ci-test-groups.cjs (deliberate
// duplication to avoid circular validation). Any change to the reporter's glob
// or classification rules must update this authority in lockstep, or the
// reporter's LAYER_RECONCILIATION_MISMATCH gate will fail permanently.
// tests/contracts/test-suite-count-authority-contract.test.cjs asserts the two
// derivations agree on the current repository.

const fs = require('fs');
const path = require('path');
const { types } = require('node:util');

const ROOT = path.resolve(__dirname, '..');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');
const REGISTRY_PATH = path.join(ROOT, 'tests', 'ci-test-group-registry.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');

const VOCABULARY = Object.freeze([
  'SOURCE_STATIC',
  'EXECUTED_FAKE',
  'EXECUTED_REAL_LOCAL',
  'EXTERNAL_INTEGRATION',
  'PRODUCTION_SMOKE',
  'DB_ENGINE_EXECUTION',
]);

const SUPPLEMENTAL_VOCABULARY = Object.freeze(['SUPPLEMENTAL_PYTHON', 'DB_ENGINE_EXECUTION']);

const CANONICAL_GROUP_ENUM = Object.freeze([
  'SOURCE_STATIC',
  'EXECUTED_FAKE',
  'BROWSER_REAL_LOCAL',
  'PROCESS_REAL_LOCAL',
  'DB_ENGINE',
  'PYTHON_SUPPLEMENTAL',
  'REMOTE_OR_PROVIDER_MANUAL',
  'FULL_DEFAULT_REGRESSION',
]);

const ERROR_CODES = Object.freeze({
  AUTHORITY_INPUT_INVALID: 'AUTHORITY_INPUT_INVALID',
  AUTHORITY_UNKNOWN_FIELD: 'AUTHORITY_UNKNOWN_FIELD',
  AUTHORITY_ACCESSOR_INPUT: 'AUTHORITY_ACCESSOR_INPUT',
  REGISTRY_PARSE_ERROR: 'REGISTRY_PARSE_ERROR',
  REGISTRY_SCHEMA_ERROR: 'REGISTRY_SCHEMA_ERROR',
  UNKNOWN_ENUM: 'UNKNOWN_ENUM',
  DUPLICATE_PATH: 'DUPLICATE_PATH',
  UNCLASSIFIED_DEFAULT_PATH: 'UNCLASSIFIED_DEFAULT_PATH',
  STALE_PATH: 'STALE_PATH',
  OVERLAPPING_MEMBERSHIP: 'OVERLAPPING_MEMBERSHIP',
  LAYER_RECONCILIATION_MISMATCH: 'LAYER_RECONCILIATION_MISMATCH',
});

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
  }
  return value;
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, label + ' must be a plain object');
  }
  if (types.isProxy(value)) {
    throw fail(ERROR_CODES.AUTHORITY_ACCESSOR_INPUT, label + ' must not be a Proxy');
  }
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && (typeof descriptor.get === 'function' || typeof descriptor.set === 'function')) {
      throw fail(ERROR_CODES.AUTHORITY_ACCESSOR_INPUT, label + ' must not contain accessor properties');
    }
  }
  return value;
}

function assertNoProxyArray(value, label) {
  if (!Array.isArray(value)) throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, label + ' must be an array');
  if (types.isProxy(value)) throw fail(ERROR_CODES.AUTHORITY_ACCESSOR_INPUT, label + ' must not be a Proxy');
  return value;
}

function assertString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, label + ' must be a non-empty string');
  }
  return value;
}

function readJsonFixed(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    throw fail(ERROR_CODES.REGISTRY_PARSE_ERROR, 'Cannot read required source file');
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw fail(ERROR_CODES.REGISTRY_PARSE_ERROR, 'Malformed JSON in required source file');
  }
}

function parseTestGlobs(testCommand) {
  if (typeof testCommand !== 'string' || !testCommand.trim()) {
    throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'Empty test command');
  }
  for (const op of ['&&', '||', ';']) {
    if (testCommand.includes(op)) throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'Shell operator in test command');
  }
  if (testCommand.includes('|') || testCommand.includes('>') || testCommand.includes('<')) {
    throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'Pipe or redirection in test command');
  }
  const tokens = testCommand.trim().split(/\s+/);
  if (tokens[0] !== 'node' || tokens[1] !== '--test') {
    throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'Not a node --test command');
  }
  const globs = tokens.slice(2);
  if (globs.length === 0) throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'No globs in test command');
  for (const g of globs) {
    if (typeof g !== 'string' || !g.trim()) throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'Invalid glob');
    const norm = g.split(path.sep).join('/');
    if (norm.startsWith('/') || /^[A-Za-z]:/.test(norm)) throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'Absolute path in glob');
    const parts = norm.split('/').filter((p) => p.length > 0);
    if (parts.includes('..')) throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'Path traversal in glob');
    const basename = parts[parts.length - 1];
    if (basename !== '*.test.cjs') throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'Invalid glob shape');
    for (const d of parts.slice(0, -1)) {
      if (d.includes('*') || d.includes('?')) throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'Wildcard in directory');
    }
  }
  return globs;
}

function enumerateDefaultCi(globs) {
  const files = [];
  for (const glob of globs) {
    const dir = path.join(ROOT, path.dirname(glob));
    if (!fs.existsSync(dir)) continue;
    const matched = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.test.cjs'))
      .map((f) => path.join(path.dirname(glob), f).split(path.sep).join('/'));
    files.push(...matched);
  }
  files.sort();
  return files;
}

// Pure deterministic derivation from validated fixed-source objects. The caller
// supplies only the fixed-source objects; no path, count override, or arbitrary
// field is accepted. The result is a deep-frozen detached counts summary.
function deriveTestSuiteCountsFromSources(sources) {
  if (sources === null || typeof sources !== 'object' || Array.isArray(sources)) {
    throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'sources must be a plain object');
  }
  if (types.isProxy(sources)) throw fail(ERROR_CODES.AUTHORITY_ACCESSOR_INPUT, 'sources must not be a Proxy');
  const allowedKeys = new Set(['classification', 'registry', 'enumeratedDefaultCi']);
  for (const key of Object.keys(sources)) {
    if (!allowedKeys.has(key)) {
      throw fail(ERROR_CODES.AUTHORITY_UNKNOWN_FIELD, 'Unknown source field: ' + key);
    }
  }

  const classification = assertPlainObject(sources.classification, 'classification');
  const registry = assertPlainObject(sources.registry, 'registry');
  const enumeratedDefaultCi = assertNoProxyArray(sources.enumeratedDefaultCi, 'enumeratedDefaultCi');
  for (const p of enumeratedDefaultCi) assertString(p, 'enumerated path');

  const vocabulary = assertNoProxyArray(classification.vocabulary, 'classification.vocabulary');
  if (vocabulary.length !== VOCABULARY.length) {
    throw fail(ERROR_CODES.UNKNOWN_ENUM, 'classification vocabulary length mismatch');
  }
  for (let i = 0; i < VOCABULARY.length; i += 1) {
    if (vocabulary[i] !== VOCABULARY[i]) {
      throw fail(ERROR_CODES.UNKNOWN_ENUM, 'classification vocabulary mismatch at index ' + i);
    }
  }

  const entries = assertNoProxyArray(classification.entries, 'classification.entries');
  const byPath = new Map();
  const seenPaths = new Set();
  for (const entry of entries) {
    assertPlainObject(entry, 'classification entry');
    const p = assertString(entry.path, 'entry path');
    const norm = p.split(path.sep).join('/');
    if (seenPaths.has(norm)) throw fail(ERROR_CODES.DUPLICATE_PATH, 'Duplicate classification path: ' + norm);
    seenPaths.add(norm);
    const layer = assertString(entry.layer, 'entry layer');
    if (!VOCABULARY.includes(layer)) throw fail(ERROR_CODES.UNKNOWN_ENUM, 'Unknown layer: ' + layer);
    if (!entry.rationale || !String(entry.rationale).trim()) {
      throw fail(ERROR_CODES.LAYER_RECONCILIATION_MISMATCH, 'Empty rationale for ' + norm);
    }
    if (byPath.has(norm)) throw fail(ERROR_CODES.DUPLICATE_PATH, 'Conflicting classification: ' + norm);
    byPath.set(norm, layer);
  }

  // Registry validation for count-relevant groups.
  const groupEnum = assertNoProxyArray(registry.group_enum, 'registry.group_enum');
  if (groupEnum.length !== CANONICAL_GROUP_ENUM.length) {
    throw fail(ERROR_CODES.UNKNOWN_ENUM, 'registry group_enum length mismatch');
  }
  for (let i = 0; i < CANONICAL_GROUP_ENUM.length; i += 1) {
    if (groupEnum[i] !== CANONICAL_GROUP_ENUM[i]) {
      throw fail(ERROR_CODES.UNKNOWN_ENUM, 'registry group_enum mismatch at index ' + i);
    }
  }
  const groups = assertNoProxyArray(registry.groups, 'registry.groups');
  const groupNames = new Set();
  for (const g of groups) {
    assertPlainObject(g, 'registry group');
    const name = assertString(g.group, 'group name');
    if (!CANONICAL_GROUP_ENUM.includes(name)) throw fail(ERROR_CODES.UNKNOWN_ENUM, 'Unknown group: ' + name);
    if (groupNames.has(name)) throw fail(ERROR_CODES.DUPLICATE_PATH, 'Duplicate group: ' + name);
    groupNames.add(name);
    if (name === 'BROWSER_REAL_LOCAL' || name === 'PROCESS_REAL_LOCAL') {
      assertNoProxyArray(g.explicit_paths, name + ' explicit_paths');
    }
  }
  for (const required of ['BROWSER_REAL_LOCAL', 'PROCESS_REAL_LOCAL']) {
    if (!groupNames.has(required)) throw fail(ERROR_CODES.REGISTRY_SCHEMA_ERROR, 'Missing group: ' + required);
  }
  const browserGroup = groups.find((g) => g.group === 'BROWSER_REAL_LOCAL');
  const processGroup = groups.find((g) => g.group === 'PROCESS_REAL_LOCAL');
  const browserPaths = browserGroup.explicit_paths.map((p) => p.split(path.sep).join('/'));
  const processPaths = processGroup.explicit_paths.map((p) => p.split(path.sep).join('/'));

  // Count classification of the enumerated default-CI inventory.
  const counts = {};
  for (const v of VOCABULARY) counts[v] = 0;
  for (const f of enumeratedDefaultCi) {
    const norm = f.split(path.sep).join('/');
    if (!byPath.has(norm)) throw fail(ERROR_CODES.UNCLASSIFIED_DEFAULT_PATH, 'Unclassified default path: ' + norm);
    counts[byPath.get(norm)] += 1;
  }

  // Stale classification entries not present in the enumerated inventory.
  const enumeratedSet = new Set(enumeratedDefaultCi.map((f) => f.split(path.sep).join('/')));
  for (const norm of byPath.keys()) {
    if (!enumeratedSet.has(norm)) throw fail(ERROR_CODES.STALE_PATH, 'Stale classification entry: ' + norm);
  }

  // Browser/process explicit-path membership must match EXECUTED_REAL_LOCAL.
  const union = new Set([...browserPaths, ...processPaths]);
  if (union.size !== browserPaths.length + processPaths.length) {
    throw fail(ERROR_CODES.OVERLAPPING_MEMBERSHIP, 'Browser/process explicit path overlap');
  }
  const realLocalPaths = new Set();
  for (const f of enumeratedDefaultCi) {
    const norm = f.split(path.sep).join('/');
    if (byPath.get(norm) === 'EXECUTED_REAL_LOCAL') realLocalPaths.add(norm);
  }
  for (const p of union) {
    if (!realLocalPaths.has(p)) {
      throw fail(ERROR_CODES.OVERLAPPING_MEMBERSHIP, 'Explicit browser/process path is not EXECUTED_REAL_LOCAL: ' + p);
    }
  }
  for (const p of realLocalPaths) {
    if (!union.has(p)) {
      throw fail(ERROR_CODES.OVERLAPPING_MEMBERSHIP, 'EXECUTED_REAL_LOCAL path missing from browser/process: ' + p);
    }
  }

  // Supplemental counts (bounded).
  const supplemental = Array.isArray(classification.supplemental)
    ? assertNoProxyArray(classification.supplemental, 'classification.supplemental')
    : [];
  let supplementalPython = 0;
  let supplementalDbEngine = 0;
  const supplementalSeen = new Set();
  for (const s of supplemental) {
    assertPlainObject(s, 'supplemental entry');
    const p = assertString(s.path, 'supplemental path');
    const norm = p.split(path.sep).join('/');
    if (supplementalSeen.has(norm)) throw fail(ERROR_CODES.DUPLICATE_PATH, 'Duplicate supplemental path: ' + norm);
    supplementalSeen.add(norm);
    const layer = assertString(s.layer, 'supplemental layer');
    if (!SUPPLEMENTAL_VOCABULARY.includes(layer)) {
      throw fail(ERROR_CODES.UNKNOWN_ENUM, 'Unknown supplemental layer: ' + layer);
    }
    if (!s.rationale || !String(s.rationale).trim()) {
      throw fail(ERROR_CODES.LAYER_RECONCILIATION_MISMATCH, 'Empty supplemental rationale for ' + norm);
    }
    if (s.defaultCi !== false) throw fail(ERROR_CODES.REGISTRY_SCHEMA_ERROR, 'Supplemental entry must be defaultCi:false: ' + norm);
    if (layer === 'SUPPLEMENTAL_PYTHON') supplementalPython += 1;
    else if (layer === 'DB_ENGINE_EXECUTION') supplementalDbEngine += 1;
  }

  const defaultTotal = enumeratedDefaultCi.length;
  const layerSum = Object.keys(counts).reduce((a, k) => a + counts[k], 0);
  if (defaultTotal !== layerSum) {
    throw fail(ERROR_CODES.LAYER_RECONCILIATION_MISMATCH, 'default_total does not equal layer sum');
  }

  const result = {
    default_total: defaultTotal,
    SOURCE_STATIC: counts.SOURCE_STATIC,
    EXECUTED_FAKE: counts.EXECUTED_FAKE,
    EXECUTED_REAL_LOCAL: counts.EXECUTED_REAL_LOCAL,
    EXTERNAL_INTEGRATION: counts.EXTERNAL_INTEGRATION,
    PRODUCTION_SMOKE: counts.PRODUCTION_SMOKE,
    DB_ENGINE_EXECUTION: counts.DB_ENGINE_EXECUTION,
    browser_count: browserPaths.length,
    process_count: processPaths.length,
    supplemental_python: supplementalPython,
    supplemental_db_engine: supplementalDbEngine,
  };
  return deepFreeze(result);
}

// Loads the fixed repository-owned sources and returns the canonical frozen
// counts summary. Accepts no arguments; caller-selected input is rejected.
function loadCanonicalTestSuiteCounts() {
  const pkg = readJsonFixed(PACKAGE_PATH);
  const testCommand = pkg && pkg.scripts && pkg.scripts.test;
  if (typeof testCommand !== 'string' || !testCommand.trim()) {
    throw fail(ERROR_CODES.AUTHORITY_INPUT_INVALID, 'package.json scripts.test missing');
  }
  const globs = parseTestGlobs(testCommand);
  const enumeratedDefaultCi = enumerateDefaultCi(globs);
  const classification = readJsonFixed(CLASSIFICATION_PATH);
  const registry = readJsonFixed(REGISTRY_PATH);
  return deriveTestSuiteCountsFromSources({ classification, registry, enumeratedDefaultCi });
}

module.exports = {
  CONTRACT_VERSION: 1,
  VOCABULARY,
  SUPPLEMENTAL_VOCABULARY,
  CANONICAL_GROUP_ENUM,
  ERROR_CODES,
  deriveTestSuiteCountsFromSources,
  loadCanonicalTestSuiteCounts,
};
