const ALLOWED_LANES = Object.freeze([
  'docs',
  'contract-test',
  'test-stability',
  'static-cleanup',
  'product-decision',
  'ux-direction',
  'browser-ui-qa',
  'database-migration',
  'api-contract',
  'auth',
  'privacy',
  'deployment',
  'production-approval',
  'unknown'
]);

const ALLOWED_STATUSES = Object.freeze([
  'READY_FOR_PLANNING',
  'BLOCKED_BY_CI',
  'BLOCKED_BY_DEPENDENCY',
  'NEEDS_PRODUCT_DECISION',
  'NEEDS_UI_QA',
  'NEEDS_DEPLOYMENT_APPROVAL',
  'SCOPE_CONFLICT',
  'NO_AUTO',
  'CI_STATE_UNTRUSTED',
  'CI_DATA_MISSING',
  'CI_UNKNOWN_STATUS'
]);

const ALLOWED_RISKS = Object.freeze([
  'none',
  'low',
  'medium',
  'high',
  'critical'
]);

function validateLane(value) {
  if (!ALLOWED_LANES.includes(value)) {
    throw new Error(`Invalid lane: ${value}. Allowed: ${ALLOWED_LANES.join(', ')}`);
  }
  return true;
}

function validateStatus(value) {
  if (!ALLOWED_STATUSES.includes(value)) {
    throw new Error(`Invalid status: ${value}. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
  }
  return true;
}

function validateRisk(value) {
  if (!ALLOWED_RISKS.includes(value)) {
    throw new Error(`Invalid risk: ${value}. Allowed: ${ALLOWED_RISKS.join(', ')}`);
  }
  return true;
}

function validateQueueItem(item) {
  if (!item || typeof item !== 'object') {
    throw new Error('Queue item must be a non-null object');
  }
  if (!item.id || typeof item.id !== 'string') {
    throw new Error('Queue item must have a string id');
  }
  if (!item.title || typeof item.title !== 'string') {
    throw new Error('Queue item must have a string title');
  }
  validateLane(item.lane);
  validateStatus(item.status);
  if (item.risk !== undefined && item.risk !== null) {
    validateRisk(item.risk);
  }
  return true;
}

function validateOutputReport(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('Report must be a non-null object');
  }
  if (!Array.isArray(report.queue)) {
    throw new Error('Report must have a queue array');
  }
  for (const item of report.queue) {
    validateQueueItem(item);
  }
  if (typeof report.timestamp !== 'string') {
    throw new Error('Report must have a string timestamp');
  }
  if (typeof report.mode !== 'string') {
    throw new Error('Report must have a string mode');
  }
  return true;
}

export {
  ALLOWED_LANES,
  ALLOWED_STATUSES,
  ALLOWED_RISKS,
  validateLane,
  validateStatus,
  validateRisk,
  validateQueueItem,
  validateOutputReport
};
