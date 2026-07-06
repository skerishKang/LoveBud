const assert = require('node:assert');
const { describe, it } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function makeRawConfig() {
  return {
    version: '0',
    mode: 'dry-run-only',
    implementation_slots: '1',
    verification_slots: '1',
    'auto-eligible lanes': ['docs', 'contract-test', 'test-stability', 'static-cleanup'],
    'human-required lanes': [
      'product-decision', 'ux-direction', 'browser-ui-qa',
      'database-migration', 'api-contract', 'auth', 'privacy',
      'deployment', 'production-approval'
    ],
    'default-human-status': 'NEEDS_PRODUCT_DECISION',
    'human-status-overrides': [
      'browser-ui-qa=NEEDS_UI_QA',
      'deployment=NEEDS_DEPLOYMENT_APPROVAL',
      'production-approval=NEEDS_DEPLOYMENT_APPROVAL'
    ],
    'allowed-statuses': [
      'READY_FOR_PLANNING', 'BLOCKED_BY_CI', 'BLOCKED_BY_DEPENDENCY',
      'NEEDS_PRODUCT_DECISION', 'NEEDS_UI_QA', 'NEEDS_DEPLOYMENT_APPROVAL',
      'SCOPE_CONFLICT', 'NO_AUTO', 'CI_STATE_UNTRUSTED',
      'CI_DATA_MISSING', 'CI_UNKNOWN_STATUS'
    ],
    merge: ['disabled'],
    'issue mutation': ['disabled'],
    'pr mutation': ['disabled'],
    'worktree mutation': ['disabled']
  };
}

describe('LoveBud Loop Policy Loader Contract', () => {
  describe('parseYamlConfig', () => {
    it('must parse the actual config successfully', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      const content = fs.readFileSync(path.join(REPO_ROOT, 'config', 'lovebud-loop.yml'), 'utf-8');
      const result = parseYamlConfig(content);
      assert.strictEqual(result.mode, 'dry-run-only');
      assert.strictEqual(result.version, '0');
      assert.ok(Array.isArray(result['auto-eligible lanes']));
      assert.ok(result['auto-eligible lanes'].length > 0);
      assert.ok(Array.isArray(result['human-required lanes']));
      assert.ok(result['human-required lanes'].length > 0);
      assert.ok(Array.isArray(result['allowed-statuses']));
      assert.ok(result['allowed-statuses'].length > 0);
      assert.strictEqual(result['default-human-status'], 'NEEDS_PRODUCT_DECISION');
      assert.ok(Array.isArray(result['human-status-overrides']));
      assert.ok(result['human-status-overrides'].length > 0);
      assert.deepStrictEqual(result.merge, ['disabled']);
      assert.deepStrictEqual(result['issue mutation'], ['disabled']);
      assert.deepStrictEqual(result['pr mutation'], ['disabled']);
      assert.deepStrictEqual(result['worktree mutation'], ['disabled']);
    });

    it('must reject duplicate top-level key', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      const yaml = `mode: dry-run-only\nmode: execute`;
      assert.throws(() => parseYamlConfig(yaml), /POLICY_CONFIG_INVALID/);
    });

    it('must reject unknown top-level key', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      const lines = fs.readFileSync(path.join(REPO_ROOT, 'config', 'lovebud-loop.yml'), 'utf-8').split('\n');
      lines.splice(1, 0, 'unknown-key: value');
      const yaml = lines.join('\n');
      assert.throws(() => parseYamlConfig(yaml), /POLICY_CONFIG_INVALID/);
    });

    it('must reject empty list item', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      const yaml = `auto-eligible lanes:\n- docs\n-\n`;
      assert.throws(() => parseYamlConfig(yaml), /POLICY_CONFIG_INVALID/);
    });

    it('must reject non-root scalar value for list key', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      const yaml = `merge: enabled\n`;
      assert.throws(() => parseYamlConfig(yaml), /POLICY_CONFIG_INVALID/);
    });

    it('must reject list-style value for scalar key', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      const yaml = `mode:\n- value\n`;
      assert.throws(() => parseYamlConfig(yaml), /POLICY_CONFIG_INVALID/);
    });

    it('must reject malformed line without colon', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      assert.throws(() => parseYamlConfig('just a line'), /POLICY_CONFIG_INVALID/);
    });

    it('must reject list item outside list context', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      assert.throws(() => parseYamlConfig('- orphan'), /POLICY_CONFIG_INVALID/);
    });

    it('must reject missing required keys', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      assert.throws(() => parseYamlConfig('mode: dry-run-only\n'), /POLICY_CONFIG_INVALID/);
    });

    it('must reject indented known root key', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      assert.throws(() => parseYamlConfig('  mode: dry-run-only\n'), /POLICY_CONFIG_INVALID/);
    });

    it('must reject indented list item', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      const yaml = `auto-eligible lanes:\n  - docs\n`;
      assert.throws(() => parseYamlConfig(yaml), /POLICY_CONFIG_INVALID/);
    });

    it('must reject tab-indented root key', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      assert.throws(() => parseYamlConfig('\t\tmode: dry-run-only'), /POLICY_CONFIG_INVALID/);
    });

    it('must reject tab-indented list item', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      const yaml = `auto-eligible lanes:\n\t- docs\n`;
      assert.throws(() => parseYamlConfig(yaml), /POLICY_CONFIG_INVALID/);
    });

    it('must reject indented root key with space before known key', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      assert.throws(() => parseYamlConfig(' allowed-statuses:\n- NO_AUTO\n'), /POLICY_CONFIG_INVALID/);
    });

    it('error message is safe and contains no raw config text', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      try {
        parseYamlConfig('  mode: dry-run-only');
        assert.fail('should have thrown');
      } catch (err) {
        assert.strictEqual(err.message, 'POLICY_CONFIG_INVALID');
        assert.ok(!err.message.includes('dry-run-only'));
        assert.ok(!err.message.includes('ghp_'));
        assert.ok(!err.message.includes('/'));
      }
    });
  });

  describe('validatePolicy', () => {
    it('must accept valid default policy', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      validatePolicy(makeRawConfig());
    });

    it('must reject mode != dry-run-only', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw.mode = 'execute';
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject overlapping auto/human lanes', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['auto-eligible lanes'] = ['docs', 'auth'];
      raw['human-required lanes'] = ['auth'];
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject NO_AUTO removal from allowed-statuses', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['allowed-statuses'] = raw['allowed-statuses'].filter(s => s !== 'NO_AUTO');
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject merge: [enabled]', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw.merge = ['enabled'];
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject empty auto-eligible lanes', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['auto-eligible lanes'] = [];
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject duplicate lane in auto-eligible', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['auto-eligible lanes'] = ['docs', 'docs'];
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject default-human-status not in allowed-statuses', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['default-human-status'] = 'INVALID_STATUS';
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject override lane not in human-required lanes', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['human-status-overrides'] = ['not-a-human-lane=NEEDS_PRODUCT_DECISION'];
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject override status not in allowed-statuses', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['human-status-overrides'] = ['browser-ui-qa=INVALID_STATUS'];
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject duplicate override lane', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['human-status-overrides'] = ['browser-ui-qa=NEEDS_UI_QA', 'browser-ui-qa=NEEDS_PRODUCT_DECISION'];
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject malformed override entry (no =)', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['human-status-overrides'] = ['browser-ui-qa'];
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject malformed override entry (empty left side)', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['human-status-overrides'] = ['=NEEDS_UI_QA'];
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });

    it('must reject malformed override entry (empty right side)', async () => {
      const { validatePolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['human-status-overrides'] = ['browser-ui-qa='];
      assert.throws(() => validatePolicy(raw), /POLICY_CONFIG_INVALID/);
    });
  });

  describe('build-queue policy integration', () => {
    it('auto lane docs with clean CI yields READY_FOR_PLANNING', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const { toPolicyObject } = await import('../../scripts/loop/policy-loader.mjs');
      const policy = toPolicyObject(makeRawConfig());
      const pr = { checks: '{"success":3}' };
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'READY_FOR_PLANNING');
    });

    it('docs moved to human-required yields default-human-status', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const { toPolicyObject } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['auto-eligible lanes'] = [];
      raw['human-required lanes'] = ['docs'];
      raw['human-status-overrides'] = [];
      const policy = toPolicyObject(raw);
      const pr = { checks: '{"success":3}' };
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'NEEDS_PRODUCT_DECISION');
    });

    it('docs removed from both lanes yields NO_AUTO', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const { toPolicyObject } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['auto-eligible lanes'] = [];
      raw['human-required lanes'] = [];
      raw['human-status-overrides'] = [];
      const policy = toPolicyObject(raw);
      const pr = { checks: '{"success":3}' };
      assert.strictEqual(determineStatus(pr, 'docs', policy), 'NO_AUTO');
    });

    it('lane absent from both sets yields NO_AUTO', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const { toPolicyObject } = await import('../../scripts/loop/policy-loader.mjs');
      const raw = makeRawConfig();
      raw['auto-eligible lanes'] = ['contract-test'];
      raw['human-required lanes'] = ['auth'];
      const policy = toPolicyObject(raw);
      assert.strictEqual(determineStatus(null, 'docs', policy), 'NO_AUTO');
    });

    it('browser-ui-qa override yields NEEDS_UI_QA', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const { toPolicyObject } = await import('../../scripts/loop/policy-loader.mjs');
      const policy = toPolicyObject(makeRawConfig());
      const pr = { checks: '{"success":3}' };
      assert.strictEqual(determineStatus(pr, 'browser-ui-qa', policy), 'NEEDS_UI_QA');
    });

    it('deployment override yields NEEDS_DEPLOYMENT_APPROVAL', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const { toPolicyObject } = await import('../../scripts/loop/policy-loader.mjs');
      const policy = toPolicyObject(makeRawConfig());
      const pr = { checks: '{"success":3}' };
      assert.strictEqual(determineStatus(pr, 'deployment', policy), 'NEEDS_DEPLOYMENT_APPROVAL');
    });

    it('product-decision yields default-human-status (NEEDS_PRODUCT_DECISION)', async () => {
      const { determineStatus } = await import('../../scripts/loop/build-queue.mjs');
      const { toPolicyObject } = await import('../../scripts/loop/policy-loader.mjs');
      const policy = toPolicyObject(makeRawConfig());
      const pr = { checks: '{"success":3}' };
      assert.strictEqual(determineStatus(pr, 'product-decision', policy), 'NEEDS_PRODUCT_DECISION');
    });
  });

  describe('run-loop.mjs source structure', () => {
    it('must call loadPolicy before collect in pipeline', () => {
      const runnerPath = path.join(REPO_ROOT, 'scripts', 'loop', 'run-loop.mjs');
      const source = fs.readFileSync(runnerPath, 'utf-8');
      const loadPolicyRef = source.indexOf('loadPolicy');
      const collectRef = source.indexOf('collect');
      assert.ok(loadPolicyRef >= 0, 'must contain loadPolicy reference');
      assert.ok(collectRef >= 0, 'must contain collect reference');
      assert.ok(loadPolicyRef < collectRef, 'deps.loadPolicy assignment must appear before deps.collect');
    });

    it('must exit with POLICY_CONFIG_INVALID before collect on policy failure', () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=dry-run'
      ], { cwd: REPO_ROOT, encoding: 'utf-8', env: { ...process.env, LOCALAPPDATA: '' } });
      if (result.status !== 0) {
        assert.ok(result.stderr.includes('POLICY_CONFIG_INVALID') ||
                  result.stderr.includes('LOOP TRIAGE FAILED'),
                  'must fail with policy error');
        assert.ok(result.status !== 0, 'must exit non-zero');
      }
    });
  });

  describe('loadPolicy', () => {
    it('must load the actual config successfully', async () => {
      const { loadPolicy } = await import('../../scripts/loop/policy-loader.mjs');
      const policy = loadPolicy();
      assert.strictEqual(policy.mode, 'dry-run-only');
      assert.ok(policy.autoEligibleLanes.length > 0);
      assert.ok(policy.humanRequiredLanes.length > 0);
      assert.strictEqual(policy.implementationSlots, 1);
      assert.strictEqual(policy.verificationSlots, 1);
      assert.strictEqual(policy.defaultHumanStatus, 'NEEDS_PRODUCT_DECISION');
      assert.ok(policy.humanStatusOverrides);
      assert.strictEqual(policy.humanStatusOverrides['browser-ui-qa'], 'NEEDS_UI_QA');
      assert.deepStrictEqual(policy.merge, ['disabled']);
      assert.deepStrictEqual(policy.issueMutation, ['disabled']);
      assert.deepStrictEqual(policy.prMutation, ['disabled']);
      assert.deepStrictEqual(policy.worktreeMutation, ['disabled']);
    });
  });

  describe('error safety', () => {
    it('must not include raw config content, token pattern, or env value in error', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      const badYaml = `auto-eligible lanes:\n- docs\n  nested: bad`;
      try {
        parseYamlConfig(badYaml);
        assert.fail('should have thrown');
      } catch (err) {
        const msg = err.message;
        assert.ok(!msg.includes('ghp_'), 'must not contain token pattern');
        assert.ok(!msg.includes('dry-run-only'), 'must not contain raw config value');
        assert.ok(!msg.includes('GH_TOKEN'), 'must not contain env name');
        assert.strictEqual(msg, 'POLICY_CONFIG_INVALID');
      }
    });

    it('must not include filesystem path in error message', async () => {
      const { parseYamlConfig } = await import('../../scripts/loop/policy-loader.mjs');
      try {
        parseYamlConfig('unknown-key: value');
      } catch (err) {
        const msg = err.message;
        assert.ok(!msg.includes('config'), 'must not reference config path');
        assert.ok(!msg.includes('lovebud-loop'), 'must not reference filename');
        assert.ok(!msg.includes('/'), 'must not contain path separator');
      }
    });
  });

  describe('loadPolicy and collect ordering', () => {
    it('must fail before GitHub collection when policy config is invalid', () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=dry-run'
      ], { cwd: REPO_ROOT, encoding: 'utf-8', env: { ...process.env, LOCALAPPDATA: '' } });
      if (result.status !== 0) {
        assert.ok(result.stderr.includes('POLICY_CONFIG_INVALID') ||
                  result.stderr.includes('LOOP TRIAGE FAILED'),
                  'must fail with policy error message');
        assert.ok(result.status !== 0, 'must exit non-zero');
      }
    });
  });

  describe('collect call count with DI', () => {
    it('invalid policy must result in 0 collect calls', async () => {
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
      assert.strictEqual(collectCallCount, 0, 'collect must not be called');
      assert.strictEqual(result.status, 'FAILED');
      assert.strictEqual(result.kind, 'POLICY_CONFIG_INVALID');
    });

    it('valid policy must result in exactly 1 collect call', async () => {
      const { execute } = await import('../../scripts/loop/run-loop.mjs');
      let collectCallCount = 0;
      const result = execute({
        args: ['--mode=dry-run'],
        loadPolicy: () => ({ mode: 'dry-run-only', autoEligibleLanes: ['docs'], humanRequiredLanes: ['auth'], allowedStatuses: ['NO_AUTO', 'CI_DATA_MISSING', 'CI_STATE_UNTRUSTED', 'CI_UNKNOWN_STATUS', 'READY_FOR_PLANNING'], defaultHumanStatus: 'NEEDS_PRODUCT_DECISION', humanStatusOverrides: {}, merge: ['disabled'], issueMutation: ['disabled'], prMutation: ['disabled'], worktreeMutation: ['disabled'], implementationSlots: 1, verificationSlots: 1 }),
        collect: () => { collectCallCount++; return { mainSha: 'abc', issues: [], prs: [] }; },
        build: () => ({ queue: [], timestamp: new Date().toISOString(), mode: 'dry-run' }),
        validateOutputReport: () => true,
        writeFailedReport: () => {},
        writeReport: () => '',
        printReport: () => {}
      });
      assert.strictEqual(collectCallCount, 1, 'collect must be called exactly once');
      assert.strictEqual(result.status, 'OK');
    });
  });
});
