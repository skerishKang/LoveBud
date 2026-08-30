'use strict';

/**
 * No-connect private-input preflight for a future #4297 reconciliation activation.
 *
 * This helper validates only local/repository inputs. It deliberately imports no
 * PostgreSQL client and performs no network, database, Product-row, artifact-write,
 * privilege, credential, or role-mapping mutation. The deepest validation step is
 * the existing Production-readonly invocation-plan builder, which parses and
 * validates the dedicated private inputs without opening a database connection.
 * The opaque plan is released immediately after validation.
 *
 * Shared output contains fixed enums/counts only. Raw paths, URLs, credentials,
 * role/grantee names, mapping keys, private values, and underlying error messages
 * are never emitted.
 *
 * Refs #4301, #4297, #4295, #1882 KEEP OPEN
 */

const path = require('node:path');
const childProcess = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

const {
  validatePrivateOutputPath,
  validateSecretsInputPath,
} = require(path.resolve(__dirname, 'role-mapping-reconciliation-core.cjs'));

const productionBoundary = require(
  path.resolve(__dirname, 'production-readonly-catalog-boundary-core.cjs')
);

const PREFLIGHT_OUTCOME = Object.freeze({
  READY: 'RECONCILIATION_INPUT_PREFLIGHT_READY',
  INVALID: 'RECONCILIATION_INPUT_PREFLIGHT_INVALID',
});

const PREFLIGHT_STAGE = Object.freeze({
  NONE: 'NONE',
  CLI_ARGUMENTS: 'CLI_ARGUMENTS',
  BASELINE: 'BASELINE',
  HEAD_BINDING: 'HEAD_BINDING',
  PRIVATE_OUTPUT_PATH: 'PRIVATE_OUTPUT_PATH',
  SECRET_INPUT_PATH: 'SECRET_INPUT_PATH',
  ROLE_MAPPING_INPUT_PATH: 'ROLE_MAPPING_INPUT_PATH',
  PRIVATE_BOUNDARY_INPUT: 'PRIVATE_BOUNDARY_INPUT',
});

const ALLOWED_FLAGS = new Set([
  '--secret-file',
  '--role-mapping-file',
  '--private-output-file',
  '--baseline-commit',
]);

const REQUIRED_KEYS = Object.freeze([
  'secretFile',
  'roleMappingFile',
  'privateOutputFile',
  'baselineCommit',
]);

function buildSanitizedOutput(outcome, stage) {
  const validOutcome = outcome === PREFLIGHT_OUTCOME.READY
    ? PREFLIGHT_OUTCOME.READY
    : PREFLIGHT_OUTCOME.INVALID;
  const allowedStages = new Set(Object.values(PREFLIGHT_STAGE));
  const safeStage = allowedStages.has(stage)
    ? stage
    : PREFLIGHT_STAGE.PRIVATE_BOUNDARY_INPUT;

  return Object.freeze({
    format_version: '1.0',
    outcome: validOutcome,
    bounded_category: validOutcome,
    input_failure_stage: safeStage,
    collection_session_count: 0,
    production_connection_count: 0,
    production_sql_count: 0,
    product_row_read_count: 0,
    private_artifact_written: false,
    private_file_write_count: 0,
    schema_mutation: 'NONE',
    data_mutation: 'NONE',
    credential_change: 'NONE',
    privilege_change: 'NONE',
    role_mapping_mutation: 'NONE',
  });
}

function invalid(stage) {
  return buildSanitizedOutput(PREFLIGHT_OUTCOME.INVALID, stage);
}

function ready() {
  return buildSanitizedOutput(PREFLIGHT_OUTCOME.READY, PREFLIGHT_STAGE.NONE);
}

function parseArgs(argv) {
  if (!Array.isArray(argv)) return null;

  const parsed = {};
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (typeof flag !== 'string' || !flag.startsWith('--')) return null;
    if (!ALLOWED_FLAGS.has(flag) || seen.has(flag)) return null;
    seen.add(flag);

    const value = argv[index + 1];
    if (typeof value !== 'string' || !value || value.startsWith('--')) return null;

    if (flag === '--secret-file') parsed.secretFile = value;
    if (flag === '--role-mapping-file') parsed.roleMappingFile = value;
    if (flag === '--private-output-file') parsed.privateOutputFile = value;
    if (flag === '--baseline-commit') parsed.baselineCommit = value;
    index += 1;
  }

  for (const key of REQUIRED_KEYS) {
    if (typeof parsed[key] !== 'string' || !parsed[key]) return null;
  }

  return parsed;
}

function resolveCurrentHead(repoRoot) {
  return childProcess.execFileSync(
    'git',
    ['rev-parse', 'HEAD'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 1024,
    }
  ).trim();
}

function runPreflight(options, dependencies) {
  const deps = dependencies || {};
  const repoRoot = deps.repoRoot || REPO_ROOT;
  const resolveHead = deps.resolveHead || resolveCurrentHead;
  const boundary = deps.productionBoundary || productionBoundary;

  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return invalid(PREFLIGHT_STAGE.CLI_ARGUMENTS);
  }

  for (const key of REQUIRED_KEYS) {
    if (typeof options[key] !== 'string' || !options[key]) {
      return invalid(PREFLIGHT_STAGE.CLI_ARGUMENTS);
    }
  }

  if (!/^[a-f0-9]{40}$/.test(options.baselineCommit)) {
    return invalid(PREFLIGHT_STAGE.BASELINE);
  }

  let currentHead;
  try {
    currentHead = resolveHead(repoRoot);
  } catch {
    return invalid(PREFLIGHT_STAGE.HEAD_BINDING);
  }
  if (currentHead !== options.baselineCommit) {
    return invalid(PREFLIGHT_STAGE.HEAD_BINDING);
  }

  try {
    validatePrivateOutputPath(repoRoot, options.privateOutputFile);
  } catch {
    return invalid(PREFLIGHT_STAGE.PRIVATE_OUTPUT_PATH);
  }

  try {
    validateSecretsInputPath(repoRoot, options.secretFile);
  } catch {
    return invalid(PREFLIGHT_STAGE.SECRET_INPUT_PATH);
  }

  try {
    validateSecretsInputPath(repoRoot, options.roleMappingFile);
  } catch {
    return invalid(PREFLIGHT_STAGE.ROLE_MAPPING_INPUT_PATH);
  }

  let plan = null;
  try {
    plan = boundary.buildProductionReadonlyInvocationPlanForRoot(repoRoot, {
      secretFile: options.secretFile,
      roleMappingFile: options.roleMappingFile,
    });
  } catch {
    return invalid(PREFLIGHT_STAGE.PRIVATE_BOUNDARY_INPUT);
  } finally {
    if (plan) {
      try {
        boundary.releaseInvocationPlan(plan);
      } catch {
        return invalid(PREFLIGHT_STAGE.PRIVATE_BOUNDARY_INPUT);
      }
    }
  }

  return ready();
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const result = parsed
    ? runPreflight(parsed)
    : invalid(PREFLIGHT_STAGE.CLI_ARGUMENTS);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.outcome === PREFLIGHT_OUTCOME.READY ? 0 : 1;
}

if (require.main === module) {
  try {
    main();
  } catch {
    process.stdout.write(`${JSON.stringify(invalid(PREFLIGHT_STAGE.PRIVATE_BOUNDARY_INPUT), null, 2)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  PREFLIGHT_OUTCOME,
  PREFLIGHT_STAGE,
  buildSanitizedOutput,
  parseArgs,
  runPreflight,
};
