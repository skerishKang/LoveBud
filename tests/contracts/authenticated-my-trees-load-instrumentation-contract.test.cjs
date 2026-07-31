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

function createHarness() {
  const domNodes = {};
  const winListeners = {};
  const timers = createFakeTimers();
  const FakeDate = createFakeDate(timers);

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
      store: {},
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
    t: (k) => k
  };
  window.window = window;

  window.__LoveBudJourneyOutcomeSink = {
    events: [],
    waiters: [],
    push(e) {
      this.events.push(e);
      for (const w of this.waiters) w(e);
    }
  };

  window.apiClient = {
    getTrees: async ({ onLifecycle }) => {
      if (onLifecycle) onLifecycle({ attempt: 1, statusClass: 'success', authHeaderPresent: true });
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

  const fnPage = new Function('window', 'document', 'setTimeout', 'clearTimeout', 'Date', myTreesPageSrc);
  fnPage(window, document, timers.setTimeout, timers.clearTimeout, FakeDate);

  const fnData = new Function('window', 'document', 'localStorage', 'console', 'setTimeout', 'clearTimeout', 'Date', myTreesDataSrc);
  fnData(window, document, window.localStorage, window.console, timers.setTimeout, timers.clearTimeout, FakeDate);

  const fnCore = new Function('window', 'document', 'localStorage', 'console', 'setTimeout', 'clearTimeout', 'Date', myTreesSrc);
  fnCore(window, document, window.localStorage, window.console, timers.setTimeout, timers.clearTimeout, FakeDate);

  return { win: window, timers };
}

function drainMicrotasks() {
  return new Promise(resolve => setImmediate(resolve));
}

function waitForStage(win, stage) {
  const existing = win.__LoveBudJourneyOutcomeSink.events.find(e => e.stage === stage);
  if (existing) return Promise.resolve(existing);
  return new Promise(resolve => {
    win.__LoveBudJourneyOutcomeSink.waiters.push(e => {
      if (e.stage === stage) resolve(e);
    });
  });
}

function waitForStageCount(win, stage, count) {
  let seen = win.__LoveBudJourneyOutcomeSink.events.filter(e => e.stage === stage).length;
  if (seen >= count) return Promise.resolve();
  return new Promise(resolve => {
    win.__LoveBudJourneyOutcomeSink.waiters.push(e => {
      if (e.stage === stage) seen += 1;
      if (seen >= count) resolve();
    });
  });
}

function waitForTerminal(win) {
  const tax = win.LoveBudJourneyOutcomeTaxonomy;
  const terminals = [tax.STAGES.TERMINAL_SUCCESS, tax.STAGES.TERMINAL_FAILURE, tax.STAGES.CANCELLED];
  const existing = win.__LoveBudJourneyOutcomeSink.events.find(e => terminals.includes(e.stage));
  if (existing) return Promise.resolve(existing);
  return new Promise(resolve => {
    win.__LoveBudJourneyOutcomeSink.waiters.push(e => {
      if (terminals.includes(e.stage)) resolve(e);
    });
  });
}

function prepareAuth(win) {
  win.localStorage.setItem('lovebud_auth_confirmed', 'true');
  win.localStorage.setItem('lovebud_auth_cache', JSON.stringify({ uid: 'user1' }));
  win.getConfirmedSessionUser = () => ({ uid: 'user1' });
}

function bootPage(win) {
  prepareAuth(win);
  win.document.dispatchEvent('DOMContentLoaded');
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
  for (const e of win.__LoveBudJourneyOutcomeSink.events) {
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
