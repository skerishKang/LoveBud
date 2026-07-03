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

const MAX_BODY_SIZE = 131072; // 128KB

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

  const memoryId = context.params?.id;
  const target = new URL(`/modal/private/memories/${memoryId}/comments`, modalBaseUrl);

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

export async function onRequestPost(context) {
  const { request } = context;

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey) {
    return buildIdempotencyKeyRequiredResponse();
  }
  if (!KEY_PATTERN.test(idempotencyKey)) {
    return buildIdempotencyKeyInvalidResponse();
  }

  const bodyResult = await readBoundedWriteBody(request);
  if (bodyResult.tooLarge) {
    return buildPayloadTooLargeResponse();
  }

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  const memoryId = context.params?.id;
  const target = new URL(`/modal/private/memories/${memoryId}/comments`, modalBaseUrl);

  let response;
  try {
    response = await fetch(target.toString(), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': request.headers.get('content-type') || 'application/json',
        'Idempotency-Key': idempotencyKey,
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
