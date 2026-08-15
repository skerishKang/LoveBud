'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { withDisposableDb, baseClientConfig } = require('./helpers/postgres-disposable-harness.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const TREE_LIKES = path.join(ROOT, 'modal_compute', 'tree_likes.py');
const TREE_COMMENTS = path.join(ROOT, 'modal_compute', 'tree_comments.py');

function readSource(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function functionBody(source, name) {
  const match = source.match(new RegExp(`def\\s+${name}\\s*\\([\\s\\S]*?(?=\\n\\ndef\\s+|$)`));
  assert.ok(match, `missing ${name}`);
  return match[0];
}

test('Tree social writers authorize explicit-public state inside the write cursor before mutation locks', () => {
  const likes = readSource(TREE_LIKES);
  const comments = readSource(TREE_COMMENTS);
  const guard = functionBody(likes, 'require_public_tree_cursor');
  const toggle = functionBody(likes, 'toggle_tree_like');
  const createComment = functionBody(comments, 'create_tree_comment');

  assert.match(guard, /visibility\s*=\s*'public'/, 'cursor guard must require explicit public visibility');
  assert.match(guard, /FOR\s+SHARE/i, 'cursor guard must take a row lock that conflicts with visibility UPDATE');
  assert.doesNotMatch(guard, /FOR\s+KEY\s+SHARE/i, 'FOR KEY SHARE is insufficient for non-key visibility updates');
  assert.match(
    guard,
    /not\s+is_explicit_public\(tree\.get\("visibility"\)\)/,
    'cursor guard must re-validate the locked row through the shared explicit-public predicate so private/NULL visibility stays fail-closed at the Python boundary'
  );
  assert.match(
    guard,
    /HTTPException\(status_code=404, detail="Tree not found"\)/,
    'cursor guard must fail closed as an existence-leak-safe 404'
  );

  assert.doesNotMatch(toggle, /require_public_tree_for_like\(safe_tree_id\)/, 'Like write must not authorize on a released pre-transaction connection');
  assert.doesNotMatch(createComment, /require_public_tree_for_like\(safe_tree_id\)/, 'Comment write must not authorize on a released pre-transaction connection');

  const likeGuard = toggle.indexOf('require_public_tree_cursor(cur, safe_tree_id)');
  const advisory = toggle.indexOf('pg_advisory_xact_lock');
  const likeMutation = toggle.indexOf('_ensure_tree_social_counts');
  assert.ok(likeGuard >= 0 && advisory > likeGuard && likeMutation > advisory,
    'Like ordering must be Tree FOR SHARE -> advisory lock -> aggregate/idempotency/mutation');

  const commentGuard = createComment.indexOf('require_public_tree_cursor(cur, safe_tree_id)');
  const idempotency = createComment.indexOf('reserve_and_verify_idempotency_target');
  const insert = createComment.indexOf('INSERT INTO tree_comments');
  assert.ok(commentGuard >= 0 && idempotency > commentGuard && insert > idempotency,
    'Comment ordering must be Tree FOR SHARE -> idempotency -> INSERT');
});

async function installFixture(client) {
  await client.query(`
    CREATE TABLE trees (
      id text PRIMARY KEY,
      visibility text NULL
    );
    CREATE TABLE tree_likes (
      id text PRIMARY KEY,
      tree_id text NOT NULL,
      owner_id text NOT NULL
    );
    CREATE TABLE tree_comments (
      id text PRIMARY KEY,
      tree_id text NOT NULL,
      owner_id text NOT NULL,
      body text NOT NULL
    );
  `);
}

async function resetTree(client, treeId, visibility = 'public') {
  await client.query('TRUNCATE tree_likes, tree_comments, trees');
  await client.query('INSERT INTO trees (id, visibility) VALUES ($1, $2)', [treeId, visibility]);
}

async function privateFirstNoMutation(client, treeId, targetTable) {
  await resetTree(client, treeId, 'public');
  await client.query('UPDATE trees SET visibility = $2 WHERE id = $1', [treeId, 'private']);

  await client.query('BEGIN');
  try {
    const auth = await client.query(
      `SELECT id, visibility FROM trees WHERE id = $1 AND visibility = 'public' FOR SHARE`,
      [treeId],
    );
    assert.equal(auth.rowCount, 0, 'private-first authorization must fail leak-safe');

    if (auth.rowCount > 0) {
      if (targetTable === 'tree_likes') {
        await client.query('INSERT INTO tree_likes (id, tree_id, owner_id) VALUES ($1, $2, $3)', ['like-1', treeId, 'actor']);
      } else {
        await client.query('INSERT INTO tree_comments (id, tree_id, owner_id, body) VALUES ($1, $2, $3, $4)', ['comment-1', treeId, 'actor', 'x']);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  const count = await client.query(`SELECT count(*)::int AS count FROM ${targetTable}`);
  assert.equal(count.rows[0].count, 0, `${targetTable} must remain unchanged after private-first denial`);
}

async function socialFirstBlocksVisibilityUpdate(ctx, treeId, targetTable) {
  const { cfg, dbName, client: social } = ctx;
  await resetTree(social, treeId, 'public');
  const owner = new Client(baseClientConfig(cfg, dbName));
  await owner.connect();
  try {
    await social.query('BEGIN');
    const auth = await social.query(
      `SELECT id, visibility FROM trees WHERE id = $1 AND visibility = 'public' FOR SHARE`,
      [treeId],
    );
    assert.equal(auth.rowCount, 1, 'social transaction must establish explicit-public authority');

    if (targetTable === 'tree_likes') {
      await social.query('INSERT INTO tree_likes (id, tree_id, owner_id) VALUES ($1, $2, $3)', ['like-2', treeId, 'actor']);
    } else {
      await social.query('INSERT INTO tree_comments (id, tree_id, owner_id, body) VALUES ($1, $2, $3, $4)', ['comment-2', treeId, 'actor', 'x']);
    }

    await owner.query('BEGIN');
    await owner.query("SET LOCAL lock_timeout = '200ms'");
    await assert.rejects(
      owner.query('UPDATE trees SET visibility = $2 WHERE id = $1', [treeId, 'private']),
      error => error && error.code === '55P03',
      'owner visibility UPDATE must block behind social FOR SHARE lock',
    );
    await owner.query('ROLLBACK');

    await social.query('COMMIT');

    await owner.query('BEGIN');
    await owner.query("SET LOCAL lock_timeout = '1s'");
    const updated = await owner.query(
      'UPDATE trees SET visibility = $2 WHERE id = $1 RETURNING visibility',
      [treeId, 'private'],
    );
    assert.equal(updated.rows[0].visibility, 'private');
    await owner.query('COMMIT');

    const count = await social.query(`SELECT count(*)::int AS count FROM ${targetTable}`);
    assert.equal(count.rows[0].count, 1, `${targetTable} social write must commit before the later privacy transition`);
  } finally {
    try { await social.query('ROLLBACK'); } catch {}
    try { await owner.query('ROLLBACK'); } catch {}
    await owner.end();
  }
}

test('PostgreSQL 17.4 serializes Tree Like/Comment writes with public->private revocation', async () => {
  await withDisposableDb('tree_social_visibility', null, async ctx => {
    await installFixture(ctx.client);

    await privateFirstNoMutation(ctx.client, 'tree-like-private-first', 'tree_likes');
    await privateFirstNoMutation(ctx.client, 'tree-comment-private-first', 'tree_comments');

    await socialFirstBlocksVisibilityUpdate(ctx, 'tree-like-social-first', 'tree_likes');
    await socialFirstBlocksVisibilityUpdate(ctx, 'tree-comment-social-first', 'tree_comments');

    await resetTree(ctx.client, 'tree-null-control', null);
    const nullAuth = await ctx.client.query(
      `SELECT id FROM trees WHERE id = $1 AND visibility = 'public'`,
      ['tree-null-control'],
    );
    assert.equal(nullAuth.rowCount, 0, 'NULL visibility must remain fail-closed');
  });
});
