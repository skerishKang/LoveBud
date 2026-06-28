const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function loadNormalize() {
  var ctx = vm.createContext({
    window: {},
    console: { error: function() {}, log: function() {}, warn: function() {} }
  });
  vm.runInContext(fs.readFileSync('js/utils/normalize.js', 'utf8'), ctx);
  return ctx.window.LoveBudNormalize;
}

test('1. { ownerId: "uid-api" } → ownerId/userId 모두 "uid-api"', function() {
  var normalize = loadNormalize();
  var result = normalize.normalizeTree({ id: 't1', ownerId: 'uid-api' });
  assert.equal(result.ownerId, 'uid-api');
  assert.equal(result.userId, 'uid-api');
});

test('2. { owner_id: "uid-snake" } → ownerId/userId 모두 "uid-snake"', function() {
  var normalize = loadNormalize();
  var result = normalize.normalizeTree({ id: 't1', owner_id: 'uid-snake' });
  assert.equal(result.ownerId, 'uid-snake');
  assert.equal(result.userId, 'uid-snake');
});

test('3. { userId: "uid-legacy" } → ownerId/userId 모두 "uid-legacy"', function() {
  var normalize = loadNormalize();
  var result = normalize.normalizeTree({ id: 't1', userId: 'uid-legacy' });
  assert.equal(result.ownerId, 'uid-legacy');
  assert.equal(result.userId, 'uid-legacy');
});

test('4. { user_id: "uid-legacy-snake" } → ownerId/userId 모두 "uid-legacy-snake"', function() {
  var normalize = loadNormalize();
  var result = normalize.normalizeTree({ id: 't1', user_id: 'uid-legacy-snake' });
  assert.equal(result.ownerId, 'uid-legacy-snake');
  assert.equal(result.userId, 'uid-legacy-snake');
});

test('5. ownerId와 userId가 함께 있으면 ownerId가 우선', function() {
  var normalize = loadNormalize();
  var result = normalize.normalizeTree({ id: 't1', ownerId: 'uid-owner', userId: 'uid-user' });
  assert.equal(result.ownerId, 'uid-owner');
  assert.equal(result.userId, 'uid-owner');
});

test('5b. ownerId와 owner_id가 함께 있으면 ownerId가 우선', function() {
  var normalize = loadNormalize();
  var result = normalize.normalizeTree({ id: 't1', ownerId: 'uid-camel', owner_id: 'uid-snake' });
  assert.equal(result.ownerId, 'uid-camel');
  assert.equal(result.userId, 'uid-camel');
});

test('6. owner identity 없는 record → 둘 다 null', function() {
  var normalize = loadNormalize();
  var result = normalize.normalizeTree({ id: 't1', title: 'No owner' });
  assert.equal(result.ownerId, null);
  assert.equal(result.userId, null);
});

test('7. normalize 결과를 JSON stringify/parse한 뒤에도 ownerId/userId 보존', function() {
  var normalize = loadNormalize();
  var result = normalize.normalizeTree({ id: 't1', ownerId: 'uid-persist' });
  var roundtripped = JSON.parse(JSON.stringify(result));
  assert.equal(roundtripped.ownerId, 'uid-persist');
  assert.equal(roundtripped.userId, 'uid-persist');
});
