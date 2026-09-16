// #4423 authenticated Memory reaction-summary GET direct-Neon candidate.
import { handleAuthenticatedMemoryReactionRead } from './memory-social-read-core.js';

export const MEMORY_AUTH_REACTION_READ_RUNTIME = Object.freeze({
  GATE_FLAG: 'LB_MEMORY_AUTH_REACTION_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

export function isMemoryAuthReactionReadDirectNeonSelected(env = {}) {
  const value = typeof env?.[MEMORY_AUTH_REACTION_READ_RUNTIME.GATE_FLAG] === 'string'
    ? env[MEMORY_AUTH_REACTION_READ_RUNTIME.GATE_FLAG].trim() : '';
  return value === MEMORY_AUTH_REACTION_READ_RUNTIME.DIRECT_NEON_VALUE;
}

export async function handleMemoryAuthReactionReadDirectNeon(request, env, memoryId, requestId, options = {}) {
  if (!isMemoryAuthReactionReadDirectNeonSelected(env)) return null;
  return handleAuthenticatedMemoryReactionRead(request, env, memoryId, requestId, options);
}

export const MEMORY_AUTH_REACTION_READ_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  path: '/api/memories/:memoryId/reactions',
  gateEnv: MEMORY_AUTH_REACTION_READ_RUNTIME.GATE_FLAG,
  databaseEnv: MEMORY_AUTH_REACTION_READ_RUNTIME.DATABASE_URL,
  requiredObjects: Object.freeze({ memories: ['SELECT'], trees: ['SELECT'], reactions: ['SELECT'] }),
  identity: 'verified Firebase uid',
  visibility: 'owner OR exact-public Memory+Tree',
  response: Object.freeze(['counts', 'userReactions']),
  writes: false,
  perRequestModalFallbackAfterDirectStart: false
});
