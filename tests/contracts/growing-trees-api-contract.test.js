const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CLOUDFLARE_PROXY = path.join(ROOT, 'functions', 'api', '[[path]].js');
const MODAL_APP = path.join(ROOT, 'modal_compute', 'app.py');

function readCloudflareProxy() {
  return fs.readFileSync(CLOUDFLARE_PROXY, 'utf8');
}

function readModalApp() {
  return fs.readFileSync(MODAL_APP, 'utf8');
}

function stripWhitespace(value) {
  return value.replace(/\s+/g, '');
}

test('cloudflare proxy maps growing trees API to modal growing browse endpoint', () => {
  const source = readCloudflareProxy();
  const compactSource = stripWhitespace(source);

  assert.match(
    source,
    /function\s+normalizeGrowingTreesLimit\s*\(\s*rawLimit\s*\)/,
    'missing dedicated growing trees limit normalizer'
  );

  assert.match(
    compactSource,
    /path===['"]\/api\/community\/growing-trees['"]/,
    'missing /api/community/growing-trees route branch'
  );

  assert.match(
    compactSource,
    /target\.pathname=['"]\/modal\/browse\/growing['"]/,
    'growing trees route must target /modal/browse/growing'
  );

  assert.match(
    compactSource,
    /constlimit=normalizeGrowingTreesLimit\(sourceUrl\.searchParams\.get\(['"]limit['"]\)\)/,
    'growing trees route must use the dedicated limit normalizer'
  );

  assert.match(
    compactSource,
    /target\.searchParams\.set\(['"]limit['"],String\(limit\)\)/,
    'growing trees route must forward normalized limit'
  );
});

test('cloudflare proxy constrains growing trees limit to 3 through 12', () => {
  const source = readCloudflareProxy();
  const compactSource = stripWhitespace(source);

  assert.match(
    compactSource,
    /functionnormalizeGrowingTreesLimit\(rawLimit\)\{returnMath\.min\(Math\.max\(Number\(rawLimit\|\|6\)\|\|6,3\),12\);\}/,
    'growing trees limit must default safely and clamp to min 3 / max 12'
  );
});

test('modal app exposes growing browse endpoint backed by growing snapshot fetcher', () => {
  const source = readModalApp();

  assert.match(
    source,
    /def\s+fetch_growing_public_tree_snapshots\s*\(\s*limit:\s*int\s*=\s*6\s*\)/,
    'missing fetch_growing_public_tree_snapshots function'
  );

  assert.match(
    source,
    /@web_app\.get\(\s*["']\/modal\/browse\/growing["']\s*\)/,
    'missing /modal/browse/growing endpoint'
  );

  assert.match(
    source,
    /def\s+get_growing_browse_snapshot\s*\([\s\S]*?return\s+fetch_growing_public_tree_snapshots\(\s*limit=limit\s*\)/,
    'growing endpoint must return fetch_growing_public_tree_snapshots(limit=limit)'
  );

  assert.match(
    source,
    /limit:\s*int\s*=\s*Query\(\s*default=6,\s*ge=3,\s*le=12\s*\)/,
    'modal growing endpoint limit must be constrained to 3 through 12'
  );
});

test('modal growing snapshot query keeps public memory count and growing stage contract', () => {
  const source = readModalApp();

  const normalizedSource = source.replace(/\r\n/g, '\n');
  const functionMatch = normalizedSource.match(
    /def\s+fetch_growing_public_tree_snapshots\s*\(\s*limit:\s*int\s*=\s*6\s*\)[\s\S]*?(?=\n\n+def\s+)/
  );
  assert.ok(functionMatch, 'missing fetch_growing_public_tree_snapshots function body');

  const functionBody = functionMatch[0];
  const compactBody = stripWhitespace(functionBody).toLowerCase();

  assert.match(
    compactBody,
    /wherevisibility=['"]public['"]/,
    'growing snapshot query must count public memories only'
  );

  assert.match(
    compactBody,
    /havingcount\(\*\)between1and2/,
    'growing snapshot query must filter public memory count between 1 and 2'
  );

  assert.match(
    compactBody,
    /wheret\.visibility=['"]public['"]/,
    'growing snapshot query must return public trees only'
  );

  assert.match(
    compactBody,
    /orderbyt\.updated_atdescnullslast,t\.created_atdescnullslast/,
    'growing snapshot query must sort by updated_at DESC with created_at DESC fallback'
  );

  assert.match(
    functionBody,
    /normalize_row\(\s*row,\s*stage_override=["']growing["']\s*\)/,
    'growing snapshots must force stage_override="growing"'
  );
});
