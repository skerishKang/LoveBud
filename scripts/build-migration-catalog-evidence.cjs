'use strict';

/**
 * CLI: build gate-compatible catalog evidence from sanitized structured metadata.
 * Source-only. Explicit --input required. Repository-root files only.
 * Refs #3542, #3458
 */

const path = require('node:path');
const {
  FAILURE,
  defaultContractPath,
  loadJson,
  buildCatalogEvidence,
  readCatalogMetadataFile,
  assertRepoRelativeInput,
  validateCatalogMetadataContract,
} = require('./migration-catalog-fingerprint-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const map = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      const err = new Error('unknown');
      err.category = 'CATALOG_INPUT_READ_FAILED';
      throw err;
    }
    if (arg === '--input') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        const err = new Error('missing');
        err.category = 'CATALOG_REQUIRED_FIELD_MISSING';
        throw err;
      }
      map.set(arg, next);
      i += 1;
      continue;
    }
    const err = new Error('unknown');
    err.category = 'CATALOG_TOP_LEVEL_FIELD_UNKNOWN';
    throw err;
  }
  return map;
}

function failClosed(blockers) {
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: 'CATALOG_EVIDENCE_BUILD',
        decision: 'FAIL_CLOSED',
        blockers: [...new Set(blockers)].sort(),
      },
      null,
      2
    )}\n`
  );
  process.exitCode = 1;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.has('--input')) {
      failClosed([FAILURE.CATALOG_REQUIRED_FIELD_MISSING]);
      return;
    }
    const inputArg = args.get('--input');
    const resolved = assertRepoRelativeInput(REPO_ROOT, path.resolve(REPO_ROOT, inputArg));
    const contract = loadJson(defaultContractPath(REPO_ROOT));
    validateCatalogMetadataContract(contract);
    const metadata = readCatalogMetadataFile(resolved, {
      maxInputBytes: contract.limits.max_input_bytes,
    });
    const evidence = buildCatalogEvidence(metadata, contract);
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    process.exitCode = 0;
  } catch (error) {
    const category = (error && error.category) || FAILURE.CATALOG_INPUT_READ_FAILED;
    failClosed([category]);
  }
}

main();
