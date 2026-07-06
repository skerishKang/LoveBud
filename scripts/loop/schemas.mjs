const ALLOWED_RISKS = Object.freeze([
  'none',
  'low',
  'medium',
  'high',
  'critical'
]);

function validateLane(value, policy) {
  const allLanes = (policy.autoEligibleLanes || []).concat(policy.humanRequiredLanes || []);
  const allowed = new Set(allLanes);
  allowed.add('unknown');
  if (!allowed.has(value)) {
    const allowedStr = [...allLanes, 'unknown'].join(', ');
    throw new Error(`Invalid lane: ${value}. Allowed: ${allowedStr}`);
  }
  return true;
}

function validateStatus(value, policy) {
  const allowed = new Set(policy.allowedStatuses || []);
  if (!allowed.has(value)) {
    throw new Error(`Invalid status: ${value}. Allowed: ${policy.allowedStatuses.join(', ')}`);
  }
  return true;
}

function validateRisk(value) {
  if (!ALLOWED_RISKS.includes(value)) {
    throw new Error(`Invalid risk: ${value}. Allowed: ${ALLOWED_RISKS.join(', ')}`);
  }
  return true;
}

function validateQueueItem(item, policy) {
  if (!item || typeof item !== 'object') {
    throw new Error('Queue item must be a non-null object');
  }
  if (!item.id || typeof item.id !== 'string') {
    throw new Error('Queue item must have a string id');
  }
  if (!item.title || typeof item.title !== 'string') {
    throw new Error('Queue item must have a string title');
  }
  validateLane(item.lane, policy);
  validateStatus(item.status, policy);
  if (item.risk !== undefined && item.risk !== null) {
    validateRisk(item.risk);
  }
  return true;
}

function validateOutputReport(report, policy) {
  if (!report || typeof report !== 'object') {
    throw new Error('Report must be a non-null object');
  }
  if (!Array.isArray(report.queue)) {
    throw new Error('Report must have a queue array');
  }
  for (const item of report.queue) {
    validateQueueItem(item, policy);
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
  ALLOWED_RISKS,
  validateLane,
  validateStatus,
  validateRisk,
  validateQueueItem,
  validateOutputReport
};
