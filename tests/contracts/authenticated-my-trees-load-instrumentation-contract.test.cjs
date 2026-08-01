'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const taxonomySrc = fs.readFileSync(path.join(ROOT, 'js', 'observability', 'journey-outcome-taxonomy.js'), 'utf8');
const myTreesDataSrc = fs.readFileSync(path.join(ROOT, 'js', 'my-trees', 'my-trees-data.js'), 'utf8');
const myTreesPageSrc = fs.readFileSync(path.join(ROOT, 'js', 'my-trees', 'my-trees-page.js'), 'utf8');
const myTreesSrc = fs.readFileSync(path.join(ROOT, 'js', 'my-trees.js'), 'utf8');

function makeNode(id) {
  const listeners = {};
  return {
    id,
    hidden: false,
    dataset: {},
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(...c) { c.forEach(x => this.classes.delete(x)); },
      contains(c) { return this.classes.has(c); }
    },
    style: { display: '' },
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    removeAttribute(k) { delete this.attributes[k]; },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    addEventListener(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    dispatchEvent(evt) {
      const fns = listeners[evt] || [];
      for (const fn of fns) fn({ preventDefault() {}, stopPropagation() {} });
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    replaceChildren() {},
    appendChild() {},
    innerHTML: '',
    textContent: ''
  };
}

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const queue = [];
  return {
    get now() { return now; },
    setTimeout(fn, ms) {
      const id = nextId++;
      queue.push({ id, at: now + (Number(ms) || 0), fn });
      return id;
    },
    clearTimeout(id) {
      const idx = queue.findIndex(t => t.id === id);
      if (idx !== -1) queue.splice(idx, 1);
    },
    advance(ms) {
      const target = now + ms;
      while (true) {
        let due = null;
        for (const t of queue) {
          if (t.at <= target && (due === null || t.at < due.at || (t.at === due.at && t.id < due.id))) due = t;
        }
        if (!due) break;
        queue.splice(queue.indexOf(due), 1);
        now = due.at;
        due.fn();
      }
      now = target;
    },
    pendingCount() { return queue.length; }
  };
}

function createFakeDate(fakeTimers) {
  const RealDate = Date;
  function FakeDate(...args) {
    return new RealDate(...args);
  }
  FakeDate.now = () => fakeTimers.now;
  FakeDate.UTC = RealDate.UTC;
  FakeDate.parse = RealDate.parse;
  FakeDate.prototype = RealDate.prototype;
  return FakeDate;
}

function deferred() {
  let resolve, reject;
  let settled = false;
  const promise = new Promise((res, rej) => {
    resolve = (v) => { settled = true; res(v); };
    reject = (e) => { settled = true; rej(e); };
  });
  return { promise, resolve, reject, isSettled: () => settled };
}

function createHarness(options = {}) {
  const domNodes = {};
  const winListeners = {};
  const timers = createFakeTimers();
  const FakeDate = createFakeDate(timers);
  const storageStore = { ...(options.storage || {}) };

  function getElementById(id) {
    if (!domNodes[id]) domNodes[id] = makeNode(id);
    return domNodes[id];
  }

  const document = {
    getElementById,
    listeners: {},
    addEventListener(evt, fn) {
      if (!this.listeners[evt]) this.listeners[evt] = [];
      this.listeners[evt].push(fn);
    },
    dispatchEvent(evtName) {
      const fns = this.listeners[evtName] || [];
      for (const fn of fns) fn();
    },
    body: makeNode('body'),
    createElement(tag) { return makeNode('new_' + tag); },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };

  const window = {
    document,
    location: { replace() {}, pathname: '/pages/my-trees.html', href: '' },
    localStorage: {
      store: storageStore,
      getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
      setItem(k, v) { this.store[k] = String(v); },
      removeItem(k) { delete this.store[k]; }
    },
    addEventListener(evt, fn) {
      if (!winListeners[evt]) winListeners[evt] = [];
      winListeners[evt].push(fn);
    },
    dispatchWindowEvent(evt, eventObj) {
      const payload = eventObj || { persisted: evt === 'pageshow' };
      const fns = winListeners[evt] || [];
      for (const fn of fns) fn(payload);
    },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    requestIdleCallback(fn) { setImmediate(fn); },
    Date: FakeDate,
    console: { log() {}, warn() {}, error() {} },
    t: (k) => k,
    LoveBudCache: options.cache || null
  };
  window.window = window;

  const defaultSink = {
    events: [],
    waiters: [],
    push(e) {
      this.events.push(e);
      for (const w of this.waiters) w(e);
    }
  };
  const sink = options.sink === false ? null : (options.sink || defaultSink);
  window.__LoveBudJourneyOutcomeSink = sink;
  window.__LOVE_BUD_JOURNEY_EVIDENCE_SINK__ = options.evidenceSink || sink;

  window.apiClient = options.apiClient || {
    getTrees: async ({ onLifecycle }) => {
      if (onLifecycle) onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
      return [{ id: 't1', title: 'My Tree' }];
    }
  };

  window.LoveBudAuthBootstrap = options.authBootstrap || {
    whenReady: async () => ({ uid: 'user1' })
  };

  window.LoveBudMyTreesFilter = {
    applyFilters: (source) => source
  };

  const fnTax = new Function('window', taxonomySrc);
  fnTax(window);
  if (options.taxonomy === false) delete window.LoveBudJourneyOutcomeTaxonomy;

  const fnPage = new Function('window', 'document', 'setTimeout', 'clearTimeout', 'Date', myTreesPageSrc);
  fnPage(window, document, timers.setTimeout, timers.clearTimeout, FakeDate);

  const fnData = new Function('window', 'document', 'localStorage', 'console', 'setTimeout', 'clearTimeout', 'Date', myTreesDataSrc);
  fnData(window, document, window.localStorage, window.console, timers.setTimeout, timers.clearTimeout, FakeDate);

  const fnCore = new Function('window', 'document', 'localStorage', 'console', 'setTimeout', 'clearTimeout', 'Date', myTreesSrc);
  fnCore(window, document, window.localStorage, window.console, timers.setTimeout, timers.clearTimeout, FakeDate);

  return { win: window, timers, sink };
}

function drainMicrotasks() {
  return new Promise(resolve => setImmediate(resolve));
}

function outcomeSink(win) {
  return win.__LOVE_BUD_JOURNEY_EVIDENCE_SINK__ || win.__LoveBudJourneyOutcomeSink;
}

function stagesOf(win) {
  return outcomeSink(win).events.map(e => e.stage);
}

function countStage(win, stage) {
  return stagesOf(win).filter(s => s === stage).length;
}

function successEvents(win) {
  const tax = win.LoveBudJourneyOutcomeTaxonomy.STAGES;
  return outcomeSink(win).events.filter(e => e.stage === tax.TERMINAL_SUCCESS);
}

function failureEvents(win) {
  const tax = win.LoveBudJourneyOutcomeTaxonomy.STAGES;
  return outcomeSink(win).events.filter(e => e.stage === tax.TERMINAL_FAILURE);
}

function directOptions(win, renderSpy) {
  return {
    setState: win.LoveBudMyTreesPage.setState,
    stateEnum: win.LoveBudMyTreesPage.STATE,
    renderTrees: renderSpy || function() {},
    acknowledgeUi: function() { return true; },
    authenticated: true,
    i18n: function(k) { return k; },
    showToast: function() {}
  };
}

function assertBoundedEvents(win) {
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  const journeyValues = Object.values(tax.JOURNEYS);
  const stageValues = Object.values(tax.STAGES);
  const statusValues = Object.values(tax.STATUS_CLASSES);
  const expectationValues = Object.values(tax.EXPECTATION_CLASSES);
  const severityValues = Object.values(tax.SEVERITY_CLASSES);
  const failureValues = Object.values(tax.FAILURE_CODES);
  const httpValues = Object.values(tax.HTTP_STATUS_CLASSES);
  const latencyValues = Object.values(tax.LATENCY_BUCKETS);
  for (const e of outcomeSink(win).events) {
    assert.deepEqual(Object.keys(e), [...tax.OUTCOME_EVENT_FIELDS], 'event keys must be exactly the bounded outcome fields');
    assert.equal(Object.isFrozen(e), true, 'event must be frozen');
    assert.ok(journeyValues.includes(e.journey), 'journey must be canonical: ' + e.journey);
    assert.ok(stageValues.includes(e.stage), 'stage must be canonical: ' + e.stage);
    assert.ok(statusValues.includes(e.statusClass), 'statusClass must be canonical: ' + e.statusClass);
    assert.ok(expectationValues.includes(e.expectationClass), 'expectationClass must be canonical: ' + e.expectationClass);
    assert.ok(severityValues.includes(e.severity), 'severity must be canonical: ' + e.severity);
    assert.ok(failureValues.includes(e.failureCode), 'failureCode must be canonical: ' + e.failureCode);
    assert.ok(httpValues.includes(e.httpStatus), 'httpStatus must be canonical: ' + e.httpStatus);
    assert.ok(latencyValues.includes(e.latencyBucket), 'latencyBucket must be canonical: ' + e.latencyBucket);
    assert.ok(['positive', 'zero', 'unknown'].includes(e.resultCountBucket), 'resultCountBucket must be bounded: ' + e.resultCountBucket);
  }
}

function assertTerminalFailureMapping(event, tax) {
  assert.equal(event.statusClass, tax.STATUS_CLASSES.FAILED);
  assert.equal(event.expectationClass, tax.EXPECTATION_CLASSES.UNEXPECTED_FAILURE);
  assert.equal(event.severity, tax.SEVERITY_CLASSES.ERROR);
}

function makeLoadError(message, status, phase) {
  const error = new Error(message || 'synthetic failure');
  if (status !== undefined) {
    error.status = status;
    error.statusCode = status;
  }
  if (phase) error._phase = phase;
  return error;
}

function createLoadOptions(win, config = {}) {
  const rendered = [];
  const stateUpdates = [];
  const toasts = [];
  const options = directOptions(win, config.renderTrees || (trees => rendered.push(trees)));
  options.setState = config.setState || ((state, detail) => stateUpdates.push({ state, detail }));
  options.showToast = (message, type) => toasts.push({ message, type });
  options.acknowledgeUi = Object.prototype.hasOwnProperty.call(config, 'acknowledgeUi')
    ? config.acknowledgeUi
    : () => true;
  if (config.preserveVisibleList !== undefined) options.preserveVisibleList = config.preserveVisibleList;
  if (config.reason !== undefined) options.reason = config.reason;
  if (config.supersedeStaleLoad !== undefined) options.supersedeStaleLoad = config.supersedeStaleLoad;
  return { options, rendered, stateUpdates, toasts };
}

async function runLoad(win, config = {}) {
  const run = createLoadOptions(win, config);
  await win.LoveBudMyTreesData.loadTrees(run.options);
  await drainMicrotasks();
  return run;
}

function terminalEvents(win) {
  const stages = win.LoveBudJourneyOutcomeTaxonomy.STAGES;
  return outcomeSink(win).events.filter(event => [
    stages.TERMINAL_SUCCESS,
    stages.TERMINAL_FAILURE,
    stages.CANCELLED,
  ].includes(event.stage));
}

function assertNoPersistenceConfirmed(win) {
  assert.equal(countStage(win, win.LoveBudJourneyOutcomeTaxonomy.STAGES.PERSISTENCE_CONFIRMED), 0);
}

test('non-empty and empty array success have one canonical terminal success', async () => {
  for (const [label, payload, expectedBucket] of [
    ['non-empty array success', [{ id: 'tree-1', title: 'Private title' }], 'positive'],
    ['empty array success', [], 'zero'],
  ]) {
    const harness = createHarness({
      apiClient: { getTrees: async () => payload },
    });
    const { win } = harness;
    const run = await runLoad(win);
    const tax = win.LoveBudJourneyOutcomeTaxonomy;
    const terminals = terminalEvents(win);

    assert.equal(terminals.filter(e => e.stage === tax.STAGES.TERMINAL_SUCCESS).length, 1, label);
    assert.equal(terminals.filter(e => e.stage === tax.STAGES.TERMINAL_FAILURE).length, 0, label);
    const terminal = terminals.find(e => e.stage === tax.STAGES.TERMINAL_SUCCESS);
    assert.equal(terminal.statusClass, tax.STATUS_CLASSES.HEALTHY);
    assert.equal(terminal.expectationClass, tax.EXPECTATION_CLASSES.EXPECTED_SUCCESS);
    assert.equal(terminal.severity, tax.SEVERITY_CLASSES.INFO);
    assert.equal(terminal.failureCode, tax.FAILURE_CODES.NONE);
    assert.equal(terminal.resultCountBucket, expectedBucket);
    assert.equal(countStage(win, tax.STAGES.NOT_MEASURABLE), 1, label);
    assertNoPersistenceConfirmed(win);
    assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0, label);
    assert.ok(run.rendered.length >= 1, 'normalization/render path must proceed for ' + label);
    assertBoundedEvents(win);
  }
});

test('401, 403, other 4xx, 5xx, fetch rejection, auth preparation, parse, invalid payload, API unavailable, and generic failures map canonically', async () => {
  const taxValues = [
    { name: '401', error: () => makeLoadError('auth 401 private body', 401), code: 'LB_JOURNEY_AUTH_REQUIRED', http: 'HTTP_4XX' },
    { name: '403', error: () => makeLoadError('auth 403 bearer secret', 403), code: 'LB_JOURNEY_AUTH_REQUIRED', http: 'HTTP_4XX' },
    { name: 'other 4xx', error: () => makeLoadError('client 404 /private/tree', 404), code: 'LB_JOURNEY_HTTP_4XX', http: 'HTTP_4XX' },
    { name: '5xx', error: () => makeLoadError('server 503 stack', 503), code: 'LB_JOURNEY_HTTP_5XX', http: 'HTTP_5XX' },
    { name: 'fetch rejection', error: () => makeLoadError('fetch https://example.test?token=secret failed', undefined, 'fetch_rejected'), code: 'LB_JOURNEY_NETWORK', http: 'NOT_MEASURED' },
    { name: 'auth_prepare_failed', error: () => makeLoadError('Bearer token secret', 401, 'auth_prepare_failed'), code: 'LB_JOURNEY_AUTH_PREPARE_FAILED', http: 'HTTP_4XX' },
    { name: 'JSON parse failure', error: () => makeLoadError('Unexpected token in response body', 200, 'json_parse_failed'), code: 'LB_JOURNEY_RESPONSE_PARSE', http: 'HTTP_2XX' },
    { name: 'invalid successful payload', value: { not: 'an array', private: 'payload' }, code: 'LB_JOURNEY_INVALID_PAYLOAD', http: 'HTTP_2XX' },
    { name: 'generic unexpected failure', error: () => makeLoadError('Error: /private/project stack'), code: 'LB_UNEXPECTED_FAILURE', http: 'NOT_MEASURED' },
  ];

  for (const scenario of taxValues) {
    const harness = createHarness();
    const { win } = harness;
    win.apiClient.getTrees = async () => {
      if (Object.prototype.hasOwnProperty.call(scenario, 'value')) return scenario.value;
      throw scenario.error();
    };
    await runLoad(win);
    const tax = win.LoveBudJourneyOutcomeTaxonomy;
    const failures = failureEvents(win);
    assert.equal(failures.length, 1, scenario.name);
    assert.equal(failures[0].failureCode, tax.FAILURE_CODES[scenario.code], scenario.name);
    assert.equal(failures[0].httpStatus, tax.HTTP_STATUS_CLASSES[scenario.http], scenario.name);
    assertTerminalFailureMapping(failures[0], tax);
    assert.equal(successEvents(win).length, 0, scenario.name);
    assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0, scenario.name);
    assertBoundedEvents(win);
  }

  const unavailable = createHarness();
  unavailable.win.apiClient = null;
  await runLoad(unavailable.win);
  const unavailableTax = unavailable.win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(failureEvents(unavailable.win)[0].failureCode, unavailableTax.FAILURE_CODES.LB_JOURNEY_API_UNAVAILABLE);
  assert.equal(failureEvents(unavailable.win)[0].httpStatus, unavailableTax.HTTP_STATUS_CLASSES.NOT_MEASURED);
  assertBoundedEvents(unavailable.win);
});

test('cache fallback after fresh request failure is not terminal success', async () => {
  const cached = [{ id: 'cached-tree', title: 'cached private title' }];
  const cacheStore = { my_trees_list: cached };
  const cache = {
    get(key) { return cacheStore[key] || null; },
    set(key, value) { cacheStore[key] = value; },
  };
  const harness = createHarness({ cache });
  const { win } = harness;
  win.apiClient.getTrees = async () => { throw makeLoadError('network body https://private.test', undefined, 'fetch_rejected'); };

  const run = await runLoad(win);
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.ok(run.rendered.length >= 2, 'cached list should paint before and after fresh failure');
  assert.equal(successEvents(win).length, 0);
  assert.equal(failureEvents(win).length, 1);
  assert.equal(failureEvents(win)[0].failureCode, tax.FAILURE_CODES.LB_JOURNEY_NETWORK);
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);
  assertNoPersistenceConfirmed(win);
  assertBoundedEvents(win);
});

test('duplicate suppression retains the active owner context and emits one terminal per generation', async () => {
  const harness = createHarness();
  const { win } = harness;
  const pending = deferred();
  let requestCount = 0;
  win.apiClient.getTrees = async () => {
    requestCount += 1;
    return pending.promise;
  };
  const first = createLoadOptions(win);
  const second = createLoadOptions(win);
  const firstPromise = win.LoveBudMyTreesData.loadTrees(first.options);
  await drainMicrotasks();
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 1);

  const secondPromise = win.LoveBudMyTreesData.loadTrees(second.options);
  await drainMicrotasks();
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(requestCount, 1);
  assert.equal(countStage(win, tax.STAGES.DUPLICATE_SUPPRESSED), 1);
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 1);

  pending.resolve([{ id: 'tree-1' }]);
  await Promise.all([firstPromise, secondPromise]);
  await drainMicrotasks();
  assert.equal(successEvents(win).length, 1);
  assert.equal(failureEvents(win).length, 0);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 1);
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);
  assertBoundedEvents(win);
});

test('history recovery coalescing keeps one generation, while a new generation cancels and removes the previous context once', async () => {
  const harness = createHarness();
  const { win } = harness;
  const recovery = deferred();
  let requestCount = 0;
  win.apiClient.getTrees = async () => {
    requestCount += 1;
    return recovery.promise;
  };
  const first = createLoadOptions(win, { reason: 'history_recovery', supersedeStaleLoad: true });
  const second = createLoadOptions(win, { reason: 'history_recovery', supersedeStaleLoad: true });
  const p1 = win.LoveBudMyTreesData.loadTrees(first.options);
  await drainMicrotasks();
  const p2 = win.LoveBudMyTreesData.loadTrees(second.options);
  await drainMicrotasks();
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(requestCount, 1);
  assert.equal(countStage(win, tax.STAGES.DUPLICATE_SUPPRESSED), 1);
  assert.equal(countStage(win, tax.STAGES.CANCELLED), 0);
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 1);
  recovery.resolve([]);
  await Promise.all([p1, p2]);

  const old = deferred();
  const fresh = deferred();
  requestCount = 0;
  win.apiClient.getTrees = async () => {
    requestCount += 1;
    return requestCount === 1 ? old.promise : fresh.promise;
  };
  const oldLoad = createLoadOptions(win, { reason: 'initial' });
  const freshLoad = createLoadOptions(win, { reason: 'history_recovery', supersedeStaleLoad: true });
  const oldPromise = win.LoveBudMyTreesData.loadTrees(oldLoad.options);
  await drainMicrotasks();
  const freshPromise = win.LoveBudMyTreesData.loadTrees(freshLoad.options);
  await drainMicrotasks();
  assert.equal(countStage(win, tax.STAGES.CANCELLED), 1);
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 1);
  fresh.resolve([{ id: 'fresh-tree' }]);
  await freshPromise;
  old.resolve([{ id: 'stale-tree' }]);
  await oldPromise;
  assert.equal(countStage(win, tax.STAGES.CANCELLED), 1, 'stale generation cancellation must be emitted once');
  assert.equal(successEvents(win).length, 2, 'coalesced recovery and fresh recovery each succeed once');
  assert.equal(failureEvents(win).length, 0);
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);
  assertBoundedEvents(win);
});

test('pagehide cancellation removes the active context and blocks stale terminal output', async () => {
  const harness = createHarness();
  const { win } = harness;
  const pending = deferred();
  win.apiClient.getTrees = async () => pending.promise;
  const load = createLoadOptions(win, { reason: 'initial' });
  const promise = win.LoveBudMyTreesData.loadTrees(load.options);
  await drainMicrotasks();
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 1);
  win.LoveBudMyTreesData.markOwnerListEpochStale();
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(countStage(win, tax.STAGES.CANCELLED), 1);
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);
  pending.resolve([{ id: 'stale-tree' }]);
  await promise;
  assert.equal(successEvents(win).length, 0);
  assert.equal(failureEvents(win).length, 0);
  assertBoundedEvents(win);
});

test('UI acknowledgement ordering gates terminal success, and false acknowledgement becomes bounded failure', async () => {
  const acknowledged = createHarness();
  let firstSeenAtAcknowledgement = null;
  acknowledged.win.apiClient.getTrees = async () => [{ id: 'tree-1' }];
  await runLoad(acknowledged.win, {
    // The settled-acknowledgement loop may re-check across bounded rendering
    // boundaries; the ordering invariant is asserted on the FIRST snapshot.
    acknowledgeUi: () => {
      if (firstSeenAtAcknowledgement === null) {
        firstSeenAtAcknowledgement = stagesOf(acknowledged.win).slice();
      }
      return true;
    },
  });
  const tax = acknowledged.win.LoveBudJourneyOutcomeTaxonomy;
  assert.ok(firstSeenAtAcknowledgement.includes(tax.STAGES.CLIENT_STATE_UPDATED));
  assert.equal(firstSeenAtAcknowledgement.includes(tax.STAGES.UI_ACKNOWLEDGED), false);
  const acknowledgedStages = stagesOf(acknowledged.win);
  assert.ok(acknowledgedStages.indexOf(tax.STAGES.UI_ACKNOWLEDGED) > acknowledgedStages.indexOf(tax.STAGES.CLIENT_STATE_UPDATED));
  assert.ok(acknowledgedStages.indexOf(tax.STAGES.TERMINAL_SUCCESS) > acknowledgedStages.indexOf(tax.STAGES.UI_ACKNOWLEDGED));
  assert.equal(successEvents(acknowledged.win).length, 1);

  const rejected = createHarness();
  rejected.win.apiClient.getTrees = async () => [{ id: 'tree-2' }];
  await runLoad(rejected.win, { acknowledgeUi: () => false });
  const rejectedTax = rejected.win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(countStage(rejected.win, rejectedTax.STAGES.UI_ACKNOWLEDGED), 0);
  assert.equal(successEvents(rejected.win).length, 0);
  assert.equal(failureEvents(rejected.win).length, 1);
  assert.equal(failureEvents(rejected.win)[0].failureCode, rejectedTax.FAILURE_CODES.LB_UI_ACKNOWLEDGEMENT_FAILED);
  assertTerminalFailureMapping(failureEvents(rejected.win)[0], rejectedTax);
  assertBoundedEvents(acknowledged.win);
  assertBoundedEvents(rejected.win);
});

test('15-second escalation uses the controlled fake scheduler and does not emit a product terminal outcome', () => {
  const harness = createHarness();
  const { win, timers } = harness;
  const stages = [];
  const manager = win.LoveBudMyTreesLoading.createMyTreesLoadingManager((stage) => stages.push(stage));
  const generation = manager.start();
  assert.equal(generation, 1);
  timers.advance(499);
  assert.deepEqual(stages, ['init']);
  timers.advance(1);
  assert.equal(stages.at(-1), 'indicator');
  timers.advance(1500);
  assert.equal(stages.at(-1), 'copy');
  timers.advance(6000);
  assert.equal(stages.at(-1), 'longWait');
  timers.advance(7000);
  assert.equal(stages.at(-1), 'error');
  assert.equal(outcomeSink(win).events.length, 0);
  manager.ready(generation);
  assert.equal(timers.pendingCount(), 0);
});

test('taxonomy-absent and sink-absent modes keep request, normalization, cache, render, and UI flow operational', async () => {
  const cacheStore = {};
  const cache = {
    get(key) { return cacheStore[key] || null; },
    set(key, value) { cacheStore[key] = value; },
  };
  const harness = createHarness({ taxonomy: false, sink: false, cache });
  const { win } = harness;
  let requestCount = 0;
  let normalizationCount = 0;
  win.LoveBudNormalize = {
    normalizeTree(tree) {
      normalizationCount += 1;
      return { ...tree, normalized: true };
    },
  };
  win.apiClient.getTrees = async () => {
    requestCount += 1;
    return [{ id: 'tree-1', privateTitle: 'secret title' }];
  };

  const run = createLoadOptions(win);
  await assert.doesNotReject(() => win.LoveBudMyTreesData.loadTrees(run.options));
  await drainMicrotasks();
  assert.equal(requestCount, 1);
  assert.equal(normalizationCount, 1);
  assert.equal(run.rendered.length, 1);
  assert.equal(run.rendered[0][0].normalized, true);
  assert.equal(cacheStore.my_trees_list[0].normalized, true);
  assert.equal(win.LoveBudJourneyOutcomeTaxonomy, undefined);
  assert.equal(win.__LoveBudJourneyOutcomeSink, null);
  assert.equal(win.__LOVE_BUD_JOURNEY_EVIDENCE_SINK__, null);
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);

  const sinkAbsent = createHarness({ sink: false });
  sinkAbsent.win.apiClient.getTrees = async () => [];
  await assert.doesNotReject(() => runLoad(sinkAbsent.win));
  assert.equal(outcomeSink(sinkAbsent.win), null);
  assert.equal(sinkAbsent.win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);
});

test('privacy scrubbing, repeated determinism, exact event keys, and no telemetry transport are enforced', async () => {
  const harness = createHarness();
  const { win } = harness;
  const raw = 'fetch https://example.test/private?token=secret failed; Bearer very-secret-token; response body private-user-content';
  win.apiClient.getTrees = async () => { throw makeLoadError(raw, undefined, 'fetch_rejected'); };
  await runLoad(win);
  const serialized = JSON.stringify(outcomeSink(win).events);
  for (const fragment of ['https://example.test', 'token=secret', 'very-secret-token', 'private-user-content', raw]) {
    assert.equal(serialized.includes(fragment), false, 'raw privacy fragment leaked: ' + fragment);
  }
  assertBoundedEvents(win);
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  const input = { stage: tax.STAGES.TERMINAL_FAILURE, failureCode: raw, rawStack: 'Error: private stack' };
  const first = tax.buildBoundedEvent(input);
  const second = tax.buildBoundedEvent(input);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first).includes('private'), false);
  assert.equal(JSON.stringify(first).includes('secret'), false);
  assert.deepEqual(Object.keys(first), [...tax.OUTCOME_EVENT_FIELDS]);
  assert.doesNotMatch(myTreesDataSrc, /navigator\.sendBeacon|XMLHttpRequest|window\.fetch\s*\(/);
  assert.doesNotMatch(myTreesDataSrc, /telemetry|analytics|collector/i);
});

test('status-less failures remain NOT_MEASURED and latency buckets stay isolated across generations', async () => {
  const harness = createHarness();
  const { win, timers } = harness;
  const first = deferred();
  const second = deferred();
  let calls = 0;
  win.apiClient.getTrees = async () => {
    calls += 1;
    return calls === 1 ? first.promise : second.promise;
  };
  const firstLoad = createLoadOptions(win);
  const firstPromise = win.LoveBudMyTreesData.loadTrees(firstLoad.options);
  await drainMicrotasks();
  timers.advance(249);
  first.resolve([{ id: 'first' }]);
  await firstPromise;
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  const firstTerminal = successEvents(win)[0];
  assert.equal(firstTerminal.latencyBucket, tax.LATENCY_BUCKETS.LT_250_MS);

  const secondLoad = createLoadOptions(win);
  const secondPromise = win.LoveBudMyTreesData.loadTrees(secondLoad.options);
  await drainMicrotasks();
  timers.advance(250);
  second.resolve([{ id: 'second' }]);
  await secondPromise;
  const successes = successEvents(win);
  assert.equal(successes.length, 2);
  assert.equal(successes[1].latencyBucket, tax.LATENCY_BUCKETS.LT_500_MS);
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);

  const statusless = createHarness();
  statusless.win.apiClient.getTrees = async () => { throw makeLoadError('statusless failure'); };
  await runLoad(statusless.win);
  assert.equal(failureEvents(statusless.win)[0].httpStatus, statusless.win.LoveBudJourneyOutcomeTaxonomy.HTTP_STATUS_CLASSES.NOT_MEASURED);
  assertBoundedEvents(statusless.win);
});

test('instrumentation contract itself uses fake scheduling and has no real-time sleep or transport escape hatch', () => {
  assert.match(taxonomySrc, /Object\.freeze/);
  assert.match(myTreesDataSrc, /getActiveContextCount/);
  assert.match(myTreesDataSrc, /__LOVE_BUD_JOURNEY_EVIDENCE_SINK__/);
  assert.doesNotMatch(myTreesDataSrc, /navigator\.sendBeacon|XMLHttpRequest|window\.fetch\s*\(/);
  const fake = createFakeTimers();
  let ran = false;
  fake.setTimeout(() => { ran = true; }, 15000);
  assert.equal(ran, false);
  fake.advance(14999);
  assert.equal(ran, false);
  fake.advance(1);
  assert.equal(ran, true);
});

// ============================================================================
// Correction scenarios C1-C8 (Issue #3796 settled acknowledgement)
// The real page acknowledgement observer (observeTerminalUiState) reads live
// DOM, which can land one rendering boundary after renderTrees. These
// scenarios exercise the settlement boundary instead of relying on the
// `acknowledgeUi: () => true` stub used by the original harness. The default
// stub remains the fast path for all pre-existing scenarios.
// ============================================================================

test('C1 settled acknowledgement: loaded terminal DOM lands one render boundary later', async () => {
  const harness = createHarness();
  const { win } = harness;
  let terminalApplied = false;
  win.apiClient.getTrees = async () => {
    setImmediate(() => { terminalApplied = true; });
    return [{ id: 'tree-1' }];
  };
  const run = await runLoad(win, {
    acknowledgeUi: (state) => state === 'loaded' && terminalApplied,
  });
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(countStage(win, tax.STAGES.UI_ACKNOWLEDGED), 1);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 1);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_FAILURE), 0);
  assert.equal(successEvents(win)[0].resultCountBucket, 'positive');
  assert.ok(run.rendered.length >= 1, 'render path must proceed');
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);
  assertBoundedEvents(win);
});

test('C2 settled acknowledgement: empty terminal DOM lands one render boundary later', async () => {
  const harness = createHarness();
  const { win } = harness;
  let terminalApplied = false;
  win.apiClient.getTrees = async () => {
    setImmediate(() => { terminalApplied = true; });
    return [];
  };
  const run = await runLoad(win, {
    acknowledgeUi: (state) => state === 'empty' && terminalApplied,
  });
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(countStage(win, tax.STAGES.UI_ACKNOWLEDGED), 1);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 1);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_FAILURE), 0);
  assert.equal(successEvents(win)[0].resultCountBucket, 'zero');
  assert.ok(run.rendered.length >= 1, 'empty render path must proceed');
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);
  assertBoundedEvents(win);
});

test('C3 settled acknowledgement: persistent terminal DOM mismatch fails closed with UI_ACKNOWLEDGEMENT_FAILED', async () => {
  const harness = createHarness();
  const { win } = harness;
  win.apiClient.getTrees = async () => [{ id: 'tree-1' }];
  await runLoad(win, { acknowledgeUi: () => false });
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(countStage(win, tax.STAGES.UI_ACKNOWLEDGED), 0);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_FAILURE), 1);
  assert.equal(failureEvents(win)[0].failureCode, tax.FAILURE_CODES.LB_UI_ACKNOWLEDGEMENT_FAILED);
  assertTerminalFailureMapping(failureEvents(win)[0], tax);
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);
  assertBoundedEvents(win);
});

test('C6 pagehide during pending acknowledgement emits no late success and removes the active context', async () => {
  const harness = createHarness();
  const { win } = harness;
  let terminalApplied = false;
  win.apiClient.getTrees = async () => {
    // The terminal DOM would land one render boundary later, but pagehide
    // arrives at that same boundary — before the settlement recheck can
    // observe it. This exercises pagehide DURING a pending acknowledgement
    // (after the response was accepted), which is exactly the NC3/NC10
    // boundary the correction must enforce.
    setImmediate(() => {
      terminalApplied = true;
      win.LoveBudMyTreesData.markOwnerListEpochStale();
    });
    return [{ id: 'tree-1' }];
  };
  const run = createLoadOptions(win, { acknowledgeUi: () => terminalApplied });
  const promise = win.LoveBudMyTreesData.loadTrees(run.options);
  await promise;
  await drainMicrotasks();
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(countStage(win, tax.STAGES.UI_ACKNOWLEDGED), 0);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_FAILURE), 0);
  assert.equal(countStage(win, tax.STAGES.CANCELLED), 1);
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);
  assertBoundedEvents(win);
});

test('C7 throwing evidence sink never breaks product load flow', async () => {
  const harness = createHarness({
    sink: {
      events: [],
      push() { throw new Error('sink exploded'); },
    },
  });
  const { win } = harness;
  let requestCount = 0;
  win.apiClient.getTrees = async () => {
    requestCount += 1;
    return [{ id: 'tree-1' }];
  };
  const run = createLoadOptions(win);
  await assert.doesNotReject(() => win.LoveBudMyTreesData.loadTrees(run.options));
  await drainMicrotasks();
  assert.equal(requestCount, 1);
  assert.equal(run.rendered.length, 1);
  assert.equal(run.rendered[0][0].id, 'tree-1');
  assert.equal(win.LoveBudMyTreesData.JourneyTracker.getActiveContextCount(), 0);
});

test('C8 privacy canary: tree id/title/description/owner/query/error/response/token never reach events', async () => {
  const harness = createHarness();
  const { win } = harness;
  const canaries = [
    'CANARY_TREE_ID_7c4e',
    'CANARY_TITLE_9f3a',
    'CANARY_DESC_b2d1',
    'CANARY_OWNER_e5a8',
    'CANARY_QUERY_a1b2',
    'CANARY_ERROR_c3d4',
    'CANARY_RESPONSE_f6e7',
    'CANARY_TOKEN_8f90',
  ];
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    if (onLifecycle) onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
    return [{ id: 'CANARY_TREE_ID_7c4e', title: 'CANARY_TITLE_9f3a', description: 'CANARY_DESC_b2d1', owner: 'CANARY_OWNER_e5a8' }];
  };
  await runLoad(win, { acknowledgeUi: () => true });
  let serialized = JSON.stringify(outcomeSink(win).events);
  for (const c of canaries.slice(0, 4)) {
    assert.equal(serialized.includes(c), false, 'success-path canary leaked: ' + c);
  }
  win.apiClient.getTrees = async () => {
    throw makeLoadError(
      'fetch CANARY_QUERY_a1b2 failed; CANARY_ERROR_c3d4; CANARY_RESPONSE_f6e7; CANARY_TOKEN_8f90',
      undefined,
      'fetch_rejected'
    );
  };
  await runLoad(win, { acknowledgeUi: () => true });
  serialized = JSON.stringify(outcomeSink(win).events);
  for (const c of canaries) {
    assert.equal(serialized.includes(c), false, 'failure-path canary leaked: ' + c);
  }
  assertBoundedEvents(win);
});
