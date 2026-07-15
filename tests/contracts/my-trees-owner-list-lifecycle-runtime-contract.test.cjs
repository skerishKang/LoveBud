const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const AUTH_POLICY_PATH = path.join(ROOT, 'js', 'api', 'auth-policy.js');
const BASE_API_FETCH_PATH = path.join(ROOT, 'js', 'api', 'base-api-fetch.js');
const MY_TREES_DATA_PATH = path.join(ROOT, 'js', 'my-trees', 'my-trees-data.js');

function createStorageMock(initialState = {}) {
  const state = new Map(Object.entries(initialState));
  return {
    getItem(key) { return state.has(key) ? state.get(key) : null; },
    setItem(key, value) { state.set(key, String(value)); },
    removeItem(key) { state.delete(key); },
  };
}

function createSandbox(options = {}) {
  const localStorageMock = createStorageMock(options.localStorage || {});
  const sessionStorageMock = createStorageMock(options.sessionStorage || {});
  const consoleMessages = [];

  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: 200,
      __lovebudAuthReady: true,
      LOVEBUD_DEBUG: false,
      LOVEBUD_MY_TREES_DEBUG: options.LOVEBUD_MY_TREES_DEBUG || false,
      __LoveBudMyTreesDiagnosticSink: options.diagnosticSink || null,
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock,
      firebase: options.firebase || null,
      LoveBudAuthState: null,
      LoveTreeAuthPolicy: null,
      LoveTreeBaseApiFetch: null,
      LoveBudCache: options.cache || null,
      LoveBudNormalize: null,
      apiClient: options.apiClient || null,
      requestIdleCallback: null,
    },
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    firebase: options.firebase || null,
    console: {
      log(...args) { consoleMessages.push({ level: 'log', args }); },
      warn(...args) { consoleMessages.push({ level: 'warn', args }); },
      error(...args) { consoleMessages.push({ level: 'error', args }); },
    },
    fetch: options.fetch || (async () => ({ ok: true, json: async () => ({}) })),
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Array,
    Object,
    Number,
    Promise,
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(AUTH_POLICY_PATH, 'utf8'), sandbox, { filename: AUTH_POLICY_PATH });
  vm.runInContext(fs.readFileSync(BASE_API_FETCH_PATH, 'utf8'), sandbox, { filename: BASE_API_FETCH_PATH });
  vm.runInContext(fs.readFileSync(MY_TREES_DATA_PATH, 'utf8'), sandbox, { filename: MY_TREES_DATA_PATH });

  return { sandbox, consoleMessages, localStorageMock };
}

function extractClassifyLoadError(sandbox) {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  const match = src.match(/function classifyLoadError\(error\)\s*\{[\s\S]*?return\s+'(\w+)';[\s\S]*?\}/);
  return match ? match[0] : null;
}

test('classifyLoadError: auth error for 401', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes("'auth'"), 'classifyLoadError must return auth for 401/403');
  assert.ok(src.includes("status === 401 || status === 403"), 'classifyLoadError must check 401 and 403');
});

test('classifyLoadError: server error for 5xx', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes("'server'"), 'classifyLoadError must return server for 5xx');
  assert.ok(src.includes("status >= 500 && status < 600"), 'classifyLoadError must check 5xx range');
});

test('classifyLoadError: fetch_rejected for status 0 with _phase=fetch_rejected', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes("'fetch_rejected'"), 'classifyLoadError must return fetch_rejected');
  assert.ok(src.includes("_phase === 'fetch_rejected'"), 'classifyLoadError must check _phase=fetch_rejected');
});

test('classifyLoadError: parse for _phase=json_parse_failed (including HTTP 200)', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes("'parse'"), 'classifyLoadError must return parse');
  assert.ok(src.includes("_phase === 'json_parse_failed'"), 'classifyLoadError must check _phase=json_parse_failed');
});

test('classifyLoadError: invalid_payload for _phase=invalid_success_payload', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes("'invalid_payload'"), 'classifyLoadError must return invalid_payload');
  assert.ok(src.includes("_phase === 'invalid_success_payload'"), 'classifyLoadError must check _phase=invalid_success_payload');
});

test('classifyLoadError: client for 4xx (other than 401/403)', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes("'client'"), 'classifyLoadError must return client for 4xx');
  assert.ok(src.includes("status >= 400 && status < 500"), 'classifyLoadError must check 4xx range');
});

test('classifyLoadError: generic as fallback', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes("'generic'"), 'classifyLoadError must have generic fallback');
});

test('classifyLoadError does not use type=network for fetch rejection', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  const fnMatch = src.match(/function classifyLoadError[\s\S]*?^\s*\}/m);
  assert.ok(fnMatch, 'classifyLoadError function must exist');
  assert.ok(!fnMatch[0].includes("'network'"), 'classifyLoadError must not return network for any case');
});

test('classifyLoadError: phase checks precede status checks (phase-first precedence)', () => {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  const fnMatch = src.match(/function classifyLoadError\(error\)\s*\{([\s\S]*?)^\s*\}/m);
  assert.ok(fnMatch, 'classifyLoadError function must exist');
  const fnBody = fnMatch[1];

  const phaseFetchIdx = fnBody.indexOf("_phase === 'fetch_rejected'");
  const phaseParseIdx = fnBody.indexOf("_phase === 'json_parse_failed'");
  const phaseInvalidIdx = fnBody.indexOf("_phase === 'invalid_success_payload'");
  const authIdx = fnBody.indexOf("status === 401 || status === 403");
  const serverIdx = fnBody.indexOf("status >= 500");

  assert.ok(phaseFetchIdx >= 0, '_phase=fetch_rejected check must exist');
  assert.ok(phaseParseIdx >= 0, '_phase=json_parse_failed check must exist');
  assert.ok(phaseInvalidIdx >= 0, '_phase=invalid_success_payload check must exist');
  assert.ok(authIdx >= 0, 'status 401/403 check must exist');
  assert.ok(serverIdx >= 0, 'status 5xx check must exist');

  assert.ok(phaseFetchIdx < authIdx, '_phase=fetch_rejected must be checked before status 401/403');
  assert.ok(phaseParseIdx < authIdx, '_phase=json_parse_failed must be checked before status 401/403');
  assert.ok(phaseInvalidIdx < authIdx, '_phase=invalid_success_payload must be checked before status 401/403');
  assert.ok(authIdx < serverIdx, 'status 401/403 must be checked before status 5xx');
});

test('classifyLoadError source has 7 return values: auth, server, client, fetch_rejected, parse, invalid_payload, generic', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  const fnMatch = src.match(/function classifyLoadError[\s\S]*?^\s*\}/m);
  assert.ok(fnMatch, 'classifyLoadError function must exist');
  const fn = fnMatch[0];
  const returnValues = fn.match(/return\s+'(\w+)'/g);
  assert.ok(returnValues, 'must have return statements');
  assert.ok(returnValues.length >= 7, `must have at least 7 return values, got ${returnValues.length}`);
});

test('loadTrees: error with _phase=fetch_rejected classifies as fetch_rejected', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes("errorType === 'auth'"), 'loadTrees must check for auth errorType');
  assert.ok(src.includes("errorType === 'server'"), 'loadTrees must check for server errorType');
});

test('loadTrees: DOM fallback handles fetch_rejected, parse, and invalid_payload error types', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(
    src.includes("errorType === 'fetch_rejected' || errorType === 'network'"),
    '_updateErrorStateMessage must handle fetch_rejected (with backward compat for network)'
  );
  assert.ok(
    src.includes("errorType === 'parse'"),
    '_updateErrorStateMessage must handle parse error type'
  );
  assert.ok(
    src.includes("errorType === 'invalid_payload'"),
    '_updateErrorStateMessage must handle invalid_payload error type'
  );
});

test('authoritative empty: loadTrees does not convert error to empty array', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(
    src.includes('Array.isArray(trees)'),
    'loadTrees must check Array.isArray(trees) for authoritative empty'
  );
  assert.ok(
    !src.includes("catch") || !src.match(/catch\s*\([^)]*\)\s*\{[^}]*return\s*\[\s*\]/),
    'loadTrees must not return [] in catch block'
  );
});

test('cache preservation: loadTrees keeps cachedTrees on server/network/generic errors', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(
    src.includes("cachedTrees && Array.isArray(cachedTrees)"),
    'loadTrees must preserve cache on non-auth errors'
  );
  assert.ok(
    src.includes("errorType === 'auth'"),
    'auth errors must show error state regardless of cache'
  );
});

test('loadTrees: cache write uses writePersistentTreesCache', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(
    src.includes('writePersistentTreesCache(trees)'),
    'loadTrees must write to persistent cache after successful fetch'
  );
});

test('loadTrees: auth error returns early without cache preservation', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  const authBlock = src.match(/if\s*\(errorType === 'auth'\)\s*\{[\s\S]*?return;/);
  assert.ok(authBlock, 'auth error must return early');
  assert.ok(authBlock[0].includes('setState(stateEnum.ERROR'), 'auth error must set error state');
});

test('my-trees-data.js does not import or reference auth-policy or base-api-fetch', () => {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(!src.includes('auth-policy'), 'my-trees-data.js must not reference auth-policy');
  assert.ok(!src.includes('base-api-fetch'), 'my-trees-data.js must not reference base-api-fetch');
});

test('_updateErrorStateMessage does not expose error details in DOM', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  const updateFn = src.match(/function _updateErrorStateMessage[\s\S]*?^\s*\}/m);
  assert.ok(updateFn, '_updateErrorStateMessage must exist');
  assert.ok(
    !updateFn[0].includes('textContent = error'),
    'must not expose raw error in DOM'
  );
});

test('my-trees-data.js window.LoveBudMyTreesData exports are intact', () => {
  const { sandbox } = createSandbox();
  const api = sandbox.window.LoveBudMyTreesData;
  assert.ok(api, 'LoveBudMyTreesData must be exported');
  assert.equal(typeof api.loadTrees, 'function', 'loadTrees must be a function');
  assert.equal(typeof api.preloadFirstTreeDetail, 'function', 'preloadFirstTreeDetail must be a function');
  assert.equal(api.TREES_CACHE_KEY, 'my_trees_list');
  assert.equal(api.PERSISTENT_TREES_CACHE_KEY, 'lovebud_my_trees_list_cache');
});

test('loadTrees: invalid payload (object) throws with _phase=invalid_success_payload', async () => {
  const { sandbox } = createSandbox({
    apiClient: { getTrees: async () => ({ not: 'an array' }) },
  });

  const stateUpdates = [];
  const rendered = [];
  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (state, detail) => stateUpdates.push({ state, detail }),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: (trees) => rendered.push(trees),
  });

  assert.equal(rendered.length, 0, 'must not render anything for invalid payload');
  assert.ok(
    stateUpdates.some(u => u.state === 'ERROR' && u.detail && u.detail.errorType === 'invalid_payload'),
    'must transition to ERROR state with errorType=invalid_payload'
  );
});

test('loadTrees: invalid payload (null) throws with _phase=invalid_success_payload', async () => {
  const { sandbox } = createSandbox({
    apiClient: { getTrees: async () => null },
  });

  const stateUpdates = [];
  const rendered = [];
  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (state, detail) => stateUpdates.push({ state, detail }),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: (trees) => rendered.push(trees),
  });

  assert.equal(rendered.length, 0, 'must not render anything for null payload');
  assert.ok(
    stateUpdates.some(u => u.state === 'ERROR' && u.detail && u.detail.errorType === 'invalid_payload'),
    'must transition to ERROR state with errorType=invalid_payload'
  );
});

test('loadTrees: invalid payload (string) throws with _phase=invalid_success_payload', async () => {
  const { sandbox } = createSandbox({
    apiClient: { getTrees: async () => 'not an array' },
  });

  const stateUpdates = [];
  const rendered = [];
  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (state, detail) => stateUpdates.push({ state, detail }),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: (trees) => rendered.push(trees),
  });

  assert.equal(rendered.length, 0, 'must not render anything for string payload');
  assert.ok(
    stateUpdates.some(u => u.state === 'ERROR' && u.detail && u.detail.errorType === 'invalid_payload'),
    'must transition to ERROR state with errorType=invalid_payload'
  );
});

test('loadTrees: invalid payload (undefined) throws with _phase=invalid_success_payload', async () => {
  const { sandbox } = createSandbox({
    apiClient: { getTrees: async () => undefined },
  });

  const stateUpdates = [];
  const rendered = [];
  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (state, detail) => stateUpdates.push({ state, detail }),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: (trees) => rendered.push(trees),
  });

  assert.equal(rendered.length, 0, 'must not render anything for undefined payload');
  assert.ok(
    stateUpdates.some(u => u.state === 'ERROR' && u.detail && u.detail.errorType === 'invalid_payload'),
    'must transition to ERROR state with errorType=invalid_payload'
  );
});

test('loadTrees: cached list + invalid payload preserves cached list', async () => {
  const cachedData = [{ id: 't1', title: 'Cached Tree' }];
  const cacheStore = { my_trees_list: cachedData };
  const mockCache = {
    get(key) { return cacheStore[key] || null; },
    set(key, value) { cacheStore[key] = value; },
  };

  const { sandbox } = createSandbox({
    cache: mockCache,
    apiClient: { getTrees: async () => ({ invalid: true }) },
    localStorage: {
      lovebud_my_trees_list_cache: JSON.stringify({
        data: cachedData,
        expiry: Date.now() + 60000,
        cachedAt: Date.now(),
      }),
    },
  });

  const rendered = [];
  const stateUpdates = [];
  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (state, detail) => stateUpdates.push({ state, detail }),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: (trees) => rendered.push(trees),
  });

  assert.ok(rendered.length >= 1, 'must render cached trees');
  assert.deepEqual(rendered[0], cachedData, 'must render the cached list, not empty');
  assert.ok(
    !stateUpdates.some(u => u.state === 'ERROR'),
    'must not transition to ERROR when cache exists'
  );
});

test('loadTrees: no cache + invalid payload transitions to error state', async () => {
  const { sandbox } = createSandbox({
    apiClient: { getTrees: async () => 42 },
  });

  const stateUpdates = [];
  const rendered = [];
  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (state, detail) => stateUpdates.push({ state, detail }),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: (trees) => rendered.push(trees),
  });

  assert.equal(rendered.length, 0, 'must not render anything');
  assert.ok(
    stateUpdates.some(u => u.state === 'ERROR' && u.detail && u.detail.errorType === 'invalid_payload'),
    'must transition to ERROR state with errorType=invalid_payload'
  );
});

test('loadTrees: invalid payload is not converted to []', async () => {
  const { sandbox } = createSandbox({
    apiClient: { getTrees: async () => ({ not: 'array' }) },
  });

  const rendered = [];
  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: () => {},
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: (trees) => rendered.push(trees),
  });

  for (const arg of rendered) {
    assert.ok(Array.isArray(arg) && arg.length > 0, 'renderTrees must never receive [] from invalid payload');
  }
});

test('loadTrees: HTTP 200 parse failure classifies as parse', async () => {
  const { sandbox } = createSandbox({
    apiClient: {
      getTrees: async () => {
        const err = new Error('Unexpected token');
        err._phase = 'json_parse_failed';
        err.status = 200;
        err.statusCode = 200;
        throw err;
      },
    },
  });

  const stateUpdates = [];
  const rendered = [];
  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (state, detail) => stateUpdates.push({ state, detail }),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: (trees) => rendered.push(trees),
  });

  assert.equal(rendered.length, 0, 'must not render on parse failure');
  assert.ok(
    stateUpdates.some(u => u.state === 'ERROR' && u.detail && u.detail.errorType === 'parse'),
    'must classify parse failure as errorType=parse'
  );
});

test('diagnostic: sink disabled → no event emission', async () => {
  const { sandbox, consoleMessages } = createSandbox({
    apiClient: { getTrees: async () => { throw Object.assign(new Error('fail'), { _phase: 'fetch_rejected' }); } },
    LOVEBUD_MY_TREES_DEBUG: false,
    diagnosticSink: null,
  });

  const stateUpdates = [];
  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (state, detail) => stateUpdates.push({ state, detail }),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
  });

  const diagLogs = consoleMessages.filter(m =>
    m.level === 'log' && m.args.some(a => typeof a === 'object' && a !== null && 'phase' in a)
  );
  assert.equal(diagLogs.length, 0, 'must not emit diagnostic events when sink is disabled');
});

test('diagnostic: sink enabled → bounded event delivered to sink', async () => {
  const emitted = [];
  const mockSink = { emit(event) { emitted.push(event); } };

  const { sandbox } = createSandbox({
    apiClient: { getTrees: async () => { throw Object.assign(new Error('fail'), { _phase: 'fetch_rejected' }); } },
    LOVEBUD_MY_TREES_DEBUG: false,
    diagnosticSink: mockSink,
  });

  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: () => {},
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
  });

  assert.ok(emitted.length >= 1, 'must emit at least one diagnostic event');
  const event = emitted[0];
  assert.equal(typeof event.phase, 'string', 'event must have phase string');
  assert.equal(typeof event.attempt, 'number', 'event must have attempt number');
  assert.equal(typeof event.authHeaderPresent, 'boolean', 'event must have authHeaderPresent boolean');
  assert.equal(typeof event.retried, 'boolean', 'event must have retried boolean');
  assert.equal(typeof event.cachePresent, 'boolean', 'event must have cachePresent boolean');
  assert.equal(typeof event.cacheUsed, 'boolean', 'event must have cacheUsed boolean');
  assert.equal(typeof event.statusClass, 'string', 'event must have statusClass string');
  assert.equal(typeof event.resultCountBucket, 'string', 'event must have resultCountBucket string');
});

test('diagnostic: LOVEBUD_MY_TREES_DEBUG=true enables sink emission', async () => {
  const emitted = [];
  const mockSink = { emit(event) { emitted.push(event); } };

  const { sandbox } = createSandbox({
    apiClient: { getTrees: async () => { throw Object.assign(new Error('fail'), { _phase: 'fetch_rejected' }); } },
    LOVEBUD_MY_TREES_DEBUG: true,
    diagnosticSink: mockSink,
  });

  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: () => {},
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
  });

  assert.ok(emitted.length >= 1, 'must emit when LOVEBUD_MY_TREES_DEBUG is true');
});

test('diagnostic: event JSON does not contain token, Authorization, UID, email, tree ID, title, or body', async () => {
  const emitted = [];
  const mockSink = { emit(event) { emitted.push(event); } };

  const { sandbox } = createSandbox({
    apiClient: {
      getTrees: async () => {
        const err = new Error('server error');
        err._phase = 'http_error';
        err.status = 500;
        err.statusCode = 500;
        throw err;
      },
    },
    LOVEBUD_MY_TREES_DEBUG: false,
    diagnosticSink: mockSink,
  });

  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: () => {},
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
  });

  assert.ok(emitted.length >= 1, 'must emit events');
  const serialized = JSON.stringify(emitted);
  assert.ok(!serialized.includes('Authorization'), 'event must not contain Authorization');
  assert.ok(!serialized.includes('leaked-token'), 'event must not contain token value');
  assert.ok(!serialized.includes('uid'), 'event must not contain uid');
  assert.ok(!serialized.includes('email'), 'event must not contain email');
  assert.ok(!serialized.includes('tree_id'), 'event must not contain tree_id');
  assert.ok(!serialized.includes('title'), 'event must not contain title');
  assert.ok(!serialized.includes('response body'), 'event must not contain response body');
});

test('diagnostic: no sink + LOVEBUD_MY_TREES_DEBUG=false → no emission and no error', async () => {
  const { sandbox, consoleMessages } = createSandbox({
    apiClient: { getTrees: async () => [] },
    LOVEBUD_MY_TREES_DEBUG: false,
    diagnosticSink: null,
  });

  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: () => {},
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: () => {},
  });

  const diagLogs = consoleMessages.filter(m =>
    m.level === 'log' && m.args.some(a => typeof a === 'object' && a !== null && 'phase' in a)
  );
  assert.equal(diagLogs.length, 0, 'no diagnostic logs when sink is disabled');
});

test('diagnostic: successful load emits phase=loaded with resultCountBucket', async () => {
  const emitted = [];
  const mockSink = { emit(event) { emitted.push(event); } };

  const { sandbox } = createSandbox({
    apiClient: { getTrees: async () => [{ id: 't1' }, { id: 't2' }] },
    LOVEBUD_MY_TREES_DEBUG: false,
    diagnosticSink: mockSink,
  });

  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: () => {},
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: () => {},
  });

  const loadedEvents = emitted.filter(e => e.phase === 'loaded');
  assert.ok(loadedEvents.length >= 1, 'must emit loaded event');
  assert.equal(loadedEvents[0].resultCountBucket, 'positive', '2 trees must be positive');
  assert.equal(loadedEvents[0].statusClass, 'success', 'loaded statusClass must be success');
});

test('diagnostic: empty array load emits resultCountBucket=zero', async () => {
  const emitted = [];
  const mockSink = { emit(event) { emitted.push(event); } };

  const { sandbox } = createSandbox({
    apiClient: { getTrees: async () => [] },
    LOVEBUD_MY_TREES_DEBUG: false,
    diagnosticSink: mockSink,
  });

  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: () => {},
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: () => {},
  });

  const loadedEvents = emitted.filter(e => e.phase === 'loaded');
  assert.ok(loadedEvents.length >= 1, 'must emit loaded event');
  assert.equal(loadedEvents[0].resultCountBucket, 'zero', 'empty array must be zero');
});
