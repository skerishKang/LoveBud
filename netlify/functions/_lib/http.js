/**
 * LoveBud - HTTP Response Helpers
 *
 * Based on: 133-relovetree/netlify/functions/_lib/http.js
 *
 * Provides consistent CORS headers and response builders.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'https://lovebud.pages.dev',
  'https://lovebud.netlify.app',
  'https://lovebud.vercel.app',
];

function getAllowedOrigins() {
  const raw = process.env.CORS_ALLOWED_ORIGINS || process.env.URL || '';
  const configured = String(raw)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function resolveCorsOrigin(requestOrigin) {
  const allowed = getAllowedOrigins();
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0];
}

function getCorsHeaders(requestOrigin, extraHeaders) {
  return Object.assign(
    {
      'Access-Control-Allow-Origin': resolveCorsOrigin(requestOrigin),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Vary': 'Origin',
    },
    extraHeaders || {}
  );
}

function buildResponse(statusCode, bodyObj, extraHeaders, requestOrigin) {
  const resolvedOrigin = requestOrigin || '';
  return {
    statusCode,
    headers: Object.assign(
      getCorsHeaders(resolvedOrigin, {
        'Content-Type': 'application/json; charset=utf-8',
      }),
      extraHeaders || {}
    ),
    body: bodyObj == null ? '' : JSON.stringify(bodyObj),
  };
}

function preflight(requestOrigin, extraHeaders) {
  return {
    statusCode: 204,
    headers: getCorsHeaders(requestOrigin, extraHeaders),
    body: '',
  };
}

function ok(bodyObj, extraHeaders, requestOrigin) {
  return buildResponse(200, bodyObj, extraHeaders, requestOrigin);
}

function created(bodyObj, extraHeaders, requestOrigin) {
  return buildResponse(201, bodyObj, extraHeaders, requestOrigin);
}

function noContent(extraHeaders, requestOrigin) {
  return buildResponse(204, null, extraHeaders, requestOrigin);
}

function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  if (details !== undefined) error.details = details;
  return error;
}

function handleError(scope, error, requestOrigin) {
  const errorInfo = {
    scope,
    timestamp: new Date().toISOString(),
    message: error?.message || 'Unknown error',
    status: error?.status || 500,
  };
  if (error.details) errorInfo.details = error.details;

  console.error(`${scope} error:`, errorInfo);
  const headers = getCorsHeaders(requestOrigin, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  if (error && typeof error.status === 'number') {
    return buildResponse(
      error.status,
      { error: error.message || 'Error', details: error.details || null },
      headers,
      requestOrigin
    );
  }
  return buildResponse(500, { 
    error: 'Internal error', 
    message: error?.message || 'Unknown error',
    details: error?.details || null,
    stack: process.env.NODE_ENV === 'production' ? null : error?.stack
  }, headers, requestOrigin);
}

module.exports = {
  buildResponse,
  getCorsHeaders,
  resolveCorsOrigin,
  preflight,
  ok,
  created,
  noContent,
  httpError,
  handleError,
};