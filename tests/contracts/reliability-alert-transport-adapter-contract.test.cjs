'use strict';

// Issue #3874 — Provider-unselected alert transport adapter contract.
//
// This contract EXECUTES the real adapter source
// (js/observability/reliability-alert-transport-adapter.js) in a restricted
// sandbox with an injected fake transport effect and proves the bounded
// provider-unselected transport boundary:
//
//   provider-unselected default -> effect 0
//   transport disabled -> effect 0
//   operator disabled -> effect 0
//   invalid/missing release SHA -> effect 0
//   unknown/private key -> effect 0
//   malformed canonical envelope -> effect 0
//   invalid secret state -> effect 0
//   invalid dedupe state -> effect 0
//   explicit synthetic ACCEPTED/REJECTED/TIMEOUT/UNAVAILABLE mapping (effect 1)
//   injected throw/rejection -> sanitized failure (effect 1)
//   maximum effect count exactly 1
//   nested accessor/Proxy hostile input -> getter/trap count 0
//   raw provider/secret/error leakage 0
//   input/result/export deeply frozen and detached
//   same bounded input -> awaited byte-stable result
//   all capability/effect flags false (even for synthetic outcomes)
//   zero network/env/filesystem/storage/queue/provider SDK capability
//   effect receives deeply frozen detached control snapshot (T23)
//   effect mutation attempts cannot alter result / leak private data (T24)
//   enum non-string coercion blocked (Symbol.toPrimitive + Proxy get) (T25/T26)
//   deps exact own-key schema (T27) + inherited/non-enumerable/accessor/Proxy
//     rejection with 0 getter/trap calls (T28)
//   envelope contract_version must be exactly '1' (T29)
//
// The synthetic effect seam must NOT be usable through the default
// provider-unselected production posture.
//
// Classification: EXECUTED_FAKE (registered once in
// tests/test-layer-classification.json with capabilities []).
//
// Refs #3874.
// Refs #3873 — accepted provider-binding audit.
// Refs #3861 — completed Child 4A provider-neutral delivery core.
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ADAPTER_PATH = path.join(ROOT, 'js', 'observability', 'reliability-alert-transport-adapter.js');

const VALID_RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567';

function readAdapterSource() {
  return fs.readFileSync(ADAPTER_PATH, 'utf8');
}

function loadAdapter() {
  const sandbox = { window: {} };
  new Function('window', readAdapterSource())(sandbox.window);
  assert.ok(sandbox.window.LoveBudReliabilityAlertTransportAdapter, 'must expose adapter');
  return sandbox.window.LoveBudReliabilityAlertTransportAdapter;
}

// A canonical 12-key envelope exactly as produced by
// reliability-alert-delivery-core.js (from #3861 Child 4A).
function validEnvelope() {
  return {
    contract_version: '1',
    source_class: 'STRUCTURAL_SENTINEL',
    operation_class: 'STRUCTURAL_SCHEMA_CHECK',
    outcome_code: 'ORPHAN_SIGNAL_DETECTED',
    severity: 'WARNING',
    advisory_action: 'INVESTIGATE',
    owner_class: 'DATABASE_OWNER',
    evidence_completeness: 'complete',
    release_sha: VALID_RELEASE_SHA,
    latency_bucket: 'TIMEOUT_OR_UNKNOWN',
    baseline_deviation_class: 'MATERIAL_DEVIATION',
    dedupe_fingerprint: 'a'.repeat(64),
  };
}

function validControl(overrides) {
  return Object.assign(
    {
      provider_class: 'PROVIDER_UNSELECTED',
      runtime_binding: 'NOT_BOUND',
      secret_status: 'NOT_REQUIRED_FOR_SOURCE_ADAPTER',
      transport_enabled: false,
      operator_disabled: false,
      retry_attempt_class: 'FIRST_ATTEMPT',
      dedupe_state_class: 'DEDUPE_NOT_AVAILABLE',
      release_sha: VALID_RELEASE_SHA,
      synthetic_effect_authorized: false,
    },
    overrides || {}
  );
}

function createAdapter(effect) {
  const A = loadAdapter();
  const deps = effect === undefined ? {} : { invokeTransport: effect };
  return { A, instance: A.createAlertTransportAdapter(deps) };
}

// ---------------------------------------------------------------------------

test('T1 provider-unselected default -> effect 0 -> PROVIDER_UNSELECTED', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const result = await instance.dispatchTransport(validEnvelope(), validControl());
  assert.equal(result.outcome, 'TRANSPORT_NOT_ATTEMPTED_PROVIDER_UNSELECTED');
  assert.equal(effectCalls, 0, 'default provider-unselected posture never invokes effect');
  assert.equal(result.provider_selected, false);
  assert.equal(result.runtime_bound, false);
  assert.equal(result.secret_read, false);
  assert.equal(result.network_performed, false);
  assert.equal(result.persistence_performed, false);
  assert.equal(result.queue_performed, false);
  assert.equal(result.preview_effect_performed, false);
  assert.equal(result.production_effect_performed, false);
});

test('T2 transport disabled -> effect 0', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const result = await instance.dispatchTransport(
    validEnvelope(),
    validControl({ transport_enabled: true })
  );
  assert.equal(result.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT');
  assert.equal(effectCalls, 0, 'transport_enabled must be exactly false in this child');
});

test('T3 operator disabled -> effect 0', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const result = await instance.dispatchTransport(
    validEnvelope(),
    validControl({ operator_disabled: true })
  );
  assert.equal(result.outcome, 'TRANSPORT_NOT_ATTEMPTED_OPERATOR_DISABLED');
  assert.equal(effectCalls, 0, 'operator disable must never invoke effect');
});

test('T4 invalid/missing release SHA -> effect 0', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const badSha = await instance.dispatchTransport(validEnvelope(), validControl({ release_sha: 'not-a-sha' }));
  assert.equal(badSha.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT');
  const missingEnv = validEnvelope();
  delete missingEnv.release_sha;
  const missingControl = validControl({ release_sha: 'x'.repeat(40) });
  const badEnv = await instance.dispatchTransport(missingEnv, missingControl);
  assert.equal(badEnv.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT');
  const mismatch = await instance.dispatchTransport(validEnvelope(), validControl({ release_sha: 'b'.repeat(40) }));
  assert.equal(mismatch.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT');
  assert.equal(effectCalls, 0, 'release SHA failures never invoke effect');
});

test('T5 unknown/private key -> effect 0', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const unknownControl = validControl({ unknown_key: 'x' });
  const unknownResult = await instance.dispatchTransport(validEnvelope(), unknownControl);
  assert.equal(unknownResult.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT');
  const privateFields = ['token', 'secret', 'cookie', 'authorization', 'email', 'endpoint', 'webhook_url', 'provider_id', 'deployment_id', 'timestamp', 'metadata'];
  for (const key of privateFields) {
    const ctl = validControl({ [key]: 'SENTINEL_SECRET' });
    const r = await instance.dispatchTransport(validEnvelope(), ctl);
    assert.equal(r.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT', key + ' must be rejected on control');
    const env = validEnvelope();
    env[key] = 'SENTINEL_SECRET';
    const re = await instance.dispatchTransport(env, validControl());
    assert.equal(re.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT', key + ' must be rejected on envelope');
  }
  assert.equal(effectCalls, 0, 'unknown/private fields never invoke effect');
});

test('T6 malformed canonical envelope -> effect 0', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const tooFew = validEnvelope();
  delete tooFew.outcome_code;
  const extra = Object.assign({}, validEnvelope(), { extra: 'x' });
  const badFp = validEnvelope();
  badFp.dedupe_fingerprint = 'not-hex';
  const badEnum = validEnvelope();
  badEnum.severity = 'FATAL';
  for (const bad of [tooFew, extra, badFp, badEnum]) {
    const r = await instance.dispatchTransport(bad, validControl());
    assert.equal(r.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT', 'malformed envelope must be rejected');
  }
  assert.equal(effectCalls, 0, 'malformed envelope never invokes effect');
});

test('T7 invalid secret state -> effect 0', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const absent = await instance.dispatchTransport(validEnvelope(), validControl({ secret_status: 'SECRET_ABSENT' }));
  const invalid = await instance.dispatchTransport(validEnvelope(), validControl({ secret_status: 'SECRET_INVALID' }));
  assert.equal(absent.outcome, 'TRANSPORT_NOT_ATTEMPTED_SECRET_STATE');
  assert.equal(invalid.outcome, 'TRANSPORT_NOT_ATTEMPTED_SECRET_STATE');
  assert.equal(effectCalls, 0, 'invalid secret state never invokes effect');
});

test('T8 invalid dedupe state -> effect 0', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const result = await instance.dispatchTransport(validEnvelope(), validControl({ dedupe_state_class: 'DEDUPE_INVALID' }));
  assert.equal(result.outcome, 'TRANSPORT_NOT_ATTEMPTED_DEDUPE_STATE');
  assert.equal(effectCalls, 0, 'invalid dedupe state never invokes effect');
});

test('T9 synthetic ACCEPTED -> exact mapping, effect 1', async () => {
  let effectCalls = 0;
  let receivedEnvelope = null;
  let receivedControl = null;
  const { instance } = createAdapter(async (env, ctl) => {
    effectCalls += 1;
    receivedEnvelope = env;
    receivedControl = ctl;
    return 'ACCEPTED';
  });
  const control = validControl({ synthetic_effect_authorized: true });
  const result = await instance.dispatchTransport(validEnvelope(), control);
  assert.equal(result.outcome, 'TRANSPORT_EFFECT_ACCEPTED_SYNTHETIC');
  assert.equal(effectCalls, 1, 'synthetic seam invokes effect exactly once');
  assert.equal(receivedEnvelope.outcome_code, 'ORPHAN_SIGNAL_DETECTED');
  assert.equal(receivedControl.provider_class, 'PROVIDER_UNSELECTED');
  assert.equal(result.provider_selected, false);
  assert.equal(result.runtime_bound, false);
  assert.equal(result.secret_read, false);
  assert.equal(result.network_performed, false);
  assert.equal(result.persistence_performed, false);
  assert.equal(result.queue_performed, false);
  assert.equal(result.preview_effect_performed, false);
  assert.equal(result.production_effect_performed, false);
});

test('T10 synthetic REJECTED/TIMEOUT/UNAVAILABLE -> exact mapping, effect 1 each', async () => {
  const cases = [
    ['REJECTED', 'TRANSPORT_EFFECT_REJECTED_SYNTHETIC'],
    ['TIMEOUT', 'TRANSPORT_EFFECT_TIMEOUT_SYNTHETIC'],
    ['UNAVAILABLE', 'TRANSPORT_EFFECT_UNAVAILABLE_SYNTHETIC'],
  ];
  for (const [response, expected] of cases) {
    let effectCalls = 0;
    const { instance } = createAdapter(async () => { effectCalls += 1; return response; });
    const result = await instance.dispatchTransport(validEnvelope(), validControl({ synthetic_effect_authorized: true }));
    assert.equal(result.outcome, expected, response + ' must map to ' + expected);
    assert.equal(effectCalls, 1, response + ': effect invoked exactly once');
  }
});

test('T11 synthetic throw/rejection -> sanitized failure, effect 1, zero leakage', async () => {
  const secret = 'RAW_' + Math.random().toString(36).slice(2);
  let effectCalls = 0;
  const { instance } = createAdapter(async () => {
    effectCalls += 1;
    throw new Error(secret);
  });
  const result = await instance.dispatchTransport(validEnvelope(), validControl({ synthetic_effect_authorized: true }));
  assert.equal(result.outcome, 'TRANSPORT_EFFECT_FAILED_SANITIZED');
  assert.equal(effectCalls, 1, 'effect attempted once before sanitization');
  const json = JSON.stringify(result);
  assert.ok(!json.includes(secret), 'raw error must never leak');
  assert.ok(!json.includes('stack'), 'stack must never leak');
  assert.ok(!json.includes('Error'), 'Error text must never leak');
});

test('T12 synthetic seam unavailable through default posture', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  // Default posture: synthetic_effect_authorized absent (false).
  const r1 = await instance.dispatchTransport(validEnvelope(), validControl());
  assert.equal(r1.outcome, 'TRANSPORT_NOT_ATTEMPTED_PROVIDER_UNSELECTED');
  assert.equal(effectCalls, 0, 'synthetic seam must not fire without explicit authorization');
  // Even with the flag true but NO injected effect, effect count stays 0.
  const noEffect = loadAdapter().createAlertTransportAdapter({});
  const r2 = await noEffect.dispatchTransport(validEnvelope(), validControl({ synthetic_effect_authorized: true }));
  assert.equal(r2.outcome, 'TRANSPORT_NOT_ATTEMPTED_PROVIDER_UNSELECTED');
  assert.equal(r2.outcome.includes('SYNTHETIC'), false);
});

test('T13 maximum effect count exactly 1', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const control = validControl({ synthetic_effect_authorized: true });
  const result = await instance.dispatchTransport(validEnvelope(), control);
  assert.equal(effectCalls, 1, 'single dispatch invokes effect at most once');
  assert.equal(result.outcome, 'TRANSPORT_EFFECT_ACCEPTED_SYNTHETIC');
  await instance.dispatchTransport(validEnvelope(), control);
  assert.equal(effectCalls, 2, 'one effect invocation per dispatch');
});

test('T14 accessor/Proxy hostile input -> getter/trap count 0', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const control = validControl({ synthetic_effect_authorized: true });
  let getterCalls = 0;
  Object.defineProperty(control, 'release_sha', {
    enumerable: true,
    get() { getterCalls += 1; return VALID_RELEASE_SHA; },
  });
  const r1 = await instance.dispatchTransport(validEnvelope(), control);
  assert.equal(r1.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT');
  assert.equal(getterCalls, 0, 'accessor getter must never be invoked');
  const proxy = new Proxy({}, {
    getPrototypeOf() { throw new Error('SENTINEL_TRAP'); },
  });
  const r2 = await instance.dispatchTransport(validEnvelope(), proxy);
  assert.equal(r2.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT');
  const envProxy = new Proxy({}, {
    getPrototypeOf() { throw new Error('SENTINEL_TRAP'); },
  });
  const r3 = await instance.dispatchTransport(envProxy, validControl());
  assert.equal(r3.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT');
  const json = JSON.stringify([r1, r2, r3]);
  assert.ok(!json.includes('SENTINEL_TRAP'), 'trap value must never leak');
  assert.equal(effectCalls, 0, 'hostile input never reaches effect');
});

test('T15 input/result/export deeply frozen and detached', async () => {
  const { A, instance } = createAdapter(async () => 'ACCEPTED');
  assert.ok(Object.isFrozen(A));
  assert.ok(Object.isFrozen(A.ERROR_CODES));
  assert.ok(Object.isFrozen(A.TRANSPORT_RESULTS));
  assert.ok(Object.isFrozen(A.TRANSPORT_CONTROL_FIELDS));
  assert.ok(Object.isFrozen(instance));
  const result = await instance.dispatchTransport(validEnvelope(), validControl({ synthetic_effect_authorized: true }));
  assert.ok(Object.isFrozen(result));
  assert.throws(() => { result.outcome = 'BROKEN'; }, TypeError);
  // Detached: mutating the caller envelope never mutates the result/control snapshot.
  const input = validEnvelope();
  const r2 = await instance.dispatchTransport(input, validControl({ synthetic_effect_authorized: true }));
  const before = r2.release_sha;
  input.release_sha = 'c'.repeat(40);
  assert.equal(r2.release_sha, before, 'result is detached from caller input');
});

test('T16 same bounded input -> awaited byte-stable result', async () => {
  const { instance } = createAdapter(async () => 'ACCEPTED');
  const env = validEnvelope();
  const ctl = validControl({ synthetic_effect_authorized: true });
  const a = await instance.dispatchTransport(env, ctl);
  const b = await instance.dispatchTransport(validEnvelope(), validControl({ synthetic_effect_authorized: true }));
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'byte-stable awaited result');
});

test('T17 no network/env/filesystem/storage/queue/provider SDK capability in adapter', () => {
  const src = readAdapterSource();
  assert.ok(!/\bfetch\s*\(/.test(src), 'no fetch');
  assert.ok(!/new\s+XMLHttpRequest/.test(src), 'no XHR');
  assert.ok(!/WebSocket/.test(src), 'no websocket');
  assert.ok(!/child_process/.test(src), 'no child_process');
  assert.ok(!/require\(['"](?:https?|fs|net|dgram|child_process|http|https)/.test(src), 'no node capability require');
  assert.ok(!/\.writeFileSync\s*\(/.test(src), 'no filesystem write');
  assert.ok(!/process\.env/.test(src), 'no env read');
  assert.ok(!/localStorage/.test(src), 'no storage');
  assert.ok(!/sessionStorage/.test(src), 'no session storage');
  assert.ok(!/\bpg\b[\s\S]*connect/i.test(src), 'no DB connect');
  assert.ok(!/document\./.test(src), 'no DOM access');
  assert.ok(!/setTimeout/.test(src), 'no timers');
  assert.ok(!/setInterval/.test(src), 'no interval');
  assert.ok(!/PagerDuty/.test(src), 'no provider SDK');
  assert.ok(!/Slack/.test(src), 'no Slack SDK');
});

test('T18 invalid-input result carries provider-unselected truth', async () => {
  const { instance } = createAdapter(async () => 'ACCEPTED');
  const result = await instance.dispatchTransport(validEnvelope(), validControl({ release_sha: 'bad' }));
  assert.equal(result.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT');
  assert.equal(result.provider_selected, false);
  assert.equal(result.runtime_bound, false);
  assert.equal(result.network_performed, false);
  assert.equal(result.production_effect_performed, false);
});

test('T19 non-throwing producer boundary', async () => {
  let threw = false;
  let result;
  try {
    result = await createAdapter(async () => { throw new Error('boom'); }).instance.dispatchTransport(
      validEnvelope(),
      validControl({ synthetic_effect_authorized: true })
    );
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, false, 'producer boundary never throws');
  assert.equal(result.outcome, 'TRANSPORT_EFFECT_FAILED_SANITIZED');
});

test('T20 non-callable injected effect fails closed at creation', () => {
  const A = loadAdapter();
  assert.throws(() => A.createAlertTransportAdapter({ invokeTransport: 'not-a-function' }), /SYNTHETIC_EFFECT_NOT_CALLABLE/);
  assert.throws(() => A.createAlertTransportAdapter({ invokeTransport: 42 }), /SYNTHETIC_EFFECT_NOT_CALLABLE/);
});

test('T21 hostile thrown-object getter -> 0 reads at the deps boundary', () => {
  let messageReads = 0;
  const hostileThrown = {
    get message() { messageReads += 1; return 'SENTINEL_MESSAGE'; },
    get stack() { return 'SENTINEL_STACK'; },
    get cause() { return { sentinel: true }; },
  };
  const hostileDeps = new Proxy({}, {
    getPrototypeOf() { throw hostileThrown; },
  });
  assert.throws(
    () => loadAdapter().createAlertTransportAdapter(hostileDeps),
    /PROXY_OR_ACCESSOR_INPUT/,
    'hostile deps boundary fails closed with the fixed sanitized code'
  );
  assert.equal(messageReads, 0, 'thrown hostile object message getter must never be read');
});

test('T22 Proxy get trap -> 0 on envelope and control inputs', async () => {
  const { instance } = createAdapter(async () => 'ACCEPTED');
  let envelopeGetTrap = 0;
  const envProxy = new Proxy(validEnvelope(), {
    get(target, prop) { envelopeGetTrap += 1; return Reflect.get(target, prop); },
  });
  const r1 = await instance.dispatchTransport(envProxy, validControl({ synthetic_effect_authorized: true }));
  assert.equal(r1.outcome, 'TRANSPORT_EFFECT_ACCEPTED_SYNTHETIC');
  assert.equal(envelopeGetTrap, 0, 'envelope get trap must never fire (descriptor snapshot)');

  let controlGetTrap = 0;
  const ctlProxy = new Proxy(validControl({ synthetic_effect_authorized: true }), {
    get(target, prop) { controlGetTrap += 1; return Reflect.get(target, prop); },
  });
  const r2 = await instance.dispatchTransport(validEnvelope(), ctlProxy);
  assert.equal(r2.outcome, 'TRANSPORT_EFFECT_ACCEPTED_SYNTHETIC');
  assert.equal(controlGetTrap, 0, 'control get trap must never fire (descriptor reads)');
});

test('T23 effect receives deeply frozen detached control snapshot', async () => {
  let effectCalls = 0;
  let receivedControl = null;
  const { instance } = createAdapter(async (env, ctl) => {
    effectCalls += 1;
    receivedControl = ctl;
    return 'ACCEPTED';
  });
  const callerControl = validControl({ synthetic_effect_authorized: true });
  const result = await instance.dispatchTransport(validEnvelope(), callerControl);
  assert.equal(result.outcome, 'TRANSPORT_EFFECT_ACCEPTED_SYNTHETIC');
  assert.equal(effectCalls, 1);
  assert.ok(Object.isFrozen(receivedControl), 'effect must receive a frozen control snapshot');
  assert.equal(Object.isFrozen(callerControl), false, 'caller control object must NOT be frozen');
  // Detached: mutating the caller later must never mutate the received snapshot.
  const before = receivedControl.release_sha;
  callerControl.release_sha = 'c'.repeat(40);
  assert.equal(receivedControl.release_sha, before, 'received control is detached from caller');
  assert.equal(receivedControl.provider_class, 'PROVIDER_UNSELECTED');
});

test('T24 effect mutation attempts cannot alter result or leak private data', async () => {
  let effectCalls = 0;
  const mutationResults = [];
  const { instance } = createAdapter(async (env, ctl) => {
    effectCalls += 1;
    try { ctl.release_sha = 'x'.repeat(40); mutationResults.push('sha-mutated'); } catch (e) { mutationResults.push('sha-threw'); }
    try { ctl.secret_status = 'SECRET_VALUE'; mutationResults.push('secret-mutated'); } catch (e) { mutationResults.push('secret-threw'); }
    try { ctl.extra = 'PRIVATE'; mutationResults.push('extra-mutated'); } catch (e) { mutationResults.push('extra-threw'); }
    try { delete ctl.provider_class; mutationResults.push('deleted'); } catch (e) { mutationResults.push('delete-threw'); }
    return 'ACCEPTED';
  });
  const result = await instance.dispatchTransport(validEnvelope(), validControl({ synthetic_effect_authorized: true }));
  assert.equal(result.outcome, 'TRANSPORT_EFFECT_ACCEPTED_SYNTHETIC');
  assert.equal(effectCalls, 1);
  assert.deepEqual(
    mutationResults,
    ['sha-threw', 'secret-threw', 'extra-threw', 'delete-threw'],
    'every mutation attempt on the frozen snapshot must throw'
  );
  assert.equal(result.release_sha, VALID_RELEASE_SHA, 'result release_sha stays canonical');
  assert.equal(result.secret_status, 'NOT_REQUIRED_FOR_SOURCE_ADAPTER', 'no injected private value in result');
  assert.equal(result.provider_class, 'PROVIDER_UNSELECTED', 'provider_class cannot be deleted');
  const json = JSON.stringify(result);
  assert.ok(!json.includes('SECRET_VALUE'), 'injected private value must never leak');
  assert.ok(!json.includes('PRIVATE'), 'injected key must never leak');
});

test('T25 enum non-string object coercion -> 0 Symbol.toPrimitive/toString/valueOf calls', async () => {
  let effectCalls = 0;
  let coercionCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const coercingValue = {
    [Symbol.toPrimitive]() { coercionCalls += 1; return 'PROVIDER_UNSELECTED'; },
    toString() { coercionCalls += 1; return 'PROVIDER_UNSELECTED'; },
    valueOf() { coercionCalls += 1; return 'PROVIDER_UNSELECTED'; },
  };
  const enumFields = ['provider_class', 'runtime_binding', 'secret_status', 'retry_attempt_class', 'dedupe_state_class'];
  for (const field of enumFields) {
    const control = validControl({ synthetic_effect_authorized: true });
    control[field] = coercingValue;
    const r = await instance.dispatchTransport(validEnvelope(), control);
    assert.equal(r.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT', field + ' must reject non-string enum value');
  }
  assert.equal(coercionCalls, 0, 'Symbol.toPrimitive/toString/valueOf must never be invoked');
  assert.equal(effectCalls, 0, 'coerced enum must never reach the effect');
});

test('T26 enum Proxy get trap -> 0 on non-string enum values', async () => {
  let effectCalls = 0;
  let getTrapCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const enumProxy = new Proxy({}, {
    get(target, prop) { getTrapCalls += 1; return 'PROVIDER_UNSELECTED'; },
  });
  const enumFields = ['provider_class', 'runtime_binding', 'secret_status', 'retry_attempt_class', 'dedupe_state_class'];
  for (const field of enumFields) {
    const control = validControl({ synthetic_effect_authorized: true });
    control[field] = enumProxy;
    const r = await instance.dispatchTransport(validEnvelope(), control);
    assert.equal(r.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT', field + ' must reject proxy enum value');
  }
  assert.equal(getTrapCalls, 0, 'Proxy get trap must never fire on enum coercion');
  assert.equal(effectCalls, 0, 'proxy enum must never reach the effect');
});

test('T27 deps exact own-key schema (undefined/null/{}/{invokeTransport} only)', () => {
  const A = loadAdapter();
  const fn = async () => 'ACCEPTED';
  assert.doesNotThrow(() => A.createAlertTransportAdapter(undefined));
  assert.doesNotThrow(() => A.createAlertTransportAdapter(null));
  assert.doesNotThrow(() => A.createAlertTransportAdapter({}));
  assert.doesNotThrow(() => A.createAlertTransportAdapter({ invokeTransport: fn }));
  const rejected = [
    { invokeTransport: fn, token: 'x' },
    { invokeTransport: fn, endpoint: 'x' },
    { metadata: {} },
    { provider_id: 'x' },
    { unknown_key: 1 },
  ];
  for (const deps of rejected) {
    assert.throws(
      () => A.createAlertTransportAdapter(deps),
      /UNKNOWN_FIELD|PROXY_OR_ACCESSOR_INPUT/,
      'deps keys ' + JSON.stringify(Object.keys(deps)) + ' must be rejected at creation'
    );
  }
});

test('T28 deps inherited/non-enumerable/accessor/Proxy rejection with 0 getter/trap calls', () => {
  const A = loadAdapter();
  const fn = async () => 'ACCEPTED';
  // Inherited invokeTransport over a plain (non-null-rooted) prototype is
  // rejected by the plain-record gate.
  const inheritedPlain = Object.create({ invokeTransport: fn });
  assert.throws(() => A.createAlertTransportAdapter(inheritedPlain), /PROXY_OR_ACCESSOR_INPUT/);
  // Inherited invokeTransport over a null-rooted chain passes the plain-record
  // gate and must still be rejected by the prototype-chain probe.
  const root = Object.create(null);
  root.invokeTransport = fn;
  const inheritedNullRoot = Object.create(root);
  assert.throws(() => A.createAlertTransportAdapter(inheritedNullRoot), /UNKNOWN_FIELD/);
  // Non-enumerable own invokeTransport must be rejected.
  const nonEnum = {};
  Object.defineProperty(nonEnum, 'invokeTransport', { value: fn, enumerable: false });
  assert.throws(() => A.createAlertTransportAdapter(nonEnum), /UNKNOWN_FIELD/);
  // Accessor invokeTransport must be rejected WITHOUT invoking the getter.
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'invokeTransport', {
    enumerable: true,
    get() { getterCalls += 1; return fn; },
  });
  assert.throws(() => A.createAlertTransportAdapter(accessor), /PROXY_OR_ACCESSOR_INPUT/);
  assert.equal(getterCalls, 0, 'deps accessor getter must never be invoked');
  // Hostile Proxy must be rejected with zero reads of the thrown object.
  let messageReads = 0;
  const hostileThrown = {
    get message() { messageReads += 1; return 'SENTINEL_MESSAGE'; },
    get stack() { return 'SENTINEL_STACK'; },
  };
  const hostileDeps = new Proxy({}, { getPrototypeOf() { throw hostileThrown; } });
  assert.throws(() => A.createAlertTransportAdapter(hostileDeps), /PROXY_OR_ACCESSOR_INPUT/);
  assert.equal(messageReads, 0, 'hostile thrown-object message getter must never be read');
});

test('T29 invalid envelope contract version -> effect 0', async () => {
  let effectCalls = 0;
  const { instance } = createAdapter(async () => { effectCalls += 1; return 'ACCEPTED'; });
  const badVersions = ['2', '1.0', 'unknown', { toString: () => '1' }];
  for (const version of badVersions) {
    const env = validEnvelope();
    env.contract_version = version;
    const r = await instance.dispatchTransport(env, validControl({ synthetic_effect_authorized: true }));
    assert.equal(r.outcome, 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT', 'contract_version must be exactly "1"');
  }
  assert.equal(effectCalls, 0, 'invalid contract version never invokes the effect');
});
