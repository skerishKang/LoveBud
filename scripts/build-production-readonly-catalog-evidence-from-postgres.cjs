'use strict';

/**
 * CLI: Production-readonly catalog evidence entrypoint (fail-closed boundary).
 *
 * Allowed flags only:
 *   --secret-file <repo-relative .secrets/...>
 *   --role-mapping-file <repo-relative .secrets/...>
 *   --validate-only
 *
 * Forbidden argv surface: credential/object/sql flags (listed in FORBIDDEN_FLAGS).
 * Forbidden: generic DATABASE_URL fallback
 *
 * Default path prepares a validated invocation plan. Full collection requires
 * explicit future Phase B approval and is available only via internal mode after
 * validation; this child does not run Production sessions.
 *
 * Refs #3570, #3458
 * Refs #3425 — Keep #3425 OPEN.
 * Refs #1882 — Keep #1882 OPEN.
 * #3569 is CLOSED / completed. Do not reopen.
 */

const path = require('node:path');
const {
  MODE,
  FAILURE,
  buildProductionReadonlyInvocationPlan,
  isSupportedProductionServerVersionNum,
  getPrivateInvocationParts,
  releaseInvocationPlan,
} = require('./production-readonly-catalog-boundary-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

const ALLOWED_FLAGS = new Set([
  '--secret-file',
  '--role-mapping-file',
  '--validate-only',
]);

const FORBIDDEN_FLAGS = new Set([
  '--password',
  '--host',
  '--user',
  '--database',
  '--port',
  '--objects',
  '--sql',
  '--connection-string',
  '--database-url',
]);

function failClosed(blockers) {
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: MODE,
        decision: 'FAIL_CLOSED',
        blockers: [...new Set(blockers)].sort(),
      },
      null,
      2
    )}\n`
  );
  process.exitCode = 1;
}

function parseArgs(argv) {
  const map = new Map();
  let validateOnly = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (FORBIDDEN_FLAGS.has(arg)) {
      const err = new Error('forbidden');
      err.category = FAILURE.PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED;
      throw err;
    }
    if (!arg.startsWith('--') || !ALLOWED_FLAGS.has(arg)) {
      const err = new Error('unknown');
      err.category = FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
      throw err;
    }
    if (arg === '--validate-only') {
      validateOnly = true;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      const err = new Error('missing');
      err.category = FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
      throw err;
    }
    map.set(arg, next);
    i += 1;
  }
  return { map, validateOnly };
}

async function main() {
  let plan;

  try {
    const { map, validateOnly } = parseArgs(process.argv.slice(2));
    if (!map.has('--secret-file') || !map.has('--role-mapping-file')) {
      failClosed([FAILURE.PRODUCTION_CATALOG_INPUT_INVALID]);
      return;
    }

    plan = buildProductionReadonlyInvocationPlan(REPO_ROOT, {
      secretFile: map.get('--secret-file'),
      roleMappingFile: map.get('--role-mapping-file'),
    });

    // Sanitized validation success — no host/user/db/password/url.
    const privateParts = getPrivateInvocationParts(plan);
    const validationReport = {
      mode: MODE,
      decision: 'VALIDATION_PASS',
      validate_only: validateOnly === true,
      object_count: plan.objectCount,
      objects: plan.objectNames,
      version_policy: plan.versionPolicy,
      dedicated_secret_key: plan.dedicatedSecretKey,
      disposable_mode_preserved: plan.disposableModePreserved,
      connection_validated: true,
      role_mapping_classes_present: true,
      // Shape only — never values.
      client_config_shape: Object.keys(privateParts.pgConfig).sort(),
      production_version_helper_loaded: typeof isSupportedProductionServerVersionNum === 'function',
      opaque_handle: true,
    };

    if (validateOnly) {
      process.stdout.write(`${JSON.stringify(validationReport, null, 2)}\n`);
      process.exitCode = 0;
      return;
    }

    // Full connect/collection is intentionally not auto-run by this child.
    // A later Phase B operator child may invoke
    // collectProductionReadonlyCatalogEvidenceFromFiles after dedicated credentials exist.
    failClosed([FAILURE.PRODUCTION_CATALOG_POLICY_INVALID]);
  } catch (error) {
    const category = (error && error.category) || FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
    failClosed([category]);
  } finally {
    if (plan) releaseInvocationPlan(plan);
  }
}

main();
