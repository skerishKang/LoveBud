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

// #3928: the owner-private cache module (js/auth/auth-cache.js) is the
// confirmed-owner authority for private cache read/write. These contract
// fixtures run the my-trees-data module in a sandbox without loading the
// full auth chain, so a minimal authority mock is injected that behaves like
// the production module for a single confirmed owner ('test-uid').
function createPrivateCacheAuthorityMock(localStorageMock) {
  const OWNER_UID = 'test-uid';
  return {
    getPrivateCacheOwnerUid() { return OWNER_UID; },
    capturePrivateCacheAuthority(expectedUid) {
      if (!expectedUid || String(expectedUid) !== OWNER_UID) return null;
      return { uid: OWNER_UID, epoch: 0 };
    },
    isPrivateCacheAuthorityCurrent(authority) {
      return !!(authority && authority.uid === OWNER_UID && Number(authority.epoch) === 0);
    },
    writePrivateCacheRecord(key, uid, record, authority) {
      if (!uid || String(uid) !== OWNER_UID || !authority) return false;
      try {
        localStorageMock.setItem(String(key), JSON.stringify(record));
        return true;
      } catch (e) {
        return false;
      }
    },
    readPrivateCacheRecord(key, uid) {
      if (!uid || String(uid) !== OWNER_UID) return null;
      try {
        const raw = localStorageMock.getItem(String(key));
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    clearPrivateCaches() {},
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
      LoveBudAuthCache: createPrivateCacheAuthorityMock(localStorageMock),
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
    apiClient: {
      getTrees: async (options) => {
        if (options && typeof options.onLifecycle === 'function') {
          options.onLifecycle({ attempt: 1, retried: false, authHeaderPresent: false, statusClass: 'success' });
        }
        return [{ id: 't1' }, { id: 't2' }];
      },
    },
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

test('diagnostic: lifecycle callback delivers real attempt/retried metadata', async () => {
  const emitted = [];
  const mockSink = { emit(event) { emitted.push(event); } };

  const { sandbox } = createSandbox({
    apiClient: {
      getTrees: async (options) => {
        if (options && typeof options.onLifecycle === 'function') {
          options.onLifecycle({ attempt: 2, retried: true, authHeaderPresent: true, statusClass: 'success' });
        }
        return [{ id: 't1' }];
      },
    },
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
  assert.equal(loadedEvents[0].attempt, 2, 'must preserve attempt from lifecycle callback');
  assert.equal(loadedEvents[0].retried, true, 'must preserve retried from lifecycle callback');
  assert.equal(loadedEvents[0].authHeaderPresent, true, 'must preserve authHeaderPresent from lifecycle callback');
});

test('diagnostic: error event preserves error metadata fallback (attempt, retried, authHeaderPresent)', async () => {
  const emitted = [];
  const mockSink = { emit(event) { emitted.push(event); } };

  const { sandbox } = createSandbox({
    apiClient: {
      getTrees: async () => {
        const err = new Error('fetch failed');
        err._phase = 'fetch_rejected';
        err._attempt = 2;
        err._retried = true;
        err._authHeaderPresent = true;
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

  const failureEvents = emitted.filter(e => e.phase === 'fetch_rejected');
  assert.ok(failureEvents.length >= 1, 'must emit fetch_rejected event');
  assert.equal(failureEvents[0].attempt, 2, 'must use error._attempt fallback');
  assert.equal(failureEvents[0].retried, true, 'must use error._retried fallback');
  assert.equal(failureEvents[0].authHeaderPresent, true, 'must use error._authHeaderPresent fallback');
});

test('diagnostic: allowlist projection drops extra fields from event', async () => {
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

  assert.ok(emitted.length >= 1, 'must emit events');
  const event = emitted[0];
  const keys = Object.keys(event);
  const expectedKeys = ['phase', 'attempt', 'retried', 'authHeaderPresent', 'cachePresent', 'cacheUsed', 'statusClass', 'resultCountBucket'];
  assert.deepEqual(keys.sort(), expectedKeys.sort(), 'event must only contain allowlisted keys');
});

test('diagnostic: extra fields in caller event are dropped in sink output', async () => {
  const emitted = [];
  const mockSink = { emit(event) { emitted.push(event); } };

  const { sandbox } = createSandbox({
    apiClient: {
      getTrees: async (options) => {
        if (options && typeof options.onLifecycle === 'function') {
          options.onLifecycle({
            attempt: 2, retried: true, authHeaderPresent: true, statusClass: 'success',
            token: 'secret', uid: 'secret', endpoint: '/trees?private=value',
            responseBody: { secret: true }, title: 'private',
          });
        }
        return [];
      },
    },
    LOVEBUD_MY_TREES_DEBUG: false,
    diagnosticSink: mockSink,
  });

  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: () => {},
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: () => {},
  });

  assert.ok(emitted.length >= 1, 'must emit events');
  const serialized = JSON.stringify(emitted);
  assert.ok(!serialized.includes('token'), 'must not contain token');
  assert.ok(!serialized.includes('uid'), 'must not contain uid');
  assert.ok(!serialized.includes('endpoint'), 'must not contain endpoint');
  assert.ok(!serialized.includes('responseBody'), 'must not contain responseBody');
  assert.ok(!serialized.includes('title'), 'must not contain title');
  assert.ok(!serialized.includes('secret'), 'must not contain secret');
});

test('diagnostic: hasAuthHeaderPresent (sessionStorage inference) is not used', async () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(
    !src.includes('function hasAuthHeaderPresent'),
    'hasAuthHeaderPresent must be removed from my-trees-data.js'
  );
});

test('sanitizeRequestLifecycle: exists as function and is used in loadTrees', () => {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes('function sanitizeRequestLifecycle'), 'sanitizeRequestLifecycle must be defined');
  assert.ok(src.includes('requestLifecycle = sanitizeRequestLifecycle(meta)'), 'loadTrees must call sanitizeRequestLifecycle');
});

test('normalizePhase: bounded enum validation exists', () => {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes('function normalizePhase'), 'normalizePhase must be defined');
  assert.ok(src.includes("'generic'"), 'normalizePhase must have generic fallback');
});

test('normalizeStatusClass: bounded enum validation exists', () => {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes('function normalizeStatusClass'), 'normalizeStatusClass must be defined');
  assert.ok(src.includes("VALID_STATUS_CLASSES"), 'normalizeStatusClass must use VALID_STATUS_CLASSES map');
});

test('normalizeCountBucket: bounded enum validation exists', () => {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes('function normalizeCountBucket'), 'normalizeCountBucket must be defined');
  assert.ok(src.includes("'unknown'"), 'normalizeCountBucket must have unknown fallback');
});

test('emitLifecycleDiagnostic: uses Object.freeze for safe event', () => {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes('Object.freeze'), 'emitLifecycleDiagnostic must use Object.freeze');
});

test('loadTrees: apiClient.getTrees receives onLifecycle callback option', () => {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(
    src.includes('onLifecycle'),
    'loadTrees must pass onLifecycle to apiClient.getTrees'
  );
  assert.ok(
    src.includes('getTrees({'),
    'loadTrees must call getTrees with options object'
  );
});

test('postgres-client getTrees: forwards onLifecycle to base-api-fetch', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'postgres-client.js'), 'utf8');
  assert.ok(
    src.includes('onLifecycle'),
    'postgres-client.js getTrees must forward onLifecycle option'
  );
  assert.ok(
    src.includes("typeof options.onLifecycle === 'function'"),
    'postgres-client.js must check onLifecycle is a function'
  );
});

test('postgres-client getTrees: backward-compatible with no arguments', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'postgres-client.js'), 'utf8');
  assert.ok(
    src.includes('getTrees: async (options = {})'),
    'postgres-client.js getTrees must default options to {}'
  );
});

test('postgres-client: only getTrees forwards onLifecycle, other methods do not', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'postgres-client.js'), 'utf8');
    const getTreeSection = src.match(/getTree:\s*async[^}]+}/);
    assert.ok(getTreeSection, 'getTree method must exist');
    assert.ok(
      !getTreeSection[0].includes('onLifecycle'),
      'getTree must not forward onLifecycle'
    );
  });

test('classifyLoadError: auth_prepare_failed for _phase=auth_prepare_failed', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes("_phase === 'auth_prepare_failed'"), 'classifyLoadError must check _phase=auth_prepare_failed');
  assert.ok(src.includes("'auth_prepare_failed'"), 'classifyLoadError must return auth_prepare_failed');
});

test('classifyLoadError: auth_prepare_failed is checked before status 401/403', () => {
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  const fnMatch = src.match(/function classifyLoadError\(error\)\s*\{([\s\S]*?)^\s*\}/m);
  assert.ok(fnMatch, 'classifyLoadError function must exist');
  const fnBody = fnMatch[1];

  const phaseAuthPrepareIdx = fnBody.indexOf("_phase === 'auth_prepare_failed'");
  const authIdx = fnBody.indexOf("status === 401 || status === 403");

  assert.ok(phaseAuthPrepareIdx >= 0, '_phase=auth_prepare_failed check must exist');
  assert.ok(authIdx >= 0, 'status 401/403 check must exist');
  assert.ok(phaseAuthPrepareIdx < authIdx, '_phase=auth_prepare_failed must be checked before status 401/403');
});

test('classifyLoadError: status===0 without phase returns generic (not fetch_rejected)', () => {
  const { sandbox } = createSandbox();
  const src = fs.readFileSync(MY_TREES_DATA_PATH, 'utf8');
  assert.ok(src.includes("return 'generic'"), 'classifyLoadError must have generic fallback');
  assert.ok(
    !src.match(/status === 0\s*\)\s*return\s+'fetch_rejected'/),
    'classifyLoadError must NOT return fetch_rejected for status===0 without phase'
  );
});

test('loadTrees: auth_prepare_failed preserves cached list when cache exists', async () => {
  const cachedData = [{ id: 't1', title: 'Cached Tree' }];
  const cacheStore = { my_trees_list: cachedData };
  const mockCache = {
    get(key) { return cacheStore[key] || null; },
    set(key, value) { cacheStore[key] = value; },
  };

  const { sandbox } = createSandbox({
    cache: mockCache,
    apiClient: {
      getTrees: async () => {
        const err = new Error('Failed to prepare request authentication');
        err._phase = 'auth_prepare_failed';
        err._attempt = 1;
        err._retried = false;
        err._authHeaderPresent = false;
        throw err;
      },
    },
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
  const toastMessages = [];
  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (state, detail) => stateUpdates.push({ state, detail }),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: (trees) => rendered.push(trees),
    showToast: (msg, type) => toastMessages.push({ msg, type }),
  });

  assert.ok(rendered.length >= 1, 'must render cached trees');
  assert.ok(
    !stateUpdates.some(u => u.state === 'ERROR'),
    'must not transition to ERROR when cache exists'
  );
});

test('loadTrees: auth_prepare_failed transitions to error state when no cache', async () => {
  const { sandbox } = createSandbox({
    apiClient: {
      getTrees: async () => {
        const err = new Error('Failed to prepare request authentication');
        err._phase = 'auth_prepare_failed';
        err._attempt = 1;
        err._retried = false;
        err._authHeaderPresent = false;
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

  assert.equal(rendered.length, 0, 'must not render anything');
  assert.ok(
    stateUpdates.some(u => u.state === 'ERROR' && u.detail && u.detail.errorType === 'auth_prepare_failed'),
    'must transition to ERROR state with errorType=auth_prepare_failed'
  );
});

test('loadTrees: auth_prepare_failed must not clear confirmed auth state', async () => {
  const { sandbox, localStorageMock } = createSandbox({
    apiClient: {
      getTrees: async () => {
        const err = new Error('Failed to prepare request authentication');
        err._phase = 'auth_prepare_failed';
        err._attempt = 1;
        err._retried = false;
        err._authHeaderPresent = false;
        throw err;
      },
    },
    localStorage: {
      lovebud_auth_confirmed: 'true',
      lovebud_auth_cache: JSON.stringify({ uid: 'test-user' }),
    },
  });

  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: () => {},
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
  });

  assert.equal(localStorageMock.getItem('lovebud_auth_confirmed'), 'true', 'confirmed auth state must not be cleared');
  assert.ok(localStorageMock.getItem('lovebud_auth_cache'), 'auth cache must not be cleared');
});

test('loadTrees: unphased status-less error classifies as generic (not fetch_rejected)', async () => {
  const { sandbox } = createSandbox({
    apiClient: {
      getTrees: async () => { throw new Error('unexpected client exception'); },
    },
  });

  const stateUpdates = [];
  const rendered = [];
  await sandbox.window.LoveBudMyTreesData.loadTrees({
    setState: (state, detail) => stateUpdates.push({ state, detail }),
    stateEnum: { LOADING: 'LOADING', ERROR: 'ERROR' },
    renderTrees: (trees) => rendered.push(trees),
  });

  const errorState = stateUpdates.find(u => u.state === 'ERROR');
  assert.ok(errorState, 'must transition to ERROR state');
  assert.equal(errorState.detail.errorType, 'generic', 'unphased error must classify as generic');
  assert.notEqual(errorState.detail.errorType, 'fetch_rejected', 'unphased error must NOT classify as fetch_rejected');
});

test('loadTrees: explicit _phase=fetch_rejected classifies as fetch_rejected', async () => {
  const { sandbox } = createSandbox({
    apiClient: {
      getTrees: async () => {
        const err = new Error('fetch failed');
        err._phase = 'fetch_rejected';
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

  const errorState = stateUpdates.find(u => u.state === 'ERROR');
  assert.ok(errorState, 'must transition to ERROR state');
  assert.equal(errorState.detail.errorType, 'fetch_rejected', 'explicit fetch_rejected phase must classify as fetch_rejected');
});

test('loadTrees: auth_prepare_failed diagnostic event does not contain sensitive fields', async () => {
  const emitted = [];
  const mockSink = { emit(event) { emitted.push(event); } };

  const { sandbox } = createSandbox({
    apiClient: {
      getTrees: async () => {
        const err = new Error('Failed to prepare request authentication');
        err._phase = 'auth_prepare_failed';
        err._attempt = 1;
        err._retried = false;
        err._authHeaderPresent = false;
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

  assert.ok(emitted.length >= 1, 'must emit diagnostic event');
  const serialized = JSON.stringify(emitted);
  assert.ok(!serialized.includes('Authorization'), 'must not contain Authorization');
  assert.ok(!serialized.includes('token'), 'must not contain token');
  assert.ok(!serialized.includes('uid'), 'must not contain uid');
  assert.ok(!serialized.includes('email'), 'must not contain email');
});
