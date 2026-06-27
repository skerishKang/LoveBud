import { validateWritePayload } from '../_shared/legacy-key-guard.js';

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

const MAX_BODY_SIZE = 131072; // 128KB

function buildPayloadTooLargeResponse() {
  return new Response(JSON.stringify({ error: 'Payload too large' }), {
    status: 413,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

async function readBoundedWriteBody(request) {
  let bodyText;
  try {
    bodyText = await request.text();
  } catch (e) {
    return { tooLarge: true, body: null };
  }

  if (!bodyText) {
    return { tooLarge: false, body: null };
  }

  const encoder = new TextEncoder();
  const encoded = encoder.encode(bodyText);
  if (encoded.byteLength > MAX_BODY_SIZE) {
    return { tooLarge: true, body: null };
  }

  return { tooLarge: false, body: encoded };
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

export async function onRequestGet(context) {
  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  const sourceUrl = new URL(context.request.url);
  const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 100) || 100, 1), 200);
  const target = new URL('/modal/private/trees', modalBaseUrl);
  target.searchParams.set('limit', String(limit));

  let response;
  try {
    response = await fetch(target.toString(), {
      headers: {
        accept: 'application/json',
        ...(context.request.headers.get('authorization')
          ? { authorization: context.request.headers.get('authorization') }
          : {})
      }
    });
  } catch (error) {
    return buildModalUnavailableResponse();
  }

  return withModalHeader(response);
}

function hasAuthorizationHeader(request) {
  return !!(request.headers.get('authorization') || request.headers.get('Authorization'));
}

function buildMissingAuthorizationResponse() {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'missing-authorization'
  };
  return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers });
}

export async function onRequestPost(context) {
  const { request } = context;

  if (!hasAuthorizationHeader(request)) {
    return buildMissingAuthorizationResponse();
  }

  const bodyResult = await readBoundedWriteBody(request);
  if (bodyResult.tooLarge) {
    return buildPayloadTooLargeResponse();
  }

  // Legacy localization key write-boundary guard (#2940)
  if (bodyResult.body) {
    try {
      const payload = JSON.parse(new TextDecoder().decode(bodyResult.body));
      const guard = validateWritePayload(payload, ['title', 'memo']);
      if (guard) return guard;
    } catch (_) { /* non-JSON upstream; skip guard */ }
  }

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  let response;
  try {
    response = await fetch(new URL('/modal/private/trees', modalBaseUrl).toString(), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': request.headers.get('content-type') || 'application/json',
        ...(request.headers.get('authorization')
          ? { authorization: request.headers.get('authorization') }
          : {})
      },
      body: bodyResult.body
    });
  } catch (error) {
    return buildModalUnavailableResponse();
  }

  return withModalHeader(response);
}
