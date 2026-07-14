const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('1. Browse HTML — previewHubSummarySlot has preview-summary-slot', () => {
  const html = read('pages/search.html');
  const el = html.match(/id="previewHubSummarySlot"[^>]*>/);
  assert.ok(el, '#previewHubSummarySlot must exist in search.html');
  assert.ok(el[0].includes('preview-summary-slot'), '#previewHubSummarySlot must have preview-summary-slot class');
});

test('2. Browse HTML — previewHubActionsSlot has preview-actions', () => {
  const html = read('pages/search.html');
  const el = html.match(/id="previewHubActionsSlot"[^>]*>/);
  assert.ok(el, '#previewHubActionsSlot must exist in search.html');
  assert.ok(el[0].includes('preview-actions'), '#previewHubActionsSlot must have preview-actions class');
});

test('3. Browse HTML — previewHubSocialSlot has preview-hub-social-slot', () => {
  const html = read('pages/search.html');
  const el = html.match(/id="previewHubSocialSlot"[^>]*>/);
  assert.ok(el, '#previewHubSocialSlot must exist in search.html');
  assert.ok(el[0].includes('preview-hub-social-slot'), '#previewHubSocialSlot must have preview-hub-social-slot class');
});

test('4. My Trees HTML — myTreesHubSummary has my-trees-hub-summary and preview-summary-slot', () => {
  const html = read('pages/my-trees.html');
  const el = html.match(/myTreesHubSummary[^>]*>/);
  assert.ok(el, '#myTreesHubSummary must exist in my-trees.html');
  const tag = html.match(/<div[^>]*myTreesHubSummary[^>]*>/);
  assert.ok(tag, '#myTreesHubSummary element must be found');
  assert.ok(tag[0].includes('my-trees-hub-summary'), '#myTreesHubSummary must retain my-trees-hub-summary class');
  assert.ok(tag[0].includes('preview-summary-slot'), '#myTreesHubSummary must have preview-summary-slot class');
});

test('5. My Trees HTML — myTreesHubActions has my-trees-hub-actions and preview-actions', () => {
  const html = read('pages/my-trees.html');
  const tag = html.match(/<div[^>]*myTreesHubActions[^>]*>/);
  assert.ok(tag, '#myTreesHubActions element must be found');
  assert.ok(tag[0].includes('my-trees-hub-actions'), '#myTreesHubActions must retain my-trees-hub-actions class');
  assert.ok(tag[0].includes('preview-actions'), '#myTreesHubActions must have preview-actions class');
});

test('6. My Trees HTML — myTreesHubSocialSlot has preview-hub-social-slot', () => {
  const html = read('pages/my-trees.html');
  const el = html.match(/id="myTreesHubSocialSlot"[^>]*>/);
  assert.ok(el, '#myTreesHubSocialSlot must exist in my-trees.html');
  assert.ok(el[0].includes('preview-hub-social-slot'), '#myTreesHubSocialSlot must have preview-hub-social-slot class');
});

test('7. Both CSS entries import preview-hub-content-slots.css', () => {
  const searchCss = read('css/search.css');
  const myTreesCss = read('css/my-trees.css');
  assert.ok(searchCss.includes('preview-hub-content-slots.css'), 'search.css must import preview-hub-content-slots.css');
  assert.ok(myTreesCss.includes('preview-hub-content-slots.css'), 'my-trees.css must import preview-hub-content-slots.css');
});

test('8. Shared CSS owns exact summary slot values', () => {
  const shared = read('css/shared/preview-hub-content-slots.css');
  assert.ok(shared.includes('font-size: 14px'), '.preview-summary-slot must set font-size: 14px');
  assert.ok(shared.includes('line-height: 1.6'), '.preview-summary-slot must set line-height: 1.6');
});

test('9. Shared CSS owns exact action stack values', () => {
  const shared = read('css/shared/preview-hub-content-slots.css');
  assert.ok(shared.includes('margin-top: 18px'), '.preview-actions must set margin-top: 18px');
  assert.ok(shared.includes('display: flex'), '.preview-actions must set display: flex');
  assert.ok(shared.includes('flex-direction: column'), '.preview-actions must set flex-direction: column');
  assert.ok(shared.includes('gap: 0'), '.preview-actions must set gap: 0');
});

test('10. flow.css no longer retains #previewHubActionsSlot geometry declaration', () => {
  const flow = read('css/search/search-preview-sidebar/flow.css');
  assert.ok(!flow.includes('#previewHubActionsSlot'), 'flow.css must not contain #previewHubActionsSlot selector');
});

test('11. actions.css no longer retains .my-trees-hub-actions container geometry', () => {
  const actions = read('css/my-trees/my-trees-preview-hub/actions.css');
  const match = actions.match(/\.my-trees-hub-actions\s*\{/);
  assert.ok(!match, 'actions.css must not retain .my-trees-hub-actions container block');
});

test('12. Browse renderer no longer retains inline style on preview-focus-copy', () => {
  const renderer = read('js/search/search-preview-renderer.js');
  // Must not have the full inline style fingerprint
  const hasInlinePattern = renderer.includes('preview-focus-copy" style=') ||
    renderer.includes("preview-focus-copy' style=");
  assert.ok(!hasInlinePattern, 'Browse renderer must not retain inline style on preview-focus-copy');
});

test('13. My Trees writeSummary no longer retains inline padding:0 4px', () => {
  const hub = read('js/my-trees/my-trees-preview-hub.js');
  // Allow comment-only reference; check that writeSummary innerHTML no longer sets inline style
  const writeSummaryMatch = hub.match(/writeSummary[\s\S]{0,500}innerHTML/);
  assert.ok(writeSummaryMatch, 'writeSummary function must set innerHTML');
  assert.ok(!writeSummaryMatch[0].includes('padding:0 4px'), 'writeSummary innerHTML must not contain inline padding:0 4px');
});

test('14. Browse summary slot ID preserved', () => {
  const html = read('pages/search.html');
  assert.ok(html.includes('id="previewHubSummarySlot"'), 'Browse summary slot ID must be preserved');
  assert.ok(html.includes('id="previewHubActionsSlot"'), 'Browse actions slot ID must be preserved');
  assert.ok(html.includes('id="previewHubSocialSlot"'), 'Browse social slot ID must be preserved');
});

test('15. My Trees summary slot ID preserved', () => {
  const html = read('pages/my-trees.html');
  assert.ok(html.includes('id="myTreesHubSummary"'), 'My Trees summary slot ID must be preserved');
  assert.ok(html.includes('id="myTreesHubActions"'), 'My Trees actions slot ID must be preserved');
  assert.ok(html.includes('id="myTreesHubSocialSlot"'), 'My Trees social slot ID must be preserved');
});

test('16. Action semantics preserved — Browse action helper keeps 감상 열기, 감상 링크 복사, 트리 열기', () => {
  const helper = read('js/search/search-preview-action-helper.js');
  assert.ok(helper.includes('감상 열기'), 'Browse action helper must retain 감상 열기');
  assert.ok(helper.includes('감상 링크 복사'), 'Browse action helper must retain 감상 링크 복사');
  assert.ok(helper.includes('트리 열기'), 'Browse action helper must retain 트리 열기');
});

test('17. Action semantics preserved — My Trees keeps 감상하기, 편집하기, 공개 화면 보기, 감상 링크 복사', () => {
  const html = read('pages/my-trees.html');
  assert.ok(html.includes('감상하기'), 'My Trees must retain 감상하기 (appreciation)');
  assert.ok(html.includes('편집하기'), 'My Trees must retain 편집하기');
  assert.ok(html.includes('공개 화면 보기'), 'My Trees must retain 공개 화면 보기');
  assert.ok(html.includes('감상 링크 복사'), 'My Trees must retain 감상 링크 복사');
});

test('18. My Trees action IDs remain stable', () => {
  const html = read('pages/my-trees.html');
  assert.ok(html.includes('id="myTreesHubOpenBtn"'), 'myTreesHubOpenBtn ID must be stable');
  assert.ok(html.includes('id="myTreesHubEditBtn"'), 'myTreesHubEditBtn ID must be stable');
  assert.ok(html.includes('id="myTreesHubShareBtn"'), 'myTreesHubShareBtn ID must be stable');
});

test('19. Audit document contains Phase 2c state', () => {
  const audit = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
  assert.ok(audit.includes('Phase 2c completed'), 'Audit document must mention Phase 2c completed');
  assert.ok(audit.includes('preview-summary-slot'), 'Audit document must mention preview-summary-slot');
  assert.ok(audit.includes('preview-actions'), 'Audit document must mention preview-actions');
  assert.ok(audit.includes('preview-hub-social-slot'), 'Audit document must mention preview-hub-social-slot');
  assert.ok(audit.includes('css/shared/preview-hub-content-slots.css'), 'Audit document must mention shared CSS file');
});

test('20. Audit document must not contain Closes/Fixes/Resolves #1882', () => {
  const audit = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
  assert.ok(!audit.includes('Closes #1882'), 'Audit must not contain Closes #1882');
  assert.ok(!audit.includes('Fixes #1882'), 'Audit must not contain Fixes #1882');
  assert.ok(!audit.includes('Resolves #1882'), 'Audit must not contain Resolves #1882');
});
