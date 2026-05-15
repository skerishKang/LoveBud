const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function getFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} must exist`);
  const braceStart = source.indexOf('{', start);
  assert.notEqual(braceStart, -1, `${functionName} must have a body`);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(braceStart, index + 1);
    }
  }
  throw new Error(`Could not parse ${functionName} body`);
}

test('API fetch bearer token cache is session scoped and clears legacy durable token records', () => {
  const source = readRepoFile('js/api/base-api-fetch.js');

  assert.match(source, /function\s+getTokenStorage\s*\(/, 'base API fetch must expose token storage helper');
  assert.match(source, /window\.sessionStorage/, 'base API bearer token cache must use sessionStorage');
  assert.match(source, /function\s+removeLegacyDurableTokenRecord\s*\(/, 'base API fetch must remove legacy durable token records');
  assert.match(source, /localStorage\.removeItem\(AUTH_TOKEN_KEY\)/, 'base API fetch must remove legacy localStorage token records');
  assert.match(source, /function\s+clearCachedTokenRecord\s*\(/, 'base API fetch must expose token cache clearing helper');
  assert.match(source, /clearCachedTokenRecord/, 'base API fetch export must include token cache clearing helper');

  const getCachedTokenBody = getFunctionBody(source, 'getCachedTokenRecord');
  const setCachedTokenBody = getFunctionBody(source, 'setCachedTokenRecord');

  assert.doesNotMatch(
    getCachedTokenBody,
    /localStorage\.getItem\(AUTH_TOKEN_KEY\)/,
    'base API fetch must not read bearer tokens from durable localStorage'
  );
  assert.doesNotMatch(
    setCachedTokenBody,
    /localStorage\.setItem\(AUTH_TOKEN_KEY/,
    'base API fetch must not write bearer tokens to durable localStorage'
  );
  assert.match(
    getCachedTokenBody,
    /storage\.getItem\(AUTH_TOKEN_KEY\)/,
    'base API fetch must read bearer tokens from session token storage'
  );
  assert.match(
    setCachedTokenBody,
    /storage\.setItem\(AUTH_TOKEN_KEY/,
    'base API fetch must write bearer tokens to session token storage'
  );
});

test('auth cache persists confirmed user metadata separately from session-scoped bearer token', () => {
  const source = readRepoFile('js/auth/auth-cache.js');

  assert.match(source, /function\s+getTokenStorage\s*\(/, 'auth cache must expose token storage helper');
  assert.match(source, /window\.sessionStorage/, 'auth cache bearer token storage must use sessionStorage');
  assert.match(source, /function\s+clearAuthTokenCache\s*\(/, 'auth cache must expose token cache clearing helper');
  assert.match(source, /localStorage\.removeItem\(tokenKey\)/, 'auth cache must clear legacy durable token records');

  const persistBody = getFunctionBody(source, 'persistConfirmedAuthSession');
  const getCachedAuthTokenBody = getFunctionBody(source, 'getCachedAuthToken');
  const setConfirmedAuthCacheBody = getFunctionBody(source, 'setConfirmedAuthCache');

  assert.match(
    persistBody,
    /localStorage\.setItem\(cacheKey/,
    'confirmed user metadata may remain in durable localStorage'
  );
  assert.match(
    persistBody,
    /localStorage\.setItem\(confirmedKey/,
    'confirmed session flag may remain in durable localStorage'
  );
  assert.doesNotMatch(
    persistBody,
    /localStorage\.setItem\(\s*tokenKey/,
    'auth cache must not write bearer tokens to durable localStorage'
  );
  assert.match(
    persistBody,
    /tokenStorage\.setItem\(\s*tokenKey/,
    'auth cache must write bearer tokens to session token storage'
  );
  assert.doesNotMatch(
    getCachedAuthTokenBody,
    /localStorage\.getItem\(tokenKey\)/,
    'auth cache must not read bearer tokens from durable localStorage'
  );
  assert.match(
    getCachedAuthTokenBody,
    /tokenStorage\.getItem\(tokenKey\)/,
    'auth cache must read bearer tokens from session token storage'
  );
  assert.match(
    setConfirmedAuthCacheBody,
    /clearAuthTokenCache\(tokenKey\)/,
    'metadata-only cache updates must not leave stale bearer token records behind'
  );
});
