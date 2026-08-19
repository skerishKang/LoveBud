// #4109 Phase-2 Growing Cloudflare -> Neon Serverless HTTP query adapter.
//
// Attaches the existing provider-neutral love-platform-api Growing contract
// (workers/love-platform-api/public-growing-read.js) to a direct Neon Serverless
// HTTP query capability.

import {
  createQueryCapability
} from '../../workers/love-platform-api/core.js';
import {
  PUBLIC_GROWING_READ_DEFAULT_LIMIT,
  PUBLIC_GROWING_READ_MAX_LIMIT,
  PUBLIC_GROWING_READ_MIN_LIMIT,
  PUBLIC_GROWING_READ_PATH,
  handlePublicGrowingRead,
  isPublicGrowingReadRequest,
  normalizePublicGrowingLimit
} from '../../workers/love-platform-api/public-growing-read.js';

export const GROWING_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_GROWING_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL',
});

const POSTGRES_URL = /^postgres(?:ql)?:///i;
const NEON_HOST = /(?:^|.)neon.tech$/i;

export function isNeonDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    const parsed = new URL(value);
    return NEON_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function readGrowingReadConfig(env = {}) {
  const gateValue = typeof env[GROWING_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[GROWING_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  const isDirect = gateValue === GROWING_RUNTIME_ENV.DIRECT_NEON_VALUE;
  const connectionString = typeof env[GROWING_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[GROWING_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(connectionString);

  return Object.freeze({
    gateValue,
    isDirect,
    configured,
    connectionString: configured ? connectionString : '',
  });
}

export const GROWING_TREES_SQL = `
SELECT
  t.id,
  t.title,
  t.visibility,
  t.created_at::text AS created_at,
  t.updated_at::text AS updated_at,
  c.memory_count AS public_memory_count,
  c.all_tags AS emotion_tags,
  m.thumbnail AS representative_thumbnail,
  m.source_url AS representative_memory_source_url,
  m.visibility AS representative_memory_visibility
FROM trees t
INNER JOIN (
  SELECT
    tree_id,
    count(*) AS memory_count,
    jsonb_agg(emotion_tags) AS all_tags
  FROM memories
  WHERE visibility = 'public'
  GROUP BY tree_id
  HAVING count(*) BETWEEN 1 AND 2
) c ON t.id = c.tree_id
LEFT JOIN LATERAL (
  SELECT thumbnail, source_url, visibility
  FROM memories
  WHERE tree_id = t.id
    AND visibility = 'public'
    AND (NULLIF(thumbnail, '') IS NOT NULL OR NULLIF(source_url, '') IS NOT NULL)
  ORDER BY created_at DESC
  LIMIT 1
) m ON TRUE
WHERE t.visibility = 'public'
ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC NULLS LAST
LIMIT $1;
`;

export function normalizeDirectNeonTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    throw new TypeError('DIRECT_NEON_TIMESTAMP_PRECISION_LOST');
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
  body = body.replace(/(\.\d+)$/, (m) => {
    const digits = m.slice(1);
    return '.' + (digits + '000000').slice(0, 6);
  });
  let normalizedOffset;
  if (offset === 'Z') {
    normalizedOffset = '+00:00';
  } else if (offset) {
    const sign = offset[0];
    const rest = offset.slice(1);
    normalizedOffset = rest.includes(':') ? offset : `${sign}${rest}:00`;
  } else {
    normalizedOffset = '';
  }
  return body + normalizedOffset;
}

export function parseBrowseEmotionTags(allTagsRaw) {
  if (!Array.isArray(allTagsRaw)) return [];
  const unique = new Set();
  for (const raw of allTagsRaw) {
    if (!raw) continue;
    let tags = raw;
    if (typeof raw === 'string') {
      try {
        tags = JSON.parse(raw);
      } catch {
        tags = [raw];
      }
    }
    if (!Array.isArray(tags)) continue;
    for (const tag of tags) {
      if (tag) unique.add(String(tag));
    }
  }
  return [...unique].sort().slice(0, 5);
}

export function mapGrowingRowForProjector(row) {
  if (!row || typeof row !== 'object') return null;
  const rawThumbnail = typeof row.representative_thumbnail === 'string'
    ? row.representative_thumbnail
    : (typeof row.raw_thumbnail === 'string' ? row.raw_thumbnail : '');
  const rawSourceUrl = typeof row.representative_memory_source_url === 'string'
    ? row.representative_memory_source_url
    : (typeof row.raw_source_url === 'string' ? row.raw_source_url : '');
  const repVisibility = typeof row.representative_memory_visibility === 'string'
    ? row.representative_memory_visibility
    : (rawThumbnail || rawSourceUrl ? 'public' : null);

  return {
    id: typeof row.id === 'string' ? row.id : String(row.id || ''),
    title: typeof row.title === 'string' ? row.title : '나의 Lovetree',
    visibility: row.visibility || 'public',
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at),
    publicMemoryCount: Number(row.public_memory_count ?? row.memory_count ?? 0),
    emotionTags: parseBrowseEmotionTags(row.emotion_tags ?? row.all_tags),
    representativeThumbnail: rawThumbnail,
    representativeMemorySourceUrl: rawSourceUrl,
    representativeMemoryVisibility: repVisibility,
  };
}

export async function createDirectNeonGrowingExecutor({ connectionString, neonOptions } = {}) {
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('GROWING_DIRECT_NEON_CONFIG_INVALID: connectionString is not a valid Neon URL');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, {
    disableWarningInBrowsers: true,
    ...(neonOptions && typeof neonOptions === 'object' ? neonOptions : {}),
  });
  return async function directNeonGrowingExecutor(text, values) {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

export function createGrowingNeonQueryCapability({ connectionString, executor, neonOptions } = {}) {
  let resolvedExecutor = executor;
  return createQueryCapability(async (descriptor) => {
    if (!resolvedExecutor) {
      if (!connectionString) {
        throw new TypeError('GROWING_DIRECT_NEON_CONFIG_INVALID: provide executor or connectionString');
      }
      resolvedExecutor = await createDirectNeonGrowingExecutor({ connectionString, neonOptions });
    }
    const limit = Number.isInteger(descriptor?.limit)
      ? Math.min(Math.max(descriptor.limit, PUBLIC_GROWING_READ_MIN_LIMIT), PUBLIC_GROWING_READ_MAX_LIMIT)
      : PUBLIC_GROWING_READ_DEFAULT_LIMIT;
    const rawRows = await resolvedExecutor(GROWING_TREES_SQL, [limit]);
    return (Array.isArray(rawRows) ? rawRows : []).map(mapGrowingRowForProjector).filter(Boolean);
  });
}

export async function handlePublicGrowingDirectNeon(request, env = {}, requestId = null, { executorOverride = null } = {}) {
  const config = readGrowingReadConfig(env);

  if (!config.isDirect) {
    return null;
  }

  if (!config.configured && !executorOverride) {
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-lovebud-upstream': 'direct-neon',
      'x-lovebud-route-status': 'config-absent',
    };
    if (requestId) headers['x-lovebud-request-id'] = requestId;
    return new Response(JSON.stringify({
      error: 'Growing direct-Neon runtime not configured',
      code: 'DIRECT_NEON_CONFIG_ABSENT',
    }), { status: 503, headers });
  }

  let forwardReq = request;
  if (requestId && !request.headers.get('x-lovebud-request-id')) {
    const newHeaders = new Headers(request.headers);
    newHeaders.set('x-lovebud-request-id', requestId);
    forwardReq = new Request(request.url, {
      method: request.method,
      headers: newHeaders,
    });
  }

  try {
    const query = createGrowingNeonQueryCapability({
      connectionString: config.connectionString,
      executor: executorOverride || undefined,
    });
    const response = await handlePublicGrowingRead(forwardReq, { query });
    const headers = new Headers(response.headers);
    headers.set('x-lovebud-upstream', 'direct-neon');
    headers.set('x-lovebud-runtime', 'direct_neon');
    if (requestId) {
      headers.set('x-lovebud-request-id', requestId);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-lovebud-upstream': 'direct-neon',
      'x-lovebud-route-status': 'query-failed',
    };
    if (requestId) headers['x-lovebud-request-id'] = requestId;
    return new Response(JSON.stringify({
      error: 'Growing direct-Neon query failed',
      code: 'DIRECT_NEON_QUERY_FAILED',
    }), { status: 500, headers });
  }
}
