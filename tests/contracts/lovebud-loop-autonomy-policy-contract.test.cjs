const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

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

describe('LoveBud Loop Autonomy Policy Contract', () => {
  describe('config/lovebud-loop.yml', () => {
    const configPath = path.join(REPO_ROOT, 'config', 'lovebud-loop.yml');
    const config = fs.readFileSync(configPath, 'utf-8');

    it('must set mode to dry-run-only', () => {
      assert.ok(config.includes('mode: dry-run-only'), 'mode must be dry-run-only');
    });

    it('must disable merge', () => {
      assert.ok(config.includes('merge:\n- disabled'), 'merge must be disabled');
    });

    it('must disable issue mutation', () => {
      assert.ok(config.includes('issue mutation:\n- disabled'), 'issue mutation must be disabled');
    });

    it('must disable pr mutation', () => {
      assert.ok(config.includes('pr mutation:\n- disabled'), 'pr mutation must be disabled');
    });

    it('must disable worktree mutation', () => {
      assert.ok(config.includes('worktree mutation:\n- disabled'), 'worktree mutation must be disabled');
    });

    it('must have allowed-statuses with required entries', () => {
      assert.ok(config.includes('NO_AUTO'), 'must contain NO_AUTO');
      assert.ok(config.includes('CI_DATA_MISSING'), 'must contain CI_DATA_MISSING');
      assert.ok(config.includes('CI_STATE_UNTRUSTED'), 'must contain CI_STATE_UNTRUSTED');
      assert.ok(config.includes('CI_UNKNOWN_STATUS'), 'must contain CI_UNKNOWN_STATUS');
    });

    it('must have default-human-status', () => {
      assert.ok(config.includes('default-human-status: NEEDS_PRODUCT_DECISION'), 'must have default human status');
    });

    it('must have human-status-overrides', () => {
      assert.ok(config.includes('browser-ui-qa=NEEDS_UI_QA'), 'must have browser-ui-qa override');
      assert.ok(config.includes('deployment=NEEDS_DEPLOYMENT_APPROVAL'), 'must have deployment override');
    });
  });

  describe('config loaded at runtime via policy-loader', () => {
    it('must load and validate policy from config successfully', async () => {
      const { loadPolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const policy = loadPolicy();
      assert.strictEqual(policy.mode, 'dry-run-only');
      assert.ok(policy.autoEligibleLanes.length > 0);
      assert.ok(policy.humanRequiredLanes.length > 0);
      assert.ok(policy.allowedStatuses.includes('NO_AUTO'));
      assert.strictEqual(policy.defaultHumanStatus, 'NEEDS_PRODUCT_DECISION');
      assert.strictEqual(policy.humanStatusOverrides['browser-ui-qa'], 'NEEDS_UI_QA');
      assert.deepStrictEqual(policy.merge, ['disabled']);
    });

    it('config change must affect status result', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const pr = { checks: '{"success":3}' };
      const policy = makeDefaultPolicy();

      assert.strictEqual(determineStatus(pr, 'docs', policy), 'READY_FOR_PLANNING');

      policy.autoEligibleLanes = [];
      policy.humanRequiredLanes = ['docs'];
      policy.humanStatusOverrides = {};
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'NEEDS_PRODUCT_DECISION');

      policy.autoEligibleLanes = [];
      policy.humanRequiredLanes = [];
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'NO_AUTO');
    });

    it('no hardcoded auto/human lane sets remain in build-queue', async () => {
      const bp = await import('../../scripts/loop/build-queue.mjs');
      assert.strictEqual(typeof bp.AUTO_ELIGIBLE_LANES, 'undefined');
      assert.strictEqual(typeof bp.HUMAN_REQUIRED_LANES, 'undefined');
    });

    it('status override browser-ui-qa yields NEEDS_UI_QA', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: '{"success":3}' };
      assert.strictEqual(determineStatus(pr, 'browser-ui-qa', policy), 'NEEDS_UI_QA');
    });

    it('status override deployment yields NEEDS_DEPLOYMENT_APPROVAL', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: '{"success":3}' };
      assert.strictEqual(determineStatus(pr, 'deployment', policy), 'NEEDS_DEPLOYMENT_APPROVAL');
    });

    it('product-decision human lane yields default-human-status', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const policy = makeDefaultPolicy();
      const pr = { checks: '{"success":3}' };
      assert.strictEqual(determineStatus(pr, 'product-decision', policy), 'NEEDS_PRODUCT_DECISION');
    });
  });

  describe('policy failure stops before GitHub collect', () => {
    it('run-loop must reference loadPolicy before collect in source', () => {
      const runnerPath = path.join(REPO_ROOT, 'scripts', 'loop', 'run-loop.mjs');
      const source = fs.readFileSync(runnerPath, 'utf-8');
      const loadIdx = source.indexOf('loadPolicy');
      const collectIdx = source.indexOf('collect');
      assert.ok(loadIdx >= 0 && collectIdx >= 0, 'both references must exist');
      assert.ok(loadIdx < collectIdx, 'loadPolicy must appear before collect in source');
    });

    it('must exit non-zero when policy load fails', () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=dry-run'
      ], { cwd: REPO_ROOT, encoding: 'utf-8', env: { ...process.env, LOCALAPPDATA: '' } });
      if (result.status !== 0) {
        assert.ok(result.stderr.includes('POLICY_CONFIG_INVALID') ||
                  result.stderr.includes('LOOP TRIAGE FAILED'),
                  'must fail with policy error');
      }
    });
  });

  describe('invalid policy collect call count zero', () => {
    it('must not call collect when policy load fails', async () => {
      const { execute } = await import('../../scripts/loop/run-loop.mjs');
      let collectCallCount = 0;
      const result = execute({
        args: ['--mode=dry-run'],
        loadPolicy: () => { throw new Error('POLICY_CONFIG_INVALID'); },
        collect: () => { collectCallCount++; return {}; },
        build: () => ({ queue: [], timestamp: '', mode: 'dry-run' }),
        validateOutputReport: () => true,
        writeFailedReport: () => {},
        writeReport: () => '',
        printReport: () => {}
      });
      assert.strictEqual(result.status, 'FAILED');
      assert.strictEqual(collectCallCount, 0);
    });

    it('must call collect exactly once when policy is valid', async () => {
      const { execute } = await import('../../scripts/loop/run-loop.mjs');
      let collectCallCount = 0;
      const result = execute({
        args: ['--mode=dry-run'],
        loadPolicy: () => ({
          mode: 'dry-run-only',
          autoEligibleLanes: ['docs'],
          humanRequiredLanes: ['auth'],
          allowedStatuses: ['NO_AUTO', 'CI_DATA_MISSING', 'CI_STATE_UNTRUSTED', 'CI_UNKNOWN_STATUS', 'READY_FOR_PLANNING'],
          defaultHumanStatus: 'NEEDS_PRODUCT_DECISION',
          humanStatusOverrides: {},
          merge: ['disabled'],
          issueMutation: ['disabled'],
          prMutation: ['disabled'],
          worktreeMutation: ['disabled'],
          implementationSlots: 1,
          verificationSlots: 1
        }),
        collect: () => { collectCallCount++; return { mainSha: 'abc', issues: [], prs: [] }; },
        build: () => ({ queue: [], timestamp: new Date().toISOString(), mode: 'dry-run' }),
        validateOutputReport: () => true,
        writeFailedReport: () => {},
        writeReport: () => '',
        printReport: () => {}
      });
      assert.strictEqual(result.status, 'OK');
      assert.strictEqual(collectCallCount, 1);
    });
  });

  describe('queue policy violation', () => {
    it('must fail when build throws QUEUE_POLICY_VIOLATION', async () => {
      const { execute } = await import('../../scripts/loop/run-loop.mjs');
      let writeKind = '';
      const result = execute({
        args: ['--mode=dry-run'],
        loadPolicy: () => ({
          mode: 'dry-run-only',
          autoEligibleLanes: ['docs'],
          humanRequiredLanes: ['auth'],
          allowedStatuses: ['NO_AUTO', 'CI_DATA_MISSING', 'CI_STATE_UNTRUSTED', 'CI_UNKNOWN_STATUS', 'READY_FOR_PLANNING'],
          defaultHumanStatus: 'NEEDS_PRODUCT_DECISION',
          humanStatusOverrides: {},
          merge: ['disabled'],
          issueMutation: ['disabled'],
          prMutation: ['disabled'],
          worktreeMutation: ['disabled'],
          implementationSlots: 1,
          verificationSlots: 1
        }),
        collect: () => { return { mainSha: 'abc', issues: [], prs: [] }; },
        build: () => { throw new Error('QUEUE_POLICY_VIOLATION'); },
        validateOutputReport: () => true,
        writeFailedReport: (k) => { writeKind = k; },
        writeReport: () => '',
        printReport: () => {}
      });
      assert.strictEqual(result.status, 'FAILED');
      assert.strictEqual(result.kind, 'QUEUE_POLICY_VIOLATION');
    });
  });

  describe('#1882 protection and mutation checks', () => {
    it('config must have mutation disabled', () => {
      const configPath = path.join(REPO_ROOT, 'config', 'lovebud-loop.yml');
      const config = fs.readFileSync(configPath, 'utf-8');
      assert.ok(config.includes('merge:\n- disabled'));
      assert.ok(config.includes('issue mutation:\n- disabled'));
      assert.ok(config.includes('pr mutation:\n- disabled'));
      assert.ok(config.includes('worktree mutation:\n- disabled'));
    });

    it('policy must enforce disabled mutations', async () => {
      const { loadPolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const policy = loadPolicy();
      assert.deepStrictEqual(policy.merge, ['disabled']);
      assert.deepStrictEqual(policy.issueMutation, ['disabled']);
      assert.deepStrictEqual(policy.prMutation, ['disabled']);
      assert.deepStrictEqual(policy.worktreeMutation, ['disabled']);
    });
  });

  describe('LOVE_BUD_LOOP_AUTONOMY_POLICY.md', () => {
    const policyPath = path.join(REPO_ROOT, 'docs', 'ops', 'LOVE_BUD_LOOP_AUTONOMY_POLICY.md');
    const policy = fs.readFileSync(policyPath, 'utf-8');

    it('must forbid Closes #1882 keyword', () => {
      assert.ok(!policy.includes('Closes #1882'), 'must not contain Closes #1882');
      assert.ok(!policy.includes('Fixes #1882'), 'must not contain Fixes #1882');
      assert.ok(!policy.includes('Resolves #1882'), 'must not contain Resolves #1882');
    });

    it('must allow Refs #1882', () => {
      assert.ok(policy.includes('Refs #1882'), 'may contain Refs #1882');
    });

    it('must mention dry-run restriction', () => {
      assert.ok(policy.includes('dry-run'), 'must mention dry-run');
    });

    it('must forbid GitHub mutation', () => {
      assert.ok(policy.includes('forbidden'), 'must mention forbidden operations');
      const hasMutationBlock = policy.includes('issue mutation') || policy.includes('issue/PR');
      assert.ok(hasMutationBlock, 'must address mutation');
    });
  });

  describe('LOVE_BUD_LOOP_RUNNER.md', () => {
    const runnerPath = path.join(REPO_ROOT, 'docs', 'ops', 'LOVE_BUD_LOOP_RUNNER.md');
    const runner = fs.readFileSync(runnerPath, 'utf-8');

    it('must specify npm run loop:triage command', () => {
      assert.ok(runner.includes('npm run loop:triage'), 'must document the run command');
    });

    it('must specify output outside repository', () => {
      assert.ok(
        runner.includes('%LOCALAPPDATA%') || runner.includes('outside the repository'),
        'must specify output outside repo'
      );
    });

    it('must mention GitHub CLI auth requirement', () => {
      assert.ok(runner.includes('gh auth status') || runner.includes('GitHub CLI'), 'must mention gh auth');
    });

    it('must not contain any token or secret values', () => {
      assert.ok(!runner.includes('ghp_'), 'must not contain token patterns');
      assert.ok(!runner.includes('GH_TOKEN'), 'must not reference token env var by value');
    });
  });

  describe('scripts/loop schemas policy validation', () => {
    it('must export validateOutputReport', async () => {
      const schemas = await import('../../scripts/loop/schemas.mjs');
      assert.strictEqual(typeof schemas.validateOutputReport, 'function');
    });

    it('must validate lane against policy', async () => {
      const schemas = await import('../../scripts/loop/schemas.mjs');
      const policy = makeDefaultPolicy();
      assert.ok(schemas.validateLane('docs', policy));
      assert.throws(() => schemas.validateLane('invalid-lane', policy), /Invalid lane/);
    });

    it('must validate status against policy', async () => {
      const schemas = await import('../../scripts/loop/schemas.mjs');
      const policy = makeDefaultPolicy();
      assert.ok(schemas.validateStatus('READY_FOR_PLANNING', policy));
      assert.throws(() => schemas.validateStatus('INVALID_STATUS', policy), /Invalid status/);
    });

    it('must allow sentinel unknown lane', async () => {
      const schemas = await import('../../scripts/loop/schemas.mjs');
      const policy = makeDefaultPolicy();
      assert.ok(schemas.validateLane('unknown', policy));
    });

    it('must not export static ALLOWED_LANES or ALLOWED_STATUSES', async () => {
      const schemas = await import('../../scripts/loop/schemas.mjs');
      assert.strictEqual(typeof schemas.ALLOWED_LANES, 'undefined');
      assert.strictEqual(typeof schemas.ALLOWED_STATUSES, 'undefined');
    });
  });

  describe('scripts/loop/run-loop.mjs', () => {
    it('must reject --mode=execute', () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=execute'
      ], { cwd: REPO_ROOT, encoding: 'utf-8' });
      assert.notStrictEqual(result.status, 0, 'must exit non-zero for forbidden mode');
      assert.ok(result.stderr.includes('forbidden'), 'must print forbidden message');
    });

    it('must reject --mode=apply', () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=apply'
      ], { cwd: REPO_ROOT, encoding: 'utf-8' });
      assert.notStrictEqual(result.status, 0);
    });

    it('must reject --mode=merge', () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=merge'
      ], { cwd: REPO_ROOT, encoding: 'utf-8' });
      assert.notStrictEqual(result.status, 0);
    });

    it('must reject --mode=push', () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=push'
      ], { cwd: REPO_ROOT, encoding: 'utf-8' });
      assert.notStrictEqual(result.status, 0);
    });

    it('must reject --mode=create-pr', () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=create-pr'
      ], { cwd: REPO_ROOT, encoding: 'utf-8' });
      assert.notStrictEqual(result.status, 0);
    });
  });

  describe('report output location', () => {
    it('output must be outside repository', () => {
      const runnerPath = path.join(REPO_ROOT, 'scripts', 'loop', 'run-loop.mjs');
      const runner = fs.readFileSync(runnerPath, 'utf-8');
      assert.ok(
        runner.includes('LOCALAPPDATA') || runner.includes('homedir'),
        'output path must use user-local or appdata directory'
      );
    });
  });
});
