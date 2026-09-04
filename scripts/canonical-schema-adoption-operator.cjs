'use strict';

/**
 * Governed operator entrypoint for #4282 canonical schema adoption.
 *
 * USAGE:
 *   node scripts/canonical-schema-adoption-operator.cjs --dry-run
 *     # paper-only readiness check; never touches a transport
 *
 *   # Production execution (out-of-band credentialed operator only):
 *   LOVEBUD_4282_ALLOW_EXECUTE=1 node scripts/canonical-schema-adoption-operator.cjs --execute
 *     # will still fail closed unless a transport is provided via
 *     # LOVEBUD_4282_OPERATOR_TRANSPORT_PATH pointing to a module exporting
 *     # a valid bounded transport interface.
 *
 * Hard rules:
 *   - execution disabled by default
 *   - both --execute flag and LOVEBUD_4282_ALLOW_EXECUTE=1 are required
 *   - transport path must export a valid bounded surface
 *   - the one-attempt budget is consumed ONLY on a committed+verified apply
 *   - any error / connection loss is treated as ambiguous outcome: stop, no retry
 *   - this script never logs or prints secret/credential material
 *
 * Refs #4282, #3458 (keep OPEN), #1882 (keep OPEN).
 */

const fs = require('node:fs');
const path = require('node:path');

const CORE = require('./canonical-schema-adoption-operator-core.cjs');

const ALLOWED_FLAGS = new Set(['--profile', '--execute', '--dry-run', '--execution-head']);

/**
 * Strict CLI argument parser.
 * Enforces:
 * - No duplicate flags
 * - No unknown flags
 * - No positional arguments
 * - No simultaneous --execute and --dry-run
 * - On --execute, explicit --profile is required
 */
function parseOperatorCliArgs(argv) {
  const seenFlags = new Set();
  let isExecute = false;
  let isDryRun = false;
  let profileKey = null;
  let executionHead = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    let flagName = arg;
    let flagValue = null;

    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        flagName = arg.slice(0, eqIdx);
        flagValue = arg.slice(eqIdx + 1);
      }
    } else {
      throw new Error(`POSITIONAL_ARGUMENT_REJECTED: unexpected argument '${arg}'`);
    }

    if (!ALLOWED_FLAGS.has(flagName)) {
      throw new Error(`UNKNOWN_FLAG_REJECTED: unrecognized flag '${arg}'`);
    }

    if (seenFlags.has(flagName)) {
      throw new Error(`DUPLICATE_FLAG_REJECTED: flag '${flagName}' specified more than once`);
    }
    seenFlags.add(flagName);

    if (flagName === '--execute') {
      if (flagValue !== null) throw new Error(`FLAG_VALUE_UNEXPECTED: flag '${flagName}' takes no value`);
      isExecute = true;
    } else if (flagName === '--dry-run') {
      if (flagValue !== null) throw new Error(`FLAG_VALUE_UNEXPECTED: flag '${flagName}' takes no value`);
      isDryRun = true;
    } else if (flagName === '--profile') {
      if (flagValue !== null) {
        profileKey = flagValue;
      } else {
        if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
          throw new Error(`FLAG_VALUE_MISSING: flag '--profile' requires a value`);
        }
        i += 1;
        profileKey = argv[i];
      }
    } else if (flagName === '--execution-head') {
      if (flagValue !== null) {
        executionHead = flagValue;
      } else {
        if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
          throw new Error(`FLAG_VALUE_MISSING: flag '--execution-head' requires a value`);
        }
        i += 1;
        executionHead = argv[i];
      }
    }
  }

  if (isExecute && isDryRun) {
    throw new Error('CONFLICTING_FLAGS_REJECTED: cannot specify both --execute and --dry-run');
  }

  if (isExecute && !profileKey) {
    throw new Error('PROFILE_REQUIRED_FOR_EXECUTE: explicit --profile is required when --execute is specified');
  }

  // Default mode is dry run if execute is not specified
  if (!isExecute && !isDryRun) {
    isDryRun = true;
  }

  // Default profile for dry run backward compatibility is '4282' if unspecified
  if (!profileKey) {
    profileKey = '4282';
  }

  return {
    isExecute,
    isDryRun,
    profileKey,
    executionHead,
  };
}

let parsedArgs;
try {
  parsedArgs = parseOperatorCliArgs(process.argv.slice(2));
} catch (err) {
  process.stderr.write(
    JSON.stringify({
      mode: 'INITIALIZATION_FAILED',
      decision: CORE.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      reason: 'INVALID_CLI_ARGUMENTS',
      message: err.message,
      oneAttemptBudgetConsumed: false,
      executionAttempted: false,
    }) + '\n',
  );
  process.exit(2);
}

const { isExecute, isDryRun, profileKey, executionHead } = parsedArgs;

const profile = CORE.resolveProfile(profileKey);
if (!profile) {
  process.stderr.write(
    JSON.stringify({
      mode: 'INITIALIZATION_FAILED',
      decision: CORE.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      reason: 'UNKNOWN_PROFILE',
      requestedProfile: profileKey,
      oneAttemptBudgetConsumed: false,
      executionAttempted: false,
    }) + '\n',
  );
  process.exit(2);
}

const allowExecuteEnv = process.env[profile.envAllowExecute] === '1';
const transportPath = process.env[profile.envTransportPath];

async function main() {
  const packet = CORE.buildCanonicalPacket(profile.key);

  if (isDryRun) {
    const readiness = CORE.evaluateOperatorReadiness(packet);
    const report = {
      mode: 'DRY_RUN',
      profile: profile.key,
      executionAttempted: false,
      oneAttemptBudgetConsumed: false,
      decision: readiness.decision,
      stops: readiness.stops,
      gateDecision: readiness.gateDecision,
      gateBlockers: readiness.gateBlockers,
      manifestStatus: readiness.manifestStatus,
      expectedSchemaStatus: readiness.expectedSchemaStatus,
      binding: {
        issue: packet.issue,
        activeAuthorizationComment: packet.activeAuthorizationComment,
        currentMain: packet.currentMain,
        migrationPath: packet.migrationPath,
        migrationSha256: packet.migrationSha256,
        intendedRelation: packet.intendedRelation,
        targetIdentity: packet.targetIdentity,
        expectedSchemaFingerprint: packet.expectedSchemaFingerprint,
        applyMode: packet.applyMode,
        unrelatedMigrationCount: packet.unrelatedMigrationCount,
      },
    };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (readiness.decision !== CORE.DECISIONS.READINESS_PASSED) {
      process.exit(2);
    }
    return;
  }

  if (!allowExecuteEnv) {
    process.stderr.write(
      JSON.stringify({
        mode: 'EXECUTE_REQUESTED',
        profile: profile.key,
        decision: CORE.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
        reason: `${profile.envAllowExecute} not set`,
        oneAttemptBudgetConsumed: false,
        executionAttempted: false,
      }) + '\n',
    );
    process.exit(2);
  }
  if (!transportPath) {
    process.stderr.write(
      JSON.stringify({
        mode: 'EXECUTE_REQUESTED',
        profile: profile.key,
        decision: CORE.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
        reason: `${profile.envTransportPath} not set`,
        oneAttemptBudgetConsumed: false,
        executionAttempted: false,
      }) + '\n',
    );
    process.exit(2);
  }

  // Exact-head verification BEFORE requiring or touching transport
  const headAuth = CORE.verifyExecutionHeadAuthority(profile, { executionHead });
  if (!headAuth.ok) {
    process.stderr.write(
      JSON.stringify({
        mode: 'EXECUTE_REQUESTED',
        profile: profile.key,
        decision: CORE.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
        reason: headAuth.reason,
        actualExecutionHead: headAuth.actualExecutionHead,
        centralAuthorizedExecutionHead: headAuth.centralAuthorizedExecutionHead,
        oneAttemptBudgetConsumed: false,
        executionAttempted: false,
      }) + '\n',
    );
    process.exit(2);
  }

  let transport;
  try {
    transport = require(path.resolve(transportPath));
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        mode: 'EXECUTE_REQUESTED',
        profile: profile.key,
        decision: CORE.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
        reason: 'TRANSPORT_REQUIRE_FAILED',
        oneAttemptBudgetConsumed: false,
        executionAttempted: false,
      }) + '\n',
    );
    process.exit(2);
  }

  const tCheck = CORE.validateTransport(transport);
  if (!tCheck.ok) {
    process.stderr.write(
      JSON.stringify({
        mode: 'EXECUTE_REQUESTED',
        profile: profile.key,
        decision: CORE.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
        reason: tCheck.reason,
        oneAttemptBudgetConsumed: false,
        executionAttempted: false,
      }) + '\n',
    );
    process.exit(2);
  }

  const result = await CORE.executeGovernedOperator({
    packet,
    transport,
    executionEnabled: true,
    allowExecute: true,
  });
  process.stdout.write(JSON.stringify({ mode: 'EXECUTE', profile: profile.key, ...result }, null, 2) + '\n');
  if (result.stops && result.stops.length > 0) {
    process.exit(2);
  }
}

main().catch((err) => {
  process.stderr.write(
    JSON.stringify({
      mode: 'AMBIGUOUS',
      decision: CORE.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
      reason: 'UNCAUGHT_ERROR',
      message: 'Operator entered an undefined state. Read-only reconcile required; no retry.',
      oneAttemptBudgetConsumed: false,
      executionAttempted: false,
    }) + '\n',
  );
  process.exit(2);
});
