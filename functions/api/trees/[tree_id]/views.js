import { REQUEST_ID_HEADER, getOrCreateRequestId } from '../../../_shared/request-id.js';
import { readBoundedRequestBody } from '../../../_shared/bounded-request-body.js';
import {
  buildInvalidPathEncodingResponse,
  isInvalidPathEncodingError,
  normalizeEncodedPathSegment
} from '../../../_shared/path-segment.js';

/**
 * Public Tree view-count edge proxy (Security slice #3917).
 *
 * This is the single chokepoint for anonymous public tree view counting. It
 * MUST NOT trust any actor identity supplied by the browser. Instead it derives
 * an anonymous, server-authoritative actor from trusted edge context:
 *
 *   CF-Connecting-IP + UTC day + server-only secret (TREE_VIEW_AUTHORITY_SECRET)
 *
 * via a domain-separated HMAC-SHA256, then forwards a FIXED, SIGNED assertion as
 * request headers to Modal. No request body is ever parsed or forwarded.
 *
 * The request stream is still consumed through the canonical bounded reader so
 * oversized or failed body streams cannot bypass the #3920 edge resource bound.
 * Accepted client bytes are discarded and never influence view identity.
 *
 * Fail-closed: if the secret or client IP context is missing, no Modal call is
 * made and no count occurs. The separate public tree read path is unaffected.
 */

const VIEW_SOURCE = 'public_tree_detail';
const ASSERTION_VERSION = 'v1';
const ACTOR_KIND_ANONYMOUS = 'anonymous';

const ASSERTION_DOMAIN = 'tree-view-assertion-v1';
const ACTOR_DOMAIN = 'tree-view-actor-v1';

const SECRET_ENV = 'TREE_VIEW_AUTHORITY_SECRET';

const SIGNATURE_HEADER = 'x-lovebud-tree-view-signature';
const VERSION_HEADER = 'x-lovebud-tree-view-version';
const TREE_ID_HEADER = 'x-lovebud-tree-view-tree-id';
const ACTOR_KEY_HEADER = 'x-lovebud-tree-view-actor-key';
const ACTOR_KIND_HEADER = 'x-lovebud-tree-view-actor-kind';
const SOURCE_HEADER = 'x-lovebud-tree-view-source';
const COUNTED_WINDOW_HEADER = 'x-lovebud-tree-view-counted-window';

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

const MODAL_FETCH_TIMEOUT_MS = 25000;

function buildModalUnavailableResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Modal backend unavailable' }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'modal',
      'x-lovebud-degraded': 'modal-unavailable',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildModalTimeoutResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Modal upstream timeout' }), {
    status: 504,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'modal',
      'x-lovebud-route-status': 'modal-timeout',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildMethodNotAllowedResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'method-not-allowed',
      allow: 'POST',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildPayloadTooLargeResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Payload too large' }), {
    status: 413,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'payload-too-large',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildBodyReadFailedResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Request body read failed' }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'body-read-failed',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildViewAuthorityUnavailableResponse(requestId) {
  return new Response(JSON.stringify({ error: 'View count unavailable' }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'view-authority-unavailable',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function extractTreeId(request) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  return parts[2] || '';
}

function buildModalUrl(request, env) {
  const modalBaseUrl = stripTrailingSlash(env.MODAL_BASE_URL);
  if (!modalBaseUrl) return null;
  const treeId = normalizeEncodedPathSegment(extractTreeId(request));
  if (!treeId) return null;
  const target = new URL(modalBaseUrl);
  target.pathname = `/modal/public/trees/${treeId}/views`;
  return target;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODAL_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function currentUtcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function deriveEdgeActorKey(secret, ip, utcDay) {
  const material = `${ACTOR_DOMAIN}|${utcDay}|${ip}`;
  return hmacHex(secret, material);
}

export function canonicalAssertion(treeId, actorKey, actorKind, source, countedWindow) {
  const lines = [
    `version=${ASSERTION_VERSION}`,
    `treeId=${treeId}`,
    `actorKey=${actorKey}`,
    `actorKind=${actorKind}`,
    `source=${source}`,
    `countedWindow=${countedWindow}`
  ];
  return `${ASSERTION_DOMAIN}\n${lines.join('\n')}`;
}

export async function signAssertion(secret, treeId, actorKey, actorKind, source, countedWindow) {
  const canonical = canonicalAssertion(treeId, actorKey, actorKind, source, countedWindow);
  return hmacHex(secret, canonical);
}

/**
 * Derive the anonymous edge actor from trusted request context and build the
 * signed assertion headers. Returns null when the secret or client IP context
 * is unavailable (fail-closed; caller must not count).
 */
export async function buildSignedAssertionHeaders(request, env, treeId) {
  const secret = env[SECRET_ENV];
  const ip = request.headers.get('CF-Connecting-IP');
  if (!secret || !ip) {
    return null;
  }
  const utcDay = currentUtcDay();
  const actorKey = await deriveEdgeActorKey(secret, ip, utcDay);
  const signature = await signAssertion(secret, treeId, actorKey, ACTOR_KIND_ANONYMOUS, VIEW_SOURCE, utcDay);
  return {
    [VERSION_HEADER]: ASSERTION_VERSION,
    [TREE_ID_HEADER]: treeId,
    [ACTOR_KEY_HEADER]: actorKey,
    [ACTOR_KIND_HEADER]: ACTOR_KIND_ANONYMOUS,
    [SOURCE_HEADER]: VIEW_SOURCE,
    [COUNTED_WINDOW_HEADER]: utcDay,
    [SIGNATURE_HEADER]: signature
  };
}

async function proxyTreeView(request, env) {
  const method = request.method.toUpperCase();
  const requestId = getOrCreateRequestId(request);
  if (method !== 'POST') return buildMethodNotAllowedResponse(requestId);

  const bodyResult = await readBoundedRequestBody(request);
  if (bodyResult.status === 'tooLarge') {
    return buildPayloadTooLargeResponse(requestId);
  }
  if (bodyResult.status === 'readError') {
    return buildBodyReadFailedResponse(requestId);
  }

  const treeId = extractTreeId(request);
  if (!treeId) return buildModalUnavailableResponse(requestId);

  let modalUrl;
  try {
    modalUrl = buildModalUrl(request, env || {});
  } catch (error) {
    if (isInvalidPathEncodingError(error)) {
      return buildInvalidPathEncodingResponse(requestId, REQUEST_ID_HEADER);
    }
    throw error;
  }
  if (!modalUrl) return buildModalUnavailableResponse(requestId);

  // Keep the native Request object intact. Its headers/url/method properties
  // are prototype-backed and must not be copied with Object.assign().
  const assertionHeaders = await buildSignedAssertionHeaders(request, env || {}, treeId);
  if (!assertionHeaders) {
    return buildViewAuthorityUnavailableResponse(requestId);
  }

  const headers = {
    accept: 'application/json',
    [REQUEST_ID_HEADER]: requestId,
    ...assertionHeaders
  };

  try {
    const response = await fetchWithTimeout(modalUrl.toString(), {
      method: 'POST',
      headers
      // NO body: accepted client bytes are discarded after the bounded read;
      // only the signed edge assertion reaches Modal (Issues #3917 / #3920).
    });
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('x-lovebud-upstream', 'modal');
    responseHeaders.set(REQUEST_ID_HEADER, requestId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    if (error && error.name === 'AbortError') return buildModalTimeoutResponse(requestId);
    return buildModalUnavailableResponse(requestId);
  }
}

export async function onRequestPost(context) {
  return proxyTreeView(context.request, context.env || {});
}

export async function onRequest(context) {
  return proxyTreeView(context.request, context.env || {});
}
