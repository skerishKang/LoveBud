'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CLI_PATH = path.resolve(REPO_ROOT, 'scripts', 'run-production-readonly-role-mapping-reconciliation.cjs');
const CLI = require(CLI_PATH);

function currentHead() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
}

function makeTempDir() {
  const dir = path.join(
    REPO_ROOT,
    '.secrets',
    `.test-wrapper-parity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function relativeToRepo(absPath) {
  return path.relative(REPO_ROOT, absPath).replace(/\\/g, '/');
}

function writePrivateJson(absPath, value) {
  fs.writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function cleanup(absPath) {
  try {
    fs.rmSync(absPath, { recursive: true, force: true });
  } catch {}
}

describe('Phase B reconciliation role-mapping wrapper parity', () => {
  it('keeps merged main source gate hard-disabled', () => {
    const source = fs.readFileSync(CLI_PATH, 'utf8');
    assert.match(source, /const PRODUCTION_RECONCILIATION_EXECUTION_ENABLED = false;/);
    assert.doesNotMatch(source, /const PRODUCTION_RECONCILIATION_EXECUTION_ENABLED = true;/);
  });

  it('normalizes direct and {role_mapping:{...}} documents identically', () => {
    const dir = makeTempDir();
    try {
      const direct = path.join(dir, 'direct.json');
      const wrapped = path.join(dir, 'wrapped.json');
      writePrivateJson(direct, { alice: 'APPLICATION' });
      writePrivateJson(wrapped, { role_mapping: { alice: 'APPLICATION' } });

      const directLoaded = CLI.loadRoleMappingWithDigest(REPO_ROOT, relativeToRepo(direct));
      const wrappedLoaded = CLI.loadRoleMappingWithDigest(REPO_ROOT, relativeToRepo(wrapped));

      assert.deepEqual(directLoaded.roleMapping, wrappedLoaded.roleMapping);
      assert.equal(directLoaded.roleMapping.alice, 'APPLICATION');
      assert.equal(directLoaded.roleMapping.public, 'PUBLIC');
      assert.match(directLoaded.beforeDigest, /^[a-f0-9]{64}$/);
      assert.match(wrappedLoaded.beforeDigest, /^[a-f0-9]{64}$/);
    } finally {
      cleanup(dir);
    }
  });

  it('accepts wrapped mapping in the no-network reconciliation seam', async () => {
    const dir = makeTempDir();
    try {
      const secret = path.join(dir, 'secret.env');
      const wrapped = path.join(dir, 'wrapped.json');
      const output = path.join(dir, 'result.json');
      fs.writeFileSync(secret, 'synthetic-placeholder\n', { mode: 0o600 });
      writePrivateJson(wrapped, { role_mapping: { alice: 'APPLICATION' } });

      const result = await CLI.runReconciliationWithDeps({
        repoRoot: REPO_ROOT,
        secretFile: relativeToRepo(secret),
        roleMappingFile: relativeToRepo(wrapped),
        privateOutputFile: relativeToRepo(output),
        baselineCommit: currentHead(),
        approvalReference: 'issue:4304',
        collectGranteesFn: async () => ['alice', 'synthetic_unmapped'],
      });

      assert.equal(result.outcome, 'RECONCILIATION_COMPLETE');
      assert.deepEqual(result.unmapped, ['synthetic_unmapped']);
      assert.equal(result.collection_session_count, 0);
      assert.ok(fs.existsSync(output));
    } finally {
      cleanup(dir);
    }
  });
});