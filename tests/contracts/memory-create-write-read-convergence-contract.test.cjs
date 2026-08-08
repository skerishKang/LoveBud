'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function createSandbox(extraGlobals) {
  const noopElement = {
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    dataset: {},
    value: '',
    addEventListener() {},
    removeEventListener() {},
    closest: () => null,
    contains: () => false,
    focus() {},
    getAttribute: () => '',
    setAttribute() {},
    removeAttribute() {}
  };
  return vm.createContext(Object.assign({
    console,
    setTimeout,
    window: Object.assign({
      apiClient: null,
      LoveBudEditorMemoryFormMode: {},
      LoveBudEditorMemoryFormPreview: {},
      LoveBudEditorMemoryFormTime: {},
      LoveBudEditorMemoryFormPayload: {}
    }, extraGlobals || {}),
    document: {
      getElementById: () => ({ ...noopElement }),
      querySelector: () => ({ ...noopElement }),
      addEventListener() {},
      removeEventListener() {}
    }
  }, extraGlobals || {}));
}

function validReleaseSha() {
  return 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';
}

function defaultTaxonomy() {
  const taxonomySource = read('js/observability/reliability-sentinel-taxonomy.js');
  const sandbox = createSandbox();
  vm.runInContext(taxonomySource, sandbox);
  return sandbox.window.LoveBudReliabilitySentinelTaxonomy;
}

function defaultDeps(overrides) {
   return Object.assign({
     createMemory: async () => ({ createdMemory: { id: 'mem-1' }, useApi: true }),
     canonicalReread: async () => ({ memories: [{ id: 'mem-1' }] }),
     taxonomy: defaultTaxonomy(),
     releaseSha: validReleaseSha(),
     observer: null
   }, overrides || {});
 }

function loadConvergenceCore() {
  const coreSource = read('js/observability/reliability-write-read-convergence-core.js');
  const sandbox = createSandbox();
  vm.runInContext(coreSource, sandbox);
  return sandbox.window.LoveBudWriteReadConvergenceCore;
}

test('convergence core module exposes createConvergenceCore', () => {
  const core = loadConvergenceCore();
  assert.equal(typeof core.createConvergenceCore, 'function');
  assert.equal(core.CONTRACT_VERSION, '1');
});

test('convergence core rejects missing createMemory dependency', () => {
  const core = loadConvergenceCore();
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ createMemory: undefined })),
    /MISSING_CREATE_DISPATCH/
  );
});

test('convergence core rejects non-callable createMemory', () => {
  const core = loadConvergenceCore();
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ createMemory: 'not-a-function' })),
    /CREATE_DISPATCH_NOT_CALLABLE/
  );
});

test('convergence core rejects null createMemory as missing dispatch', () => {
  const core = loadConvergenceCore();
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ createMemory: null })),
    /MISSING_CREATE_DISPATCH/
  );
});

test('convergence core rejects object createMemory as not callable', () => {
  const core = loadConvergenceCore();
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ createMemory: { not: 'a function' } })),
    /CREATE_DISPATCH_NOT_CALLABLE/
  );
});

test('convergence core rejects missing canonicalReread dependency', () => {
  const core = loadConvergenceCore();
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ canonicalReread: undefined })),
    /MISSING_CANONICAL_REREAD/
  );
});

test('convergence core rejects missing taxonomy dependency', () => {
  const core = loadConvergenceCore();
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ taxonomy: undefined })),
    /MISSING_TAXONOMY/
  );
});

test('convergence core rejects missing releaseSha', () => {
  const core = loadConvergenceCore();
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ releaseSha: undefined })),
    /MISSING_RELEASE_SHA/
  );
});

test('convergence core rejects invalid releaseSha', () => {
  const core = loadConvergenceCore();
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ releaseSha: 'not-a-valid-sha' })),
    /INVALID_RELEASE_SHA/
  );
});

test('convergence core rejects unknown input type', () => {
  const core = loadConvergenceCore();
  assert.throws(
    () => core.createConvergenceCore('not-an-object'),
    /UNKNOWN_INPUT/
  );
});

test('convergence core rejects Proxy/accessor input', () => {
  const core = loadConvergenceCore();
  // #3852 — the plain-record probe is getPrototypeOf-based (Object.prototype/
  // null only); a throwing getPrototypeOf Proxy is mapped to the fixed
  // PROXY_OR_ACCESSOR_INPUT code with zero raw leakage.
  const proxyDeps = new Proxy(defaultDeps(), {
    getPrototypeOf() { throw new Error('proxy getPrototypeOf invoked'); }
  });
  assert.throws(
    () => core.createConvergenceCore(proxyDeps),
    /PROXY_OR_ACCESSOR_INPUT/
  );
});

test('convergence core never invokes a Proxy get trap on dependencies', async () => {
  const core = loadConvergenceCore();
  let getterCount = 0;
  const proxyDeps = new Proxy(defaultDeps(), {
    get(target, prop) {
      getterCount += 1;
      return Reflect.get(target, prop);
    }
  });
  const convergence = core.createConvergenceCore(proxyDeps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, defaultTaxonomy().OUTCOME_CODES.CONFIRMED);
  assert.equal(getterCount, 0, 'dependency get traps must never be invoked');
});

test('convergence core rejects observer that is not callable', () => {
  const core = loadConvergenceCore();
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ observer: 'not-a-function' })),
    /OBSERVER_NOT_CALLABLE/
  );
});

test('converge dispatches createMemory exactly once', async () => {
  const core = loadConvergenceCore();
  let createCallCount = 0;
  const deps = defaultDeps({
    createMemory: async () => {
      createCallCount += 1;
      return { createdMemory: { id: 'mem-1' }, useApi: true };
    }
  });
  const convergence = core.createConvergenceCore(deps);
  await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(createCallCount, 1);
});

test('converge records PERSISTED_REREAD_CONFIRMED as final stage after successful create', async () => {
   const core = loadConvergenceCore();
   const taxonomy = defaultTaxonomy();
   const deps = defaultDeps({ taxonomy });
   const convergence = core.createConvergenceCore(deps);
   const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
   assert.equal(summary.stage, taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED);
 });

test('converge records PERSISTED_REREAD_CONFIRMED when identity found in reread', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({ taxonomy });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.stage, taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED);
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('successful flow emits stage sequence with SERVER_ACKNOWLEDGED exactly once', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const observedStages = [];
  const deps = defaultDeps({
    taxonomy,
    observer: (summary) => { observedStages.push(summary.stage); }
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.stage, taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED);
  assert.deepEqual(observedStages, [
    taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED,
    taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED,
    taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED
  ]);
  const serverAckCount = observedStages.filter(
    (s) => s === taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED
  ).length;
  assert.equal(serverAckCount, 1, 'SERVER_ACKNOWLEDGED must appear exactly once');
});

test('converge records ACKNOWLEDGED_REREAD_MISSING when identity absent from successful reread', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    canonicalReread: async () => ({ memories: [{ id: 'other-mem' }] })
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
});

test('converge records TRANSPORT_FAILED when createMemory throws', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => { throw new Error('network failure'); }
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.TRANSPORT_FAILED);
});

test('converge records ACKNOWLEDGEMENT_MISSING when create returns null', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => null
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING);
});

test('converge records ACKNOWLEDGEMENT_MISSING when create returns object without createdMemory', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => ({})
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING);
});

test('converge records ACKNOWLEDGEMENT_MISSING when createdMemory has no id', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => ({ createdMemory: { title: 'No ID' }, useApi: true })
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING);
});

test('converge records MONITORING_FAILED when canonicalReread throws', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    canonicalReread: async () => { throw new Error('reread failed'); }
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.MONITORING_FAILED);
});

test('converge records INSUFFICIENT_EVIDENCE when canonicalReread returns non-object', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    canonicalReread: async () => null
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.INSUFFICIENT_EVIDENCE);
});

test('converge records INSUFFICIENT_EVIDENCE when reread result has no memories array', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    canonicalReread: async () => ({})
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.INSUFFICIENT_EVIDENCE);
});

test('converge records ACKNOWLEDGEMENT_MISSING when payload is not a plain record', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({ taxonomy });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge(null);
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING);
});

test('observer receives sanitized summary without internal identity', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  let observerReceived = null;
  const deps = defaultDeps({
    taxonomy,
    observer: (summary) => {
      observerReceived = summary;
    }
  });
  const convergence = core.createConvergenceCore(deps);
  await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.ok(observerReceived, 'observer should have been called');
  assert.equal(observerReceived.operation_class, taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE);
  assert.equal(observerReceived.release_sha, validReleaseSha());
  assert.ok(!observerReceived.identity, 'internal identity must not leak');
  assert.ok(!observerReceived.createdMemory, 'createdMemory must not leak');
});

test('observer throw does not alter save result', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    observer: () => { throw new Error('observer failure'); }
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('observer throwing proxy does not alter save result', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const throwingProxy = new Proxy(function () {}, {
    apply() { throw new Error('proxy observer failure'); }
  });
  const deps = defaultDeps({ taxonomy, observer: throwingProxy });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('observer accessor getter is never invoked during validation', () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  let getterCallCount = 0;
  const deps = defaultDeps({ taxonomy });
  Object.defineProperty(deps, 'observer', {
    enumerable: true,
    configurable: true,
    get() {
      getterCallCount += 1;
      return null;
    }
  });
  assert.throws(
    () => core.createConvergenceCore(deps),
    /PROXY_OR_ACCESSOR_INPUT/
  );
  assert.equal(getterCallCount, 0, 'observer getter must not be invoked');
});

test('reread row id getter is never invoked for identity matching', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  let getterCallCount = 0;
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => ({ createdMemory: { id: 'mem-1' }, useApi: true }),
    canonicalReread: async () => ({
      memories: [{
        get id() { getterCallCount += 1; return 'mem-1'; }
      }]
    })
  });
  const convergence = core.createConvergenceCore(deps);
  await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(getterCallCount, 0, 'reread row id getter must not be invoked');
});

test('missing observer does not alter save result', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({ taxonomy, observer: null });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('stale earlier completion cannot overwrite later summary', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const createResolvers = [];
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => {
      await new Promise((resolve) => { createResolvers.push(resolve); });
      return { createdMemory: { id: 'mem-1' }, useApi: true };
    },
    canonicalReread: async (id) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { memories: [{ id }] };
    }
  });
  const convergence = core.createConvergenceCore(deps);
  const p1 = convergence.converge({ url: 'https://example.com', title: 'Test 1' });
  const p2 = convergence.converge({ url: 'https://example.com', title: 'Test 2' });
  createResolvers.forEach((resolve) => resolve());
  const [s1, s2] = await Promise.all([p1, p2]);
  assert.equal(s2.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(s1.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  const latest = convergence.getLatestSummary();
  assert.equal(latest, s2, 'latest summary must be from the second operation');
});

test('converge returns frozen and detached result', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({ taxonomy });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(Object.isFrozen(summary), true);
  const proto = Object.getPrototypeOf(summary);
  assert.ok(proto, 'summary must have a detached plain-object prototype');
  assert.equal(proto.constructor.prototype, proto, 'summary prototype must be the standard object prototype');
});

test('converge output contains only allowed bounded fields', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({ taxonomy });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  const allowed = [
    'operation_class', 'stage', 'outcome_code', 'release_sha',
    'latency_bucket', 'count_bucket', 'baseline_deviation',
    'severity', 'owner_action', 'evidence_completeness'
  ];
  const keys = Object.keys(summary);
  for (const key of keys) {
    assert.ok(allowed.includes(key), `unexpected key in summary: ${key}`);
  }
});

test('converge canonical JSON is byte-stable for equal inputs', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({ taxonomy });
  const convergence = core.createConvergenceCore(deps);
  const summary1 = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  const summary2 = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(JSON.stringify(summary1), JSON.stringify(summary2));
});

test('converge never issues a second write', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  let writeCount = 0;
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => {
      writeCount += 1;
      return { createdMemory: { id: 'mem-1' }, useApi: true };
    }
  });
  const convergence = core.createConvergenceCore(deps);
  await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(writeCount, 1);
});

test('converge never retries', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({ taxonomy });
  const convergence = core.createConvergenceCore(deps);
  await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(convergence.getLatestSummary().outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('converge raw identity never appears in public result', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({ taxonomy });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  const json = JSON.stringify(summary);
  assert.ok(!json.includes('mem-1'), 'internal identity must not appear in JSON');
});

test('converge raw error never appears in public result', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => { throw new Error('raw error with secret'); }
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  const json = JSON.stringify(summary);
  assert.ok(!json.includes('raw error with secret'), 'raw error must not appear in JSON');
});

test('converge missing release SHA maps to failure, not success', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ releaseSha: undefined })),
    /MISSING_RELEASE_SHA/
  );
});

test('converge unknown operation class is rejected', () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const badTaxonomy = Object.assign({}, taxonomy, { OPERATION_CLASSES: {} });
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ taxonomy: badTaxonomy })),
    /UNKNOWN_OPERATION_CLASS/
  );
});

test('converge existing form validation is preserved by observer boundary', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  let observerCalled = false;
  const deps = defaultDeps({
    taxonomy,
    observer: () => { observerCalled = true; }
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.ok(observerCalled, 'observer should have been called');
});

test('converge second POST by monitoring is zero', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  let createCallCount = 0;
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => {
      createCallCount += 1;
      return { createdMemory: { id: 'mem-1' }, useApi: true };
    }
  });
  const convergence = core.createConvergenceCore(deps);
  await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(createCallCount, 1, 'monitoring must never issue a second write');
});

test('converge count delta identity is not used', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => ({ createdMemory: { id: 'mem-1' }, useApi: true }),
    canonicalReread: async () => ({ memories: [{ id: 'mem-1' }, { id: 'mem-2' }] })
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('converge content/title identity is not used', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => ({ createdMemory: { id: 'mem-1', title: 'Test' }, useApi: true }),
    canonicalReread: async () => ({ memories: [{ id: 'mem-1', title: 'Different Title' }] })
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('converge failed reread treated as monitoring failure, not missing record', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    canonicalReread: async () => { throw new Error('reread transport failure'); }
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.MONITORING_FAILED);
});

test('converge observer exception does not block save', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    observer: () => { throw new Error('observer crash'); }
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('converge raw response is not leaked in summary', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => ({
      createdMemory: { id: 'mem-1', rawResponse: { secret: 'data' } },
      useApi: true
    })
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  const json = JSON.stringify(summary);
  assert.ok(!json.includes('rawResponse'), 'raw response must not leak');
  assert.ok(!json.includes('secret'), 'raw response data must not leak');
});

test('converge raw ID is not leaked in summary', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({ taxonomy });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  const json = JSON.stringify(summary);
  assert.ok(!json.includes('mem-1'), 'internal ID must not leak in JSON');
});

test('converge missing release SHA is not mapped to CONFIRMED', () => {
  const core = loadConvergenceCore();
  assert.throws(
    () => core.createConvergenceCore(defaultDeps({ releaseSha: '' })),
    /INVALID_RELEASE_SHA/
  );
});

test('converge stale result cannot overwrite latest', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const createResolvers = [];
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => {
      await new Promise((r) => { createResolvers.push(r); });
      return { createdMemory: { id: 'mem-1' }, useApi: true };
    },
    canonicalReread: async () => ({ memories: [{ id: 'mem-1' }] })
  });
  const convergence = core.createConvergenceCore(deps);
  const p1 = convergence.converge({ url: 'https://example.com', title: 'First' });
  const p2 = convergence.converge({ url: 'https://example.com', title: 'Second' });
  createResolvers.forEach((resolve) => resolve());
  const [s1, s2] = await Promise.all([p1, p2]);
  const latest = convergence.getLatestSummary();
  assert.equal(latest, s2, 'stale first result must not overwrite second');
});

test('converge acknowledgement alone is not mapped to CONFIRMED', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({
    taxonomy,
    canonicalReread: async () => ({ memories: [] })
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
  assert.notEqual(summary.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('converge getter invocation count is zero for internal identity', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  let getterCallCount = 0;
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => {
      const mem = {
        get id() { getterCallCount += 1; return 'mem-1'; }
      };
      return { createdMemory: mem, useApi: true };
    }
  });
  const convergence = core.createConvergenceCore(deps);
  await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(getterCallCount, 0, 'getter must not be invoked for identity extraction');
});

test('converge output is frozen and detached', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const deps = defaultDeps({ taxonomy });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(Object.isFrozen(summary), true);
  const proto = Object.getPrototypeOf(summary);
  assert.ok(proto, 'summary must have a detached plain-object prototype');
  assert.equal(proto.constructor.prototype, proto, 'summary prototype must be the standard object prototype');
  const json = JSON.stringify(summary);
  assert.ok(json.includes('CONFIRMED'), 'frozen output must serialize correctly');
});
/* ────────────────────────────────────────────────────────────────────────────
 * #3852 — Real production source integration (VM sandbox).
 * Executes the actual taxonomy, convergence core, editor data-loader, and
 * editor memory form save runtime with deterministic fake transports.
 * ──────────────────────────────────────────────────────────────────────────── */

function settleAsync() {
  return new Promise((resolve) => {
    setTimeout(() => setTimeout(resolve, 0), 0);
  });
}

function defaultFormDeps(overrides) {
  return Object.assign({
    i18n: (key) => key,
    treeId: 'tree-1',
    updateSaveStatus: () => {},
    showToast: () => {},
    nextMemoryId: () => 'local-mem-1',
    normalizeMemory: (m) => m,
    getTreeMemories: () => [],
    setTreeMemories: () => {},
    setLocalSaveMode: () => {},
    drawNode: () => {},
    drawBranch: () => {},
    calcPosition: () => ({}),
    updateSidebarStatus: () => {},
    updateFocusSelectedBtn: () => {},
    setDetailEmptyState: () => {},
    selectNode: () => {},
    treeMemories: () => [],
    setCachedMemories: () => {},
    rerenderCanvas: () => {},
    focusNodeById: () => {},
    getCanonicalRootId: () => 'root',
    editorDebugLog: () => {}
  }, overrides || {});
}

function loadRealEditorSandbox() {
  const sandbox = createSandbox();
  vm.runInContext(read('js/observability/reliability-sentinel-taxonomy.js'), sandbox);
  vm.runInContext(read('js/observability/reliability-write-read-convergence-core.js'), sandbox);
  vm.runInContext(read('js/editor/editor-data-loader.js'), sandbox);
  vm.runInContext(read('js/editor/editor-memory-form-save.js'), sandbox);
  return sandbox;
}

function loadDataLoaderSandbox() {
  const sandbox = createSandbox();
  vm.runInContext(read('js/editor/editor-data-loader.js'), sandbox);
  return sandbox;
}

function mockReleaseAuthorityReady() {
  const sha = validReleaseSha();
  return {
    getState: () => 'READY',
    getCurrent: () => ({ ok: true, releaseSha: sha }),
    whenReady: () => Promise.resolve({ ok: true, releaseSha: sha })
  };
}

function mockReleaseAuthorityUnavailable() {
  return {
    getState: () => 'UNAVAILABLE',
    getCurrent: () => ({ ok: false, code: 'RELEASE_SHA_UNAVAILABLE' }),
    whenReady: () => Promise.resolve({ ok: false, code: 'RELEASE_SHA_UNAVAILABLE' })
  };
}

test('core: taxonomy get traps never invoked during capture or converge', async () => {
  const core = loadConvergenceCore();
  let getterCount = 0;
  const proxyTaxonomy = new Proxy(defaultTaxonomy(), {
    get(target, prop) {
      getterCount += 1;
      return Reflect.get(target, prop);
    }
  });
  const convergence = core.createConvergenceCore(defaultDeps({ taxonomy: proxyTaxonomy }));
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(summary.outcome_code, defaultTaxonomy().OUTCOME_CODES.CONFIRMED);
  assert.equal(getterCount, 0, 'taxonomy get traps must never be invoked');
});

test('core: reread memories getter never invoked', async () => {
  const core = loadConvergenceCore();
  let getterCount = 0;
  const deps = defaultDeps({
    canonicalReread: async () => ({
      get memories() { getterCount += 1; return [{ id: 'mem-1' }]; }
    })
  });
  const convergence = core.createConvergenceCore(deps);
  const summary = await convergence.converge({ url: 'https://example.com', title: 'Test' });
  assert.equal(getterCount, 0, 'reread memories getter must not be invoked');
  assert.equal(summary.outcome_code, defaultTaxonomy().OUTCOME_CODES.INSUFFICIENT_EVIDENCE);
});

test('stale earlier completion is rejected and never reaches the observer', async () => {
  const core = loadConvergenceCore();
  const taxonomy = defaultTaxonomy();
  const events = [];
  const resolvers = [];
  const deps = defaultDeps({
    taxonomy,
    createMemory: async () => {
      const gate = new Promise((resolve) => { resolvers.push(resolve); });
      await gate;
      return { createdMemory: { id: 'mem-1' }, useApi: true };
    },
    canonicalReread: async () => ({ memories: [{ id: 'mem-1' }] }),
    observer: (summary) => { events.push(summary.outcome_code); }
  });
  const convergence = core.createConvergenceCore(deps);
  const p1 = convergence.converge({ url: 'https://example.com', title: 'First' });
  const p2 = convergence.converge({ url: 'https://example.com', title: 'Second' });
  resolvers[1](); // second operation completes first
  await p2;
  resolvers[0](); // first operation completes later (stale)
  await p1;
  const latest = convergence.getLatestSummary();
  assert.equal(latest.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  const confirmedEvents = events.filter((c) => c === taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(confirmedEvents.length, 1, 'only the latest completion may reach the observer');
});

test('real data-loader createCanonicalReread: missing treeId -> fixed authority-unavailable rejection', async () => {
  const sandbox = loadDataLoaderSandbox();
  const reread = sandbox.window.LoveBudEditorDataLoader.createCanonicalReread({
    treeId: null,
    apiClient: { getMemoriesByTree: async () => [] },
    normalizeMemory: (m) => m
  });
  await assert.rejects(() => reread('mem-1'), /CANONICAL_REREAD_AUTHORITY_UNAVAILABLE/);
});

test('real data-loader createCanonicalReread: missing apiClient -> fixed authority-unavailable rejection', async () => {
  const sandbox = loadDataLoaderSandbox();
  const reread = sandbox.window.LoveBudEditorDataLoader.createCanonicalReread({
    treeId: 'tree-1',
    apiClient: null,
    normalizeMemory: (m) => m
  });
  await assert.rejects(() => reread('mem-1'), /CANONICAL_REREAD_AUTHORITY_UNAVAILABLE/);
});

test('real data-loader createCanonicalReread: transport rejection -> fixed sanitized rejection', async () => {
  const sandbox = loadDataLoaderSandbox();
  const reread = sandbox.window.LoveBudEditorDataLoader.createCanonicalReread({
    treeId: 'tree-1',
    apiClient: { getMemoriesByTree: async () => { throw new Error('transport secret'); } },
    normalizeMemory: (m) => m
  });
  await assert.rejects(() => reread('mem-1'), /CANONICAL_REREAD_TRANSPORT_FAILED/);
});

test('real data-loader createCanonicalReread: malformed response -> fixed malformed result', async () => {
  const sandbox = loadDataLoaderSandbox();
  const reread = sandbox.window.LoveBudEditorDataLoader.createCanonicalReread({
    treeId: 'tree-1',
    apiClient: { getMemoriesByTree: async () => ({ not: 'an array' }) },
    normalizeMemory: (m) => m
  });
  const result = await reread('mem-1');
  assert.equal(result.malformed, true);
  assert.deepEqual(Object.keys(result), ['malformed']);
});

test('real data-loader createCanonicalReread: valid array -> filtered memories', async () => {
  const sandbox = loadDataLoaderSandbox();
  const reread = sandbox.window.LoveBudEditorDataLoader.createCanonicalReread({
    treeId: 'tree-1',
    apiClient: {
      getMemoriesByTree: async () => [
        { id: 'mem-1', treeId: 'tree-1' },
        { id: 'mem-2', treeId: 'tree-1' },
        { id: 'other-tree-mem', treeId: 'tree-2' }
      ]
    },
    normalizeMemory: (m) => m
  });
  const result = await reread('mem-1');
  assert.ok(Array.isArray(result.memories), 'memories must be an array');
  assert.deepEqual(result.memories.map((m) => m.id), ['mem-1', 'mem-2']);
});

test('real data-loader createCanonicalReread: valid empty array is authoritative success', async () => {
  const sandbox = loadDataLoaderSandbox();
  const reread = sandbox.window.LoveBudEditorDataLoader.createCanonicalReread({
    treeId: 'tree-1',
    apiClient: { getMemoriesByTree: async () => [] },
    normalizeMemory: (m) => m
  });
  const result = await reread('mem-1');
  assert.equal(Array.isArray(result.memories), true);
  assert.equal(result.memories.length, 0);
});

test('real Editor wiring: API success + reread confirmation -> CONFIRMED, exactly one write', async () => {
  const sandbox = loadRealEditorSandbox();
  const taxonomy = sandbox.window.LoveBudReliabilitySentinelTaxonomy;
  let createCalls = 0;
  let rereadCalls = 0;
  sandbox.window.apiClient = {
    createMemory: async (data) => { createCalls += 1; return { id: 'api-mem-1', ...data }; },
    getMemoriesByTree: async () => { rereadCalls += 1; return [{ id: 'api-mem-1', treeId: 'tree-1' }]; }
  };
  sandbox.window.LoveBudReleaseManifestAuthority = mockReleaseAuthorityReady();
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    convergenceObserver: (summary) => { observed.push(summary); }
  }));
  const result = await save.createMemoryWithFallback({ title: 'Test', treeId: 'tree-1', timestamp: '2026-01-01' });
  await settleAsync();
  assert.equal(createCalls, 1, 'API create must be exactly once');
  assert.equal(rereadCalls, 1, 'canonical reread must be exactly once');
  assert.equal(result.useApi, true);
  assert.equal(result.createdMemory.id, 'api-mem-1');
  const finalEvent = observed[observed.length - 1];
  assert.equal(finalEvent.stage, taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED);
  assert.equal(finalEvent.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
});

test('real Editor wiring: API rejection + local fallback -> TRANSPORT_FAILED monitoring, no reread', async () => {
  const sandbox = loadRealEditorSandbox();
  const taxonomy = sandbox.window.LoveBudReliabilitySentinelTaxonomy;
  let createCalls = 0;
  let rereadCalls = 0;
  sandbox.window.apiClient = {
    createMemory: async () => { createCalls += 1; throw new Error('network down'); },
    getMemoriesByTree: async () => { rereadCalls += 1; return []; }
  };
  sandbox.window.LoveBudReleaseManifestAuthority = mockReleaseAuthorityReady();
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    nextMemoryId: () => 'local-mem-1',
    convergenceObserver: (summary) => { observed.push(summary); }
  }));
  const result = await save.createMemoryWithFallback({ title: 'Test', timestamp: '2026-01-01' });
  await settleAsync();
  assert.equal(createCalls, 1, 'exactly one API write attempt');
  assert.equal(rereadCalls, 0, 'no canonical reread after transport failure');
  assert.equal(result.useApi, false);
  assert.equal(result.createdMemory.id, 'local-mem-1');
  const finalEvent = observed[observed.length - 1];
  assert.equal(finalEvent.stage, taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED);
  assert.equal(finalEvent.outcome_code, taxonomy.OUTCOME_CODES.TRANSPORT_FAILED);
  assert.notEqual(finalEvent.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
});

test('real Editor wiring: API client unavailable -> local fallback only, zero server writes', async () => {
  const sandbox = loadRealEditorSandbox();
  const taxonomy = sandbox.window.LoveBudReliabilitySentinelTaxonomy;
  sandbox.window.apiClient = null;
  sandbox.window.LoveBudReleaseManifestAuthority = mockReleaseAuthorityReady();
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    nextMemoryId: () => 'local-mem-1',
    convergenceObserver: (summary) => { observed.push(summary); }
  }));
  const result = await save.createMemoryWithFallback({ title: 'Test', timestamp: '2026-01-01' });
  await settleAsync();
  assert.equal(result.useApi, false);
  assert.equal(result.createdMemory.id, 'local-mem-1');
  const finalEvent = observed[observed.length - 1];
  assert.equal(finalEvent.stage, taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED);
  assert.equal(finalEvent.outcome_code, taxonomy.OUTCOME_CODES.TRANSPORT_FAILED);
});

test('real Editor wiring: reread transport rejection -> MONITORING_FAILED, UI keeps API success', async () => {
  const sandbox = loadRealEditorSandbox();
  const taxonomy = sandbox.window.LoveBudReliabilitySentinelTaxonomy;
  let createCalls = 0;
  let rereadCalls = 0;
  sandbox.window.apiClient = {
    createMemory: async (data) => { createCalls += 1; return { id: 'api-mem-1', ...data }; },
    getMemoriesByTree: async () => { rereadCalls += 1; throw new Error('reread transport failure'); }
  };
  sandbox.window.LoveBudReleaseManifestAuthority = mockReleaseAuthorityReady();
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    convergenceObserver: (summary) => { observed.push(summary); }
  }));
  const result = await save.createMemoryWithFallback({ title: 'Test', treeId: 'tree-1' });
  await settleAsync();
  assert.equal(createCalls, 1);
  assert.equal(rereadCalls, 1);
  assert.equal(result.useApi, true, 'UI result must keep API success');
  const finalEvent = observed[observed.length - 1];
  assert.equal(finalEvent.outcome_code, taxonomy.OUTCOME_CODES.MONITORING_FAILED);
  assert.notEqual(finalEvent.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
});

test('real Editor wiring: malformed reread -> INSUFFICIENT_EVIDENCE, UI keeps API success', async () => {
  const sandbox = loadRealEditorSandbox();
  const taxonomy = sandbox.window.LoveBudReliabilitySentinelTaxonomy;
  let createCalls = 0;
  let rereadCalls = 0;
  sandbox.window.apiClient = {
    createMemory: async (data) => { createCalls += 1; return { id: 'api-mem-1', ...data }; },
    getMemoriesByTree: async () => { rereadCalls += 1; return { not: 'an array' }; }
  };
  sandbox.window.LoveBudReleaseManifestAuthority = mockReleaseAuthorityReady();
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    convergenceObserver: (summary) => { observed.push(summary); }
  }));
  const result = await save.createMemoryWithFallback({ title: 'Test', treeId: 'tree-1' });
  await settleAsync();
  assert.equal(createCalls, 1);
  assert.equal(rereadCalls, 1);
  assert.equal(result.useApi, true);
  const finalEvent = observed[observed.length - 1];
  assert.equal(finalEvent.outcome_code, taxonomy.OUTCOME_CODES.INSUFFICIENT_EVIDENCE);
  assert.notEqual(finalEvent.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
});

test('real Editor wiring: valid empty reread -> ACKNOWLEDGED_REREAD_MISSING', async () => {
  const sandbox = loadRealEditorSandbox();
  const taxonomy = sandbox.window.LoveBudReliabilitySentinelTaxonomy;
  let createCalls = 0;
  let rereadCalls = 0;
  sandbox.window.apiClient = {
    createMemory: async (data) => { createCalls += 1; return { id: 'api-mem-1', ...data }; },
    getMemoriesByTree: async () => { rereadCalls += 1; return []; }
  };
  sandbox.window.LoveBudReleaseManifestAuthority = mockReleaseAuthorityReady();
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    convergenceObserver: (summary) => { observed.push(summary); }
  }));
  const result = await save.createMemoryWithFallback({ title: 'Test', treeId: 'tree-1' });
  await settleAsync();
  assert.equal(createCalls, 1);
  assert.equal(rereadCalls, 1);
  assert.equal(result.useApi, true);
  const finalEvent = observed[observed.length - 1];
  assert.equal(finalEvent.outcome_code, taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING);
});

test('real Editor wiring: release manifest unavailable -> monitoring safe skip, write exactly once', async () => {
  const sandbox = loadRealEditorSandbox();
  let createCalls = 0;
  let rereadCalls = 0;
  sandbox.window.apiClient = {
    createMemory: async (data) => { createCalls += 1; return { id: 'api-mem-1', ...data }; },
    getMemoriesByTree: async () => { rereadCalls += 1; return []; }
  };
  sandbox.window.LoveBudReleaseManifestAuthority = mockReleaseAuthorityUnavailable();
  let observerCalls = 0;
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    convergenceObserver: () => { observerCalls += 1; }
  }));
  const result = await save.createMemoryWithFallback({ title: 'Test', treeId: 'tree-1' });
  await settleAsync();
  assert.equal(createCalls, 1, 'save must not be blocked when release SHA unavailable');
  assert.equal(result.useApi, true);
  assert.equal(rereadCalls, 0);
  assert.equal(observerCalls, 0, 'monitoring must safe-skip when release SHA unavailable');
});

test('real Editor wiring: no raw error, memory id, tree id, or user content leaks', async () => {
  const sandbox = loadRealEditorSandbox();
  const consoleOut = [];
  sandbox.console = {
    warn: (...args) => { consoleOut.push(args.join(' ')); },
    error: (...args) => { consoleOut.push(args.join(' ')); },
    log: (...args) => { consoleOut.push(args.join(' ')); }
  };
  sandbox.window.apiClient = {
    createMemory: async () => { throw new Error('secret provider error'); }
  };
  sandbox.window.LoveBudReleaseManifestAuthority = mockReleaseAuthorityReady();
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    nextMemoryId: () => 'local-mem-1',
    convergenceObserver: (summary) => { observed.push(summary); }
  }));
  await save.createMemoryWithFallback({ title: 'Secret Memory Title', treeId: 'tree-1', timestamp: '2026-01-01' });
  await settleAsync();
  const summaryJson = JSON.stringify(observed);
  assert.ok(!summaryJson.includes('secret provider error'), 'raw API error must not appear in summary');
  assert.ok(!summaryJson.includes('Secret Memory Title'), 'memory content must not appear in summary');
  assert.ok(!summaryJson.includes('tree-1'), 'tree id must not appear in summary');
  assert.ok(!summaryJson.includes('local-mem-1'), 'memory id must not appear in summary');
  const consoleJoined = consoleOut.join('\n');
  assert.ok(!consoleJoined.includes('secret provider error'), 'raw error must not appear in console');
});

/* ── #3852/#3886 release manifest authority (real external source) ────────── */

function extractReleaseManifestAuthoritySource() {
  // #3886 — the release-manifest authority moved from the inline <script> block
  // to the external same-origin file js/observability/editor-release-manifest-authority.js
  // so the Editor HTML no longer carries an executable inline release authority.
  const source = read('js/observability/editor-release-manifest-authority.js');
  assert.ok(
    source.indexOf('window.LoveBudReleaseManifestAuthority') >= 0,
    'external authority must register window.LoveBudReleaseManifestAuthority'
  );
  return source;
}

test('release manifest authority (real editor.html source): single same-origin no-store fetch -> READY', async () => {
  const sha = validReleaseSha();
  const fetchCalls = [];
  const sandbox = createSandbox({
    fetch: (url, opts) => {
      fetchCalls.push({ url, opts });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ contract_version: '1', release_sha: sha }) });
    }
  });
  vm.runInContext(extractReleaseManifestAuthoritySource(), sandbox);
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  // #3852 — the single no-store fetch is lazy: it starts on the first
  // getCurrent() read so page load never issues a network request.
  const pending = authority.getCurrent();
  assert.equal(pending.ok, false, 'manifest is PENDING until the lazy fetch settles');
  assert.equal(pending.code, 'RELEASE_SHA_UNAVAILABLE');
  await settleAsync();
  const state = authority.getCurrent();
  assert.equal(state.ok, true);
  assert.equal(state.releaseSha, sha);
  assert.deepEqual(Object.keys(state), ['ok', 'releaseSha']);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(fetchCalls.length, 1, 'exactly one fetch per page');
  assert.equal(fetchCalls[0].url, '/.well-known/release.json');
  assert.equal(fetchCalls[0].opts.cache, 'no-store');
});

test('release manifest authority: invalid manifest -> UNAVAILABLE failure result', async () => {
  const sandbox = createSandbox({
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ contract_version: '2', release_sha: 'not-hex' }) })
  });
  vm.runInContext(extractReleaseManifestAuthoritySource(), sandbox);
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  authority.getCurrent(); // trigger the lazy fetch
  await settleAsync();
  const state = authority.getCurrent();
  assert.equal(state.ok, false);
  assert.equal(state.code, 'RELEASE_SHA_UNAVAILABLE');
});

test('release manifest authority: fetch rejection -> UNAVAILABLE without raw error output', async () => {
  const sandbox = createSandbox({
    fetch: () => Promise.reject(new Error('manifest secret failure'))
  });
  const consoleOut = [];
  sandbox.console = {
    warn: (...args) => { consoleOut.push(args.join(' ')); },
    error: (...args) => { consoleOut.push(args.join(' ')); },
    log: (...args) => { consoleOut.push(args.join(' ')); }
  };
  vm.runInContext(extractReleaseManifestAuthoritySource(), sandbox);
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  authority.getCurrent(); // trigger the lazy fetch
  await settleAsync();
  const state = authority.getCurrent();
  assert.equal(state.ok, false);
  assert.equal(state.code, 'RELEASE_SHA_UNAVAILABLE');
  assert.equal(consoleOut.join('\n').includes('manifest secret failure'), false, 'no raw error output');
});

test('release manifest authority external script loads before convergence core and form-save runtime in editor.html', () => {
  const html = read('pages/editor.html');
  const authSrc = 'editor-release-manifest-authority.js';
  const convergenceSrc = 'reliability-write-read-convergence-core.js';
  const saveSrc = 'editor-memory-form-save.js';
  const authIdx = html.indexOf(authSrc);
  const convergenceIdx = html.indexOf(convergenceSrc);
  const saveIdx = html.indexOf(saveSrc);
  assert.ok(authIdx >= 0, 'external release authority script reference must exist');
  assert.ok(convergenceIdx >= 0, 'convergence core script must exist');
  assert.ok(saveIdx >= 0, 'form-save script must exist');
  assert.ok(authIdx < convergenceIdx, 'release authority must load before the convergence core');
  assert.ok(authIdx < saveIdx, 'release authority must load before the form-save runtime');
});

/* ── #3886 CSP extraction: source-static boundary ─────────────────────────── */

test('#3886 source-static: targeted release-manifest inline block is absent from editor.html', () => {
  const html = read('pages/editor.html');
  assert.equal(
    html.indexOf('window.LoveBudReleaseManifestAuthority'),
    -1,
    'the release-manifest authority must no longer be an inline block in editor.html'
  );
  // The authority body may still be referenced by a bounded external script tag only.
  assert.ok(
    html.indexOf('editor-release-manifest-authority.js') >= 0,
    'external release authority script reference must exist'
  );
});

test('#3886 source-static: #3887 i18n dictionary extension is externalized (separate issue)', () => {
  const html = read('pages/editor.html');
  assert.equal(
    html.indexOf('window.i18nEditor = Object.assign(window.i18nEditor || {}, {'),
    -1,
    '#3887 i18n dictionary must no longer be an executable inline block in editor.html'
  );
  assert.ok(
    html.indexOf('js/i18n/i18n-editor-extension.js') >= 0,
    'the external i18n extension script reference must exist'
  );
  assert.ok(
    read('js/i18n/i18n-editor-extension.js').indexOf('window.i18nEditor') >= 0,
    'the external i18n extension must carry the dictionary registration'
  );
});

test('#3886 source-static: _headers is byte-identical to origin/main with no script unsafe-inline', () => {
  // Exact-main comparison: _headers must not have been modified by this branch.
  const headersContent = read('_headers');
  const { execSync, spawnSync } = require('node:child_process');
  // Detect whether origin/main is available (absent in shallow CI checkouts).
  // Only the baseline-equality check is conditional on the ref existing; the
  // CSP assertions below always run on the local _headers file.
  const refCheck = spawnSync(
    'git',
    ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'],
    { cwd: ROOT, encoding: 'utf8' }
  );
  if (refCheck.status === 0) {
    const baseline = execSync('git show origin/main:_headers', { cwd: ROOT, encoding: 'utf8' });
    assert.equal(headersContent, baseline, '_headers must be byte-identical to origin/main');
  } else {
    assert.equal(
      refCheck.status,
      1,
      'origin/main baseline check may be skipped only when the ref is genuinely absent'
    );
  }

  const cspLine = headersContent.split('\n').find((l) => l.indexOf('Content-Security-Policy') >= 0);
  assert.ok(cspLine, '_headers must define a Content-Security-Policy');
  // Only script-src is the authority seam for inline execution: style-src
  // legitimately carries a pre-existing 'unsafe-inline' and must stay untouched.
  const scriptSrc = cspLine.match(/script-src ([^;]+)/);
  assert.ok(scriptSrc, 'script-src directive must exist');
  assert.equal(
    scriptSrc[1].indexOf("'unsafe-inline'"),
    -1,
    'no unsafe-inline in script-src'
  );
  assert.equal(
    scriptSrc[1].trim(),
    "'self' https://www.gstatic.com https://apis.google.com",
    'script-src policy must be unchanged (no unsafe-inline, no nonce, no hash)'
  );
});

/* ── #3886 runtime executed-fake on the real external authority ──────────── */

function loadReleaseAuthoritySandbox(fetchImpl, extraGlobals) {
  const sandbox = createSandbox(Object.assign({ fetch: fetchImpl }, extraGlobals || {}));
  vm.runInContext(extractReleaseManifestAuthoritySource(), sandbox);
  return sandbox;
}

test('#3886 runtime: module load issues 0 fetches and stays PENDING', async () => {
  const fetchCalls = [];
  const sandbox = loadReleaseAuthoritySandbox((url, opts) => {
    fetchCalls.push({ url, opts });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ contract_version: '1', release_sha: validReleaseSha() }) });
  });
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  assert.equal(authority.getState(), 'PENDING', 'state is PENDING right after load');
  assert.equal(fetchCalls.length, 0, 'page load must issue zero fetches');
});

test('#3886 runtime: first read triggers exactly one no-store same-origin fetch to /release.json', async () => {
  const sha = validReleaseSha();
  const fetchCalls = [];
  const sandbox = loadReleaseAuthoritySandbox((url, opts) => {
    fetchCalls.push({ url, opts });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ contract_version: '1', release_sha: sha }) });
  });
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  authority.getCurrent(); // first read
  assert.equal(fetchCalls.length, 1, 'first read triggers exactly one fetch');
  assert.equal(fetchCalls[0].url, '/.well-known/release.json', 'endpoint is exactly /.well-known/release.json');
  assert.equal(fetchCalls[0].opts.cache, 'no-store', 'cache mode is no-store');
  assert.equal(fetchCalls[0].opts.credentials, 'same-origin', 'credentials are same-origin');
  await settleAsync();
  assert.equal(authority.getState(), 'READY');
  const ready = authority.getCurrent();
  assert.deepEqual(Object.keys(ready), ['ok', 'releaseSha']);
  assert.equal(ready.ok, true);
  assert.equal(ready.releaseSha, sha);
  assert.equal(authority.getCurrent().releaseSha, sha, 'repeated reads reuse the same result');
  assert.equal(fetchCalls.length, 1, 'still exactly one fetch after repeated reads');
});

test('#3886 runtime: concurrent reads share a single in-flight request', async () => {
  const fetchCalls = [];
  let resolveFetch;
  const gate = new Promise((res) => { resolveFetch = res; });
  const sandbox = loadReleaseAuthoritySandbox(() => {
    fetchCalls.push(1);
    return gate.then(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ contract_version: '1', release_sha: validReleaseSha() }) }));
  });
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  const p1 = authority.whenReady();
  const p2 = authority.whenReady();
  const p3 = authority.whenReady();
  assert.equal(fetchCalls.length, 1, 'three concurrent reads still issue exactly one fetch');
  resolveFetch();
  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
  assert.equal(r1.ok && r2.ok && r3.ok, true, 'all concurrent readers resolve to the same ready result');
  assert.equal(fetchCalls.length, 1, 'single in-flight request shared by all readers');
});

test('#3886 runtime: whenReady resolves immediately after terminal state without a new fetch', async () => {
  const fetchCalls = [];
  const sandbox = loadReleaseAuthoritySandbox((url, opts) => {
    fetchCalls.push(1);
    return Promise.reject(new Error('rejected'));
  });
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  authority.getCurrent(); // triggers the lazy fetch -> rejection -> UNAVAILABLE
  await settleAsync();
  assert.equal(authority.getState(), 'UNAVAILABLE');
  const r = await authority.whenReady();
  assert.equal(r.ok, false, 'whenReady terminal result is bounded failure');
  assert.equal(r.code, 'RELEASE_SHA_UNAVAILABLE');
  assert.deepEqual(Object.keys(r), ['ok', 'code']);
  assert.equal(fetchCalls.length, 1, 'whenReady after terminal state issues no new fetch');
});

test('#3886 runtime: malformed, missing-field, and extra-field manifests all fail closed to UNAVAILABLE', async () => {
  const manifestCases = [
    { name: 'malformed json', body: () => Promise.reject(new SyntaxError('bad json')) },
    { name: 'missing release_sha', body: () => Promise.resolve({ contract_version: '1' }) },
    { name: 'missing contract_version', body: () => Promise.resolve({ release_sha: validReleaseSha() }) },
    { name: 'extra field', body: () => Promise.resolve({ contract_version: '1', release_sha: validReleaseSha(), extra: 'x' }) },
    { name: 'wrong contract version', body: () => Promise.resolve({ contract_version: '2', release_sha: validReleaseSha() }) },
    { name: 'invalid sha', body: () => Promise.resolve({ contract_version: '1', release_sha: 'not-a-40-hex' }) },
    { name: 'non-ok response', body: () => Promise.resolve({ ok: false, json: () => Promise.resolve({ contract_version: '1', release_sha: validReleaseSha() }) }) },
    { name: 'missing response.json', body: () => Promise.resolve({ ok: true }) }
  ];
  for (const c of manifestCases) {
    const consoleOut = [];
    const sandbox = loadReleaseAuthoritySandbox(() => Promise.resolve({ ok: true, json: c.body }));
    sandbox.console = {
      warn: (...args) => consoleOut.push(args.join(' ')),
      error: (...args) => consoleOut.push(args.join(' ')),
      log: (...args) => consoleOut.push(args.join(' '))
    };
    const authority = sandbox.window.LoveBudReleaseManifestAuthority;
    authority.getCurrent();
    await settleAsync();
    assert.equal(authority.getState(), 'UNAVAILABLE', c.name + ': state must be UNAVAILABLE');
    const malformedResult = authority.getCurrent();
    assert.equal(malformedResult.ok, false, c.name + ': bounded failure result');
    assert.equal(malformedResult.code, 'RELEASE_SHA_UNAVAILABLE', c.name + ': fixed failure code');
    assert.deepEqual(Object.keys(malformedResult), ['ok', 'code'], c.name + ': bounded result shape');
    assert.equal(consoleOut.join('\\n').length, 0, c.name + ': no dynamic console output');
  }
});

test('#3886 runtime: fetch rejection yields UNAVAILABLE with zero raw error leakage', async () => {
  const consoleOut = [];
  const sandbox = loadReleaseAuthoritySandbox(() => Promise.reject(new Error('PRIVATE-TOKEN-LEAK-123')));
  sandbox.console = {
    warn: (...args) => consoleOut.push(args.join(' ')),
    error: (...args) => consoleOut.push(args.join(' ')),
    log: (...args) => consoleOut.push(args.join(' '))
  };
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  authority.getCurrent();
  await settleAsync();
  assert.equal(authority.getState(), 'UNAVAILABLE');
  assert.equal(consoleOut.join('\\n').includes('PRIVATE-TOKEN-LEAK-123'), false, 'raw error value never reaches console');
  assert.equal(JSON.stringify(authority.getCurrent()).includes('PRIVATE-TOKEN-LEAK-123'), false, 'raw error never in result');
});

test('#3886 runtime: no retry loop, no timers, and no storage persistence capability', async () => {
  const fetchCalls = [];
  let timerCalls = 0;
  const storageWrites = [];
  const storageProxy = new Proxy({}, {
    set(target, key, value) {
      storageWrites.push(String(key));
      target[key] = value;
      return true;
    }
  });
  const sandbox = loadReleaseAuthoritySandbox(() => {
    fetchCalls.push(1);
    return Promise.reject(new Error('down'));
  }, {
    setTimeout: () => { timerCalls += 1; return 0; },
    setInterval: () => { timerCalls += 1; return 0; },
    localStorage: storageProxy,
    sessionStorage: storageProxy
  });
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  authority.getCurrent(); // fetch -> rejected -> UNAVAILABLE
  await settleAsync();
  await settleAsync();
  assert.equal(authority.getState(), 'UNAVAILABLE');
  assert.equal(fetchCalls.length, 1, 'no automatic retry after rejection');
  assert.equal(timerCalls, 0, 'no setTimeout/setInterval capability used');
  assert.deepEqual(storageWrites, [], 'no localStorage/sessionStorage writes');

  // Source-static: the external file must not reference storage or timers at all.
  const source = read('js/observability/editor-release-manifest-authority.js');
  for (const forbidden of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'setTimeout', 'setInterval']) {
    assert.equal(source.includes(forbidden), false, 'source must not reference ' + forbidden);
  }
});

test('#3886 runtime: no external/private URL seam and no query/credential logging', async () => {
  const fetchCalls = [];
  const sandbox = loadReleaseAuthoritySandbox((url, opts) => {
    fetchCalls.push({ url, opts });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ contract_version: '1', release_sha: validReleaseSha() }) });
  });
  // Give the sandbox a hostile location with a private query string: the
  // authority must never read or log it (endpoint is hard-bound to the manifest).
  sandbox.window.location = { href: 'https://lovebud.pages.dev/pages/editor?token=PRIVATE-QUERY-VALUE#frag' };
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  authority.getCurrent();
  await settleAsync();
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, '/.well-known/release.json', 'endpoint is hard-bound same-origin; no arbitrary URL seam');
  const source = read('js/observability/editor-release-manifest-authority.js');
  assert.equal(source.includes('location.href'), false, 'source must not read window.location.href');
  assert.equal(JSON.stringify(authority.getCurrent()).includes('PRIVATE-QUERY-VALUE'), false, 'no query value in results');
});

/* ── #3852 first-save boundary (real editor.html authority + real runtime) ── */

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function loadFirstSaveSandbox(fetchImpl) {
  const sandbox = createSandbox({ fetch: fetchImpl });
  vm.runInContext(extractReleaseManifestAuthoritySource(), sandbox);
  vm.runInContext(read('js/observability/reliability-sentinel-taxonomy.js'), sandbox);
  vm.runInContext(read('js/observability/reliability-write-read-convergence-core.js'), sandbox);
  vm.runInContext(read('js/editor/editor-data-loader.js'), sandbox);
  vm.runInContext(read('js/editor/editor-memory-form-save.js'), sandbox);
  return sandbox;
}

test('first save: PENDING manifest + API pending -> REQUEST_DISPATCHED precedes API settle, final CONFIRMED with SHA', async () => {
  const sha = validReleaseSha();
  const manifestGate = createDeferred();
  const apiGate = createDeferred();
  let manifestResolved = false;
  const sandbox = loadFirstSaveSandbox(() =>
    manifestGate.promise.then(() => {
      manifestResolved = true;
      return { ok: true, json: () => Promise.resolve({ contract_version: '1', release_sha: sha }) };
    })
  );
  const taxonomy = sandbox.window.LoveBudReliabilitySentinelTaxonomy;
  let createCalls = 0;
  let rereadCalls = 0;
  sandbox.window.apiClient = {
    createMemory: () => {
      createCalls += 1;
      return apiGate.promise.then(() => ({ id: 'api-mem-1', treeId: 'tree-1' }));
    },
    getMemoriesByTree: async () => {
      rereadCalls += 1;
      return [{ id: 'api-mem-1', treeId: 'tree-1' }];
    }
  };
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    convergenceObserver: (summary) => { observed.push(summary); }
  }));
  const savePromise = save.createMemoryWithFallback({ title: 'Test', treeId: 'tree-1', timestamp: '2026-01-01' });

  // Both manifest and API are still pending here; monitoring started
  // synchronously at dispatch, so REQUEST_DISPATCHED must already be observed
  // while the transport has not settled.
  assert.equal(manifestResolved, false, 'manifest is still pending');
  assert.equal(createCalls, 1, 'API write dispatched exactly once');
  const dispatchEvents = observed.filter((s) => s.stage === taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED);
  assert.ok(dispatchEvents.length >= 1, 'REQUEST_DISPATCHED observed before API settlement');

  manifestGate.resolve();
  await settleAsync();
  apiGate.resolve();
  const result = await savePromise;
  await settleAsync();

  assert.equal(createCalls, 1, 'API create exactly once');
  assert.equal(rereadCalls, 1, 'canonical reread exactly once');
  assert.equal(result.useApi, true);
  assert.equal(result.createdMemory.id, 'api-mem-1');
  const finalEvent = observed[observed.length - 1];
  assert.equal(finalEvent.stage, taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED);
  assert.equal(finalEvent.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(finalEvent.release_sha, sha, 'final CONFIRMED must carry the valid release SHA');
});

test('first save: manifest resolves after the API -> UI completes on API ack alone, monitoring finalizes later', async () => {
  const sha = validReleaseSha();
  const manifestGate = createDeferred();
  const apiGate = createDeferred();
  const sandbox = loadFirstSaveSandbox(() =>
    manifestGate.promise.then(() => ({
      ok: true,
      json: () => Promise.resolve({ contract_version: '1', release_sha: sha })
    }))
  );
  const taxonomy = sandbox.window.LoveBudReliabilitySentinelTaxonomy;
  let createCalls = 0;
  let rereadCalls = 0;
  sandbox.window.apiClient = {
    createMemory: () => {
      createCalls += 1;
      return apiGate.promise.then(() => ({ id: 'api-mem-1', treeId: 'tree-1' }));
    },
    getMemoriesByTree: async () => { rereadCalls += 1; return [{ id: 'api-mem-1', treeId: 'tree-1' }]; }
  };
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    convergenceObserver: (summary) => { observed.push(summary); }
  }));
  const savePromise = save.createMemoryWithFallback({ title: 'Test', treeId: 'tree-1', timestamp: '2026-01-01' });
  assert.ok(
    observed.some((s) => s.stage === taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED),
    'REQUEST_DISPATCHED recorded before API settlement'
  );

  // UI completes on the API acknowledgement alone while the manifest is still
  // pending — the monitoring task never blocks the save result.
  apiGate.resolve();
  const result = await savePromise;
  assert.equal(result.useApi, true);
  assert.equal(result.createdMemory.id, 'api-mem-1');
  assert.equal(createCalls, 1, 'API create exactly once');
  assert.equal(
    observed.filter((s) => s.outcome_code === taxonomy.OUTCOME_CODES.CONFIRMED).length,
    0,
    'no CONFIRMED before the manifest resolves'
  );

  manifestGate.resolve();
  await settleAsync();
  assert.equal(rereadCalls, 1, 'canonical reread exactly once after readiness');
  const finalEvent = observed[observed.length - 1];
  assert.equal(finalEvent.stage, taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED);
  assert.equal(finalEvent.outcome_code, taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(finalEvent.release_sha, sha);
});

test('first save: manifest HTTP non-success (404) with valid JSON shape -> UNAVAILABLE, no CONFIRMED, write once', async () => {
  const sha = validReleaseSha();
  const sandbox = loadFirstSaveSandbox(() =>
    Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ contract_version: '1', release_sha: sha }) })
  );
  const taxonomy = sandbox.window.LoveBudReliabilitySentinelTaxonomy;
  let createCalls = 0;
  let rereadCalls = 0;
  sandbox.window.apiClient = {
    createMemory: async (data) => { createCalls += 1; return { id: 'api-mem-1', ...data }; },
    getMemoriesByTree: async () => { rereadCalls += 1; return [{ id: 'api-mem-1', treeId: 'tree-1' }]; }
  };
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    convergenceObserver: (summary) => { observed.push(summary); }
  }));
  const result = await save.createMemoryWithFallback({ title: 'Test', treeId: 'tree-1' });
  await settleAsync();
  assert.equal(createCalls, 1, 'save must not be blocked');
  assert.equal(rereadCalls, 0, 'reread must not run without a valid release SHA');
  assert.equal(result.useApi, true, 'save result keeps its existing semantics');
  assert.equal(
    observed.filter((s) => s.outcome_code === taxonomy.OUTCOME_CODES.CONFIRMED).length,
    0,
    'CONFIRMED must never be recorded without a valid SHA'
  );
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  assert.equal(authority.getState(), 'UNAVAILABLE');
});

test('release manifest authority: HTTP non-success with valid JSON shape -> never READY', async () => {
  const sha = validReleaseSha();
  const sandbox = createSandbox({
    fetch: () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ contract_version: '1', release_sha: sha }) })
  });
  vm.runInContext(extractReleaseManifestAuthoritySource(), sandbox);
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  authority.getCurrent(); // trigger the lazy fetch
  await settleAsync();
  assert.equal(authority.getState(), 'UNAVAILABLE');
  const state = authority.getCurrent();
  assert.equal(state.ok, false);
  assert.equal(state.code, 'RELEASE_SHA_UNAVAILABLE');
  const ready = await authority.whenReady();
  assert.equal(ready.ok, false);
});

test('release manifest authority: extra own field -> UNAVAILABLE (exact-key enforcement)', async () => {
  const sha = validReleaseSha();
  const sandbox = createSandbox({
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ contract_version: '1', release_sha: sha, extra: 'forbidden' }) })
  });
  vm.runInContext(extractReleaseManifestAuthoritySource(), sandbox);
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  authority.getCurrent(); // trigger the lazy fetch
  await settleAsync();
  assert.equal(authority.getState(), 'UNAVAILABLE');
  const state = authority.getCurrent();
  assert.equal(state.ok, false);
  assert.equal(state.code, 'RELEASE_SHA_UNAVAILABLE');
  const ready = await authority.whenReady();
  assert.equal(ready.ok, false);
});

test('release manifest authority: accessor own key -> UNAVAILABLE without invoking the getter', async () => {
  const sha = validReleaseSha();
  const manifest = {};
  let getterCalls = 0;
  Object.defineProperty(manifest, 'contract_version', {
    enumerable: true,
    get() { getterCalls += 1; return '1'; }
  });
  Object.defineProperty(manifest, 'release_sha', { enumerable: true, value: sha });
  const sandbox = createSandbox({
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) })
  });
  vm.runInContext(extractReleaseManifestAuthoritySource(), sandbox);
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  authority.getCurrent(); // trigger the lazy fetch
  await settleAsync();
  assert.equal(getterCalls, 0, 'manifest accessor getter must never run');
  assert.equal(authority.getState(), 'UNAVAILABLE');
});

test('release manifest authority: whenReady resolves a frozen bounded result sharing the single fetch', async () => {
  const sha = validReleaseSha();
  const fetchCalls = [];
  const sandbox = createSandbox({
    fetch: (url, opts) => {
      fetchCalls.push({ url, opts });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ contract_version: '1', release_sha: sha }) });
    }
  });
  vm.runInContext(extractReleaseManifestAuthoritySource(), sandbox);
  const authority = sandbox.window.LoveBudReleaseManifestAuthority;
  const pending = authority.getCurrent();
  assert.equal(pending.ok, false);
  assert.equal(pending.code, 'RELEASE_SHA_UNAVAILABLE');
  const ready = await authority.whenReady();
  assert.equal(ready.ok, true);
  assert.equal(ready.releaseSha, sha);
  assert.equal(Object.isFrozen(ready), true);
  assert.deepEqual(Object.keys(ready), ['ok', 'releaseSha']);
  assert.equal(authority.getState(), 'READY');
  assert.equal(fetchCalls.length, 1, 'whenReady shares the single in-flight fetch');
  assert.equal(fetchCalls[0].url, '/.well-known/release.json');
  assert.equal(fetchCalls[0].opts.cache, 'no-store');
  assert.equal(fetchCalls[0].opts.credentials, 'same-origin');
  assert.equal(fetchCalls[0].opts.headers.Accept, 'application/json');
});

/* ── #3852 cross-save stale observer gating (real Editor runtime) ────────── */

test('cross-save stale: overlapping saves share one generation guard (B final delivered once, late A final dropped)', async () => {
  const sandbox = loadRealEditorSandbox();
  const taxonomy = sandbox.window.LoveBudReliabilitySentinelTaxonomy;
  sandbox.window.LoveBudReleaseManifestAuthority = mockReleaseAuthorityReady();
  const apiGateA = createDeferred();
  const apiGateB = createDeferred();
  let createCalls = 0;
  let rereadCalls = 0;
  sandbox.window.apiClient = {
    createMemory: (data) => {
      createCalls += 1;
      const isA = createCalls === 1;
      const gate = isA ? apiGateA : apiGateB;
      const memId = isA ? 'api-mem-1' : 'api-mem-2';
      return gate.promise.then(() => ({ id: memId, treeId: 'tree-1' }));
    },
    getMemoriesByTree: async () => {
      rereadCalls += 1;
      return [{ id: 'api-mem-1', treeId: 'tree-1' }, { id: 'api-mem-2', treeId: 'tree-1' }];
    }
  };
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    nextMemoryId: () => 'local-mem-1',
    convergenceObserver: (summary) => { observed.push(summary); }
  }));

  // Two real saves through one Editor save runtime; each save creates its own
  // convergence core — only the shared generation guard can gate across them.
  const saveAPromise = save.createMemoryWithFallback({ title: 'A', treeId: 'tree-1', timestamp: '2026-01-01' });
  const saveBPromise = save.createMemoryWithFallback({ title: 'B', treeId: 'tree-1', timestamp: '2026-01-01' });
  assert.equal(createCalls, 2, 'two saves, exactly one API write each');
  assert.ok(
    observed.some((s) => s.stage === taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED),
    'A REQUEST_DISPATCHED before B starts is allowed and delivered'
  );

  // B completes first: API resolve -> canonical reread -> CONFIRMED delivered once.
  apiGateB.resolve();
  await settleAsync();
  const resultB = await saveBPromise;
  assert.equal(resultB.useApi, true);
  assert.equal(resultB.createdMemory.id, 'api-mem-2');
  const confirmedBeforeA = observed.filter((s) => s.outcome_code === taxonomy.OUTCOME_CODES.CONFIRMED);
  assert.equal(confirmedBeforeA.length, 1, 'B final CONFIRMED delivered exactly once');
  assert.equal(confirmedBeforeA[0].release_sha, validReleaseSha());

  // A completes late: its final must be dropped (A is no longer the latest save).
  apiGateA.resolve();
  const resultA = await saveAPromise;
  await settleAsync();
  assert.equal(resultA.useApi, true);
  assert.equal(resultA.createdMemory.id, 'api-mem-1');
  assert.equal(createCalls, 2, 'no second write per save');
  assert.equal(rereadCalls, 2, 'one canonical reread per successful save');
  assert.equal(
    observed.filter((s) => s.outcome_code === taxonomy.OUTCOME_CODES.CONFIRMED).length,
    1,
    'stale A final CONFIRMED must not be delivered'
  );
  assert.equal(
    observed.filter((s) => s.stage === taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED).length,
    1,
    'stale A SERVER_ACKNOWLEDGED event after B start must not be delivered'
  );
});

test('cross-save stale: A transport failure after B confirmed -> stale TRANSPORT_FAILED dropped, B final kept, A fallback intact', async () => {
  const sandbox = loadRealEditorSandbox();
  const taxonomy = sandbox.window.LoveBudReliabilitySentinelTaxonomy;
  sandbox.window.LoveBudReleaseManifestAuthority = mockReleaseAuthorityReady();
  const apiGateA = createDeferred();
  const apiGateB = createDeferred();
  const consoleOut = [];
  sandbox.console = {
    warn: (...args) => { consoleOut.push(args.join(' ')); },
    error: (...args) => { consoleOut.push(args.join(' ')); },
    log: (...args) => { consoleOut.push(args.join(' ')); }
  };
  let createCalls = 0;
  let rereadCalls = 0;
  sandbox.window.apiClient = {
    createMemory: (data) => {
      createCalls += 1;
      if (createCalls === 1) {
        return apiGateA.promise.then(() => { throw new Error('A transport secret'); });
      }
      return apiGateB.promise.then(() => ({ id: 'api-mem-2', treeId: 'tree-1' }));
    },
    getMemoriesByTree: async () => {
      rereadCalls += 1;
      return [{ id: 'api-mem-2', treeId: 'tree-1' }];
    }
  };
  const observed = [];
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({
    nextMemoryId: () => 'local-mem-1',
    convergenceObserver: (summary) => { observed.push(summary); }
  }));

  const saveAPromise = save.createMemoryWithFallback({ title: 'A', treeId: 'tree-1', timestamp: '2026-01-01' });
  const saveBPromise = save.createMemoryWithFallback({ title: 'B', treeId: 'tree-1', timestamp: '2026-01-01' });
  assert.equal(createCalls, 2);

  apiGateB.resolve();
  await settleAsync();
  const resultB = await saveBPromise;
  assert.equal(resultB.useApi, true);
  assert.equal(
    observed.filter((s) => s.outcome_code === taxonomy.OUTCOME_CODES.CONFIRMED).length,
    1,
    'B final CONFIRMED delivered exactly once'
  );

  apiGateA.resolve();
  const resultA = await saveAPromise;
  await settleAsync();
  assert.equal(resultA.useApi, false, 'A local fallback preserved');
  assert.equal(resultA.createdMemory.id, 'local-mem-1');
  assert.equal(
    observed.filter((s) => s.outcome_code === taxonomy.OUTCOME_CODES.TRANSPORT_FAILED).length,
    0,
    'stale A TRANSPORT_FAILED observer event must be dropped'
  );
  assert.equal(createCalls, 2, 'one write per save');
  assert.equal(rereadCalls, 1, 'only B performed the canonical reread');
  assert.ok(
    !consoleOut.join('\n').includes('A transport secret'),
    'raw A error must not leak to console'
  );
});

test('cross-save stale: no observer injected -> generation guard active, saves unchanged, one write each', async () => {
  const sandbox = loadRealEditorSandbox();
  sandbox.window.LoveBudReleaseManifestAuthority = mockReleaseAuthorityReady();
  const apiGateA = createDeferred();
  const apiGateB = createDeferred();
  let createCalls = 0;
  sandbox.window.apiClient = {
    createMemory: (data) => {
      createCalls += 1;
      const isA = createCalls === 1;
      const gate = isA ? apiGateA : apiGateB;
      const memId = isA ? 'api-mem-1' : 'api-mem-2';
      return gate.promise.then(() => ({ id: memId, treeId: 'tree-1' }));
    },
    getMemoriesByTree: async () => [{ id: 'api-mem-1', treeId: 'tree-1' }, { id: 'api-mem-2', treeId: 'tree-1' }]
  };
  // No convergenceObserver is injected (defaultFormDeps does not provide one).
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultFormDeps({ nextMemoryId: () => 'local-mem-1' }));

  const saveAPromise = save.createMemoryWithFallback({ title: 'A', treeId: 'tree-1', timestamp: '2026-01-01' });
  const saveBPromise = save.createMemoryWithFallback({ title: 'B', treeId: 'tree-1', timestamp: '2026-01-01' });
  assert.equal(createCalls, 2, 'one write per save without an observer');
  apiGateB.resolve();
  const resultB = await saveBPromise;
  assert.equal(resultB.useApi, true);
  assert.equal(resultB.createdMemory.id, 'api-mem-2');
  apiGateA.resolve();
  const resultA = await saveAPromise;
  assert.equal(resultA.useApi, true);
  assert.equal(resultA.createdMemory.id, 'api-mem-1');
  assert.equal(createCalls, 2, 'no second write per save without an observer');
});

/* ── #3887 Editor i18n CSP externalization (real external source) ─────────── */

const I18N_EXTENSION_EXPECTED = {
  editor_sidebar_public_tree: { ko: '공개', en: 'Public' },
  editor_sidebar_private_tree: { ko: '비공개', en: 'Private' },
  detail_empty_title: { ko: '아직 선택한 순간이 없어요', en: 'No moment selected yet.' },
  detail_empty_desc: { ko: '첫 순간은 가운데에서 시작하세요.', en: 'Start the first moment from the canvas.' },
  editor_current_moment_empty_title: { ko: '아직 선택한 순간이 없어요', en: 'No moment selected yet.' },
  editor_current_moment_empty_hint: { ko: '첫 순간은 가운데 캔버스에서 시작하세요.', en: 'Start the first moment from the center canvas.' }
};

function extractI18nExtensionSource() {
  const source = read('js/i18n/i18n-editor-extension.js');
  assert.ok(
    source.indexOf('window.i18nEditor = Object.assign(window.i18nEditor || {}, {') >= 0,
    'external i18n extension must register via Object.assign on window.i18nEditor'
  );
  return source;
}

function loadI18nExtensionSandbox(extraGlobals) {
  const sandbox = createSandbox(extraGlobals || {});
  vm.runInContext(extractI18nExtensionSource(), sandbox);
  return sandbox;
}

test('#3887 source-static: editor.html no longer carries the executable i18n inline dictionary', () => {
  const html = read('pages/editor.html');
  const inlineI18n = html.match(/window\.i18nEditor\s*=\s*Object\.assign\(window\.i18nEditor \|\| \{\}, \{/);
  assert.equal(inlineI18n, null, 'the i18n dictionary must not remain as an inline block in editor.html');
});

test('#3887 source-static: external extension script is same-origin and sits in the i18n directory', () => {
  const html = read('pages/editor.html');
  const ref = html.match(/<script[^>]*src=["']([^"']*i18n-editor-extension\.js[^"']*)["'][^>]*><\/script>/);
  assert.ok(ref, 'external i18n extension script reference must exist in editor.html');
  const src = ref[1];
  assert.equal(src.indexOf('http://'), -1, 'extension must not be an absolute http URL');
  assert.equal(src.indexOf('https://'), -1, 'extension must not be an absolute https URL');
  assert.ok(src.indexOf('js/i18n/i18n-editor-extension.js') >= 0, 'extension must be the same-origin js/i18n path');
  assert.ok(fs.existsSync(path.join(ROOT, 'js/i18n/i18n-editor-extension.js')), 'extension file must exist on disk');
});

test('#3887 source-static: exactly the six targeted keys appear exactly once in the extension', () => {
  const source = extractI18nExtensionSource();
  const keys = Object.keys(I18N_EXTENSION_EXPECTED);
  assert.equal(keys.length, 6, 'exactly six targeted keys');
  const allKeyOccurrences = source.match(/editor_sidebar_public_tree|editor_sidebar_private_tree|detail_empty_title|detail_empty_desc|editor_current_moment_empty_title|editor_current_moment_empty_hint/g) || [];
  assert.equal(allKeyOccurrences.length, 6, 'each of the six keys must appear exactly once in the extension source');
  for (const key of keys) {
    assert.equal(
      (source.match(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
      1,
      key + ' must appear exactly once'
    );
  }
  assert.equal(
    (source.match(/[a-z_]+:\s*\{\s*ko:/g) || []).length,
    6,
    'no extra dictionary keys beyond the six targeted keys'
  );
});

test('#3887 source-static: Korean and English values are preserved byte-for-byte', () => {
  const source = extractI18nExtensionSource();
  for (const key of Object.keys(I18N_EXTENSION_EXPECTED)) {
    const expected = I18N_EXTENSION_EXPECTED[key];
    assert.ok(
      source.indexOf(key + ': { ko: "' + expected.ko + '", en: "' + expected.en + '" }') >= 0 ||
        source.indexOf(key + ': {\n    ko: "' + expected.ko + '",\n    en: "' + expected.en + '",\n  }') >= 0 ||
        source.indexOf('ko: "' + expected.ko + '"') >= 0,
      key + ' must keep the exact Korean value'
    );
    assert.ok(source.indexOf('en: "' + expected.en + '"') >= 0, key + ' must keep the exact English value');
  }
});

test('#3887 source-static: shared js/i18n/i18n-editor.js is untouched and keeps its conflicting values', () => {
  const shared = read('js/i18n/i18n-editor.js');
  assert.ok(shared.indexOf("'detail_empty_title':{ko:'첫 순간이 트리를 깨워요'") >= 0, 'shared detail_empty_title value must be unchanged');
  assert.ok(shared.indexOf("'detail_empty_desc':{ko:'첫 순간을 남기면 여기에 열려요.'") >= 0, 'shared detail_empty_desc value must be unchanged');
  assert.ok(shared.indexOf("editor_current_moment_empty_title: { ko: '순간 감상', en: 'Moment view' }") >= 0, 'shared current-moment title value must be unchanged');
  assert.ok(shared.indexOf("editor_current_moment_empty_hint: { ko: '선택한 순간을 여기서 감상할 수 있어요.'") >= 0, 'shared current-moment hint value must be unchanged');
});

test('#3887 source-static: script order is i18n-editor.js -> extension -> consumers', () => {
  const html = read('pages/editor.html');
  const editorIdx = html.indexOf('js/i18n/i18n-editor.js');
  const extIdx = html.indexOf('js/i18n/i18n-editor-extension.js');
  const scoutIdx = html.indexOf('js/i18n/i18n-scout.js');
  const myTreesIdx = html.indexOf('js/i18n/i18n-my-trees.js');
  const indexIdx = html.indexOf('js/i18n/i18n-index.js');
  const i18nIdx = html.indexOf('js/i18n.js');
  assert.ok(editorIdx >= 0, 'i18n-editor.js must be referenced');
  assert.ok(extIdx >= 0, 'i18n-editor-extension.js must be referenced');
  assert.ok(myTreesIdx >= 0, 'i18n-my-trees.js must be referenced');
  assert.ok(indexIdx >= 0, 'i18n-index.js must be referenced');
  assert.ok(i18nIdx >= 0, 'i18n.js must be referenced');
  assert.ok(editorIdx < extIdx, 'i18n-editor.js must load before the extension');
  assert.ok(extIdx < myTreesIdx, 'extension must load before i18n-my-trees.js');
  assert.ok(extIdx < indexIdx, 'extension must load before i18n-index.js');
  assert.ok(extIdx < i18nIdx, 'extension must load before i18n.js');
  assert.ok(scoutIdx >= 0, 'i18n-scout.js must be referenced');
  assert.ok(extIdx < scoutIdx, 'extension must load before i18n-scout.js');
});

function assertI18nValueMatches(actual, expected, label) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), label + ' must expose exactly ko/en keys');
  assert.equal(actual.ko, expected.ko, label + ' ko value');
  assert.equal(actual.en, expected.en, label + ' en value');
}

test('#3887 runtime: extension creates window.i18nEditor when absent with exact six values', () => {
  const sandbox = loadI18nExtensionSandbox();
  assert.ok(sandbox.window.i18nEditor, 'window.i18nEditor must be created when absent');
  for (const key of Object.keys(I18N_EXTENSION_EXPECTED)) {
    assertI18nValueMatches(sandbox.window.i18nEditor[key], I18N_EXTENSION_EXPECTED[key], key);
  }
});

test('#3887 runtime: extension overrides existing conflicting keys and preserves unrelated keys', () => {
  const existing = {
    editor_sidebar_public_tree: { ko: 'OLD 공개', en: 'OLD Public' },
    some_unrelated_key: { ko: '유지', en: 'kept' },
    another_key: 'plain-value'
  };
  const sandbox = createSandbox();
  sandbox.window.i18nEditor = existing;
  vm.runInContext(extractI18nExtensionSource(), sandbox);
  const result = sandbox.window.i18nEditor;
  assert.equal(result.some_unrelated_key, existing.some_unrelated_key, 'unrelated object key must be preserved');
  assert.equal(result.another_key, 'plain-value', 'unrelated non-object value must be preserved');
  assertI18nValueMatches(result.editor_sidebar_public_tree, I18N_EXTENSION_EXPECTED.editor_sidebar_public_tree, 'conflicting key must be overridden');
  for (const key of Object.keys(I18N_EXTENSION_EXPECTED)) {
    assertI18nValueMatches(result[key], I18N_EXTENSION_EXPECTED[key], key);
  }
});

test('#3887 runtime: extension has zero side effects (no fetch, storage, timers, logging)', () => {
  const fetchCalls = [];
  const storageWrites = [];
  const consoleOut = [];
  let timerCalls = 0;
  const storageProxy = new Proxy({}, {
    set(target, key, value) {
      storageWrites.push(String(key));
      target[key] = value;
      return true;
    }
  });
  const sandbox = createSandbox({
    fetch: (url) => { fetchCalls.push(url); return Promise.resolve({}); },
    setTimeout: () => { timerCalls += 1; return 0; },
    setInterval: () => { timerCalls += 1; return 0; },
    localStorage: storageProxy,
    sessionStorage: storageProxy
  });
  sandbox.console = {
    warn: (...args) => { consoleOut.push(args.join(' ')); },
    error: (...args) => { consoleOut.push(args.join(' ')); },
    log: (...args) => { consoleOut.push(args.join(' ')); }
  };
  vm.runInContext(extractI18nExtensionSource(), sandbox);
  assert.deepEqual(fetchCalls, [], 'extension must issue zero fetches');
  assert.equal(timerCalls, 0, 'extension must schedule zero timers');
  assert.deepEqual(storageWrites, [], 'extension must write zero storage keys');
  assert.equal(consoleOut.length, 0, 'extension must emit zero console output');
  const source = read('js/i18n/i18n-editor-extension.js');
  for (const forbidden of ['fetch', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'setTimeout', 'setInterval', 'console']) {
    assert.equal(source.includes(forbidden), false, 'extension source must not reference ' + forbidden);
  }
});
