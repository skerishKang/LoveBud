import { validateLane, validateStatus } from './schemas.mjs';

const HUMAN_REQUIRED_LANES = new Set([
  'product-decision',
  'ux-direction',
  'browser-ui-qa',
  'database-migration',
  'api-contract',
  'auth',
  'privacy',
  'deployment',
  'production-approval'
]);

const AUTO_ELIGIBLE_LANES = new Set([
  'docs',
  'contract-test',
  'test-stability',
  'static-cleanup'
]);

const KNOWN_CI_KEYS = new Set([
  'success',
  'skipped',
  'failure',
  'action_required',
  'cancelled',
  'timed_out',
  'pending',
  'queued',
  'in_progress',
  'waiting'
]);

const FAILURE_KEYS = new Set(['failure', 'action_required', 'cancelled', 'timed_out']);
const PENDING_KEYS = new Set(['pending', 'queued', 'in_progress', 'waiting']);

function classifyLane(labels, title) {
  const labelSet = new Set((labels || []).map(l => l.toLowerCase()));
  const lowerTitle = (title || '').toLowerCase();

  if (labelSet.has('auth') || labelSet.has('security') || labelSet.has('privacy')) return 'auth';
  if (labelSet.has('database') || labelSet.has('migration') || labelSet.has('db')) return 'database-migration';
  if (labelSet.has('deployment') || labelSet.has('deploy') || labelSet.has('ci/cd') || labelSet.has('production')) return 'deployment';
  if (labelSet.has('api') || labelSet.has('api-contract') || labelSet.has('endpoint')) return 'api-contract';
  if (labelSet.has('ux') || labelSet.has('design') || labelSet.has('ui')) return 'ux-direction';
  if (labelSet.has('product') || labelSet.has('decision')) return 'product-decision';
  if (labelSet.has('qa') || labelSet.has('browser-test') || labelSet.has('e2e')) return 'browser-ui-qa';
  if (labelSet.has('privacy') || labelSet.has('pii')) return 'privacy';
  if (labelSet.has('production-approval') || labelSet.has('release')) return 'production-approval';

  if (labelSet.has('docs') || labelSet.has('documentation')) return 'docs';
  if (labelSet.has('contract-test') || labelSet.has('test-contract')) return 'contract-test';
  if (labelSet.has('test') || labelSet.has('test-stability') || labelSet.has('flaky')) return 'test-stability';
  if (labelSet.has('cleanup') || labelSet.has('static') || labelSet.has('chore') || labelSet.has('refactor')) return 'static-cleanup';

  if (lowerTitle.startsWith('docs') || lowerTitle.startsWith('doc:')) return 'docs';
  if (lowerTitle.includes('cleanup') || lowerTitle.includes('refactor') || lowerTitle.includes('chore')) return 'static-cleanup';
  if (lowerTitle.includes('test') || lowerTitle.includes('contract')) return 'contract-test';

  return null;
}

function ciNumeric(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  }
  return null;
}

function classifyChecks(checksObj) {
  if (!checksObj || typeof checksObj !== 'object') {
    return 'CI_DATA_MISSING';
  }

  const entries = Object.entries(checksObj);
  if (entries.length === 0) {
    return 'CI_DATA_MISSING';
  }

  let hasUnknownPositive = false;

  for (const [key, rawValue] of entries) {
    const lowerKey = key.toLowerCase();
    const count = ciNumeric(rawValue);

    if (count === null) {
      return 'CI_STATE_UNTRUSTED';
    }

    if (!KNOWN_CI_KEYS.has(lowerKey)) {
      if (count > 0) {
        hasUnknownPositive = true;
      }
      continue;
    }

    if (FAILURE_KEYS.has(lowerKey) && count > 0) {
      return 'BLOCKED_BY_CI';
    }
    if (PENDING_KEYS.has(lowerKey) && count > 0) {
      return 'BLOCKED_BY_CI';
    }
  }

  if (hasUnknownPositive) {
    return 'CI_UNKNOWN_STATUS';
  }

  return null;
}

function determineStatus(pr, lane) {
  if (pr) {
    let checksObj = pr.checks;
    if (typeof checksObj === 'string') {
      try { checksObj = JSON.parse(checksObj); } catch {
        return 'CI_DATA_MISSING';
      }
    }

    if (checksObj !== undefined && checksObj !== null) {
      const ciVerdict = classifyChecks(checksObj);
      if (ciVerdict) return ciVerdict;
    } else {
      return 'CI_DATA_MISSING';
    }
  }

  if (!lane) return 'NO_AUTO';

  if (HUMAN_REQUIRED_LANES.has(lane)) {
    if (lane === 'browser-ui-qa') return 'NEEDS_UI_QA';
    if (lane === 'deployment' || lane === 'production-approval') return 'NEEDS_DEPLOYMENT_APPROVAL';
    return 'NEEDS_PRODUCT_DECISION';
  }

  if (AUTO_ELIGIBLE_LANES.has(lane)) {
    return 'READY_FOR_PLANNING';
  }

  return 'NO_AUTO';
}

function build(githubState) {
  if (!githubState || githubState.error) {
    return { queue: [], timestamp: new Date().toISOString(), mode: 'dry-run', error: githubState ? githubState.errorMessage : 'No GitHub state' };
  }

  const queue = [];

  for (const issue of (githubState.issues || [])) {
    const lane = classifyLane(issue.labels, issue.title);
    const status = lane ? determineStatus(null, lane) : 'NO_AUTO';
    try {
      if (lane) validateLane(lane);
      validateStatus(status);
    } catch {
      continue;
    }
    queue.push({
      id: `issue-${issue.number}`,
      type: 'issue',
      number: issue.number,
      title: issue.title,
      lane: lane || 'unknown',
      status,
      risk: HUMAN_REQUIRED_LANES.has(lane) ? 'medium' : 'low'
    });
  }

  for (const pr of (githubState.prs || [])) {
    const lane = classifyLane([], pr.title);
    const status = determineStatus(pr, lane);
    try {
      if (lane) validateLane(lane);
      validateStatus(status);
    } catch {
      continue;
    }
    queue.push({
      id: `pr-${pr.number}`,
      type: 'pr',
      number: pr.number,
      title: pr.title,
      lane: lane || 'unknown',
      status,
      risk: lane && HUMAN_REQUIRED_LANES.has(lane) ? 'medium' : 'low',
      headRefName: pr.headRefName,
      headRefOid: pr.headRefOid,
      checks: pr.checks
    });
  }

  return {
    queue,
    timestamp: new Date().toISOString(),
    mode: 'dry-run',
    mainSha: githubState.mainSha
  };
}

export { build, classifyLane, classifyChecks, determineStatus, AUTO_ELIGIBLE_LANES, HUMAN_REQUIRED_LANES };
