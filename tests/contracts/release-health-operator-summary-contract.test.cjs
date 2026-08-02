'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(ROOT, 'scripts', 'release-health-operator-summary.cjs');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');
const REGISTRY_CONTRACT_PATH = path.join(ROOT, 'tests', 'contracts', 'ci-test-group-registry-contract.test.cjs');
const CF_SMOKE_CONTRACT_PATH = path.join(ROOT, 'tests', 'contracts', 'cloudflare-supplied-url-smoke-contract.test.cjs');

const SELF_PATH = 'tests/contracts/release-health-operator-summary-contract.test.cjs';

assert.ok(fs.existsSync(MODULE_PATH), 'module must exist');

const summary = require(MODULE_PATH);

const {
  CONTRACT_VERSION,
  POLICY_AUTHORITY,
  HEALTH_STATES,
  RESPONSE_RECOMMENDATIONS,
  BLOCKER_CODES,
  DEGRADED_CODES,
  PRODUCT_ACCEPTANCE_STATES,
  EVIDENCE_COMPLETENESS_STATES,
  TECHNICAL_ACCEPTANCE_STATES,
  OWNER_DECISION_STATES,
  SUMMARY_KEY_ORDER,
  ALLOWED_INPUT_FIELDS,
  PRIVATE_FIELD_NAMES,
  ERROR_CODES,
  buildReleaseHealthOperatorSummary,
  serializeReleaseHealthOperatorSummary,
  formatReleaseHealthOperatorSummary,
} = summary;

const VALID_SHA = '0123456789abcdef0123456789abcdef01234567';

function validInput(overrides) {
  return Object.assign(
    {
      release_sha: VALID_SHA,
      health_state: 'HEALTHY',
      response_recommendation: 'NO_ACTION',
      blocker_codes: [],
      degraded_codes: [],
      product_acceptance: 'PRODUCT_ACCEPTANCE_PENDING',
    },
    overrides || {}
  );
}

function expectCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.equal(err.code, code);
    assert.equal(err.name, 'SummaryError');
    return true;
  });
}

test('exact public surface is exported', () => {
  const required = [
    'CONTRACT_VERSION',
    'POLICY_AUTHORITY',
    'HEALTH_STATES',
    'RESPONSE_RECOMMENDATIONS',
    'BLOCKER_CODES',
    'DEGRADED_CODES',
    'PRODUCT_ACCEPTANCE_STATES',
    'buildReleaseHealthOperatorSummary',
    'serializeReleaseHealthOperatorSummary',
    'formatReleaseHealthOperatorSummary',
  ];
  for (const name of required) {
    assert.ok(name in summary, `missing export: ${name}`);
  }
});

test('fixed contract version and policy authority are exact', () => {
  assert.equal(CONTRACT_VERSION, 1);
  assert.equal(POLICY_AUTHORITY, 'docs/ops/RELEASE_HEALTH_THRESHOLD_AND_RESPONSE_POLICY.md');
});

test('exact four health states and five recommendations', () => {
  assert.deepEqual(HEALTH_STATES, ['HEALTHY', 'DEGRADED', 'BLOCKED', 'INSUFFICIENT_EVIDENCE']);
  assert.deepEqual(RESPONSE_RECOMMENDATIONS, [
    'NO_ACTION',
    'OBSERVE',
    'FORWARD_FIX_REQUIRED',
    'ROLLBACK_RECOMMENDED',
    'OWNER_DECISION_REQUIRED',
  ]);
  assert.equal(new Set(HEALTH_STATES).size, HEALTH_STATES.length);
  assert.equal(new Set(RESPONSE_RECOMMENDATIONS).size, RESPONSE_RECOMMENDATIONS.length);
});

test('bounded blocker and degraded code vocabularies are exact', () => {
  assert.deepEqual(BLOCKER_CODES, [
    'release_sha_mismatch',
    'missing_or_invalid_release_manifest',
    'required_route_failure',
    'required_static_asset_failure',
    'same_origin_unexpected_http_ge_400',
    'fatal_pageerror_or_unhandled_browser_error',
    'privacy_boundary_violation',
    'validated_critical_journey_terminal_failure',
    'required_health_check_failed',
  ]);
  assert.deepEqual(DEGRADED_CODES, [
    'latency_bucket_gte_5_s',
    'browser_console_error',
    'browser_horizontal_overflow',
    'successful_route_or_static_http_3xx',
  ]);
  assert.equal(new Set(BLOCKER_CODES).size, BLOCKER_CODES.length);
  assert.equal(new Set(DEGRADED_CODES).size, DEGRADED_CODES.length);
});

test('exact 11-key schema in fixed order', () => {
  assert.deepEqual(SUMMARY_KEY_ORDER, [
    'contract_version',
    'release_sha',
    'health_state',
    'response_recommendation',
    'evidence_completeness',
    'blocker_codes',
    'degraded_codes',
    'owner_decision_state',
    'technical_acceptance',
    'product_acceptance',
    'policy_authority',
  ]);
  assert.equal(SUMMARY_KEY_ORDER.length, 11);
});

test('all four health states build valid summaries', () => {
  const healthy = buildReleaseHealthOperatorSummary(validInput());
  assert.equal(healthy.health_state, 'HEALTHY');
  assert.equal(healthy.evidence_completeness, 'EVIDENCE_COMPLETE');
  assert.equal(healthy.technical_acceptance, 'TECHNICAL_ACCEPTED');
  assert.equal(healthy.owner_decision_state, 'OWNER_ACTION_NOT_REQUIRED');

  const degraded = buildReleaseHealthOperatorSummary(
    validInput({
      health_state: 'DEGRADED',
      response_recommendation: 'OBSERVE',
      degraded_codes: ['browser_console_error'],
    })
  );
  assert.equal(degraded.health_state, 'DEGRADED');
  assert.equal(degraded.technical_acceptance, 'TECHNICAL_DEGRADED');

  const blocked = buildReleaseHealthOperatorSummary(
    validInput({
      health_state: 'BLOCKED',
      response_recommendation: 'FORWARD_FIX_REQUIRED',
      blocker_codes: ['required_route_failure'],
    })
  );
  assert.equal(blocked.health_state, 'BLOCKED');
  assert.equal(blocked.technical_acceptance, 'TECHNICAL_BLOCKED');

  const insufficient = buildReleaseHealthOperatorSummary(
    validInput({
      health_state: 'INSUFFICIENT_EVIDENCE',
      response_recommendation: 'OWNER_DECISION_REQUIRED',
    })
  );
  assert.equal(insufficient.health_state, 'INSUFFICIENT_EVIDENCE');
  assert.equal(insufficient.evidence_completeness, 'EVIDENCE_INCOMPLETE');
  assert.equal(insufficient.technical_acceptance, 'TECHNICAL_EVIDENCE_INSUFFICIENT');
  assert.equal(insufficient.owner_decision_state, 'OWNER_ACTION_REQUIRED');
});

test('all five recommendations are accepted in valid contexts', () => {
  const cases = [
    { rec: 'NO_ACTION', hs: 'HEALTHY', extra: {} },
    { rec: 'OBSERVE', hs: 'DEGRADED', extra: { degraded_codes: ['latency_bucket_gte_5_s'] } },
    { rec: 'FORWARD_FIX_REQUIRED', hs: 'BLOCKED', extra: { blocker_codes: ['required_route_failure'] } },
    { rec: 'ROLLBACK_RECOMMENDED', hs: 'BLOCKED', extra: { blocker_codes: ['release_sha_mismatch'] } },
    { rec: 'OWNER_DECISION_REQUIRED', hs: 'BLOCKED', extra: { blocker_codes: ['privacy_boundary_violation'] } },
  ];
  for (const { rec, hs, extra } of cases) {
    const built = buildReleaseHealthOperatorSummary(validInput({ health_state: hs, response_recommendation: rec, ...extra }));
    assert.equal(built.response_recommendation, rec);
  }
});

test('valid 40-char lowercase SHA is echoed byte-identically', () => {
  const built = buildReleaseHealthOperatorSummary(validInput());
  assert.equal(built.release_sha, VALID_SHA);
  assert.match(built.release_sha, /^[0-9a-f]{40}$/);
});

test('uppercase, short, invalid, empty, and non-string SHA are rejected', () => {
  const bad = [
    'ABCDEF0123456789abcdef0123456789abcdef01',
    '0123456789abcdef0123456789abcdef0123456',
    '0123456789abcdef0123456789abcdef0123456z',
    '0123456789abcdef0123456789abcdef0123456 ',
    '0123456789abcdef0123456789abcdef01234567 ',
    '',
    '  ',
    'UNKNOWN',
    'NOT_EXPOSED',
    'main',
    'v1.2.3',
    null,
    undefined,
    12345,
    ['0123456789abcdef0123456789abcdef01234567'],
  ];
  for (const sha of bad) {
    expectCode(() => buildReleaseHealthOperatorSummary(validInput({ release_sha: sha })), ERROR_CODES.SUMMARY_RELEASE_SHA_INVALID);
  }
});

test('unknown input fields are rejected, never silently ignored', () => {
  for (const extra of ['extra', 'foo', 'evidence', 'rawPayload', 'summary']) {
    const input = validInput();
    input[extra] = 'x';
    expectCode(() => buildReleaseHealthOperatorSummary(input), ERROR_CODES.SUMMARY_UNKNOWN_FIELD);
  }
});

test('private and raw fields are rejected with the private-field code', () => {
  const privateFields = [
    'rawBody',
    'raw_body',
    'responseBody',
    'rawError',
    'raw_error',
    'exception',
    'stack',
    'stackTrace',
    'url',
    'query',
    'queryString',
    'cookie',
    'token',
    'authorization',
    'authorizationHeader',
    'userContent',
    'treeId',
    'memoryId',
    'userId',
    'uid',
    'uuid',
    'providerId',
    'accountId',
    'projectId',
    'deploymentId',
    'databaseUrl',
    'connectionString',
    'requestId',
    'timestamp',
    'metadata',
  ];
  assert.deepEqual([...PRIVATE_FIELD_NAMES].sort(), privateFields.slice().sort());
  for (const field of privateFields) {
    const input = validInput();
    input[field] = 'secret-value';
    expectCode(() => buildReleaseHealthOperatorSummary(input), ERROR_CODES.SUMMARY_PRIVATE_FIELD_REJECTED);
  }
});

test('unknown health state, recommendation, blocker, degraded, and product codes are rejected', () => {
  expectCode(
    () => buildReleaseHealthOperatorSummary(validInput({ health_state: 'WARN' })),
    ERROR_CODES.SUMMARY_UNKNOWN_ENUM
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(validInput({ health_state: 'healthy' })),
    ERROR_CODES.SUMMARY_UNKNOWN_ENUM
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(validInput({ response_recommendation: 'DEPLOY_NOW' })),
    ERROR_CODES.SUMMARY_UNKNOWN_ENUM
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(
      validInput({ health_state: 'BLOCKED', response_recommendation: 'FORWARD_FIX_REQUIRED', blocker_codes: ['mystery_blocker'] })
    ),
    ERROR_CODES.SUMMARY_UNKNOWN_ENUM
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(
      validInput({ health_state: 'DEGRADED', response_recommendation: 'OBSERVE', degraded_codes: ['latency_bucket_gte_5000_ms'] })
    ),
    ERROR_CODES.SUMMARY_UNKNOWN_ENUM
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(validInput({ product_acceptance: 'PRODUCT_APPROVED' })),
    ERROR_CODES.SUMMARY_UNKNOWN_ENUM
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(validInput({ blocker_codes: 'required_route_failure' })),
    ERROR_CODES.SUMMARY_INPUT_INVALID
  );
});

test('missing required input fields are rejected', () => {
  for (const required of ALLOWED_INPUT_FIELDS) {
    const input = validInput();
    delete input[required];
    expectCode(() => buildReleaseHealthOperatorSummary(input), ERROR_CODES.SUMMARY_INPUT_INVALID);
  }
  expectCode(() => buildReleaseHealthOperatorSummary(null), ERROR_CODES.SUMMARY_INPUT_INVALID);
  expectCode(() => buildReleaseHealthOperatorSummary(undefined), ERROR_CODES.SUMMARY_INPUT_INVALID);
  expectCode(() => buildReleaseHealthOperatorSummary('x'), ERROR_CODES.SUMMARY_INPUT_INVALID);
  expectCode(() => buildReleaseHealthOperatorSummary([]), ERROR_CODES.SUMMARY_INPUT_INVALID);
});

test('HEALTHY consistency is fail-closed', () => {
  expectCode(
    () => buildReleaseHealthOperatorSummary(validInput({ response_recommendation: 'OBSERVE' })),
    ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(validInput({ blocker_codes: ['required_route_failure'] })),
    ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(validInput({ degraded_codes: ['browser_console_error'] })),
    ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE
  );
});

test('DEGRADED consistency is fail-closed', () => {
  expectCode(
    () => buildReleaseHealthOperatorSummary(
      validInput({ health_state: 'DEGRADED', response_recommendation: 'NO_ACTION', degraded_codes: ['browser_console_error'] })
    ),
    ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(
      validInput({ health_state: 'DEGRADED', response_recommendation: 'OBSERVE', degraded_codes: [] })
    ),
    ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(
      validInput({ health_state: 'DEGRADED', response_recommendation: 'OBSERVE', blocker_codes: ['required_route_failure'], degraded_codes: ['browser_console_error'] })
    ),
    ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE
  );
});

test('BLOCKED consistency is fail-closed', () => {
  expectCode(
    () => buildReleaseHealthOperatorSummary(
      validInput({ health_state: 'BLOCKED', response_recommendation: 'NO_ACTION', blocker_codes: ['required_route_failure'] })
    ),
    ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(
      validInput({ health_state: 'BLOCKED', response_recommendation: 'FORWARD_FIX_REQUIRED', blocker_codes: [] })
    ),
    ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE
  );
});

test('INSUFFICIENT_EVIDENCE is never success-defaulted to HEALTHY', () => {
  const built = buildReleaseHealthOperatorSummary(
    validInput({ health_state: 'INSUFFICIENT_EVIDENCE', response_recommendation: 'OWNER_DECISION_REQUIRED' })
  );
  assert.equal(built.health_state, 'INSUFFICIENT_EVIDENCE');
  assert.equal(built.evidence_completeness, 'EVIDENCE_INCOMPLETE');
  assert.equal(built.response_recommendation, 'OWNER_DECISION_REQUIRED');
  assert.equal(built.technical_acceptance, 'TECHNICAL_EVIDENCE_INSUFFICIENT');
  assert.equal(built.owner_decision_state, 'OWNER_ACTION_REQUIRED');

  expectCode(
    () => buildReleaseHealthOperatorSummary(
      validInput({ health_state: 'INSUFFICIENT_EVIDENCE', response_recommendation: 'NO_ACTION' })
    ),
    ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE
  );
  expectCode(
    () => buildReleaseHealthOperatorSummary(
      validInput({ health_state: 'INSUFFICIENT_EVIDENCE', response_recommendation: 'OWNER_DECISION_REQUIRED', degraded_codes: ['browser_console_error'] })
    ),
    ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE
  );
});

test('owner decision state derivation is exact for all five recommendations', () => {
  const cases = [
    { rec: 'NO_ACTION', owner: 'OWNER_ACTION_NOT_REQUIRED', hs: 'HEALTHY', extra: {} },
    { rec: 'OBSERVE', owner: 'OWNER_ACTION_NOT_REQUIRED', hs: 'DEGRADED', extra: { degraded_codes: ['latency_bucket_gte_5_s'] } },
    { rec: 'FORWARD_FIX_REQUIRED', owner: 'OWNER_ACTION_NOT_REQUIRED', hs: 'BLOCKED', extra: { blocker_codes: ['required_route_failure'] } },
    { rec: 'ROLLBACK_RECOMMENDED', owner: 'OWNER_ACTION_REQUIRED', hs: 'BLOCKED', extra: { blocker_codes: ['release_sha_mismatch'] } },
    { rec: 'OWNER_DECISION_REQUIRED', owner: 'OWNER_ACTION_REQUIRED', hs: 'BLOCKED', extra: { blocker_codes: ['privacy_boundary_violation'] } },
  ];
  for (const { rec, owner, hs, extra } of cases) {
    const built = buildReleaseHealthOperatorSummary(validInput({ health_state: hs, response_recommendation: rec, ...extra }));
    assert.equal(built.owner_decision_state, owner, rec);
  }
});

test('technical and Product/UI acceptance are strictly separated', () => {
  const pending = buildReleaseHealthOperatorSummary(validInput({ product_acceptance: 'PRODUCT_ACCEPTANCE_PENDING' }));
  assert.equal(pending.health_state, 'HEALTHY');
  assert.equal(pending.technical_acceptance, 'TECHNICAL_ACCEPTED');
  assert.equal(pending.product_acceptance, 'PRODUCT_ACCEPTANCE_PENDING');
  assert.equal(pending.product_acceptance === 'PRODUCT_ACCEPTED', false);

  const rejected = buildReleaseHealthOperatorSummary(validInput({ product_acceptance: 'PRODUCT_REJECTED' }));
  assert.equal(rejected.product_acceptance, 'PRODUCT_REJECTED');
  assert.equal(rejected.health_state, 'HEALTHY');

  const blockedAccepted = buildReleaseHealthOperatorSummary(
    validInput({
      health_state: 'BLOCKED',
      response_recommendation: 'FORWARD_FIX_REQUIRED',
      blocker_codes: ['required_route_failure'],
      product_acceptance: 'PRODUCT_ACCEPTED',
    })
  );
  assert.equal(blockedAccepted.health_state, 'BLOCKED');
  assert.equal(blockedAccepted.product_acceptance, 'PRODUCT_ACCEPTED');

  const degradedPending = buildReleaseHealthOperatorSummary(
    validInput({
      health_state: 'DEGRADED',
      response_recommendation: 'OBSERVE',
      degraded_codes: ['browser_console_error'],
      product_acceptance: 'PRODUCT_ACCEPTANCE_PENDING',
    })
  );
  assert.equal(degradedPending.technical_acceptance, 'TECHNICAL_DEGRADED');
  assert.equal(degradedPending.product_acceptance, 'PRODUCT_ACCEPTANCE_PENDING');
});

test('blocker/degraded codes are deduplicated and lexicographically sorted', () => {
  const built = buildReleaseHealthOperatorSummary(
    validInput({
      health_state: 'BLOCKED',
      response_recommendation: 'FORWARD_FIX_REQUIRED',
      blocker_codes: ['required_route_failure', 'privacy_boundary_violation', 'required_route_failure', 'release_sha_mismatch'],
    })
  );
  assert.deepEqual(built.blocker_codes, [
    'privacy_boundary_violation',
    'release_sha_mismatch',
    'required_route_failure',
  ]);

  const degraded = buildReleaseHealthOperatorSummary(
    validInput({
      health_state: 'DEGRADED',
      response_recommendation: 'OBSERVE',
      degraded_codes: ['browser_horizontal_overflow', 'browser_console_error', 'browser_console_error'],
    })
  );
  assert.deepEqual(degraded.degraded_codes, ['browser_console_error', 'browser_horizontal_overflow']);
});

test('input is detached: mutating caller arrays after build leaves output unchanged', () => {
  const input = validInput({
    health_state: 'BLOCKED',
    response_recommendation: 'FORWARD_FIX_REQUIRED',
    blocker_codes: ['required_route_failure'],
  });
  const built = buildReleaseHealthOperatorSummary(input);
  const snapshot = serializeReleaseHealthOperatorSummary(built);
  input.blocker_codes.push('privacy_boundary_violation');
  input.blocker_codes.sort();
  input.release_sha = 'ffffffffffffffffffffffffffffffffffffffff';
  input.health_state = 'DEGRADED';
  assert.equal(serializeReleaseHealthOperatorSummary(built), snapshot);
});

test('output summary and code arrays are deep frozen', () => {
  const built = buildReleaseHealthOperatorSummary(
    validInput({
      health_state: 'BLOCKED',
      response_recommendation: 'FORWARD_FIX_REQUIRED',
      blocker_codes: ['required_route_failure'],
    })
  );
  assert.equal(Object.isFrozen(built), true);
  assert.equal(Object.isFrozen(built.blocker_codes), true);
  assert.equal(Object.isFrozen(built.degraded_codes), true);

  assert.throws(() => {
    built.blocker_codes.push('privacy_boundary_violation');
  }, TypeError);
  assert.throws(() => {
    built.health_state = 'DEGRADED';
  }, TypeError);
  assert.throws(() => {
    built.release_sha = 'ffffffffffffffffffffffffffffffffffffffff';
  }, TypeError);
});

test('canonical exports and constants are immutable', () => {
  const frozenValues = [
    summary,
    HEALTH_STATES,
    RESPONSE_RECOMMENDATIONS,
    BLOCKER_CODES,
    DEGRADED_CODES,
    PRODUCT_ACCEPTANCE_STATES,
    EVIDENCE_COMPLETENESS_STATES,
    TECHNICAL_ACCEPTANCE_STATES,
    OWNER_DECISION_STATES,
    SUMMARY_KEY_ORDER,
    ALLOWED_INPUT_FIELDS,
    PRIVATE_FIELD_NAMES,
    ERROR_CODES,
  ];
  for (const value of frozenValues) {
    assert.equal(Object.isFrozen(value), true);
  }
  assert.equal(HEALTH_STATES.length, 4);
  assert.equal(RESPONSE_RECOMMENDATIONS.length, 5);
  assert.equal(BLOCKER_CODES.length, 9);
  assert.equal(DEGRADED_CODES.length, 4);
  assert.equal(PRODUCT_ACCEPTANCE_STATES.length, 3);
  assert.equal(SUMMARY_KEY_ORDER.length, 11);
});

test('serialization is byte-stable and preserves canonical key order', () => {
  const inputA = validInput({
    health_state: 'BLOCKED',
    response_recommendation: 'FORWARD_FIX_REQUIRED',
    blocker_codes: ['required_route_failure', 'privacy_boundary_violation', 'required_route_failure'],
  });
  const inputB = validInput({
    health_state: 'BLOCKED',
    response_recommendation: 'FORWARD_FIX_REQUIRED',
    blocker_codes: ['privacy_boundary_violation', 'required_route_failure'],
  });
  const jsonA1 = serializeReleaseHealthOperatorSummary(buildReleaseHealthOperatorSummary(inputA));
  const jsonA2 = serializeReleaseHealthOperatorSummary(buildReleaseHealthOperatorSummary(inputA));
  const jsonB = serializeReleaseHealthOperatorSummary(buildReleaseHealthOperatorSummary(inputB));
  assert.equal(jsonA1, jsonA2);
  assert.equal(jsonA1, jsonB);
  assert.equal(jsonA1.endsWith('\n'), false);

  const parsed = JSON.parse(jsonA1);
  assert.deepEqual(Object.keys(parsed), SUMMARY_KEY_ORDER);
  assert.equal(parsed.contract_version, 1);
  assert.equal(parsed.policy_authority, POLICY_AUTHORITY);
  assert.deepEqual(parsed.blocker_codes, ['privacy_boundary_violation', 'required_route_failure']);
});

test('human formatter is byte-stable with fixed line order and advisory text', () => {
  const built = buildReleaseHealthOperatorSummary(
    validInput({
      health_state: 'BLOCKED',
      response_recommendation: 'ROLLBACK_RECOMMENDED',
      blocker_codes: ['release_sha_mismatch'],
      product_acceptance: 'PRODUCT_REJECTED',
    })
  );
  const text1 = formatReleaseHealthOperatorSummary(built);
  const text2 = formatReleaseHealthOperatorSummary(buildReleaseHealthOperatorSummary(
    validInput({
      health_state: 'BLOCKED',
      response_recommendation: 'ROLLBACK_RECOMMENDED',
      blocker_codes: ['release_sha_mismatch'],
      product_acceptance: 'PRODUCT_REJECTED',
    })
  ));
  assert.equal(text1, text2);

  const lines = text1.split('\n');
  assert.equal(lines[0], 'Release Health Operator Summary');
  assert.equal(lines[1], 'Release SHA: ' + VALID_SHA);
  assert.equal(lines[2], 'Technical health: BLOCKED');
  assert.equal(lines[3], 'Technical acceptance: TECHNICAL_BLOCKED');
  assert.equal(lines[4], 'Product/UI acceptance: PRODUCT_REJECTED');
  assert.equal(lines[5], 'Evidence completeness: EVIDENCE_COMPLETE');
  assert.equal(lines[6], 'Response recommendation: ROLLBACK_RECOMMENDED');
  assert.equal(lines[7], 'Owner action: OWNER_ACTION_REQUIRED');
  assert.equal(lines[8], 'Blockers: release_sha_mismatch');
  assert.equal(lines[9], 'Degraded signals: NONE');
  assert.ok(text1.includes('Advisory only: no deployment, rollback, provider mutation, or workflow action was executed.'));
  assert.ok(text1.includes('Policy authority: docs/ops/RELEASE_HEALTH_THRESHOLD_AND_RESPONSE_POLICY.md'));
  assert.equal(text1.endsWith('\n'), false);
});

test('human formatter separates technical status from Product/UI acceptance lines', () => {
  const built = buildReleaseHealthOperatorSummary(validInput({ product_acceptance: 'PRODUCT_ACCEPTANCE_PENDING' }));
  const text = formatReleaseHealthOperatorSummary(built);
  assert.ok(text.includes('Technical health: HEALTHY'));
  assert.ok(text.includes('Technical acceptance: TECHNICAL_ACCEPTED'));
  assert.ok(text.includes('Product/UI acceptance: PRODUCT_ACCEPTANCE_PENDING'));
});

test('errors carry only fixed sanitized codes and never echo input values', () => {
  const sensitive = 'super-secret-token-ABCDE';
  try {
    buildReleaseHealthOperatorSummary(validInput({ rawBody: sensitive }));
  } catch (err) {
    assert.equal(err.code, ERROR_CODES.SUMMARY_PRIVATE_FIELD_REJECTED);
    assert.equal(err.message.includes(sensitive), false);
  }
  try {
    buildReleaseHealthOperatorSummary(validInput({ release_sha: sensitive }));
  } catch (err) {
    assert.equal(err.code, ERROR_CODES.SUMMARY_RELEASE_SHA_INVALID);
    assert.equal(err.message.includes(sensitive), false);
  }
  try {
    buildReleaseHealthOperatorSummary(validInput({ unknownKey: sensitive }));
  } catch (err) {
    assert.equal(err.code, ERROR_CODES.SUMMARY_UNKNOWN_FIELD);
    assert.equal(err.message.includes(sensitive), false);
  }
});

test('module source has no action execution capability', () => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  assert.doesNotMatch(source, /require\s*\(\s*['"](?:child_process|node:child_process|http|node:http|https|node:https|node:net|fs|node:fs)['"]/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bXMLHttpRequest\b|\bWebSocket\b/);
  assert.doesNotMatch(source, /process\.env|\bprocess\.exit\b|\bprocess\.stdout\b|\bprocess\.stderr\b/);
  assert.doesNotMatch(source, /Date\.now|\bnew Date\b|\bMath\.random\b|crypto\.randomUUID/);
  assert.doesNotMatch(source, /\bsetTimeout\s*\(|\bsetInterval\s*\(/);
  // Construct forbidden I/O tokens dynamically so the literal token text never
  // appears in this file and cannot self-match the self-scan test below.
  const writeCapability = 'write' + 'File';
  const appendCapability = 'append' + 'File';
  const streamCapability = 'create' + 'WriteStream';
  assert.doesNotMatch(source, new RegExp(writeCapability + '|' + appendCapability + '|' + streamCapability));
  assert.doesNotMatch(source, /\bdeploy\s*\(|\brollback\s*\(|\bspawn\s*\(|\bexec\s*\(|\bexecSync\s*\(|\bexecFileSync\s*\(/);
  assert.doesNotMatch(source, /workflow[_ -]?dispatch/i);
  assert.doesNotMatch(source, /\bgithub\s*api\b|\bcloudflare\s*api\b|octokit/i);
  assert.doesNotMatch(source, /\bconsole\b/);
});

test('fresh module import has no I/O, environment, process, or stdout/stderr side effect', () => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  assert.doesNotMatch(source, /\bprocess\b|\bconsole\b/);

  const originalLog = console.log;
  const originalError = console.error;
  let logCalls = 0;
  let errorCalls = 0;
  console.log = () => { logCalls++; };
  console.error = () => { errorCalls++; };
  try {
    delete require.cache[require.resolve(MODULE_PATH)];
    const fresh = require(MODULE_PATH);
    assert.equal(fresh.CONTRACT_VERSION, 1);
    const built = fresh.buildReleaseHealthOperatorSummary(validInput());
    assert.equal(built.health_state, 'HEALTHY');
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.equal(logCalls, 0);
  assert.equal(errorCalls, 0);
});

test('this contract is classified EXECUTED_FAKE and count literals are reconciled', () => {
  const classification = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const entry = classification.entries.find((e) => e.path === SELF_PATH);
  assert.ok(entry, 'classification entry must exist for this contract test');
  assert.equal(entry.layer, 'EXECUTED_FAKE');
  assert.equal(entry.layer === 'SOURCE_STATIC', false);

  const registryContract = fs.readFileSync(REGISTRY_CONTRACT_PATH, 'utf8');
  assert.match(registryContract, /expected post-child counts 789 \/ 577 \/ 192 \/ 20/);
  assert.match(registryContract, /default_total,\s*789/);
  assert.match(registryContract, /SOURCE_STATIC,\s*577/);
  assert.match(registryContract, /EXECUTED_FAKE,\s*192/);
  assert.match(registryContract, /EXECUTED_REAL_LOCAL,\s*20/);

  // The CF smoke contract embeds the same count literals as regex-literal text.
  const cfSmoke = fs.readFileSync(CF_SMOKE_CONTRACT_PATH, 'utf8');
  assert.ok(cfSmoke.includes('default_total,\\s*789'), 'CF smoke contract must embed default_total 789 literal');
  assert.ok(cfSmoke.includes('SOURCE_STATIC,\\s*577'), 'CF smoke contract must embed SOURCE_STATIC 577 literal');
});

test('this contract executes only the pure module with synthetic fixtures', () => {
  const source = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(source, /require\s*\(\s*['"](?:http|node:http|https|node:https|node:net|child_process|node:child_process)['"]/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bsetTimeout\s*\(/);
  // Construct the forbidden tokens dynamically so the check itself does not
  // contain the literal token text and cannot self-match.
  const writeCapability = 'write' + 'File';
  const appendCapability = 'append' + 'File';
  assert.doesNotMatch(source, new RegExp(writeCapability + '|' + appendCapability));
});
