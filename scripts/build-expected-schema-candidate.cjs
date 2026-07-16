'use strict';

/**
 * CLI: build inactive expected-schema candidate JSON from sanitized catalog evidence.
 * Explicit --evidence only. Stdout-only. No DATABASE_URL, network, shell, or stdin.
 *
 * Refs #3549, #3544, #3542, #3458
 */

const path = require('node:path');
const {
  FAILURE,
  buildExpectedSchemaCandidate,
  serializeExpectedSchemaCandidate,
  readEvidenceFile,
  loadCommittedInactiveTemplate,
} = require('./expected-schema-candidate-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const map = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      const err = new Error('unknown');
      err.category = FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID;
      throw err;
    }
    if (arg === '--evidence') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        const err = new Error('missing');
        err.category = FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID;
        throw err;
      }
      map.set(arg, next);
      i += 1;
      continue;
    }
    const err = new Error('unknown');
    err.category = FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID;
    throw err;
  }
  return map;
}

function failClosed(blockers) {
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: 'EXPECTED_SCHEMA_CANDIDATE_BUILD',
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
    if (!args.has('--evidence')) {
      failClosed([FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID]);
      return;
    }
    const evidenceArg = args.get('--evidence');
    // Repository-bound reader only: lexical + realpath confinement inside core.
    // No unconfined absolute-path read path is exposed to the CLI.
    const evidence = readEvidenceFile(REPO_ROOT, evidenceArg);
    const template = loadCommittedInactiveTemplate(REPO_ROOT);
    const candidate = buildExpectedSchemaCandidate(evidence, template);
    process.stdout.write(serializeExpectedSchemaCandidate(candidate));
    process.exitCode = 0;
  } catch (error) {
    const category = (error && error.category) || FAILURE.EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID;
    failClosed([category]);
  }
}

main();
