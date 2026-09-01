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

const argv = process.argv.slice(2);
const isExecute = argv.includes('--execute');
const isDryRun = argv.includes('--dry-run') || !isExecute;
const allowExecuteEnv = process.env.LOVEBUD_4282_ALLOW_EXECUTE === '1';
const transportPath = process.env.LOVEBUD_4282_OPERATOR_TRANSPORT_PATH;

async function main() {
  const packet = CORE.buildCanonicalPacket();

  if (isDryRun) {
    const readiness = CORE.evaluateOperatorReadiness(packet);
    const report = {
      mode: 'DRY_RUN',
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
        decision: CORE.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
        reason: 'LOVEBUD_4282_ALLOW_EXECUTE not set',
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
        decision: CORE.DECISIONS.EXECUTION_DISABLED_BY_DEFAULT,
        reason: 'LOVEBUD_4282_OPERATOR_TRANSPORT_PATH not set',
        oneAttemptBudgetConsumed: false,
        executionAttempted: false,
      }) + '\n',
    );
    process.exit(2);
  }
  const transport = require(path.resolve(transportPath));
  const tCheck = CORE.validateTransport(transport);
  if (!tCheck.ok) {
    process.stderr.write(
      JSON.stringify({
        mode: 'EXECUTE_REQUESTED',
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
  process.stdout.write(JSON.stringify({ mode: 'EXECUTE', ...result }, null, 2) + '\n');
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
