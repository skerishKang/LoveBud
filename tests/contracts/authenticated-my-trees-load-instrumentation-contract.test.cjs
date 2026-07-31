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
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    replaceChildren() {},
    appendChild() {},
    innerHTML: '',
    textContent: ''
  };
}

function createHarness() {
  const domNodes = {};
  const winListeners = {};

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
      if (this.listeners[evtName]) this.listeners[evtName].forEach(fn => fn());
    },
    body: makeNode('body'),
    createElement(tag) { return makeNode('new_' + tag); },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };

  const window = {
    document,
    winListeners,
    dispatchWindowEvent(evt) {
      if (winListeners[evt]) winListeners[evt].forEach(fn => fn({ persisted: evt === 'pageshow' }));
    },
    location: { replace() {}, pathname: '/pages/my-trees.html', href: '' },
    localStorage: {
      store: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
      setItem(k, v) { this.store[k] = String(v); },
      removeItem(k) { delete this.store[k]; }
    },
    addEventListener(evt, fn) {
      if (!winListeners[evt]) winListeners[evt] = [];
      winListeners[evt].push(fn);
    },
    setTimeout(fn) { return setImmediate(fn); },
    clearTimeout() {},
    requestIdleCallback(fn) { setImmediate(fn); },
    Date: Date,
    console: { log() {}, warn() {}, error() {} },
    t: k => k
  };

  window.window = window;

  window.__LoveBudJourneyOutcomeSink = {
    events: [],
    push(e) { this.events.push(e); }
  };

  window.apiClient = {
    getTrees: async ({ onLifecycle }) => {
      onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
      return [{ id: 't1', title: 'My Tree' }];
    }
  };

  window.LoveBudAuthBootstrap = {
    whenReady: async () => ({ uid: 'user1' })
  };

  window.LoveBudMyTreesFilter = {
    applyFilters: (source) => source
  };

  const fnTax = new Function('window', taxonomySrc);
  fnTax(window);

  const fnPage = new Function('window', 'document', myTreesPageSrc);
  fnPage(window, document);

  const fnData = new Function('window', 'document', 'localStorage', 'console', 'setTimeout', myTreesDataSrc);
  fnData(window, document, window.localStorage, window.console, window.setTimeout);

  const fnCore = new Function('window', 'document', 'localStorage', 'console', 'setTimeout', myTreesSrc);
  fnCore(window, document, window.localStorage, window.console, window.setTimeout);

  return window;
}

function flush() {
  return new Promise(resolve => setTimeout(resolve, 50));
}

function bootAndFlush(win) {
  win.getConfirmedSessionUser = () => ({ uid: 'user1' });
  win.document.dispatchEvent('DOMContentLoaded');
  return Promise.resolve().then(flush).then(flush);
}

function stagesOf(win) {
  return win.__LoveBudJourneyOutcomeSink.events.map(e => e.stage);
}

function countStage(win, stage) {
  return stagesOf(win).filter(s => s === stage).length;
}

function successEvents(win) {
  const tax = win.LoveBudJourneyOutcomeTaxonomy.STAGES;
  return win.__LoveBudJourneyOutcomeSink.events.filter(e => e.stage === tax.TERMINAL_SUCCESS);
}

function failureEvents(win) {
  const tax = win.LoveBudJourneyOutcomeTaxonomy.STAGES;
  return win.__LoveBudJourneyOutcomeSink.events.filter(e => e.stage === tax.TERMINAL_FAILURE);
}

function directOptions(win, renderSpy) {
  return {
    setState: win.LoveBudMyTreesPage.setState,
    stateEnum: win.LoveBudMyTreesPage.STATE,
    renderTrees: renderSpy || function() {},
    acknowledgeUi: function() { return true; },
    i18n: function(k) { return k; },
    showToast: function() {}
  };
}

const ALLOWED_EVENT_KEYS = ['journey', 'stage', 'failureCode', 'httpStatus', 'latencyBucket', 'resultCountBucket'];

function assertBoundedEvents(win) {
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  const stageValues = Object.values(tax.STAGES);
  const failureValues = Object.values(tax.FAILURE_CODES);
  const httpValues = Object.values(tax.HTTP_STATUS_CLASSES);
  const latencyValues = Object.values(tax.LATENCY_BUCKETS);
  for (const e of win.__LoveBudJourneyOutcomeSink.events) {
    assert.deepEqual(Object.keys(e).sort(), [...ALLOWED_EVENT_KEYS].sort(), 'event keys must stay bounded');
    assert.ok(stageValues.includes(e.stage), 'stage must be canonical: ' + e.stage);
    assert.ok(failureValues.includes(e.failureCode), 'failureCode must be canonical: ' + e.failureCode);
    assert.ok(httpValues.includes(e.httpStatus), 'httpStatus must be canonical: ' + e.httpStatus);
    assert.ok(latencyValues.includes(e.latencyBucket), 'latencyBucket must be canonical: ' + e.latencyBucket);
    assert.ok(['positive', 'zero', 'unknown'].includes(e.resultCountBucket), 'resultCountBucket must be bounded: ' + e.resultCountBucket);
  }
}

test('1. non-empty array: 1 request, positive bucket, UI_ACKNOWLEDGED before TERMINAL_SUCCESS, bounded events, no raw leakage', async () => {
  const win = createHarness();
  let requestCount = 0;
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    requestCount += 1;
    onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
    return [{ id: 't1', title: 'My Tree' }];
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  const stages = stagesOf(win);
  assert.equal(requestCount, 1, 'exactly one API request');
  assert.ok(stages.includes(tax.STAGES.ACTION_STARTED));
  assert.ok(stages.includes(tax.STAGES.CLIENT_VALIDATION_PASSED));
  assert.ok(stages.includes(tax.STAGES.REQUEST_DISPATCHED));
  assert.ok(stages.includes(tax.STAGES.RESPONSE_ACCEPTED));
  assert.ok(stages.includes(tax.STAGES.CLIENT_STATE_UPDATED));
  assert.ok(stages.includes(tax.STAGES.UI_ACKNOWLEDGED));
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 1);

  const accepted = win.__LoveBudJourneyOutcomeSink.events.find(e => e.stage === tax.STAGES.RESPONSE_ACCEPTED);
  assert.equal(accepted.resultCountBucket, 'positive', 'non-empty result bucket is positive');
  assert.equal(accepted.httpStatus, tax.HTTP_STATUS_CLASSES.NOT_MEASURED, 'no fabricated numeric status');

  const ackIndex = stages.indexOf(tax.STAGES.UI_ACKNOWLEDGED);
  const successIndex = stages.indexOf(tax.STAGES.TERMINAL_SUCCESS);
  assert.ok(ackIndex !== -1 && successIndex !== -1 && ackIndex < successIndex, 'UI_ACKNOWLEDGED strictly precedes TERMINAL_SUCCESS');

  const successEvent = successEvents(win)[0];
  assert.equal(successEvent.failureCode, tax.FAILURE_CODES.NONE);
  assert.equal(successEvent.httpStatus, tax.HTTP_STATUS_CLASSES.NOT_MEASURED);

  assertBoundedEvents(win);
  const rawJson = JSON.stringify(win.__LoveBudJourneyOutcomeSink.events);
  assert.doesNotMatch(rawJson, /t1|My Tree|user1|token|Bearer|email|@/);
});

test('2. empty array: terminal success with zero result bucket, ack before success', async () => {
  const win = createHarness();
  let requestCount = 0;
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    requestCount += 1;
    onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
    return [];
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  const stages = stagesOf(win);
  assert.equal(requestCount, 1);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 1, 'empty array is a terminal success');
  const accepted = win.__LoveBudJourneyOutcomeSink.events.find(e => e.stage === tax.STAGES.RESPONSE_ACCEPTED);
  assert.equal(accepted.resultCountBucket, 'zero', 'empty result bucket is zero');
  const ackIndex = stages.indexOf(tax.STAGES.UI_ACKNOWLEDGED);
  const successIndex = stages.indexOf(tax.STAGES.TERMINAL_SUCCESS);
  assert.ok(ackIndex !== -1 && successIndex !== -1 && ackIndex < successIndex, 'UI_ACKNOWLEDGED strictly precedes TERMINAL_SUCCESS');
  assertBoundedEvents(win);
});

test('3. 401 journey emits auth-required failure and no success', async () => {
  const win = createHarness();
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    onLifecycle({ attempt: 1, statusClass: 'client', authHeaderPresent: true });
    const err = new Error('Auth fail');
    err.status = 401;
    throw err;
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(failureEvents(win).length, 1);
  assert.equal(failureEvents(win)[0].failureCode, tax.FAILURE_CODES.LB_JOURNEY_AUTH_REQUIRED);
  assert.equal(failureEvents(win)[0].httpStatus, tax.HTTP_STATUS_CLASSES.HTTP_4XX);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0);
  assert.equal(countStage(win, tax.STAGES.UI_ACKNOWLEDGED), 0);
});

test('4. 403 journey emits auth-required failure and no success', async () => {
  const win = createHarness();
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    onLifecycle({ attempt: 1, statusClass: 'client', authHeaderPresent: true });
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(failureEvents(win).length, 1);
  assert.equal(failureEvents(win)[0].failureCode, tax.FAILURE_CODES.LB_JOURNEY_AUTH_REQUIRED);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0);
});

test('5. other 4xx journey emits HTTP_4XX failure and no success', async () => {
  const win = createHarness();
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    onLifecycle({ attempt: 1, statusClass: 'client', authHeaderPresent: true });
    const err = new Error('Bad request');
    err.status = 400;
    throw err;
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(failureEvents(win).length, 1);
  assert.equal(failureEvents(win)[0].failureCode, tax.FAILURE_CODES.LB_JOURNEY_HTTP_4XX);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0);
});

test('6. 5xx journey emits HTTP_5XX failure and no success', async () => {
  const win = createHarness();
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    onLifecycle({ attempt: 1, statusClass: 'server', authHeaderPresent: true });
    const err = new Error('Server error');
    err.status = 500;
    throw err;
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(failureEvents(win).length, 1);
  assert.equal(failureEvents(win)[0].failureCode, tax.FAILURE_CODES.LB_JOURNEY_HTTP_5XX);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0);
});

test('7. fetch rejection emits network failure and no success', async () => {
  const win = createHarness();
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    onLifecycle({ attempt: 1, statusClass: 'none', authHeaderPresent: true });
    const err = new Error('Network down');
    err._phase = 'fetch_rejected';
    throw err;
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(failureEvents(win).length, 1);
  assert.equal(failureEvents(win)[0].failureCode, tax.FAILURE_CODES.LB_JOURNEY_NETWORK);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0);
});

test('8. JSON parse failure emits response-parse failure and no success', async () => {
  const win = createHarness();
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
    const err = new Error('Unexpected token');
    err._phase = 'json_parse_failed';
    throw err;
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(failureEvents(win).length, 1);
  assert.equal(failureEvents(win)[0].failureCode, tax.FAILURE_CODES.LB_JOURNEY_RESPONSE_PARSE);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0);
});

test('9. invalid successful payload emits invalid-payload failure and no success', async () => {
  const win = createHarness();
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
    return { not: 'an array' };
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(failureEvents(win).length, 1);
  assert.equal(failureEvents(win)[0].failureCode, tax.FAILURE_CODES.LB_JOURNEY_INVALID_PAYLOAD);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0);
  assert.equal(countStage(win, tax.STAGES.UI_ACKNOWLEDGED), 0);
});

test('10. generic failure and api-unavailable emit unexpected failure codes', async () => {
  const win = createHarness();
  win.apiClient.getTrees = async () => {
    throw new Error('Boom');
  };
  await bootAndFlush(win);

  let tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(failureEvents(win).length, 1);
  assert.equal(failureEvents(win)[0].failureCode, tax.FAILURE_CODES.LB_UNEXPECTED_FAILURE);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0);

  const win2 = createHarness();
  win2.apiClient = null;
  await bootAndFlush(win2);

  tax = win2.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(failureEvents(win2).length, 1);
  assert.equal(failureEvents(win2)[0].failureCode, tax.FAILURE_CODES.LB_JOURNEY_API_UNAVAILABLE);
  assert.equal(countStage(win2, tax.STAGES.TERMINAL_SUCCESS), 0);
});

test('11. cache fallback preserves visible UI with terminal failure and no success or persistence confirm', async () => {
  const win = createHarness();
  win.localStorage.setItem('lovebud_my_trees_list_cache', JSON.stringify({
    data: [{ id: 'c1', title: 'Cached Tree' }],
    expiry: Date.now() + 60000,
    cachedAt: Date.now()
  }));
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    onLifecycle({ attempt: 1, statusClass: 'server', authHeaderPresent: true });
    const err = new Error('Server error');
    err.status = 500;
    throw err;
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(failureEvents(win).length, 1);
  assert.equal(failureEvents(win)[0].failureCode, tax.FAILURE_CODES.LB_JOURNEY_HTTP_5XX);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0, 'cache fallback must not be a terminal success');
  assert.equal(countStage(win, tax.STAGES.UI_ACKNOWLEDGED), 0);
  assert.equal(countStage(win, tax.STAGES.PERSISTENCE_CONFIRMED), 0, 'read journey never records persistence confirmed');

  const doc = win.document;
  assert.ok(doc.getElementById('state-loaded').classList.contains('state-visible-block'), 'cached UI preserved and visible');
  assert.ok(doc.getElementById('state-loading').classList.contains('state-hidden'), 'loading hidden after terminal failure');
  assert.ok(doc.getElementById('state-error').classList.contains('state-hidden'), 'error section not displayed on cache fallback');
});

test('12. duplicate suppression: one request, one success, DUPLICATE_SUPPRESSED recorded', async () => {
  const win = createHarness();
  let requestCount = 0;
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    requestCount += 1;
    onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
    return [{ id: 't1', title: 'My Tree' }];
  };
  const opts = directOptions(win);
  const p1 = win.LoveBudMyTreesData.loadTrees(opts);
  const p2 = win.LoveBudMyTreesData.loadTrees(opts);
  await Promise.all([p1, p2]);
  await flush();

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(requestCount, 1, 'coalesced call shares the single active request');
  assert.equal(countStage(win, tax.STAGES.DUPLICATE_SUPPRESSED), 1);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 1, 'only one journey success');
  assert.equal(countStage(win, tax.STAGES.UI_ACKNOWLEDGED), 1);
});

test('13. stale generation: response write, cache write, ack and success all blocked', async () => {
  const win = createHarness();
  let resolveTrees;
  let cacheSetCount = 0;
  const renderSpy = function() { renderSpy.calls = (renderSpy.calls || 0) + 1; };
  win.LoveBudCache = {
    get: () => null,
    set() { cacheSetCount += 1; }
  };
  win.apiClient.getTrees = () => new Promise(resolve => { resolveTrees = resolve; });

  const p = win.LoveBudMyTreesData.loadTrees(directOptions(win, renderSpy));
  win.LoveBudMyTreesData.markOwnerListEpochStale();
  resolveTrees([{ id: 't1', title: 'My Tree' }]);
  await p;
  await flush();

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(countStage(win, tax.STAGES.CANCELLED), 1, 'stale result is cancelled');
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0);
  assert.equal(countStage(win, tax.STAGES.UI_ACKNOWLEDGED), 0);
  assert.equal(renderSpy.calls || 0, 0, 'no stale UI write');
  assert.equal(cacheSetCount, 0, 'no stale cache write');
});

test('14. pagehide supersede: in-flight response is discarded end-to-end with no stale writes', async () => {
  const win = createHarness();
  let resolveTrees;
  let cacheSetCount = 0;
  win.LoveBudCache = {
    get: () => null,
    set() { cacheSetCount += 1; }
  };
  win.apiClient.getTrees = () => new Promise(resolve => { resolveTrees = resolve; });

  win.getConfirmedSessionUser = () => ({ uid: 'user1' });
  win.document.dispatchEvent('DOMContentLoaded');
  await new Promise(resolve => setTimeout(resolve, 50));
  win.dispatchWindowEvent('pagehide');
  resolveTrees([{ id: 't1', title: 'My Tree' }]);
  await new Promise(resolve => setTimeout(resolve, 50));
  await flush();

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(countStage(win, tax.STAGES.CANCELLED), 1);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 0, 'stale response never succeeds');
  assert.equal(countStage(win, tax.STAGES.UI_ACKNOWLEDGED), 0, 'stale response never acknowledged');
  assert.equal(cacheSetCount, 0, 'stale response never writes cache');
  const loaded = win.document.getElementById('state-loaded');
  assert.ok(loaded.classList.contains('state-hidden'), 'no stale UI write to state-loaded');
});

test('15. history recovery coalescing: same-generation recovery shares the active request; stale recovery supersedes', async () => {
  const win = createHarness();
  let requestCount = 0;
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    requestCount += 1;
    onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
    return [{ id: 't1', title: 'My Tree' }];
  };

  const opts = directOptions(win);
  const p1 = win.LoveBudMyTreesData.loadTrees(Object.assign({}, opts, { reason: 'history_recovery', supersedeStaleLoad: true }));
  const p2 = win.LoveBudMyTreesData.loadTrees(Object.assign({}, opts, { reason: 'history_recovery', supersedeStaleLoad: true }));
  await Promise.all([p1, p2]);
  await flush();

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(requestCount, 1, 'same-generation recovery coalesces onto the active request');
  assert.equal(countStage(win, tax.STAGES.DUPLICATE_SUPPRESSED), 1);
  assert.equal(countStage(win, tax.STAGES.TERMINAL_SUCCESS), 1);

  const win2 = createHarness();
  let requestCount2 = 0;
  win2.apiClient.getTrees = async ({ onLifecycle }) => {
    requestCount2 += 1;
    onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
    return [{ id: 't1', title: 'My Tree' }];
  };
  const opts2 = directOptions(win2);
  const normal = win2.LoveBudMyTreesData.loadTrees(opts2);
  const recovery = win2.LoveBudMyTreesData.loadTrees(Object.assign({}, opts2, { reason: 'history_recovery', supersedeStaleLoad: true }));
  await Promise.all([normal, recovery]);
  await flush();

  const tax2 = win2.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(requestCount2, 2, 'stale pre-restore load is superseded by a new recovery request');
  assert.ok(countStage(win2, tax2.STAGES.CANCELLED) >= 1, 'superseded load is cancelled');
  assert.equal(countStage(win2, tax2.STAGES.TERMINAL_SUCCESS), 1);
});

test('16. no terminal success ever precedes its UI acknowledgement across success journeys', async () => {
  const win = createHarness();
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
    return [{ id: 't1', title: 'My Tree' }];
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  const events = win.__LoveBudJourneyOutcomeSink.events;
  let ackSeen = false;
  for (const e of events) {
    if (e.stage === tax.STAGES.TERMINAL_SUCCESS) {
      assert.ok(ackSeen, 'TERMINAL_SUCCESS must never appear before UI_ACKNOWLEDGED');
    }
    if (e.stage === tax.STAGES.UI_ACKNOWLEDGED) ackSeen = true;
  }
});

test('17. loading escalation never records TIMED_OUT', async () => {
  const win = createHarness();
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
    return [{ id: 't1', title: 'My Tree' }];
  };
  await bootAndFlush(win);

  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  assert.equal(countStage(win, tax.STAGES.TIMED_OUT), 0);
  assert.doesNotMatch(myTreesSrc + myTreesDataSrc + myTreesPageSrc, /STAGES\.TIMED_OUT/);
});

test('18. raw tree id, title, token, uid, email, header, message, and stack never leak into events', async () => {
  const win = createHarness();
  win.apiClient.getTrees = async ({ onLifecycle }) => {
    onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
    return [{ id: 'tree-id-987', title: 'Secret Tree Title', body: 'private body', sourceUrl: 'https://x.test/s.jpg' }];
  };
  await bootAndFlush(win);

  assertBoundedEvents(win);
  const rawJson = JSON.stringify(win.__LoveBudJourneyOutcomeSink.events);
  assert.doesNotMatch(rawJson, /tree-id-987|Secret Tree Title|private body|sourceUrl|x\.test/);
  assert.doesNotMatch(rawJson, /Bearer|token|user1|uid|email|@|stack|Authorization|header/i);
});

test('19. taxonomy and instrumentation perform no network, telemetry, or persistence transport', async () => {
  assert.doesNotMatch(taxonomySrc, /fetch\s*\(/);
  assert.doesNotMatch(taxonomySrc, /XMLHttpRequest|sendBeacon|WebSocket/);
  assert.doesNotMatch(taxonomySrc, /localStorage|sessionStorage|indexedDB|document\.cookie/);

  const start = myTreesDataSrc.indexOf('var MyTreesJourneyTracker');
  const end = myTreesDataSrc.indexOf('var TREES_CACHE_KEY');
  assert.ok(start !== -1 && end !== -1 && start < end, 'tracker region must be located');
  const trackerRegion = myTreesDataSrc.slice(start, end);
  assert.doesNotMatch(trackerRegion, /fetch\s*\(/);
  assert.doesNotMatch(trackerRegion, /XMLHttpRequest|sendBeacon|WebSocket/);
  assert.doesNotMatch(trackerRegion, /localStorage|sessionStorage|indexedDB|document\.cookie/);
});

test('20. no numeric HTTP 200 success-default and no persistence-confirm recording in the implementation', async () => {
  assert.doesNotMatch(myTreesDataSrc, /httpStatus:\s*200/);
  assert.doesNotMatch(myTreesDataSrc, /\{\s*httpStatus:\s*200\s*\}/);
  assert.doesNotMatch(myTreesSrc + myTreesDataSrc + myTreesPageSrc, /STAGES\.PERSISTENCE_CONFIRMED/);

  const win = createHarness();
  await bootAndFlush(win);
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  for (const e of successEvents(win)) {
    assert.equal(e.httpStatus, tax.HTTP_STATUS_CLASSES.NOT_MEASURED, 'success events carry no fabricated numeric status');
  }
});

test('source-static: unauthorized my-trees-page.js carries no direct instrumentation references', () => {
  assert.doesNotMatch(myTreesPageSrc, /JourneyTracker/);
  assert.doesNotMatch(myTreesPageSrc, /UI_ACKNOWLEDGED/);
  assert.doesNotMatch(myTreesPageSrc, /TERMINAL_SUCCESS/);
  assert.doesNotMatch(myTreesPageSrc, /recordStage/);
  assert.doesNotMatch(myTreesPageSrc, /journey-outcome-taxonomy/);
});
