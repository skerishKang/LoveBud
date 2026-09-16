// #4423 anonymous public Memory comment-list GET direct-Neon candidate.
import { handlePublicMemoryCommentRead } from './memory-social-read-core.js';

export const MEMORY_PUBLIC_COMMENT_READ_RUNTIME = Object.freeze({
  GATE_FLAG: 'LB_MEMORY_PUBLIC_COMMENT_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

export function isMemoryPublicCommentReadDirectNeonSelected(env = {}) {
  const value = typeof env?.[MEMORY_PUBLIC_COMMENT_READ_RUNTIME.GATE_FLAG] === 'string'
    ? env[MEMORY_PUBLIC_COMMENT_READ_RUNTIME.GATE_FLAG].trim() : '';
  return value === MEMORY_PUBLIC_COMMENT_READ_RUNTIME.DIRECT_NEON_VALUE;
}

export async function handleMemoryPublicCommentReadDirectNeon(request, env, treeId, memoryId, requestId, options = {}) {
  if (!isMemoryPublicCommentReadDirectNeonSelected(env)) return null;
  return handlePublicMemoryCommentRead(request, env, treeId, memoryId, requestId, options);
}

export const MEMORY_PUBLIC_COMMENT_READ_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  path: '/api/trees/:treeId/memories/:memoryId/comments',
  gateEnv: MEMORY_PUBLIC_COMMENT_READ_RUNTIME.GATE_FLAG,
  databaseEnv: MEMORY_PUBLIC_COMMENT_READ_RUNTIME.DATABASE_URL,
  requiredObjects: Object.freeze({ memories: ['SELECT'], trees: ['SELECT'], comments: ['SELECT'] }),
  identity: 'anonymous',
  visibility: 'exact Tree+Memory membership AND both public',
  response: '{comments,nextCursor}',
  limitRange: Object.freeze([1,50]),
  writes: false,
  perRequestModalFallbackAfterDirectStart: false
});
