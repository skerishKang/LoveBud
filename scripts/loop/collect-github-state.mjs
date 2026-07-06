import { execFileSync } from 'node:child_process';

function gh(argsArray, executor = execFileSync) {
  return executor('gh', argsArray, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 30000
  }).trim();
}

function checkAuth(executor = execFileSync) {
  try {
    const result = executor('gh', ['auth', 'status'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000
    });
    return result.includes('Logged in');
  } catch {
    return false;
  }
}

function getMainSha(executor = execFileSync) {
  try {
    return gh(['api', 'repos/skerishKang/LoveBud/git/refs/heads/main', '--jq', '.object.sha'], executor);
  } catch {
    throw new Error('MAIN_SHA_FETCH_FAILED');
  }
}

function getOpenIssues(executor = execFileSync) {
  try {
    const raw = gh(['issue', 'list', '--repo', 'skerishKang/LoveBud', '--state', 'open', '--limit', '100', '--json', 'number,title,labels,state,createdAt'], executor);
    return JSON.parse(raw);
  } catch {
    throw new Error('ISSUES_FETCH_FAILED');
  }
}

function getOpenPRs(executor = execFileSync) {
  try {
    const raw = gh(['pr', 'list', '--repo', 'skerishKang/LoveBud', '--state', 'open', '--limit', '100', '--json', 'number,title,headRefName,headRefOid,baseRefName,state,mergeable,reviews,statusCheckRollup'], executor);
    return JSON.parse(raw);
  } catch {
    throw new Error('PRS_FETCH_FAILED');
  }
}

function getPRCheckStatus(headSha, executor = execFileSync) {
  if (!headSha) return 'unknown';
  try {
    const raw = gh(['api', `repos/skerishKang/LoveBud/commits/${headSha}/check-runs`, '--jq', '.check_runs | group_by(.conclusion) | map({key: .[0].conclusion, count: length}) | from_entries'], executor);
    return raw;
  } catch {
    throw new Error('PR_CHECK_STATUS_FETCH_FAILED');
  }
}

function collect(_runner) {
  if (!checkAuth(_runner)) {
    return { error: 'GITHUB_AUTH_FAILED', errorMessage: 'GitHub CLI authentication failed.' };
  }

  try {
    const mainSha = getMainSha(_runner);
    const issues = getOpenIssues(_runner);
    const prs = getOpenPRs(_runner);

    const prsWithStatus = prs.map(pr => {
      const checkStatus = getPRCheckStatus(pr.headRefOid, _runner);
      return { ...pr, checkStatus };
    });

    return {
      mainSha,
      issueCount: issues.length,
      prCount: prsWithStatus.length,
      issues: issues.map(i => ({
        number: i.number,
        title: i.title,
        labels: (i.labels || []).map(l => l.name),
        createdAt: i.createdAt
      })),
      prs: prsWithStatus.map(p => ({
        number: p.number,
        title: p.title,
        headRefName: p.headRefName,
        headRefOid: p.headRefOid,
        baseRefName: p.baseRefName,
        state: p.state,
        mergeable: p.mergeable,
        checks: p.checkStatus
      }))
    };
  } catch (e) {
    return {
      error: 'COLLECTOR_FAILED',
      errorMessage: 'GitHub state collection failed.',
      errorKind: 'GITHUB_API_ERROR'
    };
  }
}

export {
  checkAuth,
  getMainSha,
  getOpenIssues,
  getOpenPRs,
  getPRCheckStatus,
  collect
};
