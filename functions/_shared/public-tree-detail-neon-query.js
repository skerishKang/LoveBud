// #4115 Phase-2 anonymous public Tree detail direct-Neon read adapter.
//
// This module is intentionally read-only and route-specific. It preserves the
// current public Tree detail visibility boundary while keeping authenticated
// owner/private reads on their existing Modal authority.

import { REQUEST_ID_HEADER } from './request-id.js';

export const PUBLIC_TREE_DETAIL_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_PUBLIC_TREE_DETAIL_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL',
});

const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;

export function isNeonDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    const parsed = new URL(value);
    return NEON_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function readPublicTreeDetailReadConfig(env = {}) {
  const gateValue = typeof env[PUBLIC_TREE_DETAIL_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[PUBLIC_TREE_DETAIL_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  const isDirect = gateValue === PUBLIC_TREE_DETAIL_RUNTIME_ENV.DIRECT_NEON_VALUE;
  const connectionString = typeof env[PUBLIC_TREE_DETAIL_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[PUBLIC_TREE_DETAIL_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(connectionString);

  return Object.freeze({
    gateValue,
    isDirect,
    configured,
    connectionString: configured ? connectionString : '',
  });
}

// Keep the query bounded, static, parameterized, and public-only. Social counts
// are read in the same query so the outward Tree detail DTO retains the current
// Modal contract without creating or updating aggregate rows.
export const PUBLIC_TREE_DETAIL_SQL = `
SELECT
  t.id::text AS id,
  t.title,
  t.visibility,
  t.created_at::text AS created_at,
  t.updated_at::text AS updated_at,
  COUNT(m.id)::int AS memory_count,
  COALESCE(s.like_count, 0)::int AS like_count,
  COALESCE(s.view_count, 0)::int AS view_count
FROM trees t
LEFT JOIN memories m
  ON m.tree_id = t.id
 AND m.visibility = 'public'
LEFT JOIN tree_social_counts s
  ON s.tree_id = t.id
WHERE t.id = $1
  AND t.visibility = 'public'
GROUP BY
  t.id,
  t.title,
  t.visibility,
  t.created_at,
  t.updated_at,
  s.like_count,
  s.view_count
LIMIT 1;
`;

export function normalizePublicTreeDetailId(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  // Matches Modal validate_required_id semantics: UUID and non-UUID string IDs
  // are both accepted, while surrounding whitespace is removed.
  return value.trim();
}

export function normalizeDirectNeonTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    // A JS Date would discard PostgreSQL sub-millisecond precision. Keep the
    // text cast in SQL authoritative instead of silently changing the DTO.
    throw new TypeError('PUBLIC_TREE_DETAIL_TIMESTAMP_PRECISION_LOST');
  }
  if (typeof value !== 'string') return String(value);

  const text = value.trim();
  const offsetMatch = text.match(/([+-]\d{2}(?::?\d{2})?|Z)$/);
  let offset = '';
  let body = text;
  if (offsetMatch) {
    offset = offsetMatch[1];
    body = text.slice(0, offsetMatch.index);
  }

  body = body.replace(' ', 'T');
  body = body.replace(/(\.\d+)$/, (match) => {
    const digits = match.slice(1);
    return `.${(digits + '000000').slice(0, 6)}`;
  });

  let normalizedOffset = '';
  if (offset === 'Z') {
    normalizedOffset = '+00:00';
  } else if (offset) {
    const sign = offset[0];
    const rest = offset.slice(1);
    normalizedOffset = rest.includes(':') ? offset : `${sign}${rest}:00`;
  }

  return body + normalizedOffset;
}

function normalizeIntegerCount(value, field) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
    throw new TypeError(`PUBLIC_TREE_DETAIL_INVALID_${field.toUpperCase()}`);
  }
  return numeric;
}

export function mapPublicTreeDetailRow(row) {
  if (!row || typeof row !== 'object') return null;
  // Defense in depth for injected/test executors and future query changes. A
  // non-public row is indistinguishable from not-found at the anonymous edge.
  if (row.visibility !== 'public') return null;

  const id = row.id == null ? '' : String(row.id);
  if (!id) return null;

  return {
    id,
    title: row.title || '',
    visibility: 'public',
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at),
    memoryCount: normalizeIntegerCount(row.memory_count, 'memory_count'),
    likeCount: normalizeIntegerCount(row.like_count, 'like_count'),
    viewCount: normalizeIntegerCount(row.view_count, 'view_count'),
  };
}

export async function createDirectNeonPublicTreeDetailExecutor({ connectionString, neonOptions } = {}) {
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('PUBLIC_TREE_DETAIL_DIRECT_NEON_CONFIG_INVALID');
  }

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, {
    disableWarningInBrowsers: true,
    ...(neonOptions && typeof neonOptions === 'object' ? neonOptions : {}),
  });

  return async function directNeonPublicTreeDetailExecutor(text, values) {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

function directHeaders(requestId, extra = {}) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon',
    ...extra,
  });
  if (requestId) {
    headers.set(REQUEST_ID_HEADER, requestId);
    headers.set('Access-Control-Expose-Headers', REQUEST_ID_HEADER);
  }
  return headers;
}

function jsonResponse(body, status, requestId, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: directHeaders(requestId, extraHeaders),
  });
}

export async function handlePublicTreeDetailDirectNeon(
  request,
  treeId,
  env = {},
  requestId = null,
  { executorOverride = null } = {},
) {
  // Authenticated reads must remain owner/private-first on Modal even when the
  // anonymous direct gate is enabled.
  const authHeader = request?.headers?.get('authorization') || request?.headers?.get('Authorization');
  if (authHeader) return null;

  const config = readPublicTreeDetailReadConfig(env);
  if (!config.isDirect) return null;

  const safeTreeId = normalizePublicTreeDetailId(treeId);
  if (!safeTreeId) {
    return jsonResponse(
      { detail: 'treeId is required' },
      400,
      requestId,
      { 'x-lovebud-route-status': 'invalid-tree-id' },
    );
  }

  if (!config.configured && !executorOverride) {
    return jsonResponse(
      {
        error: 'Public Tree detail direct-Neon runtime not configured',
        code: 'DIRECT_NEON_CONFIG_ABSENT',
      },
      503,
      requestId,
      { 'x-lovebud-route-status': 'config-absent' },
    );
  }

  try {
    const executor = executorOverride || await createDirectNeonPublicTreeDetailExecutor({
      connectionString: config.connectionString,
    });
    const rows = await executor(PUBLIC_TREE_DETAIL_SQL, [safeTreeId]);
    const rawRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    const tree = mapPublicTreeDetailRow(rawRow);

    if (!tree) {
      return jsonResponse(
        { detail: 'Tree not found' },
        404,
        requestId,
        { 'x-lovebud-route-status': 'not-found' },
      );
    }

    return jsonResponse(tree, 200, requestId);
  } catch {
    return jsonResponse(
      {
        error: 'Public Tree detail direct-Neon query failed',
        code: 'DIRECT_NEON_QUERY_FAILED',
      },
      500,
      requestId,
      { 'x-lovebud-route-status': 'query-failed' },
    );
  }
}
