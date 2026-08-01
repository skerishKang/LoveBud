/**
 * #3828 external logical-backup behavior contract — deterministic policy execution.
 *
 * Refs #3828 (implementation child). Parent #3460 stays OPEN.
 *
 * Executes ONLY the pure policy module (modal_compute/recovery_backup_policy.py)
 * through a local python3 subprocess. No provider, R2, Modal, DB, pg_dump, network,
 * secret, or filesystem-backup operation occurs. The scenario script is written to
 * the OS temp directory (never the repository) and removed after the run.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const SCENARIO_SCRIPT = `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'modal_compute'))})
import recovery_backup_policy as p

OK = dict(dump_success=True, encryption_success=True, plaintext_cleanup_success=True,
          upload_complete=True, post_upload_verified=True, daily_promotion_success=True)

def state_of(st):
    return st['backup_point_state']

results = {}
def check(name, fn):
    try:
        results[name] = {'status': 'PASS', 'value': fn()}
    except Exception as e:
        results[name] = {'status': 'ERROR', 'error': str(e)}

def expect_raise(name, fn, needle):
    try:
        fn()
        results[name] = {'status': 'FAIL', 'error': 'expected exception not raised'}
    except Exception as e:
        ok = needle is None or needle in str(e)
        results[name] = {'status': 'PASS' if ok else 'FAIL', 'error': str(e)}

# 1-4 success permutations
check('daily-only-success', lambda: p.evaluate_run(**OK))
check('daily-weekly-success', lambda: p.evaluate_run(**OK, weekly_promotion_decided=True, weekly_promotion_success=True))
check('daily-monthly-success', lambda: p.evaluate_run(**OK, monthly_promotion_decided=True, monthly_promotion_success=True))
check('daily-weekly-monthly-success', lambda: p.evaluate_run(**OK, weekly_promotion_decided=True, weekly_promotion_success=True, monthly_promotion_decided=True, monthly_promotion_success=True))

# 5-10 failure stages
check('dump-failure', lambda: p.evaluate_run(dump_success=False))
check('encryption-failure', lambda: p.evaluate_run(dump_success=True))
check('plaintext-cleanup-failure', lambda: p.evaluate_run(dump_success=True, encryption_success=True))
check('incomplete-upload', lambda: p.evaluate_run(dump_success=True, encryption_success=True, plaintext_cleanup_success=True))
check('head-verification-failure', lambda: p.evaluate_run(dump_success=True, encryption_success=True, plaintext_cleanup_success=True, upload_complete=True))
check('daily-promotion-failure', lambda: p.evaluate_run(dump_success=True, encryption_success=True, plaintext_cleanup_success=True, upload_complete=True, post_upload_verified=True))

# 11-12 partial success preservation
check('daily-valid-weekly-failure', lambda: p.evaluate_run(**OK, weekly_promotion_decided=True, weekly_promotion_success=False))
check('daily-valid-monthly-failure', lambda: p.evaluate_run(**OK, monthly_promotion_decided=True, monthly_promotion_success=False))

# 13-15 freshness / missing tiers
check('stale-daily-classify', lambda: p.classify_daily_freshness('GE_24H_LT_7D'))
check('stale-daily-run', lambda: p.evaluate_run(dump_success=False, daily_age_bucket='GE_24H_LT_7D'))
check('missing-weekly', lambda: p.evaluate_run(**OK).get('weekly_tier'))
check('missing-monthly', lambda: p.evaluate_run(**OK).get('monthly_tier'))

# 16-19 rejections
expect_raise('unknown-state-rejection', lambda: p.reject_unknown_state('BOGUS'), 'unknown state rejected')
expect_raise('private-field-rejection', lambda: p.make_sanitized_status(timestamp='x'), None)
expect_raise('raw-field-rejection', lambda: p.make_sanitized_status(checksum='x'), 'RAW_FIELD_REJECTED')
expect_raise('impossible-state-rejection', lambda: p.reject_impossible_partial({'backup_point_state': p.BACKUP_POINT_MISSING, 'daily_tier': p.DAILY_TIER_VALID, 'weekly_tier': p.WEEKLY_TIER_MISSING, 'monthly_tier': p.MONTHLY_TIER_MISSING}), 'impossible partial rejected')
# preserve-daily helpers
check('preserve-daily-weekly-failure-helper', lambda: p.preserve_daily_on_weekly_failure(True, False))
check('preserve-daily-monthly-failure-helper', lambda: p.preserve_daily_on_monthly_failure(True, False))

print(json.dumps(results))
`;

function runScenarios() {
  const tmp = path.join(os.tmpdir(), 'lovebud-backup-behavior-' + process.pid + '.py');
  fs.writeFileSync(tmp, SCENARIO_SCRIPT, { mode: 0o600 });
  try {
    const stdout = execFileSync('python3', [tmp], { encoding: 'utf8', timeout: 60000 });
    return JSON.parse(stdout);
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) { /* best effort */ }
  }
}

const results = runScenarios();

test('1. daily-only success', () => {
  const r = results['daily-only-success'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_POINT_VALID');
  assert.equal(r.value.daily_tier, 'DAILY_TIER_VALID');
  assert.equal(r.value.weekly_tier, 'WEEKLY_TIER_MISSING');
  assert.equal(r.value.monthly_tier, 'MONTHLY_TIER_MISSING');
});

test('2. daily+weekly success', () => {
  const r = results['daily-weekly-success'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.weekly_tier, 'WEEKLY_TIER_VALID');
});

test('3. daily+monthly success', () => {
  const r = results['daily-monthly-success'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.monthly_tier, 'MONTHLY_TIER_VALID');
});

test('4. daily+weekly+monthly success', () => {
  const r = results['daily-weekly-monthly-success'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.weekly_tier, 'WEEKLY_TIER_VALID');
  assert.equal(r.value.monthly_tier, 'MONTHLY_TIER_VALID');
});

test('5. dump failure', () => {
  const r = results['dump-failure'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_POINT_MISSING');
  assert.equal(r.value.phase, 'dump');
});

test('6. encryption failure', () => {
  const r = results['encryption-failure'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_POINT_MISSING');
  assert.equal(r.value.phase, 'encryption');
});

test('7. plaintext cleanup failure', () => {
  const r = results['plaintext-cleanup-failure'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_POINT_MISSING');
  assert.equal(r.value.phase, 'plaintext_cleanup');
});

test('8. incomplete upload', () => {
  const r = results['incomplete-upload'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_UPLOAD_INCOMPLETE');
});

test('9. head verification failure', () => {
  const r = results['head-verification-failure'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_INTEGRITY_UNVERIFIED');
});

test('10. daily promotion failure', () => {
  const r = results['daily-promotion-failure'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_POINT_MISSING');
  assert.equal(r.value.phase, 'daily_promotion');
});

test('11. valid daily + weekly failure preserves daily', () => {
  const r = results['daily-valid-weekly-failure'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_POINT_VALID');
  assert.equal(r.value.daily_tier, 'DAILY_TIER_VALID');
  assert.equal(r.value.weekly_tier, 'WEEKLY_TIER_MISSING');
  assert.equal(r.value.phase, 'weekly_promotion');
});

test('12. valid daily + monthly failure preserves daily', () => {
  const r = results['daily-valid-monthly-failure'];
  assert.equal(r.status, 'PASS');
  assert.equal(r.value.backup_point_state, 'BACKUP_POINT_VALID');
  assert.equal(r.value.daily_tier, 'DAILY_TIER_VALID');
  assert.equal(r.value.monthly_tier, 'MONTHLY_TIER_MISSING');
  assert.equal(r.value.phase, 'monthly_promotion');
});

test('13. stale daily point', () => {
  assert.equal(results['stale-daily-classify'].status, 'PASS');
  assert.equal(results['stale-daily-classify'].value, 'DAILY_TIER_STALE');
  const run = results['stale-daily-run'];
  assert.equal(run.status, 'PASS');
  assert.equal(run.value.daily_tier, 'DAILY_TIER_STALE');
});

test('14. missing weekly point', () => {
  assert.equal(results['missing-weekly'].status, 'PASS');
  assert.equal(results['missing-weekly'].value, 'WEEKLY_TIER_MISSING');
});

test('15. missing monthly point', () => {
  assert.equal(results['missing-monthly'].status, 'PASS');
  assert.equal(results['missing-monthly'].value, 'MONTHLY_TIER_MISSING');
});

test('16. unknown state rejection', () => {
  assert.equal(results['unknown-state-rejection'].status, 'PASS');
});

test('17. private field rejection', () => {
  assert.equal(results['private-field-rejection'].status, 'PASS');
});

test('18. raw field rejection', () => {
  assert.equal(results['raw-field-rejection'].status, 'PASS');
});

test('19. impossible state rejection', () => {
  assert.equal(results['impossible-state-rejection'].status, 'PASS');
});

test('20. preserve-daily helper functions', () => {
  assert.equal(results['preserve-daily-weekly-failure-helper'].status, 'PASS');
  assert.equal(results['preserve-daily-weekly-failure-helper'].value.weekly_tier, 'WEEKLY_TIER_MISSING');
  assert.equal(results['preserve-daily-monthly-failure-helper'].status, 'PASS');
  assert.equal(results['preserve-daily-monthly-failure-helper'].value.monthly_tier, 'MONTHLY_TIER_MISSING');
});
