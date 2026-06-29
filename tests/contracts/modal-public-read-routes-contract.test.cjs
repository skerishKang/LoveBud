const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODAL_APP = path.join(ROOT, 'modal_compute/app.py');
const MODAL_PUBLIC_READS = path.join(ROOT, 'modal_compute/public_reads.py');
const MODAL_VALIDATION = path.join(ROOT, 'modal_compute/validation.py');

function readModalApp() {
  return fs.readFileSync(MODAL_APP, 'utf8').replace(/\r\n/g, '\n');
}

function readModalPublicReads() {
  return fs.readFileSync(MODAL_PUBLIC_READS, 'utf8').replace(/\r\n/g, '\n');
}

function readModalValidation() {
  return fs.readFileSync(MODAL_VALIDATION, 'utf8').replace(/\r\n/g, '\n');
}

function hasString(content, pattern) {
  return content.includes(pattern);
}

function extractPythonFunction(content, functionName) {
  const normalized = content.replace(/\r\n/g, '\n');
  const startRegex = new RegExp(`^def ${functionName}\\(`, 'm');
  const match = startRegex.exec(normalized);
  assert.ok(match, `${functionName} should exist`);

  const start = match.index;
  const afterStart = normalized.slice(start);
  const nextTopLevel = afterStart.search(/\n\ndef |\n\nasync def |\n\n@web_app\.|\n\napp = |\n\nimage = |\n\nweb_app = /);

  if (nextTopLevel === -1) return normalized.slice(start);
  return normalized.slice(start, start + nextTopLevel);
}

function extractDecoratedHandler(content, decoratorNeedle, handlerName) {
  const decoratorIndex = content.indexOf(decoratorNeedle);
  assert.notEqual(decoratorIndex, -1, `${decoratorNeedle} decorator should exist`);

  const handlerIndex = content.indexOf(`def ${handlerName}(`, decoratorIndex);
  assert.notEqual(handlerIndex, -1, `${handlerName} should follow ${decoratorNeedle}`);

  const sliced = content.slice(handlerIndex);
  const nextDecorator = sliced.search(/\n\n@web_app\./);
  if (nextDecorator === -1) return sliced;
  return sliced.slice(0, nextDecorator);
}

test('modal public read route handlers remain in app.py', () => {
  const content = readModalApp();

  const expectedRoutes = [
    '@web_app.get("/modal/browse/latest")',
    '@web_app.get("/modal/browse/growing")',
    '@web_app.get("/modal/community/memories")',
    '@web_app.get("/modal/memories/{memory_id}")',
    '@web_app.get("/modal/trees/{tree_id}")',
  ];

  for (const route of expectedRoutes) {
    assert.ok(hasString(content, route), `${route} should remain in modal_compute/app.py`);
  }
});

test('modal public read handlers call their current helper functions', () => {
  const content = readModalApp();

  const latestHandler = extractDecoratedHandler(content, '@web_app.get("/modal/browse/latest")', 'get_latest_browse_snapshot');
  assert.ok(hasString(latestHandler, 'fetch_latest_public_tree_snapshots(limit=limit, sort=safe_sort)'));
  // safe_sort must accept latest, popular, likes, and views (Unit C)
  assert.ok(hasString(latestHandler, 'safe_sort = sort if sort in {"latest", "popular", "likes", "views"} else "latest"'));

  const growingHandler = extractDecoratedHandler(content, '@web_app.get("/modal/browse/growing")', 'get_growing_browse_snapshot');
  assert.ok(hasString(growingHandler, 'fetch_growing_public_tree_snapshots(limit=limit)'));

  const memoriesHandler = extractDecoratedHandler(content, '@web_app.get("/modal/community/memories")', 'get_public_community_memories');
  assert.ok(hasString(memoriesHandler, 'validate_optional_id(treeId, "treeId")'));
  assert.ok(hasString(memoriesHandler, 'fetch_public_memories(tree_id=safe_tree_id, limit=limit)'));

  const memoryDetailHandler = extractDecoratedHandler(content, '@web_app.get("/modal/memories/{memory_id}")', 'get_public_memory_detail');
  assert.ok(hasString(memoryDetailHandler, 'validate_required_id(memory_id, "memoryId")'));
  assert.ok(hasString(memoryDetailHandler, 'fetch_public_memory(safe_memory_id)'));
  assert.ok(hasString(memoryDetailHandler, 'HTTPException(status_code=404, detail="Memory not found")'));

  const treeDetailHandler = extractDecoratedHandler(content, '@web_app.get("/modal/trees/{tree_id}")', 'get_public_tree_detail');
  assert.ok(hasString(treeDetailHandler, 'validate_required_id(tree_id, "treeId")'));
  assert.ok(hasString(treeDetailHandler, 'fetch_public_tree(safe_tree_id)'));
  assert.ok(hasString(treeDetailHandler, 'HTTPException(status_code=404, detail="Tree not found")'));
});

test('modal public read helpers preserve public visibility filters and normalization boundaries', () => {
  const content = readModalPublicReads();

  const latestHelper = extractPythonFunction(content, 'fetch_latest_public_tree_snapshots');
  assert.ok(hasString(latestHelper, "t.visibility = 'public'"));
  assert.ok(hasString(latestHelper, "WHERE visibility = 'public'"));
  // latest Browse summary: likeCount and viewCount in SQL, normalized by validation normalize_row
  assert.ok(hasString(latestHelper, 'normalize_row(row, include_like_count=True)'));
  assert.ok(hasString(latestHelper, 's.view_count'), 'latest helper must select view_count in SQL');
  assert.ok(hasString(latestHelper, 'HAVING count(*) >= 3'));
  assert.ok(hasString(latestHelper, 'has_memories'));
  assert.ok(hasString(latestHelper, '_table_exists(cur, "memories")'));
  assert.ok(hasString(latestHelper, 'jsonb_agg(emotion_tags)'));
  assert.ok(!hasString(latestHelper, 'ARRAY_AGG(emotion_tags)'));

  const growingHelper = extractPythonFunction(content, 'fetch_growing_public_tree_snapshots');
  assert.ok(hasString(growingHelper, "t.visibility = 'public'"));
  assert.ok(hasString(growingHelper, "WHERE visibility = 'public'"));
  // growing Browse summary: must NOT include social counts (Unit C scope discipline)
  assert.ok(hasString(growingHelper, 'normalize_row(row, stage_override="growing")'));
  assert.ok(!hasString(growingHelper, 'include_like_count'), 'growing helper must not include likeCount');
  assert.ok(!hasString(growingHelper, 's.like_count'), 'growing helper must not join like_count');
  assert.ok(!hasString(growingHelper, 's.view_count'), 'growing helper must not join view_count');
  assert.ok(hasString(growingHelper, 'HAVING count(*) BETWEEN 1 AND 2'));
  assert.ok(hasString(growingHelper, 'has_memories'));
  assert.ok(hasString(growingHelper, '_table_exists'));
  assert.ok(hasString(growingHelper, 'jsonb_agg(emotion_tags)'));
  assert.ok(!hasString(growingHelper, 'ARRAY_AGG(emotion_tags)'));

  const memoriesHelper = extractPythonFunction(content, 'fetch_public_memories');
  assert.ok(hasString(memoriesHelper, "m.visibility = 'public'"));
  assert.ok(hasString(memoriesHelper, "t.visibility = 'public'"));
  assert.ok(hasString(memoriesHelper, 'INNER JOIN trees t'));
  assert.ok(hasString(memoriesHelper, 'normalize_memory_row(row)'));
  assert.ok(hasString(memoriesHelper, '_legacy_payload_node_to_memory_row'));

  const memoryHelper = extractPythonFunction(content, 'fetch_public_memory');
  assert.ok(hasString(memoryHelper, "m.visibility = 'public'"));
  assert.ok(hasString(memoryHelper, "t.visibility = 'public'"));
  assert.ok(hasString(memoryHelper, 'normalize_memory_row'));
  assert.ok(hasString(memoryHelper, 'reactionCounts'));
  assert.ok(hasString(memoryHelper, '_get_legacy_memory_from_payload'));

  const treeHelper = extractPythonFunction(content, 'fetch_public_tree');
  assert.ok(hasString(treeHelper, "t.visibility = 'public'"));
  assert.ok(hasString(treeHelper, "m.visibility = 'public'"));
  assert.ok(hasString(treeHelper, 'normalize_tree_row(row, row.get("memory_count"), include_owner=False)'));
  assert.ok(hasString(treeHelper, '_normalize_legacy_tree_row'));
});

test('public tree detail helper omits owner identifier from response shape', () => {
  const content = readModalPublicReads();
  const treeHelper = extractPythonFunction(content, 'fetch_public_tree');

  assert.ok(!hasString(treeHelper, 't.owner_id'), 'public tree detail must not select owner_id');
  assert.ok(!hasString(treeHelper, 'owner_id,'), 'public tree detail must not return owner_id');
  assert.ok(hasString(treeHelper, 'include_owner=False'), 'public tree detail must omit owner identifiers at normalization');
});

test('tree normalizer preserves owner identifiers by default for private routes', () => {
  const content = readModalValidation();
  const normalizer = extractPythonFunction(content, 'normalize_tree_row');

  assert.ok(hasString(normalizer, 'include_owner: bool = True'));
  assert.ok(hasString(normalizer, 'if include_owner:'));
  assert.ok(hasString(normalizer, 'tree["ownerId"] = str(row["owner_id"]) if row.get("owner_id") else None'));
});

test('modal public read route limits remain clamped at route boundary', () => {
  const content = readModalApp();

  const latestHandler = extractDecoratedHandler(content, '@web_app.get("/modal/browse/latest")', 'get_latest_browse_snapshot');
  assert.ok(hasString(latestHandler, 'limit: int = Query(default=12, ge=1, le=60)'));

  const growingHandler = extractDecoratedHandler(content, '@web_app.get("/modal/browse/growing")', 'get_growing_browse_snapshot');
  assert.ok(hasString(growingHandler, 'limit: int = Query(default=6, ge=3, le=12)'));

  const memoriesHandler = extractDecoratedHandler(content, '@web_app.get("/modal/community/memories")', 'get_public_community_memories');
  assert.ok(hasString(memoriesHandler, 'limit: int = Query(default=100, ge=1, le=200)'));
});
