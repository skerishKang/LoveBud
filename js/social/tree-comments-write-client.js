/**
 * LoveBud tree-level comment authenticated write adapter.
 *
 * Tree-target POST only: POST /trees/:treeId/comments
 * Does not call moment/memory comment endpoints.
 * Uses LoveTreeBaseApiFetch (authenticated path). Caller supplies Idempotency-Key.
 *
 * Refs #3527, #3188, #1882
 */

(function () {
  'use strict';

  var UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
  var MAX_BODY = 5000;

  var RAW_ACCOUNT_KEYS = ['ownerId', 'owner_id', 'uid', 'email'];
  var SAFE_FIELDS = [
    'id',
    'treeId',
    'body',
    'createdAt',
    'updatedAt',
    'authorDisplayLabel'
  ];

  function isValidTreeId(treeId) {
    return typeof treeId === 'string' && UUID_RE.test(treeId.trim());
  }

  function isValidIdempotencyKey(key) {
    return typeof key === 'string' && KEY_PATTERN.test(key);
  }

  function generateIdempotencyKey() {
    var a =
      'tc-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 10);
    if (a.length < 8) a = a + 'xxxxxxxx';
    return a.slice(0, 128);
  }

  function normalizeTreeCommentRow(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var item = {};
    var i;
    for (i = 0; i < SAFE_FIELDS.length; i += 1) {
      var key = SAFE_FIELDS[i];
      var value = raw[key];
      item[key] = value == null ? '' : String(value);
    }
    for (i = 0; i < RAW_ACCOUNT_KEYS.length; i += 1) {
      delete item[RAW_ACCOUNT_KEYS[i]];
    }
    return item;
  }

  function resolveApiFetch() {
    var BaseApiFetch =
      (typeof window !== 'undefined' && window.LoveTreeBaseApiFetch) || null;
    if (BaseApiFetch && typeof BaseApiFetch.apiFetch === 'function') {
      return function (endpoint, opts) {
        return BaseApiFetch.apiFetch(endpoint, opts);
      };
    }
    return null;
  }

  function mapWriteError(err) {
    var status = err && (err.status || err.statusCode);
    var code = err && err.code;
    if (status === 400 && code === 'IDEMPOTENCY_KEY_REQUIRED') {
      return { ok: false, state: 'idempotency_key_required' };
    }
    if (status === 400 && code === 'IDEMPOTENCY_KEY_INVALID') {
      return { ok: false, state: 'idempotency_key_invalid' };
    }
    if (status === 400) {
      return { ok: false, state: 'invalid_request' };
    }
    if (status === 401) {
      return { ok: false, state: 'unauthorized' };
    }
    if (status === 403) {
      return { ok: false, state: 'forbidden' };
    }
    if (status === 404) {
      return { ok: false, state: 'not_found' };
    }
    if (status === 429) {
      return { ok: false, state: 'rate_limited' };
    }
    if (status === 503) {
      return { ok: false, state: 'upstream_unavailable' };
    }
    if (status === 504) {
      return { ok: false, state: 'upstream_timeout' };
    }
    return { ok: false, state: 'unexpected_safe_error' };
  }

  /**
   * Create a whole-tree comment.
   * @param {string} treeId
   * @param {string} body
   * @param {string} [idempotencyKey]
   * @returns {Promise<{ok:boolean, state:string, comment?:object}>}
   */
  async function createTreeComment(treeId, body, idempotencyKey) {
    var cleanTreeId = typeof treeId === 'string' ? treeId.trim() : '';
    if (!isValidTreeId(cleanTreeId)) {
      return { ok: false, state: 'invalid_tree_id' };
    }

    var text = typeof body === 'string' ? body.trim() : '';
    if (!text) {
      return { ok: false, state: 'empty_body' };
    }
    if (text.length > MAX_BODY) {
      return { ok: false, state: 'body_too_long' };
    }

    var key =
      typeof idempotencyKey === 'string' && idempotencyKey
        ? idempotencyKey
        : generateIdempotencyKey();
    if (!isValidIdempotencyKey(key)) {
      return { ok: false, state: 'idempotency_key_invalid' };
    }

    var apiFetch = resolveApiFetch();
    if (!apiFetch) {
      return { ok: false, state: 'transport_unavailable' };
    }

    var endpoint = '/trees/' + encodeURIComponent(cleanTreeId) + '/comments';

    try {
      var payload = await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Idempotency-Key': key
        },
        body: JSON.stringify({ body: text })
      });

      // Response may be the comment object or { comment: {...} }
      var raw =
        payload && typeof payload === 'object'
          ? payload.comment && typeof payload.comment === 'object'
            ? payload.comment
            : payload
          : null;
      var comment = normalizeTreeCommentRow(raw);
      if (!comment || !comment.body) {
        // Authoritative create without body still counts as success for list refresh path
        return {
          ok: true,
          state: 'created',
          comment: comment || null,
          idempotencyKey: key
        };
      }
      if (!comment.treeId) comment.treeId = cleanTreeId;
      return {
        ok: true,
        state: 'created',
        comment: comment,
        idempotencyKey: key
      };
    } catch (err) {
      var mapped = mapWriteError(err);
      mapped.idempotencyKey = key;
      return mapped;
    }
  }

  window.LoveBudTreeCommentsWrite = {
    isValidTreeId: isValidTreeId,
    isValidIdempotencyKey: isValidIdempotencyKey,
    generateIdempotencyKey: generateIdempotencyKey,
    normalizeTreeCommentRow: normalizeTreeCommentRow,
    createTreeComment: createTreeComment,
    MAX_BODY: MAX_BODY
  };
})();
