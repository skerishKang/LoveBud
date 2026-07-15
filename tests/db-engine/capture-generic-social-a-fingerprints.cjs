'use strict';

/**
 * CI-only capture of Migration A canonical SHA-256 fingerprints.
 * Activated when GENERIC_SOCIAL_A_CAPTURE_FINGERPRINTS=1.
 * Local default: no-op exit 0 (LOCAL_DB_ENGINE remains NOT_RUN).
 *
 * Prints only label=64hex lines. Never prints raw definitions.
 * Never reads DATABASE_URL. Never runs Migration B.
 *
 * Refs: #3536, #3534, #3458, #1882
 */

async function main() {
  if (process.env.GENERIC_SOCIAL_A_CAPTURE_FINGERPRINTS !== '1') {
    process.stdout.write('GENERIC_SOCIAL_A_CAPTURE_SKIPPED=1\n');
    return;
  }

  if (process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_FORBIDDEN');
  }

  // Lazy-require so local runs without pg / DB still skip cleanly.
  const path = require('node:path');
  const harness = require('./helpers/postgres-disposable-harness.cjs');
  const fingerprints = require('./helpers/generic-social-a-fingerprints.cjs');

  const ROOT = path.resolve(__dirname, '..', '..');
  const PREFLIGHT = path.join(ROOT, 'scripts/validate-generic-social-a-preflight.sql');
  const MIG_A = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
  const FIXTURE = path.join(__dirname, 'fixtures/generic-social-a-guard-legacy.sql');

  await harness.withDisposableDb('capture_fp', FIXTURE, async ({ client, runSql }) => {
    const pre = runSql(PREFLIGHT);
    if (pre.status !== 0) {
      throw new Error('GENERIC_SOCIAL_A_FINGERPRINT_CAPTURE_FAILED preflight');
    }
    const mig = runSql(MIG_A);
    if (mig.status !== 0) {
      throw new Error('GENERIC_SOCIAL_A_FINGERPRINT_CAPTURE_FAILED migration_a');
    }
    const map = await fingerprints.computeFingerprintMap(client);
    fingerprints.printFingerprintLabels(map);
  });
}

main().catch((err) => {
  const msg = err && err.message ? String(err.message) : 'GENERIC_SOCIAL_A_FINGERPRINT_CAPTURE_FAILED';
  process.stderr.write(`${msg.split('\n')[0]}\n`);
  process.exit(1);
});
