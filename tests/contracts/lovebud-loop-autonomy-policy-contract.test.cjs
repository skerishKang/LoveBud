const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

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

  describe('scripts/loop schemas', () => {
    const schemasPath = path.join(REPO_ROOT, 'scripts', 'loop', 'schemas.mjs');

    it('must export validateOutputReport', async () => {
      const schemas = await import(schemasPath);
      assert.strictEqual(typeof schemas.validateOutputReport, 'function');
    });

    it('must have non-empty ALLOWED_LANES', async () => {
      const schemas = await import(schemasPath);
      assert.ok(schemas.ALLOWED_LANES.length > 0);
    });

    it('must reject invalid lane', async () => {
      const schemas = await import(schemasPath);
      assert.throws(() => schemas.validateLane('invalid-lane'), /Invalid lane/);
    });

    it('must reject invalid status', async () => {
      const schemas = await import(schemasPath);
      assert.throws(() => schemas.validateStatus('INVALID_STATUS'), /Invalid status/);
    });
  });

  describe('scripts/loop/run-loop.mjs', () => {
    it('must reject --mode=execute', async () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=execute'
      ], { cwd: REPO_ROOT, encoding: 'utf-8' });
      assert.notStrictEqual(result.status, 0, 'must exit non-zero for forbidden mode');
      assert.ok(result.stderr.includes('forbidden'), 'must print forbidden message');
    });

    it('must reject --mode=apply', async () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=apply'
      ], { cwd: REPO_ROOT, encoding: 'utf-8' });
      assert.notStrictEqual(result.status, 0);
    });

    it('must reject --mode=merge', async () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=merge'
      ], { cwd: REPO_ROOT, encoding: 'utf-8' });
      assert.notStrictEqual(result.status, 0);
    });

    it('must reject --mode=push', async () => {
      const cp = require('node:child_process');
      const result = cp.spawnSync('node', [
        'scripts/loop/run-loop.mjs',
        '--mode=push'
      ], { cwd: REPO_ROOT, encoding: 'utf-8' });
      assert.notStrictEqual(result.status, 0);
    });

    it('must reject --mode=create-pr', async () => {
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
        !runner.includes('path.join(import.meta.url') || !runner.includes('__dirname'),
        'must not use repo-relative paths for output'
      );
      assert.ok(
        runner.includes('LOCALAPPDATA') || runner.includes('homedir'),
        'output path must use user-local or appdata directory'
      );
    });
  });
});
