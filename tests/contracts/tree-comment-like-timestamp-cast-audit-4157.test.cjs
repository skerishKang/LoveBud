const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const COMMENT_SOURCE = fs.readFileSync(
  path.join(__dirname, '../../functions/_shared/tree-comment-direct-neon.js'),
  'utf8'
);
const LIKE_SOURCE = fs.readFileSync(
  path.join(__dirname, '../../functions/_shared/tree-like-direct-neon.js'),
  'utf8'
);

test('#4157 comment replay reread text-casts both timestamptz fields', () => {
  assert.match(
    COMMENT_SOURCE,
    /SELECT id, tree_id, owner_id, body,\s+created_at::text AS created_at,\s+updated_at::text AS updated_at\s+FROM tree_comments\s+WHERE id = \$1\s+LIMIT 1/,
    'comment replay must preserve PostgreSQL timestamp text rather than pg Date parsing'
  );
});

test('#4157 comment create RETURNING text-casts both timestamptz fields', () => {
  assert.match(
    COMMENT_SOURCE,
    /RETURNING id, tree_id, owner_id, body,\s+created_at::text AS created_at,\s+updated_at::text AS updated_at/,
    'comment INSERT RETURNING must preserve PostgreSQL timestamp text rather than pg Date parsing'
  );

  assert.equal(
    (COMMENT_SOURCE.match(/created_at::text AS created_at/g) || []).length,
    2,
    'exactly the replay reread and create RETURNING should cast created_at'
  );
  assert.equal(
    (COMMENT_SOURCE.match(/updated_at::text AS updated_at/g) || []).length,
    2,
    'exactly the replay reread and create RETURNING should cast updated_at'
  );
});

test('#4157 like response has no DB timestamp surface requiring the same cast', () => {
  assert.match(
    LIKE_SOURCE,
    /const resultPayload = \{ treeId, active, likeCount \};/,
    'Like response contract is treeId/active/likeCount only'
  );
  assert.doesNotMatch(
    LIKE_SOURCE,
    /const resultPayload = \{[^}]*createdAt|const resultPayload = \{[^}]*updatedAt/,
    'Like must not expose an uncast DB timestamp through its response payload'
  );
});
