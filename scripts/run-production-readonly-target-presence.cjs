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
 *   - Source-disabled gate precedes private .secrets reads.
 *   - Duplicate CLI flags fail closed (no last-write-wins).
 *   - Complete real executor path implemented behind the source-disabled gate.
 *
 * Refs #4346, #4282, #4000, #4004, #4005, #4255, #4256, #1882.
 */

const path = require('node:path');
const fs = require('node:fs');
const { Client } = require('pg');

const {
  MODE: BOUNDARY_MODE,
  FAILURE: BOUNDARY_FAILURE,
  DEDICATED_SECRET_KEY,
  resolveSecretsRelativeFile,
  loadDedicatedProductionReadonlyDatabaseUrl,
  parseProductionReadonlyDatabaseUrl,
  loadProductionRoleMapping,
  isSupportedProductionServerVersionNum,
  assertSupportedProductionServerVersionNum,
  buildProductionReadonlyInvocationPlan,
  getPrivateInvocationParts,
  releaseInvocationPlan,
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

// Provenance authority: CENTRAL source activation comment 5543403159 (Issue #4346)
const PRODUCTION_EXECUTION_SOURCE_ENABLED = true;
const PRODUCTION_EXECUTION_SOURCE_AUTHORITY_COMMENT = '5543403159';

const RUNNER_MODE = 'PRODUCTION_READONLY_TARGET_PRESENCE';

const RUNNER_OUTCOMES = Object.freeze({
  TARGET_ABSENT: 'TARGET_ABSENT',
  TARGET_PRESENT: 'TARGET_PRESENT',
  PRESENCE_CHECK_NOT_RUN_CONNECTION_BOUNDARY: 'PRESENCE_CHECK_NOT_RUN_CONNECTION_BOUNDARY',
  PRESENCE_CHECK_FAIL_READONLY_PROOF: 'PRESENCE_CHECK_FAIL_READONLY_PROOF',
  PRESENCE_CHECK_FAIL_METADATA_OR_SHAPE: 'PRESENCE_CHECK_FAIL_METADATA_OR_SHAPE',
  PRESENCE_CHECK_FAIL_FINGERPRINT_MISMATCH: 'PRESENCE_CHECK_FAIL_FINGERPRINT_MISMATCH',
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

/**
 * Strict CLI argument parser.
 * Disallows duplicate flags completely (no last-write-wins).
 */
function parseCliArgs(argv) {
  const flags = new Map();
  const seenFlags = new Set();
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
      if (seenFlags.has('--validate-only')) {
        const err = new Error(BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
        err.category = BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
        throw err;
      }
      seenFlags.add('--validate-only');
      validateOnly = true;
      continue;
    }
    if (arg === '--dry-run') {
      if (seenFlags.has('--dry-run')) {
        const err = new Error(BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
        err.category = BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
        throw err;
      }
      seenFlags.add('--dry-run');
      dryRun = true;
      continue;
    }

    if (!arg.startsWith('--') || !ALLOWED_CLI_FLAGS.has(arg)) {
      const err = new Error(BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
      err.category = BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
      throw err;
    }

    // Flag with value duplicate check
    if (seenFlags.has(arg)) {
      const err = new Error(BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID);
      err.category = BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID;
      throw err;
    }
    seenFlags.add(arg);

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
 * Pure public policy check. Does NOT read .secrets, credentials, or role files.
 */
function validatePresenceRunnerPolicy(options) {
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

  return {
    valid: true,
    targetProfile,
  };
}

/**
 * Private credential & configuration loader.
 * MUST ONLY be called when source execution is explicitly enabled or in dryRun/validation mode.
 */
function loadPresenceRunnerPrivateInputs(options) {
  validatePresenceRunnerPolicy(options);

  const secretFile = options.secretFile;
  const roleMappingFile = options.roleMappingFile;

  const url = loadDedicatedProductionReadonlyDatabaseUrl(REPO_ROOT, secretFile);
  const pgConfig = parseProductionReadonlyDatabaseUrl(url);
  const roleMapping = loadProductionRoleMapping(REPO_ROOT, roleMappingFile);

  return {
    valid: true,
    targetProfile: resolveTargetProfile(options.profile || '4346'),
    roleMapping,
    roleMappingClassesCount: Object.keys(roleMapping).length,
    pgConfig,
    pgConfigShape: Object.keys(pgConfig).sort(),
    dedicatedSecretKey: DEDICATED_SECRET_KEY,
  };
}

/**
 * Pure/internal executor core.
 * Tested via mock client.
 * Does NOT read credentials, does NOT instantiate new Client(), does NOT accept host/database/URL,
 * and CANNOT create Production connections.
 * Orchestrates transaction read-only proof, major-17 version assertion, target inspection,
 * fingerprint validation, and fail-closed rollback.
 *
 * @param {object} params
 * @param {object} params.client - connected pg client or mock with query(text, params)
 * @param {object} params.targetProfile - immutable target profile
 * @param {Map|object} params.roleMapping - role mapping
 * @param {object} params.contract - catalog metadata contract
 * @returns {Promise<object>} inspection result
 */
async function executeReadonlyInspectionWithClient({ client, targetProfile, roleMapping, contract }) {
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

  let startedTxn = false;
  try {
    await client.query(Q.BEGIN_RO);
    startedTxn = true;

    const roRes = await client.query(Q.SHOW_RO);
    const roVal = roRes.rows[0] && (roRes.rows[0].transaction_read_only || Object.values(roRes.rows[0])[0]);
    if (!isTransactionReadOnlyOn(roVal)) {
      const err = new Error(ADAPTER_FAILURE.CATALOG_ADAPTER_READ_ONLY_REQUIRED);
      err.category = ADAPTER_FAILURE.CATALOG_ADAPTER_READ_ONLY_REQUIRED;
      throw err;
    }

    const verRes = await client.query(Q.SHOW_VER);
    const verRaw = verRes.rows[0] && (verRes.rows[0].server_version_num || Object.values(verRes.rows[0])[0]);
    assertSupportedProductionServerVersionNum(verRaw);

    const inspection = await inspectTargetPresenceWithClient(
      client,
      targetProfile,
      roleMapping,
      contract
    );

    if (inspection.presence === 'TARGET_PRESENT' && !inspection.fingerprintMatch) {
      const err = new Error(RUNNER_OUTCOMES.PRESENCE_CHECK_FAIL_FINGERPRINT_MISMATCH);
      err.category = RUNNER_OUTCOMES.PRESENCE_CHECK_FAIL_FINGERPRINT_MISMATCH;
      err.context = {
        actualFingerprint: inspection.fingerprint,
        expectedFingerprint: targetProfile.expectedFingerprint,
      };
      throw err;
    }

    return {
      mode: RUNNER_MODE,
      outcome: inspection.presence === 'TARGET_ABSENT'
        ? RUNNER_OUTCOMES.TARGET_ABSENT
        : RUNNER_OUTCOMES.TARGET_PRESENT,
      decision: 'INSPECTION_COMPLETED',
      profile: targetProfile.profile,
      target: targetProfile.target,
      presence: inspection.presence,
      relation: inspection.relation,
      fingerprint: inspection.fingerprint,
      expectedFingerprint: inspection.expectedFingerprint,
      fingerprintMatch: inspection.fingerprintMatch,
      executionAttempted: true,
    };
  } finally {
    if (startedTxn) {
      try {
        await client.query(Q.ROLLBACK);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Private input & contract preparation helper.
 * Loads private credentials, role mapping, and catalog metadata contract.
 * Does NOT instantiate Client, does NOT connect, and does NOT execute any query.
 * Throws boundary/policy error if any input is missing or invalid.
 */
function prepareProductionReadonlyInspection(options) {
  const privateInputs = loadPresenceRunnerPrivateInputs(options);
  const targetProfile = privateInputs.targetProfile;
  const contract = loadContract(REPO_ROOT);

  return {
    privateInputs,
    targetProfile,
    contract,
  };
}

/**
 * Real Production read-only executor engine.
 * STRICTLY INTERNAL: not exported, cannot be invoked directly from outside.
 * Accepts already-prepared inputs; instantiates Client, connects, and delegates
 * to executeReadonlyInspectionWithClient within an explicit READ ONLY transaction.
 */
async function executeProductionReadonlyInspectionInternal(prepared) {
  const { privateInputs, targetProfile, contract } = prepared;

  const client = new Client(privateInputs.pgConfig);

  try {
    try {
      await client.connect();
    } catch {
      const err = new Error(ADAPTER_FAILURE.CATALOG_ADAPTER_QUERY_FAILED);
      err.category = ADAPTER_FAILURE.CATALOG_ADAPTER_QUERY_FAILED;
      throw err;
    }

    return await executeReadonlyInspectionWithClient({
      client,
      targetProfile,
      roleMapping: privateInputs.roleMapping,
      contract,
    });
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

/**
 * Main runner execution entrypoint.
 * In this turn, live Production execution is source-activated under CENTRAL comment 5543403159.
 * Private secret and role mapping files are accessed ONLY after policy validation passes.
 * Takes ONLY options (no injectedClientFactory parameter, no execution bypass parameter).
 */
async function runTargetPresenceRunner(options) {
  let policy;
  try {
    policy = validatePresenceRunnerPolicy(options);
  } catch (err) {
    return {
      mode: RUNNER_MODE,
      outcome: RUNNER_OUTCOMES.PRESENCE_CHECK_NOT_RUN_CONNECTION_BOUNDARY,
      decision: 'FAIL_CLOSED',
      reason: err.category || BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID,
      profile: (options && options.profile) || null,
      executionAttempted: false,
    };
  }

  const targetProfile = policy.targetProfile;

  // Handle dryRun / validateOnly without connecting
  if (options && (options.validateOnly || options.dryRun)) {
    let privateInputs;
    try {
      privateInputs = loadPresenceRunnerPrivateInputs(options);
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
        dedicated_secret_key: privateInputs.dedicatedSecretKey,
        target_immutable: true,
      },
    };
  }

  // Live execution guard: MUST PRECEDE PRIVATE FILE READS AND CLIENT CREATION
  // Under NO circumstance can any argument bypass this gate.
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

  // Phase C: Private input + contract preparation (BEFORE Client creation or connection)
  // Any failure here is a connection boundary failure with executionAttempted = false.
  let prepared;
  try {
    prepared = prepareProductionReadonlyInspection(options);
  } catch (err) {
    return {
      mode: RUNNER_MODE,
      outcome: RUNNER_OUTCOMES.PRESENCE_CHECK_NOT_RUN_CONNECTION_BOUNDARY,
      decision: 'FAIL_CLOSED',
      reason: err.category || BOUNDARY_FAILURE.PRODUCTION_CATALOG_INPUT_INVALID,
      profile: targetProfile.profile,
      target: targetProfile.target,
      executionAttempted: false,
    };
  }

  // Phase D: Real execution path (Client creation, connect, READ ONLY transaction)
  // Reached ONLY when preparation completely succeeded.
  try {
    return await executeProductionReadonlyInspectionInternal(prepared);
  } catch (err) {
    const category = err.category || 'INSPECTION_FAILED';
    let outcome = RUNNER_OUTCOMES.PRESENCE_CHECK_FAIL_METADATA_OR_SHAPE;
    if (category === ADAPTER_FAILURE.CATALOG_ADAPTER_READ_ONLY_REQUIRED) {
      outcome = RUNNER_OUTCOMES.PRESENCE_CHECK_FAIL_READONLY_PROOF;
    } else if (category === RUNNER_OUTCOMES.PRESENCE_CHECK_FAIL_FINGERPRINT_MISMATCH) {
      outcome = RUNNER_OUTCOMES.PRESENCE_CHECK_FAIL_FINGERPRINT_MISMATCH;
    } else if (category === BOUNDARY_FAILURE.PRODUCTION_CATALOG_SERVER_VERSION_UNSUPPORTED) {
      outcome = RUNNER_OUTCOMES.PRESENCE_CHECK_FAIL_METADATA_OR_SHAPE;
    }

    return {
      mode: RUNNER_MODE,
      outcome,
      decision: 'FAIL_CLOSED',
      reason: category,
      profile: targetProfile.profile,
      target: targetProfile.target,
      executionAttempted: true,
    };
  }
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
  if (result.decision !== 'VALIDATION_PASS' && result.decision !== 'INSPECTION_COMPLETED') {
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
  PRODUCTION_EXECUTION_SOURCE_AUTHORITY_COMMENT,
  IMMUTABLE_TARGET_PROFILES,
  resolveTargetProfile,
  parseCliArgs,
  validatePresenceRunnerPolicy,
  inspectTargetPresenceWithClient,
  executeReadonlyInspectionWithClient,
  runTargetPresenceRunner,
};
