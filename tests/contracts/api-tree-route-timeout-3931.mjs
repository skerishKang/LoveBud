import assert from 'node:assert/strict';
import fs from 'node:fs';

const collection = fs.readFileSync(new URL('../../functions/api/trees.js', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../../functions/api/trees/[id].js', import.meta.url), 'utf8');

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function assertCanonicalTimeoutBoundary(label, source) {
  assert.match(source, /const MODAL_FETCH_TIMEOUT_MS = 25000;/, `${label}: canonical 25s timeout`);
  assert.match(source, /new AbortController\(\)/, `${label}: AbortController boundary`);
  assert.match(source, /setTimeout\(\(\) => controller\.abort\(\), timeoutMs\)/, `${label}: timeout abort`);
  assert.match(source, /fetch\(url, \{ \.\.\.options, signal: controller\.signal \}\)/, `${label}: upstream receives AbortSignal`);
  assert.match(source, /error && error\.name === 'AbortError'/, `${label}: AbortError classified separately`);
  assert.match(source, /status: 504/, `${label}: timeout is 504`);
  assert.match(source, /'x-lovebud-route-status': 'modal-timeout'/, `${label}: timeout taxonomy`);
  assert.match(source, /status: 503/, `${label}: unavailable is 503`);
  assert.match(source, /'x-lovebud-degraded': 'modal-unavailable'/, `${label}: unavailable taxonomy`);
}

assertCanonicalTimeoutBoundary('collection', collection);
assertCanonicalTimeoutBoundary('detail', detail);

// Collection GET + POST are both bounded. The only raw fetch is inside fetchWithTimeout itself.
assert.equal(count(collection, 'await fetchWithTimeout('), 2, 'collection GET and POST use bounded fetch');
assert.equal(count(collection, 'return await fetch(url, { ...options, signal: controller.signal });'), 1, 'collection has exactly one raw fetch seam');
assert.doesNotMatch(collection, /response = await fetch\(target\.toString\(\)/, 'collection cannot bypass timeout helper');

// Detail owner GET, authenticated 404 public fallback, anonymous GET, PUT and DELETE are all bounded.
assert.equal(count(detail, 'await fetchWithTimeout('), 5, 'detail GET/fallback/anonymous/PUT/DELETE use bounded fetch');
assert.equal(count(detail, 'return await fetch(url, { ...options, signal: controller.signal });'), 1, 'detail has exactly one raw fetch seam');
assert.doesNotMatch(detail, /response = await fetch\(primaryTarget\.toString\(\)/, 'owner GET cannot bypass timeout helper');
assert.doesNotMatch(detail, /response = await fetch\(publicTarget\.toString\(\)/, '404 fallback cannot bypass timeout helper');
assert.doesNotMatch(detail, /modalResponse = await fetch\(targetUrl\.toString\(\)/, 'anonymous GET cannot bypass timeout helper');
assert.doesNotMatch(detail, /const response = await fetch\(target\.toString\(\)/, 'writes cannot bypass timeout helper');

// Negative controls: timeout and generic network rejection must stay distinguishable.
for (const [label, source] of [['collection', collection], ['detail', detail]]) {
  const failureBody = source.slice(source.indexOf('function modalFailureResponse'));
  assert.match(failureBody, /if \(error && error\.name === 'AbortError'\)[\s\S]*buildModalTimeoutResponse/, `${label}: AbortError -> timeout`);
  assert.match(failureBody, /return buildModalUnavailableResponse/, `${label}: non-Abort rejection -> unavailable`);
}

// Existing security/resource ordering must remain intact for writes.
assert.ok(collection.indexOf('if (!hasAuthorizationHeader(request))') < collection.indexOf('const bodyResult = await readBoundedWriteBody(request)'), 'POST auth remains before body read');
assert.ok(detail.indexOf('if (!hasAuthorizationHeader(request))') < detail.indexOf('const bodyResult = await readBoundedWriteBody(request)'), 'PUT auth remains before body read');
assert.match(detail, /if \(!hasAuthorizationHeader\(context\.request\)\)[\s\S]*buildMissingAuthorizationResponse/, 'DELETE auth guard retained');

console.log('api-tree-route-timeout-3931: PASS');
