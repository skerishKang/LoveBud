/**
 * LoveBud tree-level comment read/list client adapter.
 *
 * Tree-target only. Reads whole-tree comments via the dedicated
 * `GET /api/trees/:treeId/comments` route (public-read eligible surface).
 * Strictly separated from #3075 moment comments: no moment endpoint, no
 * `memory_id`, no moment client adapter reuse. This module exposes only a
 * data-read function; it renders nothing and changes no existing surface
 * or backend behavior.
 *
 * Refs: #3414, #3188, #3412, #3413, #3408, #3410, #3404, #3405, #3400, #3401,
 *       #3396, #3398, #3393, #3394, #3388, #3392, #3075, #1882
 */

(function () {
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const RAW_ACCOUNT_KEYS = ['ownerId', 'owner_id', 'uid', 'email'];

  const SAFE_FIELDS = ['id', 'treeId', 'body', 'createdAt', 'updatedAt', 'authorDisplayLabel'];

  function isValidTreeId(treeId) {
    return typeof treeId === 'string' && UUID_RE.test(treeId.trim());
  }

  function sanitizeLimit(limit) {
    const DEFAULT = 20;
    const MIN = 1;
    const MAX = 50;
    let n = Number(limit);
    if (!Number.isFinite(n) || n < MIN) n = DEFAULT;
    if (n > MAX) n = MAX;
    n = Math.floor(n);
    return Math.max(MIN, Math.min(n, MAX));
  }

  // Normalize a single comment row into the safe public DTO.
  // Always drops raw account identifiers (ownerId/owner_id/uid/email) and
  // keeps only the documented safe fields.
  function normalizeTreeCommentRow(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const item = {};
    for (const key of SAFE_FIELDS) {
      const value = raw[key];
      item[key] = value == null ? '' : String(value);
    }
    // Explicitly do not copy any raw account identifier.
    for (const rawKey of RAW_ACCOUNT_KEYS) {
      delete item[rawKey];
    }
    return item;
  }

  function extractComments(payload) {
    if (!payload || typeof payload !== 'object') return [];
    const list = Array.isArray(payload) ? payload : payload.comments;
    if (!Array.isArray(list)) return [];
    return list.map(normalizeTreeCommentRow).filter(Boolean);
  }

  // Resolve the fetch transport. In the browser this reuses the project's
  // BaseApiFetch (which honors publicRead, so guest read sends no auth header
  // and never enters a 401 retry loop). Under Node (tests) the module is loaded
  // with a mocked window/fetch, so the same browser path is exercised with a
  // mocked fetch and no production/staging network.
  function resolveApiFetch() {
    const BaseApiFetch = (typeof window !== 'undefined' && window.LoveTreeBaseApiFetch) || null;
    if (BaseApiFetch && typeof BaseApiFetch.apiFetch === 'function') {
      return (endpoint, opts) => BaseApiFetch.apiFetch(endpoint, opts);
    }
    return async (endpoint, opts = {}) => {
      const url = '/api' + endpoint;
      const res = await fetch(url, opts);
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }
      if (!res.ok) {
        const err = new Error(
          (data && data.error) ? String(data.error) : `HTTP Error ${res.status}`
        );
        err.status = res.status;
        err.statusCode = res.status;
        if (data && data.code) err.code = String(data.code);
        throw err;
      }
      return data;
    };
  }

  function mapError(err) {
    const status = err && (err.status || err.statusCode);
    const code = err && err.code;
    if (status == null) {
      // Transport/network failure (no response): upstream unreachable.
      return { ok: false, state: 'upstream_unavailable' };
    }
    if (status === 400 && code === 'INVALID_TREE_ID') {
      return { ok: false, state: 'invalid_tree_id' };
    }
    if (status === 400) {
      return { ok: false, state: 'invalid_tree_id' };
    }
    if (status === 404) {
      return { ok: false, state: 'not_found_private_non_public' };
    }
    if (status === 503) {
      return { ok: false, state: 'upstream_unavailable' };
    }
    if (status === 504) {
      return { ok: false, state: 'upstream_timeout' };
    }
    if (status === 401) {
      // Transport 401 anomaly: collapse to safe error, never retry loop.
      return { ok: false, state: 'unexpected_safe_error' };
    }
    return { ok: false, state: 'unexpected_safe_error' };
  }

  async function fetchTreeComments(treeId, options) {
    const opts = options || {};
    const cleanTreeId = typeof treeId === 'string' ? treeId.trim() : '';

    if (!isValidTreeId(cleanTreeId)) {
      return { ok: false, state: 'invalid_tree_id' };
    }

    const limit = sanitizeLimit(opts.limit);
    let endpoint = `/trees/${encodeURIComponent(cleanTreeId)}/comments?limit=${limit}`;
    if (opts.cursor && typeof opts.cursor === 'string') {
      endpoint += `&cursor=${encodeURIComponent(opts.cursor)}`;
    }

    const apiFetch = resolveApiFetch();
    try {
      // publicRead: true -> guest/public read sends no Authorization header,
      // no Idempotency-Key, and never triggers a 401 mutation/auth retry loop.
      const payload = await apiFetch(endpoint, { publicRead: true });
      const comments = extractComments(payload);
      const nextCursor = (payload && typeof payload.nextCursor === 'string') ? payload.nextCursor : null;
      return {
        ok: true,
        state: comments.length > 0 ? 'loaded_with_comments' : 'loaded_empty',
        comments,
        nextCursor,
      };
    } catch (err) {
      return mapError(err);
    }
  }

  window.LoveBudTreeComments = {
    isValidTreeId,
    sanitizeLimit,
    normalizeTreeCommentRow,
    extractComments,
    fetchTreeComments,
  };
})();
