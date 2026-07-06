const assert = require('node:assert');
const { describe, it } = require('node:test');

function mockRunner(behaviors) {
  return function run(command, args, options) {
    const key = args.join(' ');
    if (behaviors[key]) {
      const result = behaviors[key](command, args, options);
      if (result instanceof Error) throw result;
      return result;
    }
    throw new Error('UNMOCKED_GH_CALL: gh ' + args.join(' '));
  };
}

function successBehaviors() {
  return {
    'auth status': () => 'Logged in to github.com',
    'api repos/skerishKang/LoveBud/git/refs/heads/main --jq .object.sha': () => 'b85877498ddbc35b9526c2f89da113ff121e550f',
    'issue list --repo skerishKang/LoveBud --state open --limit 100 --json number,title,labels,state,createdAt': () => JSON.stringify([]),
    'pr list --repo skerishKang/LoveBud --state open --limit 100 --json number,title,headRefName,headRefOid,baseRefName,state,mergeable,reviews,statusCheckRollup': () => JSON.stringify([])
  };
}

describe('LoveBud Loop Collector Contract', () => {
  it('successful collection returns mainSha and empty metadata', async () => {
    const { collect } = await import('../../scripts/loop/collect-github-state.mjs');
    const result = collect(mockRunner(successBehaviors()));
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.mainSha, 'b85877498ddbc35b9526c2f89da113ff121e550f');
    assert.strictEqual(result.issueCount, 0);
    assert.strictEqual(result.prCount, 0);
  });

  it('auth failure returns GITHUB_AUTH_FAILED', async () => {
    const { collect } = await import('../../scripts/loop/collect-github-state.mjs');
    const behaviors = {
      'auth status': () => 'not logged in'
    };
    const result = collect(mockRunner(behaviors));
    assert.strictEqual(result.error, 'GITHUB_AUTH_FAILED');
  });

  it('collector throws on main SHA API failure', async () => {
    const { collect } = await import('../../scripts/loop/collect-github-state.mjs');
    const behaviors = {
      'auth status': () => 'Logged in to github.com',
      'api repos/skerishKang/LoveBud/git/refs/heads/main --jq .object.sha': () => {
        throw new Error('NETWORK_ERROR');
      }
    };
    const result = collect(mockRunner(behaviors));
    assert.strictEqual(result.error, 'COLLECTOR_FAILED');
    assert.strictEqual(result.errorKind, 'GITHUB_API_ERROR');
  });

  it('collector throws on issues fetch failure', async () => {
    const { collect } = await import('../../scripts/loop/collect-github-state.mjs');
    const behaviors = {
      'auth status': () => 'Logged in to github.com',
      'api repos/skerishKang/LoveBud/git/refs/heads/main --jq .object.sha': () => 'b85877498ddbc35b9526c2f89da113ff121e550f',
      'issue list --repo skerishKang/LoveBud --state open --limit 100 --json number,title,labels,state,createdAt': () => {
        throw new Error('RATE_LIMITED');
      }
    };
    const result = collect(mockRunner(behaviors));
    assert.strictEqual(result.error, 'COLLECTOR_FAILED');
    assert.strictEqual(result.errorKind, 'GITHUB_API_ERROR');
  });

  it('collector throws on PRs fetch failure', async () => {
    const { collect } = await import('../../scripts/loop/collect-github-state.mjs');
    const behaviors = {
      'auth status': () => 'Logged in to github.com',
      'api repos/skerishKang/LoveBud/git/refs/heads/main --jq .object.sha': () => 'b85877498ddbc35b9526c2f89da113ff121e550f',
      'issue list --repo skerishKang/LoveBud --state open --limit 100 --json number,title,labels,state,createdAt': () => JSON.stringify([]),
      'pr list --repo skerishKang/LoveBud --state open --limit 100 --json number,title,headRefName,headRefOid,baseRefName,state,mergeable,reviews,statusCheckRollup': () => {
        throw new Error('RATE_LIMITED');
      }
    };
    const result = collect(mockRunner(behaviors));
    assert.strictEqual(result.error, 'COLLECTOR_FAILED');
    assert.strictEqual(result.errorKind, 'GITHUB_API_ERROR');
  });

  it('collector throws on check-status fetch failure', async () => {
    const { collect } = await import('../../scripts/loop/collect-github-state.mjs');
    const behaviors = {
      'auth status': () => 'Logged in to github.com',
      'api repos/skerishKang/LoveBud/git/refs/heads/main --jq .object.sha': () => 'b85877498ddbc35b9526c2f89da113ff121e550f',
      'issue list --repo skerishKang/LoveBud --state open --limit 100 --json number,title,labels,state,createdAt': () => JSON.stringify([]),
      'pr list --repo skerishKang/LoveBud --state open --limit 100 --json number,title,headRefName,headRefOid,baseRefName,state,mergeable,reviews,statusCheckRollup': () => JSON.stringify([
        { number: 1, title: 'test', headRefOid: 'abc123', headRefName: 'test', baseRefName: 'main', state: 'OPEN', mergeable: 'MERGEABLE' }
      ]),
      'api repos/skerishKang/LoveBud/commits/abc123/check-runs --jq .check_runs | group_by(.conclusion) | map({key: .[0].conclusion, count: length}) | from_entries': () => {
        throw new Error('NETWORK_ERROR');
      }
    };
    const result = collect(mockRunner(behaviors));
    assert.strictEqual(result.error, 'COLLECTOR_FAILED');
    assert.strictEqual(result.errorKind, 'GITHUB_API_ERROR');
  });

  it('collector never leaks raw error contents in errorMessage', async () => {
    const { collect } = await import('../../scripts/loop/collect-github-state.mjs');
    const behaviors = {
      'auth status': () => 'Logged in to github.com',
      'api repos/skerishKang/LoveBud/git/refs/heads/main --jq .object.sha': () => {
        throw new Error('token=ghp_ABC123 secret leaked');
      }
    };
    const result = collect(mockRunner(behaviors));
    assert.strictEqual(result.error, 'COLLECTOR_FAILED');
    assert.ok(!result.errorMessage.includes('ghp_'));
    assert.ok(!result.errorMessage.includes('token'));
  });
});
