// #4423 anonymous public Memory reaction-summary GET direct-Neon candidate.
import { handlePublicMemoryReactionRead } from './memory-social-read-core.js';

export const MEMORY_PUBLIC_REACTION_READ_RUNTIME = Object.freeze({
  GATE_FLAG: 'LB_MEMORY_PUBLIC_REACTION_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

export function isMemoryPublicReactionReadDirectNeonSelected(env = {}) {
  const value = typeof env?.[MEMORY_PUBLIC_REACTION_READ_RUNTIME.GATE_FLAG] === 'string'
    ? env[MEMORY_PUBLIC_REACTION_READ_RUNTIME.GATE_FLAG].trim() : '';
  return value === MEMORY_PUBLIC_REACTION_READ_RUNTIME.DIRECT_NEON_VALUE;
}

export async function handleMemoryPublicReactionReadDirectNeon(request, env, treeId, memoryId, requestId, options = {}) {
  if (!isMemoryPublicReactionReadDirectNeonSelected(env)) return null;
  return handlePublicMemoryReactionRead(request, env, treeId, memoryId, requestId, options);
}

export const MEMORY_PUBLIC_REACTION_READ_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  path: '/api/trees/:treeId/memories/:memoryId/reactions',
  gateEnv: MEMORY_PUBLIC_REACTION_READ_RUNTIME.GATE_FLAG,
  databaseEnv: MEMORY_PUBLIC_REACTION_READ_RUNTIME.DATABASE_URL,
  requiredObjects: Object.freeze({ memories: ['SELECT'], trees: ['SELECT'], reactions: ['SELECT'] }),
  identity: 'anonymous',
  visibility: 'exact Tree+Memory membership AND both public',
  response: Object.freeze(['counts', 'total']),
  writes: false,
  perRequestModalFallbackAfterDirectStart: false
});
