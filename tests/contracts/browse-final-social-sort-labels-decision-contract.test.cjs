// Browse Final Social Sort Labels Decision — contract test
// Locks the decision in docs/product/lovebud-browse-final-social-sort-labels-decision.md
// Refs #2433, #1661, #608

const assert = require('node:assert');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const docsDir = path.join(__dirname, '..', '..', 'docs', 'product');
const decisionDoc = path.join(docsDir, 'lovebud-browse-final-social-sort-labels-decision.md');

// Helper to read file content
function readDoc(p) {
  return fs.readFileSync(p, 'utf8');
}

test('Decision document exists', () => {
  assert.ok(fs.existsSync(decisionDoc), `Expected ${decisionDoc} to exist`);
});

test('Decision document records three final labels', () => {
  const content = readDoc(decisionDoc);
  // Must explicitly state the three labels
  assert.match(content, /최신순/);
  assert.match(content, /조회순/);
  assert.match(content, /좋아요순/);
});

test('Decision document maps labels to correct sort values', () => {
  const content = readDoc(decisionDoc);
  // Verify mapping table or explicit statements
  assert.match(content, /최신순.*latest|latest.*최신순/);
  assert.match(content, /조회순.*views|views.*조회순/);
  assert.match(content, /좋아요순.*likes|likes.*좋아요순/);
});

test('Decision document explicitly disposes of 인기순', () => {
  const content = readDoc(decisionDoc);
  // Must have explicit decision about 인기순
  assert.match(content, /인기순/);
  // Must state it is removed/hidden from visible control
  assert.match(content, /제거|숨김|not present|not surfaced|disposition|removed|hidden/i);
});

test('Decision document preserves popular API support', () => {
  const content = readDoc(decisionDoc);
  // popular sort value must still work via API
  assert.match(content, /popular.*작동|popular.*works|popular.*supported|API.*popular|continues to work/i);
});

test('Decision document reaffirms hard scope boundaries for Unit D UI PR', () => {
  const content = readDoc(decisionDoc);
  // Must list boundaries that UI PR must not touch
  const boundaryKeywords = [
    'backend sort logic',
    'API contract',
    'Browse summary payload',
    'private tree boundary',
    'dedup policy',
    'analytics prohibition'
  ];
  for (const kw of boundaryKeywords) {
    assert.match(content, new RegExp(kw, 'i'), `Missing boundary keyword: ${kw}`);
  }
});

test('Decision document records implementation gates for Unit D UI PR', () => {
  const content = readDoc(decisionDoc);
  // Must have implementation gates section
  assert.match(content, /Implementation Gates|implementation gates/i);
  const gateKeywords = [
    '정확히 세 개|exactly three|three options',
    '최신순.*조회순.*좋아요순|조회순.*좋아요순.*최신순|좋아요순.*최신순.*조회순',
    'mobile.*375px|375px.*mobile',
    'desktop'
  ];
  for (const kw of gateKeywords) {
    assert.match(content, new RegExp(kw, 'i'), `Missing gate keyword: ${kw}`);
  }
});

test('Decision document does not authorize runtime changes', () => {
  const content = readDoc(decisionDoc);
  // Must be clear this is docs-only decision
  assert.match(content, /docs-only|docs only|문서만|런타임.*변경.*없음|no runtime.*change|Runtime behavior remains unchanged/i);
});

test('Decision document references all parent decisions', () => {
  const content = readDoc(decisionDoc);
  const requiredRefs = [
    'lovebud-browse-tree-social-counts-plan',
    'lovebud-browse-tree-view-count-policy',
    'lovebud-browse-sort-views-readiness-audit',
    'lovebud-public-tree-detail-viewcount-read-boundary',
    'BROWSE_POPULAR_SORT_SEMANTICS',
    'BROWSE_SORT_DEFINITION'
  ];
  for (const ref of requiredRefs) {
    assert.match(content, new RegExp(ref, 'i'), `Missing parent reference: ${ref}`);
  }
});

test('Decision document records closure note for #1661 and #608', () => {
  const content = readDoc(decisionDoc);
  assert.match(content, /#1661/);
  assert.match(content, /#608/);
  assert.match(content, /does not close|남아있|remain open/i);
});

// Runtime locking assertions — these must fail if the codebase drifts
test('Runtime locking: visitor-viewer-panels.js tree-comments sort (인기순/최신순) is separate from Browse sort', () => {
  const filePath = path.join(__dirname, '..', '..', 'js', 'visitor-viewer', 'visitor-viewer-panels.js');
  const content = fs.readFileSync(filePath, 'utf8');
  // visitor-viewer-panels.js has comment sorting, not Browse tree sorting.
  // Browse sort labels (조회순/좋아요순) must NOT be in visitor-viewer.
  assert.doesNotMatch(content, /조회순/);
  assert.doesNotMatch(content, /좋아요순/);
  // 인기순 and 최신순 should still be present (tree-comments sort, separate)
  assert.match(content, /인기순/);
  assert.match(content, /최신순/);
  // These must NOT have data-browse-sort attributes
  assert.doesNotMatch(content, /data-browse-sort/);
});

test('Runtime locking: search-ui.js now has 조회순/좋아요순 (Unit D implementation)', () => {
  const filePath = path.join(__dirname, '..', '..', 'js', 'search', 'search-ui.js');
  const content = fs.readFileSync(filePath, 'utf8');
  // 조회순 and 좋아요순 must now be present (Unit D implementation)
  assert.match(content, /조회순/);
  assert.match(content, /좋아요순/);
  // 최신순 should still be present
  assert.match(content, /최신순/);
  // popular button must be removed from visible controls
  assert.doesNotMatch(content, /data-browse-sort="popular"/);
  // English labels must exist
  assert.match(content, /Views/);
  assert.match(content, /Likes/);
});

test('Runtime locking: catch-all route still accepts popular and maps unsupported to latest', () => {
  const filePath = path.join(__dirname, '..', '..', 'functions', 'api', '[[path]].js');
  const content = fs.readFileSync(filePath, 'utf8');
  // popular must still be in the ternary
  assert.match(content, /popular/);
  // unsupported values must fall back to latest
  assert.match(content, /latest/);
  // likes and views must be in the ternary (post Unit C)
  assert.match(content, /likes/);
  assert.match(content, /views/);
});

test('Runtime locking: modal app safe_sort set includes latest, popular, likes, views', () => {
  const filePath = path.join(__dirname, '..', '..', 'modal_compute', 'app.py');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.match(content, /latest/);
  assert.match(content, /popular/);
  assert.match(content, /likes/);
  assert.match(content, /views/);
  // safe_sort set should contain all four
  assert.match(content, /safe_sort.*=.*{.*latest.*popular.*likes.*views|safe_sort.*=.*{.*views.*likes.*popular.*latest/);
});

test('Runtime locking: public_reads order_clause branches for likes and views exist', () => {
  const filePath = path.join(__dirname, '..', '..', 'modal_compute', 'public_reads.py');
  const content = fs.readFileSync(filePath, 'utf8');
  // likes branch
  assert.match(content, /like_count.*DESC.*updated_at.*DESC.*created_at.*DESC.*id.*ASC|order_clause.*likes/);
  // views branch
  assert.match(content, /view_count.*DESC.*updated_at.*DESC.*created_at.*DESC.*id.*ASC|order_clause.*views/);
});
test('Runtime locking: viewCount and likeCount in Browse summary payload', () => {
  // The Browse summary payload must expose viewCount and likeCount.
  // The SQL query selects s.view_count for sort=views ordering, and
  // normalize_row() with include_like_count=True adds both likeCount and viewCount.

  const filePath = path.join(__dirname, '..', '..', 'modal_compute', 'validation.py');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // normalize_row must add viewCount
  assert.match(content, /result\[\"viewCount\"\]|result\['viewCount'\]/);
  
  // include_like_count adds both likeCount and viewCount
  assert.match(content, /include_like_count/);
  assert.match(content, /result\[\"likeCount\"\]/);
});

test('Runtime locking: tree_social_counts has view_count and like_count indexes', () => {
  const filePath = path.join(__dirname, '..', '..', 'scripts', 'migration-add-tree-social-counts.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.match(content, /idx_tree_social_counts_view_count/);
  assert.match(content, /idx_tree_social_counts_like_count/);
  assert.match(content, /view_count.*DESC.*updated_at.*DESC/);
  assert.match(content, /like_count.*DESC.*updated_at.*DESC/);
});