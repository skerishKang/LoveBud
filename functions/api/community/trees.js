import { buildModalUrl } from '../[[path]].js';
import { handlePublicBrowseSummaryDirectNeon } from '../../_shared/public-browse-summary-direct-neon.js';

const REQUEST_ID_HEADER = 'x-lovebud-request-id';
const MAX_REQUEST_ID_LENGTH = 80;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const MODAL_FETCH_TIMEOUT_MS = 25000;

function normalizeRequestId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_REQUEST_ID_LENGTH) return null;
  if (!SAFE_REQUEST_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function getOrCreateRequestId(request) {
  return normalizeRequestId(request.headers.get(REQUEST_ID_HEADER)) || `req-${crypto.randomUUID()}`;
}

function buildJsonResponse(body, status, routeStatus, requestId, upstream = 'cloudflare') {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': upstream,
    'x-lovebud-route-status': routeStatus,
    [REQUEST_ID_HEADER]: requestId
  };
  return new Response(JSON.stringify(body), { status, headers });
}

function buildMethodNotAllowedResponse(requestId) {
  const response = buildJsonResponse({ error: 'Method not allowed' }, 405, 'method-not-allowed', requestId);
  response.headers.set('allow', 'GET');
  return response;
}

function buildNotFoundResponse(requestId) {
  return buildJsonResponse({ error: 'Route not found' }, 404, 'unhandled', requestId);
}

function buildModalUnavailableResponse(requestId) {
  return buildJsonResponse({ error: 'Modal backend unavailable' }, 503, 'modal-unavailable', requestId, 'modal');
}

function buildModalTimeoutResponse(requestId) {
  return buildJsonResponse({ error: 'Modal upstream timeout' }, 504, 'modal-timeout', requestId, 'modal');
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

async function withBrowseHeaders(response, requestId) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  if (!headers.has('x-lovebud-upstream')) headers.set('x-lovebud-upstream', 'modal');
  headers.set(REQUEST_ID_HEADER, requestId);

  const existingExposeHeaders = headers.get('Access-Control-Expose-Headers') || '';
  if (!existingExposeHeaders.toLowerCase().includes(REQUEST_ID_HEADER)) {
    headers.set(
      'Access-Control-Expose-Headers',
      existingExposeHeaders ? `${existingExposeHeaders}, ${REQUEST_ID_HEADER}` : REQUEST_ID_HEADER
    );
  }

  try {
    const bodyText = await response.text();
    return new Response(bodyText, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const requestId = getOrCreateRequestId(request);

  if (request.method.toUpperCase() !== 'GET') {
    return buildMethodNotAllowedResponse(requestId);
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== '/api/community/trees' || url.searchParams.get('view') !== 'summary') {
    return buildNotFoundResponse(requestId);
  }

  const directResponse = await handlePublicBrowseSummaryDirectNeon(
    request,
    env || {},
    requestId
  );
  if (directResponse) return directResponse;

  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return buildModalUnavailableResponse(requestId);

  const headers = { accept: 'application/json', [REQUEST_ID_HEADER]: requestId };

  try {
    const modalResponse = await fetchWithTimeout(modalUrl.toString(), { headers });
    return await withBrowseHeaders(modalResponse, requestId);
  } catch (error) {
    if (error?.name === 'AbortError') {
      return buildModalTimeoutResponse(requestId);
    }
    console.warn('[LoveBudCloudflareProxy] Browse summary Modal read failed, returning 503', error);
    return buildModalUnavailableResponse(requestId);
  }
}
