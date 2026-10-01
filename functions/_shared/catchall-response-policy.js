/**
 * Catch-all response policy (Issue #4535, Slice 4).
 *
 * Owns the pure response TAXONOMY of functions/api/[[path]].js: the terminal
 * answers the gateway produces when a request does not (or cannot) become an
 * upstream call, or when it becomes one that fails at a known boundary.
 *
 *   - 404 unhandled / 405 method-not-allowed: the path is owned by this
 *     gateway but the method is not allowed on it;
 *   - 401 missing-authorization: an auth-first edge rejection;
 *   - 413 payload-too-large / 503 body-read-failed: bounded body read limits;
 *   - 503 modal-unavailable: a degraded Modal authority;
 *   - 504 modal-timeout: an upstream fetch that aborted.
 *
 * These builders are pure: they take an optional request id and return a new
 * Response. They perform no fetch, no body read and no routing. The gateway
 * keeps every decision that decides WHICH of these is used — auth checks,
 * bounded body reads and their ordering, the Modal read/write orchestration,
 * the AbortError -> 504 conversion, the 404 fallback, cache/no-store behaviour
 * and the Direct-Neon gates — because transport and policy are different
 * concerns from the response shape they produce.
 *
 * Cloudflare Functions ESM. Refs #4535.
 */

import { REQUEST_ID_HEADER } from './request-id.js';

// 503 — the bounded body read failed before the upstream call could be made.
export function buildBodyReadFailedResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'body-read-failed'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Request body read failed' }), {
    status: 503,
    headers
  });
}

// 413 — the bounded body read exceeded its limit.
export function buildPayloadTooLargeResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'payload-too-large'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Request body too large' }), { status: 413, headers });
}

// 404 — no route owns this path.
export function buildNotFoundResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'unhandled'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Route not found' }), { status: 404, headers });
}

// 405 — the path is owned here but the method is not allowed on it.
export function buildMethodNotAllowedResponse(allow = 'GET', requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'method-not-allowed',
    'allow': allow,
    [REQUEST_ID_HEADER]: requestId
  };
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}

// 503 — the Modal authority is degraded and no fallback is permitted.
export function buildModalUnavailableResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'modal',
    'x-lovebud-degraded': 'modal-unavailable'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Modal backend unavailable' }), { status: 503, headers });
}

// 401 — an auth-first edge rejection that must not reach the upstream.
export function buildMissingAuthorizationResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'missing-authorization'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers });
}

// 504 — an upstream Modal fetch aborted on its timeout budget.
export function buildModalTimeoutResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'modal',
    'x-lovebud-route-status': 'modal-timeout'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Modal upstream timeout' }), { status: 504, headers });
}