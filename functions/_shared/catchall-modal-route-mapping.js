/**
 * Catch-all Modal route mapping (Issue #4535, Slice 1).
 *
 * Owns the pure edge routing decision for functions/api/[[path]].js:
 *   - buildModalUrl: the same-origin /api/* path (plus method, query and auth
 *     shape) mapped to its Modal upstream target, including the limit/sort
 *     clamps that belong to that mapping;
 *   - isModalOwnedGetRoute / isModalOwnedWriteRoute: which same-origin requests
 *     this gateway owns and proxies to Modal.
 *
 * The gateway itself keeps orchestration and everything that performs I/O:
 * auth checks, bounded body reads and size-limit responses, the fetch timeout,
 * request-id handling, upstream/cache headers, the 404 fallback and the
 * no-store behaviour for anonymous Tree detail. Those stay in
 * functions/api/[[path]].js.
 *
 * This module performs no fetch, no body read and no env mutation; it only maps
 * a request to a target URL. Cloudflare Functions ESM. Refs #4535.
 */

import {
  buildMemoryModalUrl,
  isMemoryReadRequest,
  isMemoryWriteRequest
} from './memory-route-proxy.js';
import { normalizeEncodedPathSegment } from './path-segment.js';

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

function normalizeGrowingTreesLimit(rawLimit) {
  return Math.min(Math.max(Number(rawLimit || 6) || 6, 3), 12);
}

export function buildModalUrl(request, env) {
  const modalBaseUrl = stripTrailingSlash(env.MODAL_BASE_URL);
  if (!modalBaseUrl) return null;

  const sourceUrl = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = sourceUrl.pathname.replace(/\/+$/, '');
  const target = new URL(modalBaseUrl);

  if (path === '/api/community/trees' && sourceUrl.searchParams.get('view') === 'summary') {
    const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 12) || 12, 1), 60);
    const requestedSort = sourceUrl.searchParams.get('sort');
    const sort = requestedSort === 'popular'
      ? 'popular'
      : requestedSort === 'likes'
        ? 'likes'
        : requestedSort === 'views'
          ? 'views'
          : 'latest';
    target.pathname = '/modal/browse/latest';
    target.searchParams.set('limit', String(limit));
    target.searchParams.set('sort', sort);
    return target;
  }

  if (path === '/api/community/growing-trees') {
    const limit = normalizeGrowingTreesLimit(sourceUrl.searchParams.get('limit'));
    target.pathname = '/modal/browse/growing';
    target.searchParams.set('limit', String(limit));
    return target;
  }

  if (path === '/api/community/memories') {
    target.pathname = '/modal/community/memories';
    const treeId = sourceUrl.searchParams.get('treeId');
    const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 100) || 100, 1), 200);
    if (treeId) target.searchParams.set('treeId', treeId);
    target.searchParams.set('limit', String(limit));
    return target;
  }

  if (path === '/api/trees') {
    target.pathname = '/modal/private/trees';
    if (method === 'GET') {
      const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 100) || 100, 1), 200);
      target.searchParams.set('limit', String(limit));
    }
    return target;
  }

  const memoryTarget = buildMemoryModalUrl(request, env);
  if (memoryTarget) return memoryTarget;

  // POST /api/trees/:id/fork → /modal/private/trees/:id/fork
  const treeForkMatch = path.match(/^\/api\/trees\/([^/]+)\/fork$/);
  if (treeForkMatch && method === 'POST') {
    const treeId = normalizeEncodedPathSegment(treeForkMatch[1]);
    target.pathname = `/modal/private/trees/${treeId}/fork`;
    return target;
  }

  const capabilityMatch = path.match(/^\/api\/private\/trees\/([^/]+)\/capability$/);
  if (capabilityMatch) {
    const treeId = normalizeEncodedPathSegment(capabilityMatch[1]);
    target.pathname = `/modal/private/trees/${treeId}/capability`;
    return target;
  }

  const treeMatch = path.match(/^\/api\/trees\/([^/]+)$/);
  if (treeMatch) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const isWrite = ['PUT', 'DELETE'].includes(method);
    const treeId = normalizeEncodedPathSegment(treeMatch[1]);
    target.pathname = (isWrite || authHeader)
      ? `/modal/private/trees/${treeId}`
      : `/modal/trees/${treeId}`;
    return target;
  }

  // Tree hub-layout (same-origin PUT) → Modal POST /modal/private/trees/:id/hub-layout.
  // The canonical same-origin contract is PUT (#3058); the upstream Modal endpoint
  // is POST, so the edge gateway translates PUT → POST (see tryModalWrite).
  const hubLayoutMatch = path.match(/^\/api\/trees\/([^/]+)\/hub-layout$/);
  if (hubLayoutMatch) {
    const treeId = normalizeEncodedPathSegment(hubLayoutMatch[1]);
    target.pathname = `/modal/private/trees/${treeId}/hub-layout`;
    return target;
  }

  // Appreciation-order (same-origin GET/POST) → Modal private appreciation-order.
  // #4236 establishes the stable Modal fallback contract for the future
  // direct-Neon migration. No method translation (POST stays POST).
  const appreciationOrderMatch = path.match(/^\/api\/trees\/([^/]+)\/appreciation-order$/);
  if (appreciationOrderMatch) {
    const treeId = normalizeEncodedPathSegment(appreciationOrderMatch[1]);
    target.pathname = `/modal/private/trees/${treeId}/appreciation-order`;
    return target;
  }

  return null;
}

export function isModalOwnedGetRoute(request, env) {
  if (request.method.toUpperCase() !== 'GET') return false;
  if (isMemoryReadRequest(request)) return true;
  const modalUrl = buildModalUrl(request, env || {});
  return modalUrl !== null;
}

export function isModalOwnedWriteRoute(request, env) {
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'DELETE'].includes(method)) return false;
  if (isMemoryWriteRequest(request)) return true;

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');

  if (method === 'POST' && path.match(/^\/api\/trees\/[^/]+\/fork$/)) {
    return buildModalUrl(request, env || {}) !== null;
  }

  if (method === 'POST' && ['/api/trees', '/api/memories'].includes(path)) {
    return buildModalUrl(request, env || {}) !== null;
  }

  const isDetail = path.match(/^\/api\/(trees|memories)\/[^/]+$/);
  if (['PUT', 'DELETE'].includes(method) && isDetail) {
    return buildModalUrl(request, env || {}) !== null;
  }

  // Same-origin PUT /api/trees/:id/hub-layout → Modal POST (translated in tryModalWrite).
  if (method === 'PUT' && path.match(/^\/api\/trees\/[^/]+\/hub-layout$/)) {
    return buildModalUrl(request, env || {}) !== null;
  }

  // Same-origin POST /api/trees/:id/appreciation-order → Modal POST (no translation).
  if (method === 'POST' && path.match(/^\/api\/trees\/[^/]+\/appreciation-order$/)) {
    return buildModalUrl(request, env || {}) !== null;
  }

  return false;
}