import { REQUEST_ID_HEADER } from '../../functions/_shared/request-id.js';
import {
  PLATFORM_ERROR,
  PlatformApiError,
  buildPlatformErrorResponse,
  createRequestContext,
  requireCapability
} from './core.js';

export const PUBLIC_GROWING_READ_PATH = '/api/community/growing-trees';
export const PUBLIC_GROWING_READ_OPERATION = 'lovebud.public-growing-tree-snapshots.v1';
export const PUBLIC_GROWING_READ_DEFAULT_LIMIT = 6;
export const PUBLIC_GROWING_READ_MIN_LIMIT = 3;
export const PUBLIC_GROWING_READ_MAX_LIMIT = 12;

const PUBLIC_GROWING_OUTPUT_KEYS = Object.freeze([
  'id',
  'title',
  'visibility',
  'createdAt',
  'updatedAt',
  'representativeThumbnail',
  'memoryCount',
  'emotionTags',
  'stage',
  'theme',
  'timeRange',
  'representativeMemorySourceUrl'
]);

export const PUBLIC_GROWING_READ_CONTRACT = Object.freeze({
  path: PUBLIC_GROWING_READ_PATH,
  method: 'GET',
  operation: PUBLIC_GROWING_READ_OPERATION,
  defaultLimit: PUBLIC_GROWING_READ_DEFAULT_LIMIT,
  minLimit: PUBLIC_GROWING_READ_MIN_LIMIT,
  maxLimit: PUBLIC_GROWING_READ_MAX_LIMIT,
  treeVisibility: 'public',
  memoryVisibility: 'public',
  minPublicMemoryCount: 1,
  maxPublicMemoryCount: 2,
  order: Object.freeze([
    Object.freeze({ field: 'updatedAt', direction: 'desc', nulls: 'last' }),
    Object.freeze({ field: 'createdAt', direction: 'desc', nulls: 'last' })
  ]),
  outputKeys: PUBLIC_GROWING_OUTPUT_KEYS
});

function boundedString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function nullableTimestamp(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : null;
}

function normalizeEmotionTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((tag) => typeof tag === 'string' && tag.length > 0))]
    .sort()
    .slice(0, 5);
}

function hasPublicRepresentativeMediaProof(row) {
  const thumbnail = boundedString(row.representativeThumbnail);
  const sourceUrl = boundedString(row.representativeMemorySourceUrl);
  if (!thumbnail && !sourceUrl) {
    return true;
  }
  return row.representativeMemoryVisibility === 'public';
}

function isAuthorizedGrowingRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return false;
  }
  if (row.visibility !== 'public') {
    return false;
  }
  if (!Number.isInteger(row.publicMemoryCount)
      || row.publicMemoryCount < PUBLIC_GROWING_READ_CONTRACT.minPublicMemoryCount
      || row.publicMemoryCount > PUBLIC_GROWING_READ_CONTRACT.maxPublicMemoryCount) {
    return false;
  }
  if (typeof row.id !== 'string' || row.id.length === 0) {
    return false;
  }
  if (!hasPublicRepresentativeMediaProof(row)) {
    return false;
  }
  if (row.createdAt !== null && row.createdAt !== undefined && typeof row.createdAt !== 'string') {
    return false;
  }
  if (row.updatedAt !== null && row.updatedAt !== undefined && typeof row.updatedAt !== 'string') {
    return false;
  }
  return true;
}

function projectGrowingRow(row) {
  const sourceUrl = boundedString(row.representativeMemorySourceUrl);
  const rawThumbnail = boundedString(row.representativeThumbnail);

  return Object.freeze({
    id: row.id,
    title: boundedString(row.title, '나의 Lovetree') || '나의 Lovetree',
    visibility: 'public',
    createdAt: nullableTimestamp(row.createdAt),
    updatedAt: nullableTimestamp(row.updatedAt),
    representativeThumbnail: rawThumbnail || sourceUrl || '',
    memoryCount: row.publicMemoryCount,
    emotionTags: normalizeEmotionTags(row.emotionTags),
    stage: 'growing',
    theme: 'LoveTree',
    timeRange: '',
    representativeMemorySourceUrl: sourceUrl
  });
}

export function normalizePublicGrowingLimit(rawLimit) {
  const numeric = Number(rawLimit || PUBLIC_GROWING_READ_DEFAULT_LIMIT)
    || PUBLIC_GROWING_READ_DEFAULT_LIMIT;
  const clamped = Math.min(
    Math.max(numeric, PUBLIC_GROWING_READ_MIN_LIMIT),
    PUBLIC_GROWING_READ_MAX_LIMIT
  );
  return Number.isInteger(clamped) ? clamped : null;
}

export function isPublicGrowingReadRequest(request) {
  if (!(request instanceof Request) || request.method !== 'GET') {
    return false;
  }
  return new URL(request.url).pathname === PUBLIC_GROWING_READ_PATH;
}

export function buildPublicGrowingReadDescriptor(limit) {
  return Object.freeze({
    operation: PUBLIC_GROWING_READ_OPERATION,
    limit,
    treeVisibility: PUBLIC_GROWING_READ_CONTRACT.treeVisibility,
    memoryVisibility: PUBLIC_GROWING_READ_CONTRACT.memoryVisibility,
    publicMemoryCount: Object.freeze({
      min: PUBLIC_GROWING_READ_CONTRACT.minPublicMemoryCount,
      max: PUBLIC_GROWING_READ_CONTRACT.maxPublicMemoryCount
    }),
    order: PUBLIC_GROWING_READ_CONTRACT.order
  });
}

export function projectPublicGrowingRows(rows, limit) {
  if (!Array.isArray(rows)) {
    throw new TypeError('Growing query result must be an array');
  }
  if (!Number.isInteger(limit)
      || limit < PUBLIC_GROWING_READ_MIN_LIMIT
      || limit > PUBLIC_GROWING_READ_MAX_LIMIT) {
    throw new TypeError('Growing projection requires a bounded integer limit');
  }

  const output = [];
  for (const row of rows) {
    if (!isAuthorizedGrowingRow(row)) {
      continue;
    }
    output.push(projectGrowingRow(row));
    if (output.length >= limit) {
      break;
    }
  }
  return Object.freeze(output);
}

function buildPublicGrowingSuccessResponse(items, requestId) {
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

export async function handlePublicGrowingRead(request, capabilities) {
  const context = createRequestContext(request, { capabilities });
  try {
    const url = new URL(request.url);
    const limit = normalizePublicGrowingLimit(url.searchParams.get('limit'));
    if (limit === null) {
      throw new PlatformApiError(PLATFORM_ERROR.ROUTE_UNAVAILABLE);
    }

    const query = requireCapability(context.capabilities, 'query');
    const rows = await query.execute(buildPublicGrowingReadDescriptor(limit));
    const items = projectPublicGrowingRows(rows, limit);
    return buildPublicGrowingSuccessResponse(items, context.requestId);
  } catch (error) {
    return buildPlatformErrorResponse(error, context.requestId);
  }
}
