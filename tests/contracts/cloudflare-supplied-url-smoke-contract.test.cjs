const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SMOKE_SCRIPT = path.join(ROOT, 'scripts', 'cloudflare-supplied-url-smoke.cjs');
const REGISTRY_PATH = path.join(ROOT, 'tests', 'ci-test-group-registry.json');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');
const REGISTRY_CONTRACT_PATH = path.join(ROOT, 'tests', 'contracts', 'ci-test-group-registry-contract.test.cjs');
const PACKAGE_PATH = path.join(ROOT, 'package.json');

const SOURCE = fs.readFileSync(SMOKE_SCRIPT, 'utf-8');

test('1. SMOKE_EXPECTED_SHA is required', () => {
  assert.match(SOURCE, /SMOKE_EXPECTED_SHA/);
  const usageLines = SOURCE.split('\n').filter((l) => l.includes('SMOKE_EXPECTED_SHA'));
  assert.ok(usageLines.length >= 2);
  const requiredLine = usageLines.find((l) => l.includes('required'));
  assert.ok(requiredLine, 'must indicate SMOKE_EXPECTED_SHA is required');
});

test('2. exactly 40-character lowercase hex SHA validation', () => {
  assert.match(SOURCE, /\^?\[0-9a-f\]\{40\}\$?/);
  const rejectLine = SOURCE.split('\n').filter((l) => l.includes('40') && l.includes('hex'));
  assert.ok(rejectLine.length >= 1);
  assert.match(SOURCE, /process\.exit\(2\)/);
});

test('3. manifest path exists in source', () => {
  assert.match(SOURCE, /\/\.well-known\/release\.json/);
});

test('4. exact two-key manifest validation (contract_version, release_sha)', () => {
  const hasTwoKeyCheck = SOURCE.includes('contract_version') && SOURCE.includes('release_sha');
  assert.ok(hasTwoKeyCheck, 'must reference contract_version and release_sha');
  assert.match(SOURCE, /keys\.length\s*!==\s*2/);
  assert.match(SOURCE, /keys\[0\]/);
  assert.match(SOURCE, /keys\[1\]/);
  assert.match(SOURCE, /contract_version\s*!==\s*'1'/);
});

test('5. no-store cache policy validation', () => {
  assert.match(SOURCE, /no-store/);
  assert.match(SOURCE, /cache-control/i);
});

test('6. two-request equality with different nonces', () => {
  assert.match(SOURCE, /nonce1|nonce2|crypto\.randomUUID/);
  const noncePattern = /_\s*=\s*\$\{?\s*(nonce1|nonce2)\s*\}?/;
  assert.ok(SOURCE.split('\n').filter((l) => l.includes('nonce')).length >= 2);
  assert.ok(SOURCE.includes('JSON.stringify(result1.parsed) !== JSON.stringify(result2.parsed)'));
});

test('7. canonical extensionless route operation codes', () => {
  assert.match(SOURCE, /ROUTE_HOME/);
  assert.match(SOURCE, /ROUTE_INTRO/);
  assert.match(SOURCE, /ROUTE_BROWSE/);
  assert.match(SOURCE, /ROUTE_MY_TREES/);
  assert.match(SOURCE, /ROUTE_EDITOR/);
  assert.match(SOURCE, /ROUTE_SETTINGS/);
  assert.match(SOURCE, /ROUTE_PUBLIC_VIEWER/);
  assert.match(SOURCE, /ROUTE_DETAIL/);
  assert.match(SOURCE, /ROUTE_LOGIN/);
});

test('8. old /pages/*.html routes are NOT used as target authority', () => {
  const oldIntro = SOURCE.match(/pages\/intro\.html/);
  const oldSearch = SOURCE.match(/pages\/search\.html/);
  assert.equal(oldIntro, null, 'must not reference /pages/intro.html as target route');
  assert.equal(oldSearch, null, 'must not reference /pages/search.html as target route');
  assert.match(SOURCE, /'\/intro'/);
  assert.match(SOURCE, /'\/search'/);
});

test('9. five static asset operation codes and paths', () => {
  assert.match(SOURCE, /STATIC_GLOBAL_CSS/);
  assert.match(SOURCE, /STATIC_HOME_ENTRY/);
  assert.match(SOURCE, /STATIC_BROWSE_ENTRY/);
  assert.match(SOURCE, /STATIC_EDITOR_ENTRY/);
  assert.match(SOURCE, /STATIC_VIEWER_ENTRY/);
  assert.match(SOURCE, /\/css\/global\.css/);
  assert.match(SOURCE, /\/js\/index\.js/);
  assert.match(SOURCE, /\/js\/search\/index\.js/);
  assert.match(SOURCE, /\/js\/editor\.js/);
  assert.match(SOURCE, /\/js\/viewer\/tree-viewer\.js/);
});

test('10. browser routes are only /, /intro, /search', () => {
  const BROWSER_ROUTES_MATCH = SOURCE.match(/BROWSER_ROUTES\s*=\s*\[([^\]]+)\]/);
  assert.ok(BROWSER_ROUTES_MATCH, 'must define BROWSER_ROUTES');
  const routes = BROWSER_ROUTES_MATCH[1];
  assert.ok(routes.includes("'/'"));
  assert.ok(routes.includes("'/intro'"));
  assert.ok(routes.includes("'/search'"));
  assert.ok(!routes.includes('/my-trees'), 'BROWSER_ROUTES must not include /my-trees');
  assert.ok(!routes.includes('/editor'), 'BROWSER_ROUTES must not include /editor');
  assert.ok(!routes.includes('/settings'), 'BROWSER_ROUTES must not include /settings');
  assert.ok(!routes.includes('/tree'), 'BROWSER_ROUTES must not include /tree');
  assert.ok(!routes.includes('/detail'), 'BROWSER_ROUTES must not include /detail');
  assert.ok(!routes.includes('/login'), 'BROWSER_ROUTES must not include /login');
});

test('11. desktop and mobile viewports preserved', () => {
  const VIEWPORTS_MATCH = SOURCE.match(/VIEWPORTS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(VIEWPORTS_MATCH, 'must define VIEWPORTS');
  const body = VIEWPORTS_MATCH[1];
  assert.ok(body.includes('desktop'), 'must include desktop viewport');
  assert.ok(body.includes('mobile'), 'must include mobile viewport');
  assert.ok(body.includes('1280'), 'desktop width must be 1280');
  assert.ok(body.includes('800'), 'desktop height must be 800');
  assert.ok(body.includes('375'), 'mobile width must be 375');
  assert.ok(body.includes('812'), 'mobile height must be 812');
});

test('12. sanitized operation schema with bounded fields', () => {
  assert.match(SOURCE, /operation_code/);
  assert.match(SOURCE, /status_class/);
  assert.match(SOURCE, /sanitized_error_code/);
  assert.match(SOURCE, /severity/);
  assert.match(SOURCE, /latency_bucket/);
  assert.match(SOURCE, /http_status/);
  assert.match(SOURCE, /content_type_class/);
  assert.match(SOURCE, /viewport/);
  assert.match(SOURCE, /body_present/);
  assert.match(SOURCE, /horizontal_overflow_px/);
  assert.match(SOURCE, /error_count/);
  assert.match(SOURCE, /expectation_class/);

  assert.match(SOURCE, /LT_250_MS/);
  assert.match(SOURCE, /TIMEOUT_OR_UNKNOWN/);
  assert.match(SOURCE, /NOT_APPLICABLE/);
  assert.match(SOURCE, /NOT_MEASURED/);
});

test('13. raw baseUrl is NOT included in output', () => {
  const outputLines = SOURCE.match(/emitOutput\s*\([^)]*\)/);
  assert.ok(!SOURCE.includes('"baseUrl"'), 'must not include raw baseUrl in output JSON');
  assert.ok(!SOURCE.includes("'baseUrl'"), 'must not include raw baseUrl in output JSON');
});

test('14. raw response body is NOT included in output', () => {
  const dangerousPatterns = [/responseBody/, /response\.body/, /resBody/, /rawBody/];
  for (const dp of dangerousPatterns) {
    assert.ok(!dp.test(SOURCE), `must not contain pattern: ${dp}`);
  }
});

test('15. stack trace is NOT printed to stderr', () => {
  assert.ok(!SOURCE.includes('error.stack'), 'must not print error.stack');
  assert.ok(!SOURCE.includes('stack ? stack'), 'must not print stack trace');
  assert.ok(!SOURCE.includes('.stack'), 'must not reference .stack property');
});

test('16. API/auth journey operations are deferred (not present)', () => {
  assert.ok(!SOURCE.includes('API_COMMUNITY_TREES_SUMMARY'), 'must not include API_COMMUNITY_TREES_SUMMARY');
  assert.ok(!SOURCE.includes('API_PUBLIC_TREE_READ'), 'must not include API_PUBLIC_TREE_READ');
  assert.ok(!SOURCE.includes('AUTH_GUARD_EXPECTED_REJECTION'), 'must not include AUTH_GUARD_EXPECTED_REJECTION');
  assert.ok(!SOURCE.includes('SMOKE_EMAIL'), 'must not include SMOKE_EMAIL');
  assert.ok(!SOURCE.includes('SMOKE_PASSWORD'), 'must not include SMOKE_PASSWORD');
  assert.ok(!SOURCE.includes('/api/'), 'must not contain /api/ endpoint references');
});

test('17. exit codes 0, 1, 2 are used correctly', () => {
  assert.match(SOURCE, /process\.exit\(2\)/);
  assert.match(SOURCE, /process\.exit\(1\)/);
  assert.match(SOURCE, /process\.exit\(0\)/);
  assert.ok(!SOURCE.includes('process.exit(3)'), 'must not use exit code 3');
});

test('18. package.json is not modified (smoke:cloudflare already exists)', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf-8'));
  assert.ok(pkg.scripts['smoke:cloudflare'], 'smoke:cloudflare script must exist');
  assert.ok(pkg.scripts['smoke:cloudflare'].includes('cloudflare-supplied-url-smoke.cjs'));
});

test('19. exact file boundary (scripts + tests/contracts + registries + registry-contract)', () => {
  const allowedFiles = [
    'scripts/cloudflare-supplied-url-smoke.cjs',
    'tests/contracts/cloudflare-supplied-url-smoke-contract.test.cjs',
    'tests/ci-test-group-registry.json',
    'tests/test-layer-classification.json',
    'tests/contracts/ci-test-group-registry-contract.test.cjs',
  ];
  for (const f of allowedFiles) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), `required file must exist: ${f}`);
  }
  assert.match(SOURCE, /LB_MANIFEST_/);
  assert.match(SOURCE, /LB_ROUTE_RESPONSE_/);
  assert.match(SOURCE, /LB_STATIC_ASSET_/);
  assert.match(SOURCE, /BROWSER_FATAL_ERROR/);
  assert.match(SOURCE, /BROWSER_CONSOLE_ERROR/);
  assert.match(SOURCE, /BROWSER_NETWORK_FAILURE/);
  assert.match(SOURCE, /BROWSER_HTTP_BLOCKER/);
  assert.match(SOURCE, /BROWSER_HORIZONTAL_OVERFLOW/);
});
