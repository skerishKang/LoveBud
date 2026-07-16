'use strict';

/**
 * CLI: build repository-owned PREPARED_ONLY adoption-baseline collection plan.
 * Explicit arguments only. Stdout-only. No DB, network, shell, secrets, or env fallback.
 * Uses the same trusted contract loader as the programmatic API.
 *
 * Refs #3555, #3458
 */

const {
  FAILURE,
  buildPreparedCollectionPlan,
  serializePreparedCollectionPlan,
} = require('./adoption-baseline-collection-plan-core.cjs');

function parseArgs(argv) {
  const map = new Map();
  const allowed = new Set(['--baseline-commit', '--approval-reference']);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--') || !allowed.has(arg)) {
      const err = new Error('unknown');
      err.category = FAILURE.COLLECTION_PLAN_INPUT_INVALID;
      throw err;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      const err = new Error('missing');
      err.category = FAILURE.COLLECTION_PLAN_INPUT_INVALID;
      throw err;
    }
    map.set(arg, next);
    i += 1;
  }
  return map;
}

function failClosed(blockers) {
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: 'ADOPTION_BASELINE_COLLECTION_PLAN_BUILD',
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
    if (!args.has('--baseline-commit') || !args.has('--approval-reference')) {
      failClosed([FAILURE.COLLECTION_PLAN_INPUT_INVALID]);
      return;
    }
    // Public builder loads the canonical repository contract internally.
    // No caller path, env, or second-arg contract injection.
    const plan = buildPreparedCollectionPlan({
      baselineCommit: args.get('--baseline-commit'),
      approvalReference: args.get('--approval-reference'),
    });
    process.stdout.write(serializePreparedCollectionPlan(plan));
    process.exitCode = 0;
  } catch (error) {
    const category = (error && error.category) || FAILURE.COLLECTION_PLAN_INPUT_INVALID;
    failClosed([category]);
  }
}

main();
