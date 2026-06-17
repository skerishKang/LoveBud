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

// ─── Auth / Rate-Limit Boundary Helpers (Contract-only, placeholder) ──────────────

const SCOUT_SUGGEST_RATE_LIMITS = {
  free: { requestsPerMinute: 5, windowSeconds: 60 },
  authenticated: { requestsPerMinute: 10, windowSeconds: 60 },
};

function parseScoutAuthorizationHeader(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return { ok: false, scheme: '', token: '', errorCode: 'UNAUTHORIZED', message: 'Authorization header missing' };
  }
  const parts = headerValue.trim().split(/\s+/);
  if (parts.length !== 2) {
    return { ok: false, scheme: '', token: '', errorCode: 'UNAUTHORIZED', message: 'Authorization header malformed' };
  }
  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== 'bearer') {
    return { ok: false, scheme, token: '', errorCode: 'UNAUTHORIZED', message: 'Authorization scheme must be Bearer' };
  }
  if (!token || token.length === 0) {
    return { ok: false, scheme, token: '', errorCode: 'UNAUTHORIZED', message: 'Bearer token missing' };
  }
  // Token value is intentionally NOT logged or included in error messages
  return { ok: true, scheme: 'Bearer', token: token.trim(), errorCode: '', message: '' };
}

function getScoutSuggestRateLimitPolicy(tier) {
  const normalizedTier = (tier === 'authenticated' ? 'authenticated' : 'free');
  const policy = SCOUT_SUGGEST_RATE_LIMITS[normalizedTier];
  return { tier: normalizedTier, requestsPerMinute: policy.requestsPerMinute, windowSeconds: policy.windowSeconds };
}

// TODO: Firebase Admin SDK verification — future boundary only
// import { getAuth } from 'firebase-admin/auth';
// async function verifyScoutFirebaseToken(token) { /* placeholder */ }

// TODO: Persistent rate-limit storage — future boundary only
// async function checkScoutRateLimit(userId, tier) { /* placeholder using KV/Durable Objects */ }

import {
  createScoutLiveProviderAdapter,
  createScoutRealProviderAdapterInterface,
  SCOUT_LIVE_PROVIDER_INTERFACE_STATUS,
} from "./live-provider-adapter.js";
import {
  createScoutLiveProviderTransport,
  SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER,
} from "./live-provider-api-key-transport.js";
import {
  verifyScoutLiveAuthBoundary,
  checkScoutLiveRateLimitBoundary,
} from "./live-auth-rate-limit-boundary.js";
import {
  buildScoutLiveAuthEvent,
  buildScoutLiveRateLimitEvent,
  safeInvokeScoutLiveObserver,
} from "./live-auth-rate-limit-observability.js";
import {
  createScoutLiveDependencyAdapter,
} from "./live-auth-rate-limit-dependency-adapter.js";

const SCOUT_SUGGEST_PROVIDER_MODES = {
  STUB: 'stub',
  LIVE: 'live',
};

function resolveScoutSuggestProviderMode(env) {
  // Default is stub — no live provider call ever made without explicit config
  const mode = (env?.SCOUT_SUGGEST_PROVIDER_MODE || '').toLowerCase();

  if (mode === SCOUT_SUGGEST_PROVIDER_MODES.LIVE) {
    // Check if required live config is present (placeholder — no actual secret required yet)
    const hasLiveConfig = !!(
      env?.SCOUT_SUGGEST_LLM_PROVIDER &&
      env?.SCOUT_SUGGEST_LLM_API_KEY &&
      env?.SCOUT_SUGGEST_MODEL
    );
    if (!hasLiveConfig) {
      return {
        providerMode: SCOUT_SUGGEST_PROVIDER_MODES.LIVE,
        status: 'config_missing',
        safeToCallLiveProvider: false,
        error: { code: 'CONFIG_MISSING', message: 'Scout live suggestion provider is not configured' },
      };
    }
    return {
      providerMode: SCOUT_SUGGEST_PROVIDER_MODES.LIVE,
      status: 'available',
      safeToCallLiveProvider: true,
      error: null,
    };
  }

  // Default: stub mode
  return {
    providerMode: SCOUT_SUGGEST_PROVIDER_MODES.STUB,
    status: 'available',
    safeToCallLiveProvider: false,
    error: null,
  };
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

  // ─── Auth boundary (contract-defined, placeholder enforcement) ──────────────
  // Current mode: stub-only dev → Authorization NOT enforced
  // TODO: When live provider is enabled, enforce Bearer auth here:
  // const authResult = parseScoutAuthorizationHeader(
  //   request.headers.get('authorization') || request.headers.get('Authorization')
  // );
  // if (!authResult.ok) return buildErrorResponse(authResult.errorCode, authResult.message, requestId, 401);
  // const userId = await verifyScoutFirebaseToken(authResult.token); // future boundary

  // ─── Rate-limit boundary (contract-defined, placeholder enforcement) ────────
  // Current mode: stub-only dev → rate limit NOT enforced
  // TODO: When live provider is enabled, enforce rate limit here:
  // const tier = userId ? 'authenticated' : 'free';
  // const rateLimitPolicy = getScoutSuggestRateLimitPolicy(tier);
  // const allowed = await checkScoutRateLimit(userId, tier); // future boundary
  // if (!allowed) return buildErrorResponse('RATE_LIMITED', 'Too many requests', requestId, 429);

  // ─── Live provider configuration boundary (contract-defined, placeholder) ─────
  const providerConfig = resolveScoutSuggestProviderMode(env);
  if (providerConfig.providerMode === SCOUT_SUGGEST_PROVIDER_MODES.LIVE) {
    // ── Dependency adapter seam (mock-disabled by default) ──
    // Tests can inject a full adapter via { context: { liveAdapter } } or
    // { context: { liveDependencies } }. When neither is provided, the
    // canonical mock-disabled skeleton is used (fail-closed) so the
    // endpoint cannot accidentally allow real traffic in skeleton mode.
    // No real Firebase Admin SDK / no real persistent rate-limit storage /
    // no provider SDK / no fetch is invoked by the skeleton.
    const liveAdapter =
      context?.liveAdapter ||
      context?.liveDependencies ||
      createScoutLiveDependencyAdapter({ mockDisabled: true });

    // ── DI seam: injected mock verifier/limiter/observer (test-only) ──
    // shape: { verifyToken?, checkRateLimit?, observer?, requestId }
    // Production: verifyToken comes from the mock-disabled adapter (deny);
    // checkRateLimit is intentionally left undefined in skeleton mode so
    // the boundary's "rate-limit unavailable" safe-fail path fires
    // (preserves the RATE_LIMIT_UNAVAILABLE / 503 taxonomy). Observer
    // call is a no-op.
    // Tests: pass mocks via any of:
    //   { context: { liveAdapter } }        (full adapter with verifyToken/checkRateLimit/requestId)
    //   { context: { liveDependencies } }   (alias of liveAdapter)
    //   { context: { verifyToken, checkRateLimit, observer } }  (legacy direct DI)
    const hasRealLimiter = typeof context?.checkRateLimit === 'function';
    const hasRealAdapter = !!(context?.liveAdapter || context?.liveDependencies);
    const liveDependencies = {
      verifyToken: typeof context?.verifyToken === 'function'
        ? context.verifyToken
        : liveAdapter.verifyToken,
      checkRateLimit: hasRealLimiter
        ? context.checkRateLimit
        : (hasRealAdapter ? liveAdapter.checkRateLimit : undefined),
      observer: context?.observer,
      requestId,
    };

    // ── Live-mode auth boundary (canonical, DI-injected, safe-fail) ──
    const authStart = Date.now();
    const authResult = await verifyScoutLiveAuthBoundary(request, liveDependencies);
    // Observability seam: optional observer; sanitized event only; safe-swallowed.
    // The observer is called BEFORE any early return so all auth decisions are recorded.
    safeInvokeScoutLiveObserver(
      liveDependencies.observer,
      buildScoutLiveAuthEvent({
        requestId,
        authResult,
        latencyMs: Date.now() - authStart,
      })
    );
    if (!authResult.ok) {
      return buildErrorResponse(authResult.error.code, authResult.error.message, requestId, 401);
    }

    // ── Live-mode rate-limit boundary (canonical, DI-injected, safe-fail) ──
    const rateLimitStart = Date.now();
    const rateLimitResult = await checkScoutLiveRateLimitBoundary(request, authResult, liveDependencies);
    safeInvokeScoutLiveObserver(
      liveDependencies.observer,
      buildScoutLiveRateLimitEvent({
        requestId,
        authResult,
        rateLimitResult,
        latencyMs: Date.now() - rateLimitStart,
      })
    );
    if (!rateLimitResult.ok) {
      const status = (rateLimitResult.status === 'rate_limited') ? 429 : 503;
      const headers = {
        'content-type': 'application/json; charset=utf-8',
        'x-lovebud-upstream': 'cloudflare',
        'x-lovebud-route-status': rateLimitResult.error.code.toLowerCase().replace(/_/g, '-'),
        [REQUEST_ID_HEADER]: requestId,
      };
      if (rateLimitResult.retryAfterSeconds > 0) {
        headers['retry-after'] = String(rateLimitResult.retryAfterSeconds);
      }
      return new Response(
        JSON.stringify({ ok: false, error: { code: rateLimitResult.error.code, message: rateLimitResult.error.message } }),
        { status, headers }
      );
    }

    if (!providerConfig.safeToCallLiveProvider) {
      return buildErrorResponse(providerConfig.error.code, providerConfig.error.message, requestId, 503);
    }
    // Live mode: real provider adapter interface provides structured state
    // DISABLED → PROVIDER_UNAVAILABLE, CONFIG_MISSING → CONFIG_MISSING, READY_FOR_ADAPTER → call suggest
    // #2630 endpoint wiring: when the staging/test gate + api_key transport
    // mode + openai-compatible provider are all explicitly enabled, and
    // an API key is present, construct the API-key provider transport
    // and inject it as apiKeyTransport. The transport factory itself
    // enforces its own gates (stage in {staging,test}, no production).
    const transportMode = String(env.SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE || '').trim();
    const stage = String(env.SCOUT_SUGGEST_PROVIDER_STAGE || '').trim();
    const llmProvider = String(env.SCOUT_SUGGEST_LLM_PROVIDER || '').trim();
    const model = String(env.SCOUT_SUGGEST_MODEL || '').trim();
    const apiKey = env.SCOUT_SUGGEST_LLM_API_KEY || env.apiKey || '';
    const hasApiKey = typeof apiKey === 'string' && apiKey.length > 0;
    const stageOk = stage === 'staging' || stage === 'test';
    const transportGateOk = transportMode === 'api_key'
      && stageOk
      && llmProvider === SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER
      && model.length > 0
      && hasApiKey;

    // Allow injected fetch from context (for tests) or runtime global fetch (for staging).
    // The transport factory accepts an injected fetch; we pass it through.
    const injectedFetch = (context && typeof context.fetch === 'function')
      ? context.fetch
      : null;

    let apiKeyTransportFn = null;
    if (transportGateOk) {
      try {
        const transport = createScoutLiveProviderTransport(
          {
            SCOUT_SUGGEST_PROVIDER_MODE: env.SCOUT_SUGGEST_PROVIDER_MODE,
            SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: env.SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED,
            SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE: transportMode,
            SCOUT_SUGGEST_PROVIDER_STAGE: stage,
            SCOUT_SUGGEST_LLM_PROVIDER: llmProvider,
            SCOUT_SUGGEST_MODEL: model,
            SCOUT_SUGGEST_LLM_API_KEY: apiKey,
            SCOUT_SUGGEST_LLM_BASE_URL: env.SCOUT_SUGGEST_LLM_BASE_URL,
          },
          { fetch: injectedFetch }
        );
        // The transport is only useful if it's in READY_FOR_ADAPTER state.
        if (transport && transport.status === 'READY_FOR_ADAPTER' && typeof transport.execute === 'function') {
          apiKeyTransportFn = async (input) => {
            // Build a simple prompt from the validated input.
            const excerpt = (input && typeof input.excerpt === 'string') ? input.excerpt : '';
            const lang = (input && typeof input.lang === 'string') ? input.lang : 'ko';
            const tone = (input && typeof input.tone === 'string') ? input.tone : 'polite';
            const prompt = `Language: ${lang}\nTone: ${tone}\nExcerpt: ${excerpt}\n\nSuggest a memory moment.`;
            let res;
            try {
              res = await transport.execute(prompt, { requestId });
            } catch (err) {
              return { ok: false, error: { code: 'PROVIDER_ERROR', message: 'Scout API-key transport threw an exception.' } };
            }
            if (!res || typeof res !== 'object') {
              return { ok: false, error: { code: 'PROVIDER_ERROR', message: 'Scout API-key transport returned a non-object result.' } };
            }
            if (!res.ok) {
              return { ok: false, error: res.error || { code: 'PROVIDER_ERROR', message: 'Scout API-key transport failed.' } };
            }
            // Normalize to the adapter's expected shape.
            const content = (res.response && typeof res.response.content === 'string')
              ? res.response.content
              : '';
            return {
              ok: true,
              suggestion: { content, provider: res.response?.provider, model: res.response?.model },
              providerMode: 'live_api_key',
            };
          };
        }
      } catch (err) {
        // Transport creation failed — fall through to no apiKeyTransport injection.
        apiKeyTransportFn = null;
      }
    }

    const combinedConfig = {
      ...env,
      executor: context?.executor || context?.liveAdapter?.executor || context?.liveDependencies?.executor,
      providerExecutorTransport: context?.providerExecutorTransport || context?.liveAdapter?.providerExecutorTransport || context?.liveDependencies?.providerExecutorTransport,
      executorTransport: context?.executorTransport || context?.liveAdapter?.executorTransport || context?.liveDependencies?.executorTransport,
      mockProviderTransport: context?.mockProviderTransport || context?.liveAdapter?.mockProviderTransport || context?.liveDependencies?.mockProviderTransport,
      apiKeyTransport: apiKeyTransportFn || context?.apiKeyTransport,
      logger: context?.logger || context?.liveAdapter?.logger || context?.liveDependencies?.logger,
      requestId,
    };
    const realAdapterInterface = createScoutRealProviderAdapterInterface(combinedConfig);

    if (realAdapterInterface.status === SCOUT_LIVE_PROVIDER_INTERFACE_STATUS.DISABLED) {
      return buildErrorResponse('PROVIDER_UNAVAILABLE', 'Scout live provider adapter is disabled.', requestId, 503);
    }

    if (realAdapterInterface.status === SCOUT_LIVE_PROVIDER_INTERFACE_STATUS.CONFIG_MISSING) {
      return buildErrorResponse('CONFIG_MISSING', 'Scout live suggestion provider is not configured.', requestId, 503);
    }

    const suggestRes = await realAdapterInterface.suggest(validation.normalized);
    if (!suggestRes.ok) {
      const code = suggestRes.error?.code || 'PROVIDER_UNAVAILABLE';
      const msg = suggestRes.error?.message || 'Scout live provider adapter is not yet connected.';
      return buildErrorResponse(code, msg, requestId, 503);
    }

    return buildSuccessResponse(suggestRes.suggestion, suggestRes.providerMode || 'live_mock', requestId);
  }

  // ─── Live provider integration — placeholder for Phase D ──────────────────
  // if (env.SCOUT_LLM_API_KEY) {
  //   try { return await callLiveProvider(validation.normalized, env); }
  //   catch { return buildErrorResponse('PROVIDER_UNAVAILABLE', 'AI suggestion service temporarily unavailable', requestId, 503); }
  // }
  // If live provider not configured, fall through to stub
  // buildErrorResponse('CONFIG_MISSING', 'AI suggestion not configured', requestId, 503);
  // Standard error codes: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, RATE_LIMITED, PROVIDER_UNAVAILABLE, PROVIDER_ERROR, CONFIG_MISSING, INTERNAL_ERROR

  // Return deterministic stub suggestion
  const suggestion = generateStubSuggestion(validation.normalized);

  return buildSuccessResponse(suggestion, providerConfig.providerMode, requestId);
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