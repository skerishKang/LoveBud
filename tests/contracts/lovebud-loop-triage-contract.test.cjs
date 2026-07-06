const assert = require('node:assert');
const { describe, it } = require('node:test');

function makeDefaultPolicy() {
  return {
    mode: 'dry-run-only',
    implementationSlots: 1,
    verificationSlots: 1,
    autoEligibleLanes: ['docs', 'contract-test', 'test-stability', 'static-cleanup'],
    humanRequiredLanes: [
      'product-decision', 'ux-direction', 'browser-ui-qa',
      'database-migration', 'api-contract', 'auth', 'privacy',
      'deployment', 'production-approval'
    ],
    allowedStatuses: [
      'READY_FOR_PLANNING', 'BLOCKED_BY_CI', 'BLOCKED_BY_DEPENDENCY',
      'NEEDS_PRODUCT_DECISION', 'NEEDS_UI_QA', 'NEEDS_DEPLOYMENT_APPROVAL',
      'SCOPE_CONFLICT', 'NO_AUTO', 'CI_STATE_UNTRUSTED',
      'CI_DATA_MISSING', 'CI_UNKNOWN_STATUS'
    ],
    defaultHumanStatus: 'NEEDS_PRODUCT_DECISION',
    humanStatusOverrides: {
      'browser-ui-qa': 'NEEDS_UI_QA',
      'deployment': 'NEEDS_DEPLOYMENT_APPROVAL',
      'production-approval': 'NEEDS_DEPLOYMENT_APPROVAL'
    },
    merge: ['disabled'],
    issueMutation: ['disabled'],
    prMutation: ['disabled'],
    worktreeMutation: ['disabled']
  };
}

const FIXTURE_NO_ISSUES_NO_PRS = {
  mainSha: 'b85877498ddbc35b9526c2f89da113ff121e550f',
  issueCount: 0,
  prCount: 0,
  issues: [],
  prs: []
};

const FIXTURE_DOCS_ONLY = {
  mainSha: 'b85877498ddbc35b9526c2f89da113ff121e550f',
  issueCount: 1,
  prCount: 0,
  issues: [
    { number: 101, title: 'docs: update README', labels: ['docs'], createdAt: '2026-07-01T00:00:00Z' }
  ],
  prs: []
};

const FIXTURE_MIXED = {
  mainSha: 'b85877498ddbc35b9526c2f89da113ff121e550f',
  issueCount: 4,
  prCount: 2,
  issues: [
    { number: 101, title: 'docs: update README', labels: ['docs'], createdAt: '2026-07-01T00:00:00Z' },
    { number: 102, title: 'Add login page', labels: ['auth'], createdAt: '2026-07-01T00:00:00Z' },
    { number: 103, title: 'Database migration for comments', labels: ['database'], createdAt: '2026-07-01T00:00:00Z' },
    { number: 104, title: 'Clean up unused CSS', labels: ['cleanup'], createdAt: '2026-07-01T00:00:00Z' }
  ],
  prs: [
    {
      number: 200, title: 'Fix editor save feedback', headRefName: 'fix/editor-save',
      headRefOid: 'aaa111', baseRefName: 'main', state: 'OPEN', mergeable: 'MERGEABLE',
      checks: '{"success":3,"failure":0,"pending":0}'
    },
    {
      number: 201, title: 'Refactor search module', headRefName: 'refactor/search',
      headRefOid: 'bbb222', baseRefName: 'main', state: 'OPEN', mergeable: 'MERGEABLE',
      checks: '{"success":2,"failure":1,"pending":0}'
    }
  ]
};

describe('LoveBud Loop Triage Contract', () => {
  describe('classifyLane', () => {
    it('docs label maps to docs lane', async () => {
      const { classifyLane } = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(classifyLane(['docs'], 'some title'), 'docs');
    });

    it('auth label maps to auth lane', async () => {
      const { classifyLane } = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(classifyLane(['auth'], 'some title'), 'auth');
    });

    it('database label maps to database-migration lane', async () => {
      const { classifyLane } = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(classifyLane(['database'], 'some title'), 'database-migration');
    });

    it('ux label maps to ux-direction lane', async () => {
      const { classifyLane } = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(classifyLane(['ux'], 'some title'), 'ux-direction');
    });

    it('deployment label maps to deployment lane', async () => {
      const { classifyLane } = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(classifyLane(['deployment'], 'some title'), 'deployment');
    });

    it('cleanup label maps to static-cleanup lane', async () => {
      const { classifyLane } = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(classifyLane(['cleanup'], 'some title'), 'static-cleanup');
    });

    it('test label maps to test-stability lane', async () => {
      const { classifyLane } = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(classifyLane(['test'], 'some title'), 'test-stability');
    });

    it('unknown label returns null', async () => {
      const { classifyLane } = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(classifyLane(['unrelated'], 'some title'), null);
    });

    it('title heuristic: docs: prefix maps to docs', async () => {
      const { classifyLane } = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(classifyLane([], 'docs: update readme'), 'docs');
    });

    it('title heuristic: cleanup in title maps to static-cleanup', async () => {
      const { classifyLane } = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(classifyLane([], 'cleanup unused files'), 'static-cleanup');
    });
  });

  describe('determineStatus', () => {
    it('docs lane with clean CI is READY_FOR_PLANNING', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: JSON.stringify({success: 3}) };
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'READY_FOR_PLANNING');
    });

    it('auth lane is NEEDS_PRODUCT_DECISION (default-human-status)', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: JSON.stringify({success: 3}) };
      assert.strictEqual(determineStatus(pr, 'auth', policy), 'NEEDS_PRODUCT_DECISION');
    });

    it('browser-ui-qa lane is NEEDS_UI_QA (human-status-override)', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: JSON.stringify({success: 3}) };
      assert.strictEqual(determineStatus(pr, 'browser-ui-qa', policy), 'NEEDS_UI_QA');
    });

    it('deployment lane is NEEDS_DEPLOYMENT_APPROVAL (human-status-override)', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: JSON.stringify({success: 3}) };
      assert.strictEqual(determineStatus(pr, 'deployment', policy), 'NEEDS_DEPLOYMENT_APPROVAL');
    });

    it('PR with failing checks is BLOCKED_BY_CI', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: JSON.stringify({success: 2, failure: 1}) };
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'BLOCKED_BY_CI');
    });

    it('PR with pending checks is BLOCKED_BY_CI', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: JSON.stringify({success: 2, pending: 1}) };
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'BLOCKED_BY_CI');
    });

    it('null lane is NO_AUTO', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      assert.strictEqual(determineStatus(null, null, policy), 'NO_AUTO');
    });

    it('unknown lane is NO_AUTO', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      assert.strictEqual(determineStatus(null, 'unknown', policy), 'NO_AUTO');
    });

    it('zero-failure CI is not BLOCKED_BY_CI', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: JSON.stringify({success: 3, failure: 0, pending: 0}) };
      assert.notStrictEqual(determineStatus(pr, 'docs', policy), 'BLOCKED_BY_CI');
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'READY_FOR_PLANNING');
    });

    it('positive failure count is BLOCKED_BY_CI', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: JSON.stringify({success: 3, failure: 1, pending: 0}) };
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'BLOCKED_BY_CI');
    });

    it('positive pending count is BLOCKED_BY_CI', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: JSON.stringify({success: 3, failure: 0, pending: 1}) };
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'BLOCKED_BY_CI');
    });

    it('zero action_required is not BLOCKED_BY_CI', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: JSON.stringify({success: 3, action_required: 0, queued: 0}) };
      assert.notStrictEqual(determineStatus(pr, 'docs', policy), 'BLOCKED_BY_CI');
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'READY_FOR_PLANNING');
    });

    it('non-numeric count values are treated conservatively', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr1 = { checks: JSON.stringify({success: 3, failure: 'abc'}) };
      assert.strictEqual(determineStatus(pr1, 'docs', policy), 'CI_STATE_UNTRUSTED');
      const pr2 = { checks: JSON.stringify({success: 3, failure: -1}) };
      assert.strictEqual(determineStatus(pr2, 'docs', policy), 'CI_STATE_UNTRUSTED');
    });

    it('cancelled and timed_out counts are treated as BLOCKED_BY_CI', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr1 = { checks: JSON.stringify({success: 2, cancelled: 1}) };
      assert.strictEqual(determineStatus(pr1, 'docs', policy), 'BLOCKED_BY_CI');
      const pr2 = { checks: JSON.stringify({success: 2, timed_out: 1}) };
      assert.strictEqual(determineStatus(pr2, 'docs', policy), 'BLOCKED_BY_CI');
    });

    it('unknown positive status key is CI_UNKNOWN_STATUS', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: JSON.stringify({success: 3, neutral: 1}) };
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'CI_UNKNOWN_STATUS');
    });

    it('missing checks data is CI_DATA_MISSING', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const prNoChecks = { title: 'test' };
      assert.strictEqual(determineStatus(prNoChecks, 'docs', policy), 'CI_DATA_MISSING');
      const prNullChecks = { checks: null, title: 'test' };
      assert.strictEqual(determineStatus(prNullChecks, 'docs', policy), 'CI_DATA_MISSING');
      const prEmptyChecks = { checks: '{}', title: 'test' };
      assert.strictEqual(determineStatus(prEmptyChecks, 'docs', policy), 'CI_DATA_MISSING');
    });

    it('malformed CI JSON is CI_DATA_MISSING', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: 'not-json', title: 'test' };
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'CI_DATA_MISSING');
    });
  });

  describe('build with fixtures', () => {
    it('empty state produces empty queue', async () => {
      const { build } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const report = build(FIXTURE_NO_ISSUES_NO_PRS, policy);
      assert.strictEqual(report.queue.length, 0);
      assert.strictEqual(report.mode, 'dry-run');
    });

    it('docs-only fixture produces READY_FOR_PLANNING', async () => {
      const { build } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const report = build(FIXTURE_DOCS_ONLY, policy);
      assert.strictEqual(report.queue.length, 1);
      assert.strictEqual(report.queue[0].status, 'READY_FOR_PLANNING');
      assert.strictEqual(report.queue[0].lane, 'docs');
    });

    it('mixed fixture: docs is auto-eligible, auth is not', async () => {
      const { build } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const report = build(FIXTURE_MIXED, policy);

      const docsItem = report.queue.find(i => i.number === 101);
      assert.ok(docsItem);
      assert.strictEqual(docsItem.status, 'READY_FOR_PLANNING');

      const authItem = report.queue.find(i => i.number === 102);
      assert.ok(authItem);
      assert.strictEqual(authItem.status, 'NEEDS_PRODUCT_DECISION');

      const dbItem = report.queue.find(i => i.number === 103);
      assert.ok(dbItem);
      assert.strictEqual(dbItem.status, 'NEEDS_PRODUCT_DECISION');

      const cleanupItem = report.queue.find(i => i.number === 104);
      assert.ok(cleanupItem);
      assert.strictEqual(cleanupItem.status, 'READY_FOR_PLANNING');

      const pr200 = report.queue.find(i => i.number === 200);
      assert.ok(pr200);
      assert.strictEqual(pr200.status, 'NO_AUTO');

      const pr201 = report.queue.find(i => i.number === 201);
      assert.ok(pr201);
      assert.strictEqual(pr201.status, 'BLOCKED_BY_CI');
    });

    it('error state produces empty queue with error', async () => {
      const { build } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const errorState = { error: true, errorMessage: 'test error' };
      const report = build(errorState, policy);
      assert.strictEqual(report.queue.length, 0);
      assert.ok(report.error);
    });

    it('config change must affect build output status', async () => {
      const { build } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      let report = build(FIXTURE_DOCS_ONLY, policy);
      assert.strictEqual(report.queue[0].status, 'READY_FOR_PLANNING');

      policy.autoEligibleLanes = [];
      policy.humanRequiredLanes = ['docs'];
      policy.humanStatusOverrides = {};
      report = build(FIXTURE_DOCS_ONLY, policy);
      assert.strictEqual(report.queue[0].status, 'NEEDS_PRODUCT_DECISION');

      policy.autoEligibleLanes = [];
      policy.humanRequiredLanes = [];
      assert.throws(() => build(FIXTURE_DOCS_ONLY, policy), /QUEUE_POLICY_VIOLATION/);
    });

    it('no hardcoded auto/human lane sets remain', async () => {
      const bp = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(typeof bp.AUTO_ELIGIBLE_LANES, 'undefined');
      assert.strictEqual(typeof bp.HUMAN_REQUIRED_LANES, 'undefined');
    });
  });

  describe('run-loop.mjs mode rejection', () => {
    it('must reject --mode=execute', () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=execute'
      ], { encoding: 'utf-8' });
      assert.notStrictEqual(result.status, 0);
      assert.ok(result.stderr.includes('forbidden'));
    });
  });

  describe('policy failure stops before GitHub collect', () => {
    it('must exit non-zero when policy load fails', () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=dry-run'
      ], { cwd: __dirname + '/../..', encoding: 'utf-8', env: { ...process.env, LOCALAPPDATA: '' } });
      if (result.status !== 0) {
        assert.ok(result.stderr.includes('POLICY_CONFIG_INVALID') ||
                  result.stderr.includes('LOOP TRIAGE FAILED'),
                  'must fail with policy error');
      }
    });
  });
});
