const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('API fetch keeps explicit bearer token cache out of durable localStorage', () => {
  const source = readRepoFile('js/api/base-api-fetch.js');

  assert.match(source, /function\s+getTokenStorage\s*\(/, 'base API fetch must expose token storage helper');
  assert.match(source, /window\.sessionStorage/, 'base API bearer token cache must use sessionStorage');
  assert.match(source, /localStorage\.removeItem\(\s*AUTH_TOKEN_KEY\s*\)/, 'base API fetch must remove legacy localStorage token records');
  assert.match(source, /storage\.getItem\(\s*AUTH_TOKEN_KEY\s*\)/, 'base API fetch must read bearer tokens from session token storage');
  assert.match(source, /storage\.setItem\(\s*AUTH_TOKEN_KEY\s*,/, 'base API fetch must write bearer tokens to session token storage');

  assert.doesNotMatch(source, /localStorage\.getItem\(\s*AUTH_TOKEN_KEY\s*\)/, 'base API fetch must not read bearer tokens from durable localStorage');
  assert.doesNotMatch(source, /localStorage\.setItem\(\s*AUTH_TOKEN_KEY\s*,/, 'base API fetch must not write bearer tokens to durable localStorage');
});

test('auth cache stores metadata durably but bearer tokens only in token storage', () => {
  const source = readRepoFile('js/auth/auth-cache.js');

  assert.match(source, /function\s+getTokenStorage\s*\(/, 'auth cache must expose token storage helper');
  assert.match(source, /window\.sessionStorage/, 'auth cache bearer token storage must use sessionStorage');
  assert.match(source, /localStorage\.setItem\(\s*cacheKey\s*,/, 'confirmed user metadata may remain in durable localStorage');
  assert.match(source, /localStorage\.setItem\(\s*confirmedKey\s*,/, 'confirmed session flag may remain in durable localStorage');
  assert.match(source, /localStorage\.removeItem\(\s*tokenKey\s*\)/, 'auth cache must clear legacy durable token records');
  assert.match(source, /tokenStorage\.getItem\(\s*tokenKey\s*\)/, 'auth cache must read bearer tokens from session token storage');
  assert.match(source, /tokenStorage\.setItem\(\s*tokenKey\s*,/, 'auth cache must write bearer tokens to session token storage');

  assert.doesNotMatch(source, /localStorage\.getItem\(\s*tokenKey\s*\)/, 'auth cache must not read bearer tokens from durable localStorage');
  assert.doesNotMatch(source, /localStorage\.setItem\(\s*tokenKey\s*,/, 'auth cache must not write bearer tokens to durable localStorage');
});
