import { REQUEST_ID_HEADER } from '../../functions/_shared/request-id.js';
import {
  PLATFORM_ERROR,
  PlatformApiError,
  buildPlatformErrorResponse,
  createRequestContext,
  requireCapability
} from './core.js';

export const PUBLIC_LOVETREE_GROWING_READ_PATH = '/internal/lovetree/public/browse-eligible-trees';
export const PUBLIC_LOVETREE_GROWING_READ_OPERATION = 'lovetree.public.browse-eligible-trees.v1';
export const PUBLIC_LOVETREE_GROWING_READ_DEFAULT_LIMIT = 6;
export const PUBLIC_LOVETREE_GROWING_READ_MIN_LIMIT = 3;
export const PUBLIC_LOVETREE_GROWING_READ_MAX_LIMIT = 12;

const PUBLIC_LOVETREE_GROWING_OUTPUT_KEYS = Object.freeze([
  'id',
  'title',
  'artist',
  'likeCount'
]);

export const PUBLIC_LOVETREE_GROWING_READ_CONTRACT = Object.freeze({
  path: PUBLIC_LOVETREE_GROWING_READ_PATH,
  method: 'GET',
  operation: PUBLIC_LOVETREE_GROWING_READ_OPERATION,
  defaultLimit: PUBLIC_LOVETREE_GROWING_READ_DEFAULT_LIMIT,
  minLimit: PUBLIC_LOVETREE_GROWING_READ_MIN_LIMIT,
  maxLimit: PUBLIC_LOVETREE_GROWING_READ_MAX_LIMIT,
  treeVisibility: 'public',
  memoryVisibility: 'public',
  minPublicMemoryCount: 3,
  order: Object.freeze([
    Object.freeze({ field: 'likeCount', direction: 'desc' }),
    Object.freeze({ field: 'createdAt', direction: 'desc' })
  ]),
  tertiaryOrder: null,
  outputKeys: PUBLIC_LOVETREE_GROWING_OUTPUT_KEYS
});

function normalizedLikeCount(value) {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }
  return value;
}

function isAuthorizedLoveTreeGrowingRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return false;
  }
  if (row.visibility !== 'public') {
    return false;
  }
  if (!Number.isInteger(row.publicMemoryCount)
      || row.publicMemoryCount < PUBLIC_LOVETREE_GROWING_READ_CONTRACT.minPublicMemoryCount) {
    return false;
  }
  if (typeof row.id !== 'string' || row.id.length === 0) {
    return false;
  }
  if (typeof row.title !== 'string' || typeof row.artist !== 'string') {
    return false;
  }
  return normalizedLikeCount(row.likeCount) !== null;
}

function projectLoveTreeGrowingRow(row) {
  return Object.freeze({
    id: row.id,
    title: row.title,
    artist: row.artist,
    likeCount: normalizedLikeCount(row.likeCount)
  });
}

export function normalizePublicLoveTreeGrowingLimit(rawLimit) {
  if (rawLimit === null || rawLimit === '') {
    return PUBLIC_LOVETREE_GROWING_READ_DEFAULT_LIMIT;
  }

  const numeric = Number(rawLimit);
  if (Number.isNaN(numeric)) {
    return null;
  }
  if (Number.isFinite(numeric) && !Number.isInteger(numeric)) {
    return null;
  }

  const clamped = Math.min(
    Math.max(numeric, PUBLIC_LOVETREE_GROWING_READ_MIN_LIMIT),
    PUBLIC_LOVETREE_GROWING_READ_MAX_LIMIT
  );
  return Number.isInteger(clamped) ? clamped : null;
}

export function isPublicLoveTreeGrowingReadRequest(request) {
  if (!(request instanceof Request) || request.method !== 'GET') {
    return false;
  }
  return new URL(request.url).pathname === PUBLIC_LOVETREE_GROWING_READ_PATH;
}

export function buildPublicLoveTreeGrowingReadDescriptor(limit) {
  return Object.freeze({
    operation: PUBLIC_LOVETREE_GROWING_READ_OPERATION,
    limit,
    treeVisibility: PUBLIC_LOVETREE_GROWING_READ_CONTRACT.treeVisibility,
    memoryVisibility: PUBLIC_LOVETREE_GROWING_READ_CONTRACT.memoryVisibility,
    publicMemoryCount: Object.freeze({
      min: PUBLIC_LOVETREE_GROWING_READ_CONTRACT.minPublicMemoryCount
    }),
    order: PUBLIC_LOVETREE_GROWING_READ_CONTRACT.order
  });
}

export function projectPublicLoveTreeGrowingRows(rows, limit) {
  if (!Array.isArray(rows)) {
    throw new TypeError('LoveTree public growing query result must be an array');
  }
  if (!Number.isInteger(limit)
      || limit < PUBLIC_LOVETREE_GROWING_READ_MIN_LIMIT
      || limit > PUBLIC_LOVETREE_GROWING_READ_MAX_LIMIT) {
    throw new TypeError('LoveTree public growing projection requires a bounded integer limit');
  }

  const output = [];
  for (const row of rows) {
    if (!isAuthorizedLoveTreeGrowingRow(row)) {
      continue;
    }
    output.push(projectLoveTreeGrowingRow(row));
    if (output.length >= limit) {
      break;
    }
  }
  return Object.freeze(output);
}

function buildPublicLoveTreeGrowingSuccessResponse(items, requestId) {
  return new Response(JSON.stringify(items), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      [REQUEST_ID_HEADER]: requestId,
      'Access-Control-Expose-Headers': REQUEST_ID_HEADER
    }
  });
}

export async function handlePublicLoveTreeGrowingRead(request, capabilities) {
  const context = createRequestContext(request, { capabilities });
  try {
    const url = new URL(request.url);
    const limit = normalizePublicLoveTreeGrowingLimit(url.searchParams.get('limit'));
    if (limit === null) {
      throw new PlatformApiError(PLATFORM_ERROR.ROUTE_UNAVAILABLE);
    }

    const query = requireCapability(context.capabilities, 'query');
    const rows = await query.execute(buildPublicLoveTreeGrowingReadDescriptor(limit));
    const items = projectPublicLoveTreeGrowingRows(rows, limit);
    return buildPublicLoveTreeGrowingSuccessResponse(items, context.requestId);
  } catch (error) {
    return buildPlatformErrorResponse(error, context.requestId);
  }
}
