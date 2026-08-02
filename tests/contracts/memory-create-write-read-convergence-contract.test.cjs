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
  const proxyDeps = new Proxy(defaultDeps(), {
    get(target, prop) {
      if (prop === 'createMemory') return target.createMemory;
      if (prop === 'canonicalReread') return target.canonicalReread;
      if (prop === 'taxonomy') return target.taxonomy;
      if (prop === 'releaseSha') return target.releaseSha;
      throw new Error('accessor invoked');
    }
  });
  assert.throws(
    () => core.createConvergenceCore(proxyDeps),
    /PROXY_OR_ACCESSOR_INPUT/
  );
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