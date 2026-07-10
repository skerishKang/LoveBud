'use strict';

/**
 * Deterministic reporter for LoveBud default-CI Node test evidence layers.
 *
 * Enumerates the same test directories the default `npm test` script runs,
 * then resolves each file against the machine-readable classification in
 * tests/test-layer-classification.json.
 *
 * The enumeration source of truth is `package.json` → `scripts.test`
 * (parsed into globs), NOT a hardcoded glob list. The parsed package globs
 * are compared, in exact ordered form, against the manifest's
 * `defaultCiGlobs`. Any drift (mismatch, unsupported command shape, duplicate
 * glob, missing glob directory) fails closed with a non-zero exit.
 *
 * It does NOT connect to any network, database, browser, or deployment target,
 * and it never prints secrets, private URLs, raw UUIDs, request IDs, or logs.
 *
 * Refs: #3429, #3425, #3427, #3428
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INVENTORY_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');

// Documented baseline only. The reporter never treats this as the source of
// truth for enumeration; it reads package.json.scripts.test instead.
const DEFAULT_CI_GLOBS = ['tests/smoke/*.test.cjs', 'tests/routes/*.test.cjs', 'tests/contracts/*.test.cjs'];

const SUPPLEMENTAL_VOCABULARY = ['SUPPLEMENTAL_PYTHON'];

// Shell operators / constructs that are not supported in the test command.
const SHELL_OPERATORS = ['&&', '||', ';'];

function loadInventory() {
  const raw = fs.readFileSync(INVENTORY_PATH, 'utf8');
  const inv = JSON.parse(raw);
  if (!Array.isArray(inv.vocabulary) || inv.vocabulary.length === 0) {
    throw new Error('Inventory vocabulary missing or empty');
  }
  if (!Array.isArray(inv.entries)) {
    throw new Error('Inventory entries missing');
  }
  return inv;
}

function readPackageTestCommand() {
  if (!fs.existsSync(PACKAGE_PATH)) {
    throw new Error('package.json not found');
  }
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  if (!pkg || !pkg.scripts || typeof pkg.scripts.test !== 'string' || !pkg.scripts.test.trim()) {
    throw new Error('package.json scripts.test missing or empty');
  }
  return pkg.scripts.test;
}

/**
 * Parse a `node --test <glob...>` command into its glob list.
 * Fails closed (throws) on any unsupported shape: shell operators, pipes,
 * redirection, a non-`node --test` command, missing globs, or a glob that is
 * not a `*.test.cjs` path.
 */
function parseNodeTestGlobs(testCommand) {
  if (typeof testCommand !== 'string' || !testCommand.trim()) {
    throw new Error('UNSUPPORTED_TEST_COMMAND: empty command');
  }
  for (const op of SHELL_OPERATORS) {
    if (testCommand.includes(op)) {
      throw new Error('UNSUPPORTED_TEST_COMMAND: shell operator ' + op);
    }
  }
  if (testCommand.includes('|')) {
    throw new Error('UNSUPPORTED_TEST_COMMAND: pipe');
  }
  if (testCommand.includes('>') || testCommand.includes('<')) {
    throw new Error('UNSUPPORTED_TEST_COMMAND: redirection');
  }
  const tokens = testCommand.trim().split(/\s+/);
  if (tokens[0] !== 'node' || tokens[1] !== '--test') {
    throw new Error('UNSUPPORTED_TEST_COMMAND: not a `node --test` command');
  }
  const globs = tokens.slice(2);
  if (globs.length === 0) {
    throw new Error('UNSUPPORTED_TEST_COMMAND: no globs');
  }
  for (const g of globs) {
    if (typeof g !== 'string' || !g.endsWith('.test.cjs')) {
      throw new Error('UNSUPPORTED_TEST_COMMAND: invalid glob ' + g);
    }
  }
  return globs;
}

/**
 * Pure check of a package test command against the manifest globs.
 * Returns status flags only (no private path output). Never throws on a
 * malformed command; it records `unsupportedTestCommand` instead.
 */
function checkPackageTestCommand(command, manifestGlobs) {
  const res = {
    packageGlobMismatch: false,
    unsupportedTestCommand: false,
    duplicateGlobs: false,
    missingGlobDirectories: false,
    globs: [],
  };
  let globs;
  try {
    globs = parseNodeTestGlobs(command);
  } catch (e) {
    res.unsupportedTestCommand = true;
    return res;
  }
  res.globs = globs;

  const seen = new Set();
  for (const g of globs) {
    if (seen.has(g)) res.duplicateGlobs = true;
    seen.add(g);
  }

  for (const g of globs) {
    const dir = path.join(ROOT, path.dirname(g));
    if (!fs.existsSync(dir)) res.missingGlobDirectories = true;
  }

  const manifest = Array.isArray(manifestGlobs) ? manifestGlobs : [];
  if (res.globs.length !== manifest.length || !res.globs.every((g, i) => g === manifest[i])) {
    res.packageGlobMismatch = true;
  }

  return res;
}

function enumerateDefaultCi(globs) {
  let useGlobs = globs;
  if (!Array.isArray(useGlobs) || useGlobs.length === 0) {
    useGlobs = parseNodeTestGlobs(readPackageTestCommand());
  }
  const files = [];
  for (const glob of useGlobs) {
    const dir = path.join(ROOT, path.dirname(glob));
    if (!fs.existsSync(dir)) continue;
    const matched = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.test.cjs'))
      .map((f) => path.join(path.dirname(glob), f).split(path.sep).join('/'));
    files.push(...matched);
  }
  files.sort();
  return files;
}

/**
 * Validate the supplemental (out-of-default-CI) inventory entries.
 * Each entry must be a real `.py` file, flagged `defaultCi: false`, use the
 * allowed supplemental layer, carry a non-empty rationale, not overlap the
 * default-CI enumerated set, and not be duplicated.
 */
function validateSupplemental(inv, enumeratedSet) {
  const suppEntries = Array.isArray(inv.supplemental) ? inv.supplemental : [];
  const stale = [];
  const duplicates = [];
  const inDefaultCi = [];
  const invalid = [];
  const emptyRationale = [];
  const seen = new Set();
  for (const s of suppEntries) {
    const sp = s && typeof s.path === 'string' ? s.path.split(path.sep).join('/') : '';
    if (!sp) {
      invalid.push('<missing-path>');
      continue;
    }
    if (seen.has(sp)) duplicates.push(sp);
    else seen.add(sp);
    if (s.defaultCi !== false) inDefaultCi.push(sp);
    if (!SUPPLEMENTAL_VOCABULARY.includes(s.layer)) invalid.push(sp);
    if (!sp.endsWith('.py')) invalid.push(sp);
    if (!s.rationale || !String(s.rationale).trim()) emptyRationale.push(sp);
    if (enumeratedSet.has(sp)) inDefaultCi.push(sp);
    const fp = path.join(ROOT, sp);
    if (!fs.existsSync(fp)) stale.push(sp);
  }
  return { stale, duplicates, inDefaultCi, invalid, emptyRationale };
}

function classify(inv, enumerated) {
  const byPath = new Map();
  for (const e of inv.entries) {
    const key = e.path.split(path.sep).join('/');
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key).push(e);
  }

  const vocab = new Set(inv.vocabulary);
  const enumeratedSet = new Set(enumerated);
  const counts = {};
  for (const v of inv.vocabulary) counts[v] = 0;

  const unclassified = [];
  const conflicts = [];
  const invalidCategory = [];
  const emptyRationale = [];

  for (const f of enumerated) {
    const matches = byPath.get(f) || [];
    if (matches.length === 0) {
      unclassified.push(f);
      continue;
    }
    if (matches.length > 1) {
      conflicts.push(f);
      continue;
    }
    const entry = matches[0];
    if (!vocab.has(entry.layer)) {
      invalidCategory.push(f);
      continue;
    }
    if (!entry.rationale || !String(entry.rationale).trim()) {
      emptyRationale.push(f);
      continue;
    }
    counts[entry.layer] += 1;
  }

  const stale = [];
  for (const e of inv.entries) {
    const key = e.path.split(path.sep).join('/');
    if (!enumeratedSet.has(key)) stale.push(key);
  }

  const supp = validateSupplemental(inv, enumeratedSet);

  return {
    counts,
    unclassified,
    conflicts,
    invalidCategory,
    emptyRationale,
    stale,
    supplementalStale: supp.stale,
    supplementalDuplicates: supp.duplicates,
    supplementalInDefaultCi: supp.inDefaultCi,
    supplementalInvalid: supp.invalid,
    supplementalEmptyRationale: supp.emptyRationale,
    totalClassified:
      enumerated.length -
      unclassified.length -
      conflicts.length -
      invalidCategory.length -
      emptyRationale.length,
  };
}

function run() {
  const inv = loadInventory();
  const manifestGlobs = Array.isArray(inv.defaultCiGlobs) ? inv.defaultCiGlobs : [];

  let command;
  try {
    command = readPackageTestCommand();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('PACKAGE_TEST_COMMAND_ERROR: ' + e.message);
    process.exitCode = 1;
    return { inv, enumerated: [], result: null };
  }

  const pkg = checkPackageTestCommand(command, manifestGlobs);
  const enumerated = enumerateDefaultCi(pkg.globs);
  const result = classify(inv, enumerated);

  result.packageGlobMismatch = pkg.packageGlobMismatch;
  result.unsupportedTestCommand = pkg.unsupportedTestCommand;
  result.duplicateGlobs = pkg.duplicateGlobs;
  result.missingGlobDirectories = pkg.missingGlobDirectories;

  const lines = [];
  lines.push('LoveBud default-CI test evidence-layer classification');
  lines.push('Enumerated default-CI test files: ' + enumerated.length);
  lines.push('');
  lines.push('Per-layer counts (deterministic vocabulary order):');
  for (const v of inv.vocabulary) {
    lines.push('  ' + v + ': ' + result.counts[v]);
  }
  lines.push('');
  lines.push('Total classified: ' + result.totalClassified);
  lines.push('Unclassified: ' + result.unclassified.length);
  lines.push('Conflicting: ' + result.conflicts.length);
  lines.push('Invalid category: ' + result.invalidCategory.length);
  lines.push('Empty rationale: ' + result.emptyRationale.length);
  lines.push('Stale inventory paths: ' + result.stale.length);
  lines.push('Package test-command glob equality: ' + (result.packageGlobMismatch ? 'MISMATCH' : 'exact'));
  lines.push('Unsupported package test command: ' + (result.unsupportedTestCommand ? 'YES' : 'no'));
  lines.push('Duplicate globs: ' + (result.duplicateGlobs ? 'YES' : 'no'));
  lines.push('Missing glob directories: ' + (result.missingGlobDirectories ? 'YES' : 'no'));
  lines.push('Supplemental stale: ' + result.supplementalStale.length);
  lines.push('Supplemental duplicates: ' + result.supplementalDuplicates.length);
  lines.push('Supplemental in default-CI: ' + result.supplementalInDefaultCi.length);
  lines.push('Supplemental invalid: ' + result.supplementalInvalid.length);
  lines.push('Supplemental empty rationale: ' + result.supplementalEmptyRationale.length);
  lines.push('');
  // Explicitly surfaced per Issue #3429 requirements.
  lines.push('DB_ENGINE_EXECUTION: ' + result.counts.DB_ENGINE_EXECUTION);
  lines.push('PRODUCTION_SMOKE: ' + result.counts.PRODUCTION_SMOKE);
  lines.push('');
  const supplemental = Array.isArray(inv.supplemental) ? inv.supplemental.length : 0;
  lines.push('Supplemental / out-of-default-CI tests (excluded from default-CI counts): ' + supplemental);

  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));

  const failed =
    result.unclassified.length > 0 ||
    result.conflicts.length > 0 ||
    result.invalidCategory.length > 0 ||
    result.emptyRationale.length > 0 ||
    result.stale.length > 0 ||
    result.packageGlobMismatch ||
    result.unsupportedTestCommand ||
    result.duplicateGlobs ||
    result.missingGlobDirectories ||
    result.supplementalStale.length > 0 ||
    result.supplementalDuplicates.length > 0 ||
    result.supplementalInDefaultCi.length > 0 ||
    result.supplementalInvalid.length > 0 ||
    result.supplementalEmptyRationale.length > 0;

  if (failed) {
    if (result.unclassified.length) console.error('UNCLASSIFIED:\n  ' + result.unclassified.join('\n  '));
    if (result.conflicts.length) console.error('CONFLICTS:\n  ' + result.conflicts.join('\n  '));
    if (result.invalidCategory.length) console.error('INVALID_CATEGORY:\n  ' + result.invalidCategory.join('\n  '));
    if (result.emptyRationale.length) console.error('EMPTY_RATIONALE:\n  ' + result.emptyRationale.join('\n  '));
    if (result.stale.length) console.error('STALE:\n  ' + result.stale.join('\n  '));
    if (result.packageGlobMismatch) console.error('PACKAGE_GLOB_MISMATCH');
    if (result.unsupportedTestCommand) console.error('UNSUPPORTED_TEST_COMMAND');
    if (result.duplicateGlobs) console.error('DUPLICATE_GLOBS');
    if (result.missingGlobDirectories) console.error('MISSING_GLOB_DIRECTORIES');
    if (result.supplementalStale.length) console.error('SUPPLEMENTAL_STALE:\n  ' + result.supplementalStale.join('\n  '));
    if (result.supplementalDuplicates.length) console.error('SUPPLEMENTAL_DUPLICATES:\n  ' + result.supplementalDuplicates.join('\n  '));
    if (result.supplementalInDefaultCi.length) console.error('SUPPLEMENTAL_IN_DEFAULT_CI:\n  ' + result.supplementalInDefaultCi.join('\n  '));
    if (result.supplementalInvalid.length) console.error('SUPPLEMENTAL_INVALID:\n  ' + result.supplementalInvalid.join('\n  '));
    if (result.supplementalEmptyRationale.length) console.error('SUPPLEMENTAL_EMPTY_RATIONALE:\n  ' + result.supplementalEmptyRationale.join('\n  '));
    process.exitCode = 1;
  }
  return { inv, enumerated, result };
}

if (require.main === module) {
  run();
}

module.exports = {
  loadInventory,
  readPackageTestCommand,
  parseNodeTestGlobs,
  checkPackageTestCommand,
  enumerateDefaultCi,
  validateSupplemental,
  classify,
  run,
  DEFAULT_CI_GLOBS,
  SUPPLEMENTAL_VOCABULARY,
};
