// Bounded experimental / Preview-only seam for the #4003 direct-Neon Browse
// summary prototype.
//
// This route is intentionally NOT on the Production Browse path.
// Post-#4052, `/api/community/trees?view=summary` is owned by the exact Pages
// Function `functions/api/community/trees.js`, which reuses `buildModalUrl()`
// from `../[[path]].js` and proxies to Modal. This experimental seam does not
// modify or replace that Production authority.
// It lives at `/api/experimental/direct-neon-browse` and is reachable ONLY when
// both:
//   1. the explicit opt-in gate `LB_EXPERIMENTAL_DIRECT_NEON_BROWSE === 'true'`
//      is set (Preview/experimental context only), and
//   2. the dedicated experimental Neon secret `DIRECT_NEON_BROWSE_DATABASE_URL`
//      is bound (never the Production canonical DATABASE_URL).
//
// Any other request fails closed:
//   - gate disabled            -> 404 (seam unreachable from Production)
//   - gate enabled, no secret  -> 503 (no database query is performed)
//
// It never logs the connection string, Tree/Memory IDs, or row bodies, and it
// never writes, migrates, or reads private data. Response normalization is owned
// by `../../_shared/direct-neon-browse-summary-core.js`.

import {
  normalizeBrowseLimit,
} from '../../_shared/direct-neon-browse-summary-core.js';
import {
  DIRECT_NEON_BROWSE_CONNECTION_SECRET,
  DIRECT_NEON_BROWSE_ENABLED_FLAG,
  fetchBrowseSummaryViaDirectNeon,
  readDirectNeonBrowseConfig,
} from '../../_shared/direct-neon-browse-transport.js';

export const SEAM_PATH = '/api/experimental/direct-neon-browse';

function buildJsonResponse(status, body, extraHeaders = {}) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-experimental': 'direct-neon-browse',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  };
  return new Response(JSON.stringify(body), { status, headers });
}

// Pure-ish request handler. `executorOverride` is for tests; in production it is
// undefined and the executor is built from the resolved experimental secret.
export async function buildDirectNeonBrowseResponse({ request, env = {}, executorOverride = null } = {}) {
  const config = readDirectNeonBrowseConfig(env);

  if (!config.enabled) {
    return buildJsonResponse(404, {
      error: 'experimental direct-Neon Browse disabled',
      path: SEAM_PATH,
    }, { 'x-lovebud-route-status': 'disabled' });
  }

  if (!config.configured) {
    // Fail closed. No database query is attempted.
    return buildJsonResponse(503, {
      error: 'direct-Neon Browse not configured',
      path: SEAM_PATH,
    }, { 'x-lovebud-route-status': 'config-absent' });
  }

  let sort;
  let limit;
  try {
    const url = new URL(request.url);
    sort = url.searchParams.get('sort') || undefined;
    limit = normalizeBrowseLimit(url.searchParams.get('limit') || undefined);
  } catch {
    return buildJsonResponse(400, { error: 'invalid request url' }, { 'x-lovebud-route-status': 'bad-request' });
  }

  // `buildModalUrl()` uses the same numeric 1..60 clamp before forwarding to
  // FastAPI, whose canonical `limit: int` contract rejects an in-range
  // fractional value (for example 1.5) with 422. Fail before any Neon query so
  // the experimental seam preserves that observable error boundary instead of
  // turning a PostgreSQL bigint-parameter failure into a 502.
  if (!Number.isInteger(limit)) {
    return buildJsonResponse(422, {
      error: 'invalid Browse limit',
      code: 'INVALID_LIMIT',
    }, { 'x-lovebud-route-status': 'invalid-limit' });
  }

  try {
    const trees = await fetchBrowseSummaryViaDirectNeon({
      executor: executorOverride || undefined,
      connectionString: executorOverride ? undefined : config.connectionString,
      sort,
      limit,
    });
    return buildJsonResponse(200, trees, {
      'x-lovebud-route-status': 'ok',
      'x-lovebud-experimental-source': 'neon-serverless-http',
    });
  } catch (error) {
    // Sanitized: never echo the connection string, IDs, or row content.
    const code = error && error.name === 'AbortError' ? 'timeout' : 'upstream-error';
    return buildJsonResponse(502, {
      error: 'direct-Neon Browse query failed',
      code,
    }, { 'x-lovebud-route-status': 'query-failed' });
  }
}

export async function onRequestGet(context) {
  return buildDirectNeonBrowseResponse({
    request: context.request,
    env: context.env || {},
  });
}

export async function onRequest(context) {
  if ((context.request && context.request.method || 'GET').toUpperCase() !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        allow: 'GET',
        'x-lovebud-experimental': 'direct-neon-browse',
      },
    });
  }
  return onRequestGet(context);
}
