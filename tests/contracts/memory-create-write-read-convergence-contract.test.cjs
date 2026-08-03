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
  return { getCurrent: () => ({ ok: true, releaseSha: validReleaseSha() }) };
}

function mockReleaseAuthorityUnavailable() {
  return { getCurrent: () => ({ ok: false, code: 'RELEASE_SHA_UNAVAILABLE' }) };
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

/* ── #3852 release manifest authority (real pages/editor.html source) ────── */

function extractReleaseManifestAuthoritySource() {
  const html = read('pages/editor.html');
  const marker = 'window.LoveBudReleaseManifestAuthority';
  const start = html.indexOf(marker);
  assert.ok(start >= 0, 'editor.html must register window.LoveBudReleaseManifestAuthority');
  const scriptStart = html.lastIndexOf('<script>', start);
  const scriptEnd = html.indexOf('</script>', start);
  assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, 'release authority must live in an inline script');
  return html.slice(scriptStart + '<script>'.length, scriptEnd);
}

test('release manifest authority (real editor.html source): single same-origin no-store fetch -> READY', async () => {
  const sha = validReleaseSha();
  const fetchCalls = [];
  const sandbox = createSandbox({
    fetch: (url, opts) => {
      fetchCalls.push({ url, opts });
      return Promise.resolve({ json: () => Promise.resolve({ contract_version: '1', release_sha: sha }) });
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
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ contract_version: '2', release_sha: 'not-hex' }) })
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

test('release manifest authority registered before the form-save runtime in editor.html', () => {
  const html = read('pages/editor.html');
  const authIdx = html.indexOf('window.LoveBudReleaseManifestAuthority');
  const saveIdx = html.indexOf('editor-memory-form-save.js');
  assert.ok(authIdx >= 0, 'release authority must be registered');
  assert.ok(saveIdx >= 0, 'form-save script must exist');
  assert.ok(authIdx < saveIdx, 'release authority must register before the form-save runtime');
});
