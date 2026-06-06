/**
 * Scout Suggestion Endpoint — stub-first skeleton
 * Phase D prep: returns deterministic stub suggestions only
 * v20260606-1
 *
 * POST /api/scout/suggest
 * No real LLM, no API keys, no external fetch, no persistence
 */

const REQUEST_ID_HEADER = 'x-lovebud-request-id';
const MAX_BODY_SIZE = 131072; // 128KB

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

  return { tooLarge: false, body: bodyText };
}

function buildErrorResponse(code, message, requestId, status = 400) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': code.toLowerCase().replace(/_/g, '-'),
    [REQUEST_ID_HEADER]: requestId
  };
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), { status, headers });
}

function buildSuccessResponse(suggestion, providerMode, requestId) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'ok',
    [REQUEST_ID_HEADER]: requestId
  };
  return new Response(JSON.stringify({ ok: true, providerMode, suggestion }), { status: 200, headers });
}

function normalizeString(value, maxLen = 5000) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function validateRequest(body) {
  const errors = [];

  const excerpt = normalizeString(body?.excerpt);
  if (!excerpt) {
    errors.push('excerpt is required');
  }

  const sourceUrl = normalizeString(body?.sourceUrl, 2048);
  if (sourceUrl) {
    try {
      new URL(sourceUrl); // validate URL format
    } catch {
      errors.push('sourceUrl must be a valid URL');
    }
  }

  const summary = normalizeString(body?.summary, 5000);
  const memo = normalizeString(body?.memo, 5000);

  const requestedLanguage = normalizeString(body?.requestedLanguage || body?.lang || 'ko', 10);
  if (!['ko', 'en'].includes(requestedLanguage)) {
    errors.push('requestedLanguage must be ko or en');
  }

  const desiredTone = normalizeString(body?.desiredTone || body?.tone || 'polite', 20);
  if (!['casual', 'polite', 'emotional'].includes(desiredTone)) {
    errors.push('desiredTone must be casual, polite, or emotional');
  }

  let maxOutputLength = Number(body?.maxOutputLength || body?.maxTokens || 200);
  if (!Number.isFinite(maxOutputLength)) maxOutputLength = 200;
  maxOutputLength = Math.min(Math.max(maxOutputLength, 50), 500);

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      excerpt,
      sourceUrl,
      summary,
      memo,
      requestedLanguage,
      desiredTone,
      maxOutputLength
    }
  };
}

function generateStubSuggestion(input) {
  const { excerpt, sourceUrl, summary, memo, requestedLanguage, desiredTone, maxOutputLength } = input;

  // Deterministic stub based on input hash
  const seed = (excerpt + sourceUrl + summary + memo).length;

  const titleBase = excerpt.slice(0, 30) || '제목 없음';
  const summaryBase = summary || excerpt.slice(0, 100) || '내용 없음';
  const memoBase = memo || excerpt.slice(0, 200) || '메모 없음';

  const langSuffix = requestedLanguage === 'en' ? ' (suggested)' : ' (제안)';
  const tonePrefix = desiredTone === 'emotional' ? '감동적인 ' : desiredTone === 'casual' ? '편안한 ' : '정중한 ';

  const baseTags = ['감동', '행복', '위로', '기쁨', '설렘', '평온', '감사', '희망'];
  const tagCount = Math.min(4, (seed % 4) + 1);
  const emotionTags = baseTags.slice(0, tagCount).map(t => t.slice(0, 20));

  return {
    titleSuggestion: (tonePrefix + titleBase + langSuffix).slice(0, 50),
    summarySuggestion: (summaryBase + langSuffix).slice(0, 200),
    translationSuggestion: requestedLanguage === 'en'
      ? ('Translated: ' + excerpt.slice(0, 150)).slice(0, 500)
      : ('번역: ' + excerpt.slice(0, 150)).slice(0, 500),
    emotionTags,
    memoSuggestion: (tonePrefix + memoBase + langSuffix).slice(0, 2000),
    safetyNote: requestedLanguage === 'en'
      ? 'This is a suggestion. Please review before saving.'
      : '이 제안은 자동 생성되었습니다. 저장 전 검토해 주세요.'
  };
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = getOrCreateRequestId(request);

  // Method is already guaranteed by onRequestPost, but keep guard for safety
  if (request.method.toUpperCase() !== 'POST') {
    return buildErrorResponse('VALIDATION_ERROR', 'Only POST is supported', requestId, 405);
  }

  // Parse JSON body
  let body;
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return buildErrorResponse('VALIDATION_ERROR', 'Content-Type must be application/json', requestId, 400);
  }

  const bodyResult = await readBoundedBody(request);
  if (bodyResult.tooLarge) {
    return buildErrorResponse('VALIDATION_ERROR', 'Request body too large', requestId, 413);
  }

  try {
    body = bodyResult.body ? JSON.parse(bodyResult.body) : {};
  } catch (e) {
    return buildErrorResponse('VALIDATION_ERROR', 'Invalid JSON body', requestId, 400);
  }

  // Validate request
  const validation = validateRequest(body);
  if (!validation.valid) {
    return buildErrorResponse('VALIDATION_ERROR', validation.errors.join('; '), requestId, 400);
  }

  // TODO: Auth verification — placeholder for Phase D
  // const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  // if (!authHeader) return buildErrorResponse('UNAUTHORIZED', 'Authorization required', requestId, 401);
  // Verify Firebase ID token here when ready

  // TODO: Rate limiting — placeholder for Phase D
  // Check rate limit via KV/Durable Objects when ready

  // TODO: Live provider integration — placeholder for Phase D
  // if (env.SCOUT_LLM_API_KEY) {
  //   try { return await callLiveProvider(validation.normalized, env); }
  //   catch { return buildErrorResponse('PROVIDER_UNAVAILABLE', 'AI suggestion service temporarily unavailable', requestId, 503); }
  // }
  // If live provider not configured, fall through to stub
  // buildErrorResponse('CONFIG_MISSING', 'AI suggestion not configured', requestId, 503);
  // Standard error codes: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, RATE_LIMITED, PROVIDER_UNAVAILABLE, PROVIDER_ERROR, CONFIG_MISSING, INTERNAL_ERROR

  // Return deterministic stub suggestion
  const suggestion = generateStubSuggestion(validation.normalized);

  return buildSuccessResponse(suggestion, 'stub', requestId);
}

// ─── Other methods: not allowed ─────────────────────────────────────────────

async function onRequestNotAllowed(context, requestId) {
  return buildErrorResponse('VALIDATION_ERROR', 'Only POST is supported', requestId, 405);
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