// #4219 Phase-4 public Tree view-count Cloudflare -> Neon WebSocket
// interactive transaction candidate.
//
// Migration candidate only. The Product route remains Modal-backed unless:
//   LB_TREE_VIEW_WRITE_RUNTIME=direct_neon
//
// The browser never supplies view actor identity. The route derives the
// anonymous actor at the trusted edge under the existing #3917 HMAC boundary
// and passes only that server-derived projection into this adapter.
//
// This module reuses the merged #4132 Neon WS transaction adapter. It creates
// no provider resource, secret, role, schema, or Production gate.

import {
  createNeonWsTransactionAdapter,
  isNeonWsConnectionString,
  NeonWsTransactionError,
  NEON_WS_TRANSACTION_ERROR,
  sanitizeNeonWsTransactionError
} from './db/neon-ws-transaction-adapter.js';

export const TREE_VIEW_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_TREE_VIEW_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

export const TREE_VIEW_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ACTOR_KIND = 'anonymous';
const ALLOWED_SOURCE = 'public_tree_detail';

export function isTreeViewDirectNeonRequest(request) {
  if (!request || String(request.method || '').toUpperCase() !== 'POST') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return /^\/api\/trees\/[^/]+\/views$/.test(path);
}

export function isTreeViewDirectNeonSelected(env = {}) {
  const value = typeof env?.[TREE_VIEW_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[TREE_VIEW_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === TREE_VIEW_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function readTreeViewWriteConfig(env = {}) {
  const dedicated = typeof env?.[TREE_VIEW_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[TREE_VIEW_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({
    dedicated,
    configured,
    connectionString: configured ? dedicated : ''
  });
}

export function detectForbiddenTreeViewWriterFallback(env = {}) {
  if (readTreeViewWriteConfig(env).configured) return null;
  for (const name of TREE_VIEW_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonWsConnectionString(raw)) {
      return Object.freeze({ name, connectionString: raw });
    }
  }
  return null;
}

function responseHeaders(requestId, routeStatus = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon'
  };
  if (routeStatus) headers['x-lovebud-route-status'] = routeStatus;
  if (requestId) {
    headers['x-lovebud-request-id'] = requestId;
    headers['Access-Control-Expose-Headers'] = 'x-lovebud-request-id';
  }
  return headers;
}

function jsonResponse(body, status, requestId, routeStatus = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(requestId, routeStatus)
  });
}

function validateTreeId(rawTreeId) {
  const treeId = String(rawTreeId || '').trim();
  if (!treeId) return { ok: false, status: 400, detail: 'Tree ID is required' };
  if (!UUID_PATTERN.test(treeId)) {
    return { ok: false, status: 400, detail: 'Tree ID must be a valid UUID' };
  }
  return { ok: true, value: treeId };
}

function validateAuthority(authority) {
  if (!authority || typeof authority !== 'object') {
    return { ok: false, status: 503, detail: 'View count unavailable' };
  }
  const actorKey = String(authority.actorKey || '').trim();
  const actorKind = String(authority.actorKind || '').trim();
  const source = String(authority.source || '').trim();
  if (!actorKey || actorKey.length > 128) {
    return { ok: false, status: 503, detail: 'View count unavailable' };
  }
  if (actorKind !== ALLOWED_ACTOR_KIND || source !== ALLOWED_SOURCE) {
    return { ok: false, status: 503, detail: 'View count unavailable' };
  }
  return {
    ok: true,
    value: Object.freeze({ actorKey, actorKind, source })
  };
}

async function readCapabilityTables(tx) {
  const rows = await tx.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ($1, $2)`,
    ['tree_social_counts', 'tree_view_dedup_events']
  );
  const names = new Set((rows || []).map((row) => String(row.table_name || '')));
  return Object.freeze({
    socialCounts: names.has('tree_social_counts'),
    dedupEvents: names.has('tree_view_dedup_events')
  });
}

async function readViewCount(tx, treeId, socialCountsExists, canonical = false) {
  if (!socialCountsExists) return 0;
  const query = `SELECT view_count
                 FROM tree_social_counts
                 WHERE tree_id = $1
                 LIMIT 1`;
  const rows = canonical
    ? await tx.canonicalReread(query, [treeId])
    : await tx.query(query, [treeId]);
  return rows && rows.length > 0 ? Number(rows[0].view_count || 0) : 0;
}

function workFailure(workSignal, status, body, routeStatus, code) {
  workSignal.outcome = { status, body, routeStatus };
  return new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
    code,
    { status }
  );
}

async function runTreeViewWork(tx, workSignal, { treeId, actorKey, actorKind, source }) {
  // #4139 authority: mutation-local explicit-public authorization MUST be held
  // with FOR SHARE before aggregate or dedupe mutation.
  const treeRows = await tx.forShare(
    `SELECT id, visibility
     FROM trees
     WHERE id = $1
       AND visibility = 'public'
     FOR SHARE`,
    [treeId]
  );
  if (!treeRows || treeRows.length === 0 || treeRows[0].visibility !== 'public') {
    throw workFailure(
      workSignal,
      404,
      { error: 'Tree not found' },
      'tree-not-found',
      'TREE_NOT_FOUND'
    );
  }

  const capability = await readCapabilityTables(tx);
  if (!capability.socialCounts || !capability.dedupEvents) {
    const viewCount = await readViewCount(tx, treeId, capability.socialCounts, true);
    const result = { treeId, counted: false, viewCount };
    workSignal.outcome = { status: 200, body: result, routeStatus: 'view-capability-unavailable' };
    return result;
  }

  await tx.query(
    `INSERT INTO tree_social_counts (tree_id, like_count, view_count, updated_at)
     VALUES ($1, 0, 0, NOW())
     ON CONFLICT (tree_id) DO NOTHING`,
    [treeId]
  );

  const eventRows = await tx.query(
    `INSERT INTO tree_view_dedup_events (
       id,
       tree_id,
       actor_key,
       actor_kind,
       counted_window_start,
       source,
       created_at
     )
     VALUES ($1, $2, $3, $4, date_trunc('day', NOW()), $5, NOW())
     ON CONFLICT (tree_id, actor_key, counted_window_start) DO NOTHING
     RETURNING id`,
    [crypto.randomUUID(), treeId, actorKey, actorKind, source]
  );
  const counted = !!(eventRows && eventRows.length > 0);

  if (counted) {
    await tx.query(
      `UPDATE tree_social_counts
       SET view_count = view_count + 1,
           updated_at = NOW()
       WHERE tree_id = $1`,
      [treeId]
    );
  }

  const viewCount = await readViewCount(tx, treeId, true, true);
  const result = { treeId, counted, viewCount };
  workSignal.outcome = { status: 200, body: result, routeStatus: counted ? 'view-counted' : 'view-deduped' };
  return result;
}

function sanitizeAdapterErrorResponse(error, requestId, routeStatus) {
  const sanitized = sanitizeNeonWsTransactionError(error);
  if (sanitized.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
    return jsonResponse(
      { error: 'Transaction commit outcome unknown', code: 'COMMIT_OUTCOME_UNKNOWN' },
      502,
      requestId,
      'commit-outcome-unknown'
    );
  }
  const status = Number.isInteger(sanitized.status) ? sanitized.status : 500;
  return jsonResponse(
    { error: 'Tree View direct-Neon transaction failed', code: sanitized.code },
    status,
    requestId,
    routeStatus
  );
}

export async function handleTreeViewDirectNeon(
  request,
  env = {},
  requestId = null,
  authority = null,
  {
    treeIdOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  if (!isTreeViewDirectNeonRequest(request) || !isTreeViewDirectNeonSelected(env)) {
    return null;
  }

  // Trusted-edge authority must already be derived by the route. Never read
  // actor identity from request body/query/custom headers here.
  const authorityResult = validateAuthority(authority);
  if (!authorityResult.ok) {
    return jsonResponse(
      { error: authorityResult.detail },
      authorityResult.status,
      requestId,
      'view-authority-unavailable'
    );
  }

  const treeIdResult = validateTreeId(treeIdOverride);
  if (!treeIdResult.ok) {
    return jsonResponse(
      { error: treeIdResult.detail },
      treeIdResult.status,
      requestId,
      'invalid-tree-id'
    );
  }

  const config = readTreeViewWriteConfig(env);
  if (!config.configured) {
    const forbidden = detectForbiddenTreeViewWriterFallback(env);
    if (forbidden) {
      return jsonResponse(
        { error: 'Tree View direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
        503,
        requestId,
        'config-forbidden-fallback'
      );
    }
    return jsonResponse(
      { error: 'Tree View direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' },
      503,
      requestId,
      'config-absent'
    );
  }

  let adapter = transactionAdapterOverride;
  if (!adapter) {
    try {
      adapter = await createNeonWsTransactionAdapter({
        connectionString: config.connectionString,
        ...(neonImporter ? { neonImporter } : {})
      });
    } catch (error) {
      return sanitizeAdapterErrorResponse(error, requestId, 'adapter-init');
    }
  }

  const workSignal = { outcome: undefined };
  let result;
  try {
    result = await adapter.runTransaction(async (tx) => {
      return runTreeViewWork(tx, workSignal, {
        treeId: treeIdResult.value,
        ...authorityResult.value
      });
    });
  } catch (error) {
    if (error instanceof NeonWsTransactionError) {
      if (error.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
        return jsonResponse(
          { error: 'Transaction commit outcome unknown', code: 'COMMIT_OUTCOME_UNKNOWN' },
          502,
          requestId,
          'commit-outcome-unknown'
        );
      }
      if (workSignal.outcome) {
        return jsonResponse(
          workSignal.outcome.body,
          workSignal.outcome.status,
          requestId,
          workSignal.outcome.routeStatus
        );
      }
    }
    return sanitizeAdapterErrorResponse(error, requestId, 'transaction-failed');
  }

  const payload = result && typeof result === 'object' && result.value ? result.value : null;
  if (
    !payload ||
    payload.treeId !== treeIdResult.value ||
    typeof payload.counted !== 'boolean' ||
    !Number.isFinite(payload.viewCount)
  ) {
    return jsonResponse(
      { error: 'View count failed' },
      500,
      requestId,
      'no-view-result'
    );
  }

  return jsonResponse(payload, 200, requestId, workSignal.outcome?.routeStatus || 'view-complete');
}

export const TREE_VIEW_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'POST',
  path: '/api/trees/:id/views',
  gateEnv: TREE_VIEW_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: TREE_VIEW_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: TREE_VIEW_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: TREE_VIEW_FORBIDDEN_FALLBACK_ENVS,
  actorAuthority: 'trusted-edge-hmac-anonymous-actor',
  publicAuthorizationLock: 'FOR_SHARE',
  dedupeIdentity: '(tree_id, actor_key, counted_window_start)',
  writes: true,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false
});
