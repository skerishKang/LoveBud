/**
 * Contract tests for self comment deletion lifecycle route.
 *
 * These tests verify that the Cloudflare DELETE proxy and Modal
 * DELETE route exist, require Authorization, delegate to the
 * existing soft_delete_own_comment helper, validate UUID input,
 * and never leak raw exception data.
 *
 * Refs: #3195
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readFileContent(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function hasString(content, pattern) {
  return content.includes(pattern);
}

// ─── FILE PATHS ────────────────────────────────────────────────────────────

const APP_PY = path.join(ROOT, 'modal_compute', 'app.py');
const COMMENTS_PY = path.join(ROOT, 'modal_compute', 'comments.py');
const CF_COMMENTS_ID_JS = path.join(ROOT, 'functions/api/comments/[id].js');

// ─── FILE EXISTENCE ────────────────────────────────────────────────────────

test('1. Cloudflare DELETE /api/comments/{id} route exists', () => {
  assert.ok(fs.existsSync(CF_COMMENTS_ID_JS), 'functions/api/comments/[id].js must exist');
});

test('2. Modal DELETE /modal/private/comments/{comment_id} route exists', () => {
  const content = readFileContent(APP_PY);
  assert.ok(hasString(content, '/modal/private/comments/{comment_id}'), 'Modal DELETE route must be defined');
});

// ─── CLOUDFLARE PROXY CONTRACT ────────────────────────────────────────────

test('3. Cloudflare DELETE route requires Authorization', () => {
  const content = readFileContent(CF_COMMENTS_ID_JS);
  assert.ok(hasString(content, 'onRequestDelete'), 'must export onRequestDelete');
  assert.ok(hasString(content, 'authorization'), 'must reference authorization header');
  assert.ok(hasString(content, 'build401Response'), 'must have 401 response for missing auth');
  assert.ok(hasString(content, '!authHeader'), 'must check for absent auth header');
});

test('4. Cloudflare DELETE route forwards Authorization to Modal', () => {
  const content = readFileContent(CF_COMMENTS_ID_JS);
  assert.ok(hasString(content, 'authorization: authHeader'), 'must forward Authorization header to Modal');
  assert.ok(hasString(content, "method: 'DELETE'"), 'must use DELETE method');
  assert.ok(hasString(content, '/modal/private/comments/'), 'must target Modal private comments route');
});

test('5. Cloudflare DELETE route handles Modal timeout and unavailability', () => {
  const content = readFileContent(CF_COMMENTS_ID_JS);
  assert.ok(hasString(content, 'build504Response'), 'must build 504 on timeout');
  assert.ok(hasString(content, 'build503Response'), 'must build 503 on unavailable');
  assert.ok(hasString(content, 'x-lovebud-degraded'), 'must set degraded header on 503');
});

test('6. Cloudflare DELETE route preserves request ID pattern', () => {
  const content = readFileContent(CF_COMMENTS_ID_JS);
  assert.ok(hasString(content, 'getOrCreateRequestId'), 'must use existing request ID pattern');
  assert.ok(hasString(content, 'withUpstreamHeaders'), 'must forward request ID in response');
  assert.ok(hasString(content, 'x-lovebud-request-id'), 'must reference request ID header');
});

// ─── MODAL ROUTE CONTRACT — route-scoped block ─────────────────────────────

test('7. delete_own_comment has @web_app.delete decorator', () => {
  const decorator = extractDecoratorLine(APP_PY, 'delete_own_comment');
  assert.ok(decorator.includes('@web_app.delete'), 'route must have @web_app.delete decorator');
  assert.ok(decorator.includes('/modal/private/comments/{comment_id}'), 'decorator must reference the correct path');
});

test('8. delete_own_comment calls require_firebase_user, validate_required_uuid, and soft_delete_own_comment', () => {
  const block = extractPythonFunctionBlock(APP_PY, 'delete_own_comment');
  assert.ok(block.length > 0, 'function block must be extractable');

  assert.ok(hasString(block, 'require_firebase_user'), 'must call require_firebase_user');
  assert.ok(hasString(block, 'validate_required_uuid'), 'must call validate_required_uuid for input safety');
  assert.ok(hasString(block, 'soft_delete_own_comment'), 'must delegate to soft_delete_own_comment');
  assert.ok(hasString(block, 'safe_comment_id'), 'must use safe_comment_id variable');
  assert.ok(hasString(block, 'user["uid"]'), 'must pass actor uid');
});

test('9. delete_own_comment block does not contain hide_comment_by_tree_owner', () => {
  const block = extractPythonFunctionBlock(APP_PY, 'delete_own_comment');
  assert.ok(!hasString(block, 'hide_comment_by_tree_owner'), 'must not contain hide_comment_by_tree_owner');
});

test('10. delete_own_comment block does not contain direct DB access', () => {
  const block = extractPythonFunctionBlock(APP_PY, 'delete_own_comment');
  assert.ok(!hasString(block, 'get_db_connection'), 'must not contain get_db_connection');
  assert.ok(!hasString(block, '.cursor'), 'must not contain cursor calls');
  assert.ok(!hasString(block, '.execute'), 'must not contain execute calls');
});

test('11. delete_own_comment block does not log or return raw exception data', () => {
  const block = extractPythonFunctionBlock(APP_PY, 'delete_own_comment');
  assert.ok(!hasString(block, 'str(e)'), 'must not log str(e)');
  assert.ok(!hasString(block, 'traceback'), 'must not contain traceback');
});

// ─── PUBLIC COMMENTS READ STILL FILTERS ───────────────────────────────────

test('12. fetch_public_comments still filters status=visible and deleted_at IS NULL', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(hasString(content, 'visible'), 'public comments must filter status = visible');
  assert.ok(hasString(content, 'deleted_at IS NULL'), 'public comments must filter deleted_at IS NULL');
});

// ─── soft_delete_own_comment helper contract ───────────────────────────────

test('13. soft_delete_own_comment has cross-account authority via SocialWriteError(403)', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(hasString(content, 'def soft_delete_own_comment('), 'soft_delete_own_comment must exist');
  assert.ok(hasString(content, 'SocialWriteError'), 'must use SocialWriteError');
  assert.ok(hasString(content, '403'), 'must return 403 for cross-account delete');
  assert.ok(hasString(content, '404'), 'must return 404 when comment not found');
  assert.ok(hasString(content, '"deleted"'), 'must set status to deleted');
});

// ─── URL ROUTE FILE NAMING ───────────────────────────────────────────────

test('14. Cloudflare route file follows [param].js naming convention', () => {
  const filename = path.basename(CF_COMMENTS_ID_JS);
  assert.equal(filename, '[id].js', 'route file must be named [id].js for Cloudflare param binding');
});

// ─── HELPERS ──────────────────────────────────────────────────────────────

/**
 * Extract the full body (indented block) of a Python function.
 * Handles multi-line type-annotated signatures by finding the
 * closing paren of the parameter list before looking for the colon.
 */
function extractPythonFunctionBlock(filePath, functionName) {
  const content = readFileContent(filePath);
  const headerIdx = content.indexOf(`def ${functionName}(`);
  if (headerIdx === -1) return '';

  // Find the closing paren that ends the parameter list
  let depth = 1;
  let idx = headerIdx + `def ${functionName}(`.length;
  while (idx < content.length && depth > 0) {
    if (content[idx] === '(') depth++;
    if (content[idx] === ')') depth--;
    idx++;
  }
  if (depth !== 0) return '';

  // Now find the colon that ends the function signature
  const colonIdx = content.indexOf(':', idx);
  if (colonIdx === -1) return '';

  // Start collecting indented body lines
  const afterNewline = content.indexOf('\n', colonIdx);
  if (afterNewline === -1) return '';

  const lines = content.slice(afterNewline + 1).split('\n');
  let result = '';
  for (const line of lines) {
    if (line.length === 0 || line[0] === ' ' || line[0] === '\t') {
      result += line + '\n';
    } else if (line.trim().length === 0) {
      result += '\n';
    } else {
      break;
    }
  }
  return result;
}

/**
 * Extract the decorator line immediately before a function definition.
 */
function extractDecoratorLine(filePath, functionName) {
  const content = readFileContent(filePath);
  const headerIdx = content.indexOf(`def ${functionName}(`);
  if (headerIdx === -1) return '';

  // Walk backwards from the def line to find the preceding non-blank line
  const beforeDef = content.slice(0, headerIdx).trimEnd();
  const lastNewline = beforeDef.lastIndexOf('\n');
  const decoratorLine = lastNewline === -1 ? beforeDef : beforeDef.slice(lastNewline + 1);
  return decoratorLine.trim();
}


// ─── #4492 DIRECT-NEON SOURCE CANDIDATE ───────────────────────────────────

const COMMENT_DELETE_DIRECT_JS = path.join(ROOT, 'functions/_shared/comment-delete-direct-neon.js');
const COMMENT_ID_4492 = '44920000-0000-4000-8000-000000000001';
const MEMORY_ID_4492 = '44920000-0000-4000-8000-000000000002';
const ACTOR_ID_4492 = 'firebase-owner-4492';
const WRITE_DB_4492 = 'postgresql://ep-comment-delete-4492.us-east-1.neon.tech/neondb?sslmode=require';

function commentDeleteRequest4492({
  commentId = COMMENT_ID_4492,
  auth = 'Bearer comment-delete-token-4492'
} = {}) {
  const headers = new Headers({ 'x-lovebud-request-id': 'req-comment-delete-4492' });
  if (auth) headers.set('authorization', auth);
  return new Request(`https://lovebud.pages.dev/api/comments/${commentId}`, {
    method: 'DELETE',
    headers
  });
}

function commentDeleteEnv4492(extra = {}) {
  return {
    LB_COMMENT_DELETE_WRITE_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_WRITE_DATABASE_URL: WRITE_DB_4492,
    ...extra
  };
}

function makeCommentDeleteAdapter4492({
  row = {
    id: COMMENT_ID_4492,
    owner_id: ACTOR_ID_4492,
    memory_id: MEMORY_ID_4492,
    status: 'visible',
    deleted_at: null
  }
} = {}) {
  const calls = [];
  let runCalls = 0;
  const adapter = {
    async runTransaction(work) {
      runCalls += 1;
      const tx = {
        async query(text, values = []) {
          calls.push({ text, values: Array.isArray(values) ? [...values] : values });
          if (/FROM comments[\s\S]*WHERE id = \$1/i.test(text)) {
            return row ? [{ ...row }] : [];
          }
          if (/UPDATE comments[\s\S]*SET status = 'deleted'/i.test(text)) return [];
          if (/INSERT INTO social_audit_log/i.test(text)) return [];
          throw new Error('unexpected fake query');
        }
      };
      return { value: await work(tx), outcome: 'committed' };
    }
  };
  return {
    adapter,
    calls,
    get runCalls() { return runCalls; }
  };
}

test('15. #4492 direct-Neon Comment DELETE gate is source-only and dedicated-writer-only', async () => {
  assert.ok(fs.existsSync(COMMENT_DELETE_DIRECT_JS), 'direct helper must exist');
  const direct = await import('../../functions/_shared/comment-delete-direct-neon.js');

  assert.equal(direct.isCommentDeleteDirectNeonSelected({}), false);
  assert.equal(direct.isCommentDeleteDirectNeonSelected({ LB_COMMENT_DELETE_WRITE_RUNTIME: 'modal' }), false);
  assert.equal(direct.isCommentDeleteDirectNeonSelected({ LB_COMMENT_DELETE_WRITE_RUNTIME: 'future' }), false);
  assert.equal(direct.isCommentDeleteDirectNeonSelected({ LB_COMMENT_DELETE_WRITE_RUNTIME: ' direct_neon ' }), true);

  assert.equal(direct.COMMENT_DELETE_DIRECT_NEON_CONTRACT.databaseEnv, 'LOVE_PLATFORM_WRITE_DATABASE_URL');
  assert.equal(direct.COMMENT_DELETE_DIRECT_NEON_CONTRACT.productionDeletePrivilegeAuthorized, false);
  assert.equal(direct.COMMENT_DELETE_DIRECT_NEON_CONTRACT.productionGateActivationAuthorized, false);
  assert.equal(direct.COMMENT_DELETE_DIRECT_NEON_CONTRACT.providerMutationAuthorized, false);
  assert.equal(direct.COMMENT_DELETE_DIRECT_NEON_CONTRACT.perRequestModalFallbackAfterDirectStart, false);
  assert.equal(direct.COMMENT_DELETE_DIRECT_NEON_CONTRACT.automaticWholeTransactionRetry, false);
  assert.equal(direct.COMMENT_DELETE_DIRECT_NEON_CONTRACT.retryOnUnknownCommitOutcome, false);

  const routeSource = readFileContent(CF_COMMENTS_ID_JS);
  assert.ok(hasString(routeSource, 'isCommentDeleteDirectNeonSelected'));
  assert.ok(hasString(routeSource, 'handleCommentDeleteDirectNeon'));
  assert.ok(hasString(routeSource, '/modal/private/comments/'), 'Modal fallback must remain source-visible');
});

test('16. #4492 direct DELETE verifies Firebase actor then preserves lookup -> soft-delete -> audit ordering', async () => {
  const direct = await import('../../functions/_shared/comment-delete-direct-neon.js');
  const fixture = makeCommentDeleteAdapter4492();
  let verifiedToken = null;

  const response = await direct.handleCommentDeleteDirectNeon(
    commentDeleteRequest4492(),
    COMMENT_ID_4492,
    commentDeleteEnv4492(),
    'req-comment-delete-4492',
    {
      verifyTokenOverride: async (token) => {
        verifiedToken = token;
        return { uid: ACTOR_ID_4492, email: 'ignored@example.invalid' };
      },
      transactionAdapterOverride: fixture.adapter
    }
  );

  assert.equal(response.status, 200);
  assert.equal(verifiedToken, 'comment-delete-token-4492');
  assert.equal(fixture.runCalls, 1);
  assert.equal(fixture.calls.length, 3);

  assert.match(fixture.calls[0].text, /SELECT[\s\S]*owner_id[\s\S]*memory_id[\s\S]*FROM comments/i);
  assert.deepEqual(fixture.calls[0].values, [COMMENT_ID_4492]);

  assert.match(fixture.calls[1].text, /UPDATE comments[\s\S]*status = 'deleted'[\s\S]*deleted_at = NOW\(\)[\s\S]*deleted_by = \$1/i);
  assert.deepEqual(fixture.calls[1].values, [ACTOR_ID_4492, COMMENT_ID_4492]);

  assert.match(fixture.calls[2].text, /INSERT INTO social_audit_log/i);
  assert.match(fixture.calls[2].text, /'comment\.soft_delete'/);
  assert.deepEqual(fixture.calls[2].values.slice(1), [ACTOR_ID_4492, MEMORY_ID_4492]);

  assert.equal(response.headers.get('x-lovebud-upstream'), 'direct-neon');
  assert.equal(response.headers.get('x-lovebud-runtime'), 'direct_neon');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { id: COMMENT_ID_4492, status: 'deleted' });
});

test('17. #4492 missing/non-author Comment DELETE fails before mutation with Modal error parity', async () => {
  const direct = await import('../../functions/_shared/comment-delete-direct-neon.js');

  for (const scenario of [
    { row: null, status: 404, message: 'Comment not found' },
    {
      row: {
        id: COMMENT_ID_4492,
        owner_id: 'different-owner',
        memory_id: MEMORY_ID_4492,
        status: 'visible',
        deleted_at: null
      },
      status: 403,
      message: 'Only the comment author can delete this comment'
    }
  ]) {
    const fixture = makeCommentDeleteAdapter4492({ row: scenario.row });
    const response = await direct.handleCommentDeleteDirectNeon(
      commentDeleteRequest4492(),
      COMMENT_ID_4492,
      commentDeleteEnv4492(),
      'req-comment-delete-authz-4492',
      {
        verifyTokenOverride: async () => ({ uid: ACTOR_ID_4492 }),
        transactionAdapterOverride: fixture.adapter
      }
    );

    assert.equal(response.status, scenario.status);
    assert.equal(fixture.calls.length, 1);
    const body = await response.json();
    assert.equal(body.code, 'SOCIAL_WRITE_UNAVAILABLE');
    assert.equal(body.error, scenario.message);
  }
});

test('18. #4492 already non-visible Comment DELETE is idempotent and emits no second mutation/audit', async () => {
  const direct = await import('../../functions/_shared/comment-delete-direct-neon.js');
  for (const status of ['deleted', 'hidden']) {
    const fixture = makeCommentDeleteAdapter4492({
      row: {
        id: COMMENT_ID_4492,
        owner_id: ACTOR_ID_4492,
        memory_id: MEMORY_ID_4492,
        status,
        deleted_at: '2026-09-26T00:00:00Z'
      }
    });
    const response = await direct.handleCommentDeleteDirectNeon(
      commentDeleteRequest4492(),
      COMMENT_ID_4492,
      commentDeleteEnv4492(),
      'req-comment-delete-idempotent-4492',
      {
        verifyTokenOverride: async () => ({ uid: ACTOR_ID_4492 }),
        transactionAdapterOverride: fixture.adapter
      }
    );

    assert.equal(response.status, 200);
    assert.equal(fixture.calls.length, 1);
    assert.deepEqual(await response.json(), { id: COMMENT_ID_4492, status });
  }
});

test('19. #4492 invalid UUID and forbidden generic/read DB fallback fail before direct transaction work', async () => {
  const direct = await import('../../functions/_shared/comment-delete-direct-neon.js');
  let runs = 0;
  const neverAdapter = {
    async runTransaction() {
      runs += 1;
      throw new Error('must not run');
    }
  };

  const invalid = await direct.handleCommentDeleteDirectNeon(
    commentDeleteRequest4492({ commentId: 'not-a-uuid' }),
    'not-a-uuid',
    commentDeleteEnv4492(),
    'req-comment-delete-invalid-4492',
    {
      verifyTokenOverride: async () => ({ uid: ACTOR_ID_4492 }),
      transactionAdapterOverride: neverAdapter
    }
  );
  assert.equal(invalid.status, 400);
  assert.equal(runs, 0);

  const forbiddenEnv = commentDeleteEnv4492({
    LOVE_PLATFORM_WRITE_DATABASE_URL: '',
    LOVE_PLATFORM_DATABASE_URL: WRITE_DB_4492
  });
  const forbidden = await direct.handleCommentDeleteDirectNeon(
    commentDeleteRequest4492(),
    COMMENT_ID_4492,
    forbiddenEnv,
    'req-comment-delete-config-4492',
    {
      verifyTokenOverride: async () => ({ uid: ACTOR_ID_4492 }),
      transactionAdapterOverride: neverAdapter
    }
  );
  assert.equal(forbidden.status, 503);
  assert.equal((await forbidden.json()).code, 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK');
  assert.equal(runs, 0);
});

test('20. #4492 transaction failure and unknown COMMIT outcome are sanitized and never retried', async () => {
  const direct = await import('../../functions/_shared/comment-delete-direct-neon.js');
  const txmod = await import('../../functions/_shared/db/neon-ws-transaction-adapter.js');

  let queryFailureRuns = 0;
  const queryFailure = await direct.handleCommentDeleteDirectNeon(
    commentDeleteRequest4492(),
    COMMENT_ID_4492,
    commentDeleteEnv4492(),
    'req-comment-delete-query-fail-4492',
    {
      verifyTokenOverride: async () => ({ uid: ACTOR_ID_4492 }),
      transactionAdapterOverride: {
        async runTransaction() {
          queryFailureRuns += 1;
          throw new txmod.NeonWsTransactionError(
            txmod.NEON_WS_TRANSACTION_ERROR.QUERY_FAILURE,
            'private query sentinel 4492'
          );
        }
      }
    }
  );
  assert.equal(queryFailureRuns, 1);
  assert.ok([500, 502].includes(queryFailure.status));
  assert.doesNotMatch(await queryFailure.text(), /private query sentinel 4492|postgresql:|comment-delete-token-4492/);

  let unknownRuns = 0;
  const unknown = await direct.handleCommentDeleteDirectNeon(
    commentDeleteRequest4492(),
    COMMENT_ID_4492,
    commentDeleteEnv4492(),
    'req-comment-delete-unknown-4492',
    {
      verifyTokenOverride: async () => ({ uid: ACTOR_ID_4492 }),
      transactionAdapterOverride: {
        async runTransaction() {
          unknownRuns += 1;
          throw new txmod.NeonWsTransactionError(
            txmod.NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN,
            'private commit sentinel 4492'
          );
        }
      }
    }
  );
  assert.equal(unknownRuns, 1);
  assert.equal(unknown.status, 502);
  assert.equal(unknown.headers.get('x-lovebud-route-status'), 'commit-outcome-unknown');
  const unknownBody = await unknown.text();
  assert.match(unknownBody, /COMMIT_OUTCOME_UNKNOWN/);
  assert.doesNotMatch(unknownBody, /private commit sentinel 4492|postgresql:|comment-delete-token-4492/);
});
