const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function loadPolicy() {
  const source = fs.readFileSync(path.join(ROOT, 'js/api/auth-policy.js'), 'utf8');
  const storage = new Map();
  const localStorageMock = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  };
  const sandbox = {
    window: {
      __LOVEBUD_AUTH_WAIT_MS: 2000,
      __lovebudAuthReady: false,
    },
    localStorage: localStorageMock,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { policy: sandbox.window.LoveTreeAuthPolicy, storage: localStorageMock };
}

test('auth policy keeps community endpoints public-classified', () => {
  const { policy } = loadPolicy();
  assert.equal(policy.endpointLikelyRequiresAuth('/community/trees'), false);
  assert.equal(policy.endpointLikelyRequiresAuth('/trees'), true);
});

test('auth policy detects confirmed session from cache', () => {
  const { policy, storage } = loadPolicy();
  storage.setItem('lovebud_auth_confirmed', 'true');
  storage.setItem('lovebud_auth_cache', JSON.stringify({ uid: 'u1' }));
  assert.equal(policy.hasConfirmedAuthSession(), true);
});