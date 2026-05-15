const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('explicit bearer token cache is session-scoped, not durable-localStorage scoped', () => {
  const apiSource = readRepoFile('js/api/base-api-fetch.js');
  const authCacheSource = readRepoFile('js/auth/auth-cache.js');
  const combinedSource = `${apiSource}\n${authCacheSource}`;

  assert.match(apiSource, /function\s+getTokenStorage\s*\(/, 'base API fetch must expose token storage helper');
  assert.match(authCacheSource, /function\s+getTokenStorage\s*\(/, 'auth cache must expose token storage helper');
  assert.match(combinedSource, /window\.sessionStorage/, 'explicit bearer token cache must use sessionStorage');

  assert.match(apiSource, /localStorage\.removeItem\(\s*AUTH_TOKEN_KEY\s*\)/, 'base API fetch must remove legacy durable token records');
  assert.match(authCacheSource, /localStorage\.removeItem\(\s*tokenKey\s*\)/, 'auth cache must remove legacy durable token records');

  assert.doesNotMatch(apiSource, /localStorage\.getItem\(\s*AUTH_TOKEN_KEY\s*\)/, 'base API fetch must not read bearer tokens from durable localStorage');
  assert.doesNotMatch(apiSource, /localStorage\.setItem\(\s*AUTH_TOKEN_KEY\s*,/, 'base API fetch must not write bearer tokens to durable localStorage');
  assert.doesNotMatch(authCacheSource, /localStorage\.getItem\(\s*tokenKey\s*\)/, 'auth cache must not read bearer tokens from durable localStorage');
  assert.doesNotMatch(authCacheSource, /localStorage\.setItem\(\s*tokenKey\s*,/, 'auth cache must not write bearer tokens to durable localStorage');
});

test('confirmed auth metadata remains separate from bearer token cache', () => {
  const authCacheSource = readRepoFile('js/auth/auth-cache.js');

  assert.match(authCacheSource, /localStorage\.setItem\(\s*cacheKey\s*,/, 'confirmed user metadata may remain in durable localStorage');
  assert.match(authCacheSource, /localStorage\.setItem\(\s*confirmedKey\s*,/, 'confirmed session flag may remain in durable localStorage');
  assert.match(authCacheSource, /clearAuthTokenCache\(\s*tokenKey\s*\)/, 'metadata-only updates must clear stale bearer token records');
  assert.match(authCacheSource, /tokenStorage\.setItem/, 'bearer token records must be written through token storage');
  assert.match(authCacheSource, /tokenStorage\.getItem/, 'bearer token records must be read through token storage');
});
