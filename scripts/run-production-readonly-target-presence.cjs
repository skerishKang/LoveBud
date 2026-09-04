'use strict';

/**
 * Reviewed entrypoint for Production read-only target presence inspection (#4346).
 *
 * Distinguishes whether a specific schema-adoption target relation
 * (specifically public.tree_hub_layouts) is:
 *   - TARGET_ABSENT (0 rows)
 *   - TARGET_PRESENT (1 valid row)
 *
 * Governed invariants:
 *   - Source/test only in this turn: Production live execution is hard source-disabled.
 *   - ZERO Production database connections.
 *   - ZERO DDL/DML, ZERO migration apply, ZERO ledger/attestation write, ZERO grant/revoke.
 *   - Bound strictly to immutable Profile 4346 (target: table:public.tree_hub_layouts).
 *   - Caller override strictly rejected: no caller SQL, no object override, no repoRoot override,
 *     no connection override, no generic DATABASE_URL.
 *   - Dedicated secret key only: LOVEBUD_PRODUCTION_READONLY_DATABASE_URL.
 *   - Sanitized output format only (no raw credentials, no OIDs, no product row data).
 *
 * Refs #4346, #4282, #4000, #4004, #4005, #4255, #4256, #1882.
 */

const path = require('node:path');
const fs = require('node:fs');

const {
  MODE: BOUNDARY_MODE,
  FAILURE: BOUNDARY_FAILURE,
  DEDICATED_SECRET_KEY,
  resolveSecretsRelativeFile,
  loadDedicatedProductionReadonlyDatabaseUrl,
  parseProductionReadonlyDatabaseUrl,
  loadProductionRoleMapping,
  isSupportedProductionServerVersionNum,
  rejectCallerOverrides,
} = require('./production-readonly-catalog-boundary-core.cjs');

const {
  ADAPTER_FAILURE,
  Q,
  isTransactionReadOnlyOn,
  parseServerVersionNum,
  classifyTargetPresenceRelationRows,
  fetchRawObject,
  toCanonicalMetadata,
  buildCatalogEvidence,
  loadContract,
} = require('./migration-catalog-postgres-adapter-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

// Hard invariant: Production live connection execution is source-disabled in this PR turn.
const PRODUCTION_EXECUTION_SOURCE_ENABLED = false;

const RUNNER_MODE = 'PRODUCTION_READONLY_TARGET_PRESENCE';

const RUNNER_OUTCOMES = Object.freeze({
  TARGET_ABSENT: 'TARGET_ABSENT',
  TARGET_PRESENT: 'TARGET_PRESENT',
  PRESENCE_CHECK_NOT_RUN_CONNECTION_BOUNDARY: 'PRESENCE_CHECK_NOT_RUN_CONNECTION_BOUNDARY',
  PRESENCE_CHECK_FAIL_READONLY_PROOF: 'PRESENCE_CHECK_FAIL_READONLY_PROOF',
  PRESENCE_CHECK_FAIL_METADATA_OR_SHAPE: 'PRESENCE_CHECK_FAIL_METADATA_OR_SHAPE',
  PRESENCE_CHECK_EXECUTION_DISABLED: 'PRESENCE_CHECK_EXECUTION_DISABLED',
});

const IMMUTABLE_TARGET_PROFILES = Object.freeze({
  '4346': Object.freeze({
    profile: '4346',
    issue: 4346,
    approvalReference: 'issue:4346',
    target: 'table:public.tree_hub_layouts',
    schema: 'public',
    relation: 'tree_hub_layouts',
    kind: 'TABLE',
    expectedFingerprint: 'sha256:199a8d5dc0b21d8a5d0ecaa7a7101cd65b926f2d884682840624388279cc2316',
  }),
});

const ALLOWED_CLI_FLAGS = new Set([
  '--profile',
  '--secret-file',
  '--role-mapping-file',
  '--validate-only',
  '--dry-run',
]);

const FORBIDDEN_CLI_FLAGS = new Set([
  '--host', '--port', '--user', '--username', '--password',
  '--database', '--database-url', '--connection-string',
  '--objects', '--target', '--sql', '--query', '--repo-root', '--root',
  '--contract-root', '--policy-root', '--output', '--output-file',
  '--activate', '--attest', '--execute',
]);

function resolveTargetProfile(profileKey) {
  if (typeof profileKey !== 'string') return null;
  const normalized = profileKey.trim();
  if (IMMUTABLE_TARGET_PROFILES[normalized]) {
    return IMMUTABLE_TARGET_PROFILES[normalized];
  }
  return null;
}

function parseCliArgs(argv) {
  const flags = new Map();
  let validateOnly = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (FORBIDDEN_CLI_FLAGS.has(arg)) {
      const err = new Error(BOUNDARY_FAILURE.PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED);
      err.category = BOUNDARY_FAILURE.PRODUCTION_CATALOG_CALLER_OVERRIDE_REJECTED;
      throw err;
    }
    if (arg === '--validate-only') {
      validateOnly = true;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (!arg.startsWith('--') || !ALLOWED_CLI_FLAGS.has(arg)) {
      const err = new Error(BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
      err.category = BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
      throw err;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      const err = new Error(BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
      err.category = BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
      throw err;
    }
    flags.set(arg, next);
    i += 1;
  }

  return { flags, validateOnly, dryRun };
}

/**
 * Pure helper to inspect target presence on an active client or mocked queries.
 * Queries pg_catalog for the exact relation, executes classifyTargetPresenceRelationRows.
 * If TARGET_ABSENT, returns absence result.
 * If TARGET_PRESENT, collects single-object metadata, canonicalizes, and verifies fingerprint.
 *
 * @param {object} client - pg client or mock with query(text, params)
 * @param {object} targetProfile - immutable target profile
 * @param {Map|object} roleMap - role mapping
 * @param {object} contract - catalog metadata contract
 * @returns {Promise<object>} sanitized inspection result
 */
async function inspectTargetPresenceWithClient(client, targetProfile, roleMap, contract) {
  if (!client || typeof client.query !== 'function') {
    const err = new Error(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID);
    err.category = ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID;
    throw err;
  }
  if (!targetProfile || typeof targetProfile !== 'object') {
    const err = new Error(ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID);
    err.category = ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID;
    throw err;
  }

  const relRes = await client.query(Q.RELATION, [targetProfile.schema, targetProfile.relation]);
  const classification = classifyTargetPresenceRelationRows(relRes.rows, targetProfile.kind);

  if (classification.presence === 'TARGET_ABSENT') {
    return {
      mode: RUNNER_MODE,
      profile: targetProfile.profile,
      target: targetProfile.target,
      presence: 'TARGET_ABSENT',
      relation: null,
      fingerprint: null,
      expectedFingerprint: targetProfile.expectedFingerprint,
      fingerprintMatch: null,
    };
  }

  // TARGET_PRESENT: collect single-target metadata
  const targetDescriptor = {
    schema: targetProfile.schema,
    object_name: targetProfile.relation,
    object_kind: targetProfile.kind,
  };

  const rawObject = await fetchRawObject(client, targetDescriptor, roleMap);
  const metadata = toCanonicalMetadata([rawObject], contract);
  const evidence = buildCatalogEvidence(metadata, contract);

  const singleObj = evidence.objects && evidence.objects[0];
  const actualFingerprint = singleObj ? singleObj.fingerprint : null;
  const fingerprintMatch = actualFingerprint === targetProfile.expectedFingerprint;

  return {
    mode: RUNNER_MODE,
    profile: targetProfile.profile,
    target: targetProfile.target,
    presence: 'TARGET_PRESENT',
    relation: {
      schema: targetProfile.schema,
      object_name: targetProfile.relation,
      object_kind: targetProfile.kind,
      rls_enabled: classification.relation.rls_enabled,
      rls_forced: classification.relation.rls_forced,
    },
    fingerprint: actualFingerprint,
    expectedFingerprint: targetProfile.expectedFingerprint,
    fingerprintMatch,
  };
}

/**
 * Validate presence runner configuration and input files without connecting.
 */
function validatePresenceRunnerInputs(options) {
  rejectCallerOverrides(options || {});

  const profileKey = (options && options.profile) || '4346';
  const targetProfile = resolveTargetProfile(profileKey);
  if (!targetProfile) {
    const err = new Error(BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
    err.category = BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
    throw err;
  }

  const secretFile = options && options.secretFile;
  const roleMappingFile = options && options.roleMappingFile;

  if (typeof secretFile !== 'string' || !secretFile.trim()) {
    const err = new Error(BOUNDARY_FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID);
    err.category = BOUNDARY_FAILURE.PRODUCTION_CATALOG_SECRET_FILE_INVALID;
    throw err;
  }
  if (typeof roleMappingFile !== 'string' || !roleMappingFile.trim()) {
    const err = new Error(BOUNDARY_FAILURE.PRODUCTION_CATALOG_ROLE_MAPPING_REQUIRED);
    err.category = BOUNDARY_FAILURE.PRODUCTION_CATALOG_ROLE_MAPPING_REQUIRED;
    throw err;
  }

  const url = loadDedicatedProductionReadonlyDatabaseUrl(REPO_ROOT, secretFile);
  const pgConfig = parseProductionReadonlyDatabaseUrl(url);
  const roleMapping = loadProductionRoleMapping(REPO_ROOT, roleMappingFile);

  return {
    valid: true,
    targetProfile,
    roleMappingClassesCount: Object.keys(roleMapping).length,
    pgConfigShape: Object.keys(pgConfig).sort(),
    dedicatedSecretKey: DEDICATED_SECRET_KEY,
  };
}

/**
 * Main runner execution entrypoint.
 * In this turn, live Production execution is hard source-disabled.
 */
async function runTargetPresenceRunner(options) {
  const profileKey = (options && options.profile) || '4346';
  const targetProfile = resolveTargetProfile(profileKey);
  if (!targetProfile) {
    return {
      mode: RUNNER_MODE,
      outcome: RUNNER_OUTCOMES.PRESENCE_CHECK_NOT_RUN_CONNECTION_BOUNDARY,
      decision: 'FAIL_CLOSED',
      reason: 'UNKNOWN_OR_UNAUTHORIZED_PROFILE',
      profile: profileKey,
      executionAttempted: false,
    };
  }

  let validation;
  try {
    validation = validatePresenceRunnerInputs(options);
  } catch (err) {
    return {
      mode: RUNNER_MODE,
      outcome: RUNNER_OUTCOMES.PRESENCE_CHECK_NOT_RUN_CONNECTION_BOUNDARY,
      decision: 'FAIL_CLOSED',
      reason: err.category || BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID,
      profile: targetProfile.profile,
      executionAttempted: false,
    };
  }

  if (options && (options.validateOnly || options.dryRun)) {
    return {
      mode: RUNNER_MODE,
      outcome: 'VALIDATION_PASS',
      decision: 'VALIDATION_PASS',
      profile: targetProfile.profile,
      target: targetProfile.target,
      expectedFingerprint: targetProfile.expectedFingerprint,
      executionAttempted: false,
      validationReport: {
        connection_validated: true,
        role_mapping_classes_present: true,
        dedicated_secret_key: validation.dedicatedSecretKey,
        target_immutable: true,
      },
    };
  }

  // Live execution guard: fail closed
  if (!PRODUCTION_EXECUTION_SOURCE_ENABLED) {
    return {
      mode: RUNNER_MODE,
      outcome: RUNNER_OUTCOMES.PRESENCE_CHECK_EXECUTION_DISABLED,
      decision: 'FAIL_CLOSED',
      reason: 'PRODUCTION_EXECUTION_SOURCE_DISABLED_IN_THIS_TURN',
      profile: targetProfile.profile,
      target: targetProfile.target,
      executionAttempted: false,
    };
  }

  return {
    mode: RUNNER_MODE,
    outcome: RUNNER_OUTCOMES.PRESENCE_CHECK_EXECUTION_DISABLED,
    decision: 'FAIL_CLOSED',
    executionAttempted: false,
  };
}

async function cli() {
  let parsed;
  try {
    parsed = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        mode: RUNNER_MODE,
        outcome: RUNNER_OUTCOMES.PRESENCE_CHECK_NOT_RUN_CONNECTION_BOUNDARY,
        decision: 'FAIL_CLOSED',
        reason: err.category || 'ARGUMENT_PARSING_FAILED',
      }, null, 2) + '\n'
    );
    process.exit(2);
  }

  const { flags, validateOnly, dryRun } = parsed;
  const profile = flags.get('--profile') || '4346';
  const secretFile = flags.get('--secret-file');
  const roleMappingFile = flags.get('--role-mapping-file');

  const result = await runTargetPresenceRunner({
    profile,
    secretFile,
    roleMappingFile,
    validateOnly,
    dryRun,
  });

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.decision !== 'VALIDATION_PASS') {
    process.exit(result.decision === 'FAIL_CLOSED' ? 2 : 1);
  }
}

if (require.main === module) {
  cli().catch((err) => {
    process.stderr.write(
      JSON.stringify({
        mode: RUNNER_MODE,
        outcome: RUNNER_OUTCOMES.PRESENCE_CHECK_NOT_RUN_CONNECTION_BOUNDARY,
        decision: 'FAIL_CLOSED',
        reason: 'UNHANDLED_EXCEPTION',
      }, null, 2) + '\n'
    );
    process.exit(2);
  });
}

module.exports = {
  RUNNER_MODE,
  RUNNER_OUTCOMES,
  PRODUCTION_EXECUTION_SOURCE_ENABLED,
  IMMUTABLE_TARGET_PROFILES,
  resolveTargetProfile,
  validatePresenceRunnerInputs,
  inspectTargetPresenceWithClient,
  runTargetPresenceRunner,
};
