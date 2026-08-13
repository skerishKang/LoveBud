import { fetchModalWithTimeout, isModalTimeoutError } from '../../../_shared/modal-fetch.js';
import { readBoundedRequestBody } from '../../../_shared/bounded-request-body.js';

// Canonical request-body size boundary: 128 KB / 128 KiB (131072 bytes), owned and enforced by the shared reader.
function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

function withModalHeader(response) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-upstream', 'modal');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

const KEY_PATTERN = /^[A-Za-z0-9._:\-]{8,128}$/;

function buildMissingAuthorizationResponse() {
  return new Response(JSON.stringify({ error: 'Authorization required' }), {
    status: 401,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'missing-authorization'
    }
  });
}

function buildPayloadTooLargeResponse() {
  return new Response(JSON.stringify({ error: 'Payload too large' }), {
    status: 413,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function buildIdempotencyKeyRequiredResponse() {
  return new Response(JSON.stringify({
    error: 'Idempotency-Key header is required for this operation',
    code: 'IDEMPOTENCY_KEY_REQUIRED'
  }), {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function buildIdempotencyKeyInvalidResponse() {
  return new Response(JSON.stringify({
    error: 'Idempotency-Key must be 8-128 ASCII characters from [A-Za-z0-9._:-]',
    code: 'IDEMPOTENCY_KEY_INVALID'
  }), {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function buildBodyReadFailureResponse() {
  return new Response(JSON.stringify({ error: 'Request body could not be read' }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'body-read-failed'
    }
  });
}

function buildModalUnavailableResponse() {
  return new Response(JSON.stringify({ error: 'Modal service temporarily unavailable' }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'modal',
      'x-lovebud-degraded': 'modal-unavailable'
    }
  });
}

function buildModalTimeoutResponse() {
  return new Response(JSON.stringify({ error: 'Modal upstream timeout' }), {
    status: 504,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'modal',
      'x-lovebud-route-status': 'modal-timeout'
    }
  });
}

function buildModalConfigUnavailableResponse() {
  return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
    status: 503,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function getAuthorization(request) {
  return request.headers.get('authorization') || request.headers.get('Authorization');
}

async function fetchModal(target, options) {
  try {
    return await fetchModalWithTimeout(target, options);
  } catch (error) {
    if (isModalTimeoutError(error)) return buildModalTimeoutResponse();
    return buildModalUnavailableResponse();
  }
}

export async function onRequestGet(context) {
  const authorization = getAuthorization(context.request);
  if (!authorization) return buildMissingAuthorizationResponse();

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) return buildModalConfigUnavailableResponse();

  const memoryId = context.params?.id;
  const target = new URL(`/modal/private/memories/${memoryId}/comments`, modalBaseUrl);
  const response = await fetchModal(target.toString(), {
    headers: { accept: 'application/json', authorization }
  });
  return response.status >= 500 && response.headers.get('x-lovebud-upstream') === 'modal'
    ? response
    : withModalHeader(response);
}

export async function onRequestPost(context) {
  const { request } = context;
  const authorization = getAuthorization(request);
  if (!authorization) return buildMissingAuthorizationResponse();

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey) return buildIdempotencyKeyRequiredResponse();
  if (!KEY_PATTERN.test(idempotencyKey)) return buildIdempotencyKeyInvalidResponse();

  const bodyResult = await readBoundedRequestBody(request);
  if (bodyResult.status === 'tooLarge') return buildPayloadTooLargeResponse();
  if (bodyResult.status === 'readError') return buildBodyReadFailureResponse();

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) return buildModalConfigUnavailableResponse();

  const memoryId = context.params?.id;
  const target = new URL(`/modal/private/memories/${memoryId}/comments`, modalBaseUrl);
  const response = await fetchModal(target.toString(), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': request.headers.get('content-type') || 'application/json',
      'Idempotency-Key': idempotencyKey,
      authorization
    },
    body: bodyResult.body
  });
  return response.status >= 500 && response.headers.get('x-lovebud-upstream') === 'modal'
    ? response
    : withModalHeader(response);
}
