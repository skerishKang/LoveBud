import { validateReviewedPayload } from './save-memory-intake.js';

const REQUEST_ID_HEADER = 'x-lovebud-request-id';
const MAX_BODY_SIZE = 131072;

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function generateRequestId() {
  return 'req-' + crypto.randomUUID();
}

function getOrCreateRequestId(request) {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  if (existing && /^[A-Za-z0-9._:-]+$/.test(existing) && existing.length <= 80) {
    return existing;
  }
  return generateRequestId();
}

async function readBoundedBody(request) {
  let bodyText;
  try {
    bodyText = await request.text();
  } catch {
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
  return { tooLarge: false, body: bodyText };
}

function buildErrorResponse(code, message, requestId, status) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': code.toLowerCase().replace(/_/g, '-'),
    [REQUEST_ID_HEADER]: requestId,
  };
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), { status, headers });
}

function buildIntakeResponse(reviewed, requestId) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'intake-accepted',
    [REQUEST_ID_HEADER]: requestId,
  };
  return new Response(
    JSON.stringify({ ok: true, status: 'intake_accepted', persistence: 'gated', reviewed }),
    { status: 202, headers }
  );
}

function safetyNote() {
  return { message: 'This is a draft. Please review before saving.' };
}

export async function onRequestPost(context) {
  const { request } = context;
  const requestId = getOrCreateRequestId(request);

  if (request.method.toUpperCase() !== 'POST') {
    return buildErrorResponse('invalid_payload', 'Only POST is supported', requestId, 405);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return buildErrorResponse('invalid_payload', 'Content-Type must be application/json', requestId, 400);
  }

  const bodyResult = await readBoundedBody(request);
  if (bodyResult.tooLarge) {
    return buildErrorResponse('invalid_payload', 'Request body too large', requestId, 413);
  }

  let parsed;
  try {
    parsed = bodyResult.body ? JSON.parse(bodyResult.body) : {};
  } catch {
    return buildErrorResponse('invalid_payload', 'Invalid JSON body', requestId, 400);
  }

  const validation = validateReviewedPayload(parsed);
  if (!validation.ok) {
    const statusMap = {
      unreviewed_generated_only: 400,
      forbidden_content: 422,
      unsafe_source: 422,
    };
    const status = statusMap[validation.error.code] || 400;
    return buildErrorResponse(validation.error.code, validation.error.message, requestId, status);
  }

  return buildIntakeResponse(validation.reviewed, requestId);
}

async function onRequestNotAllowed(context, requestId) {
  return buildErrorResponse('invalid_payload', 'Only POST is supported', requestId, 405);
}

export async function onRequestGet(context) {
  const requestId = getOrCreateRequestId(context.request);
  return onRequestNotAllowed(context, requestId);
}

export async function onRequestPut(context) {
  const requestId = getOrCreateRequestId(context.request);
  return onRequestNotAllowed(context, requestId);
}

export async function onRequestDelete(context) {
  const requestId = getOrCreateRequestId(context.request);
  return onRequestNotAllowed(context, requestId);
}

export async function onRequestPatch(context) {
  const requestId = getOrCreateRequestId(context.request);
  return onRequestNotAllowed(context, requestId);
}

export async function onRequestOptions(context) {
  const requestId = getOrCreateRequestId(context.request);
  return onRequestNotAllowed(context, requestId);
}
