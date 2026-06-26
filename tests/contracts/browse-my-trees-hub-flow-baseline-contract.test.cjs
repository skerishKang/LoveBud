'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('1. My Trees flow wrapper has preview-flow-slot', () => {
  const html = read('pages/my-trees.html');
  const flowWrapper = html.match(/<[^>]*\bid="myTreesHubFlow"[^>]*>/);
  assert.ok(flowWrapper, '#myTreesHubFlow wrapper must exist');
  assert.ok(flowWrapper[0].includes('preview-flow-slot'), '#myTreesHubFlow must have preview-flow-slot class');
});

test('2. My Trees flow list retains preview-flow-list', () => {
  const html = read('pages/my-trees.html');
  const flowList = html.match(/<[^>]*\bid="myTreesHubFlowList"[^>]*>/);
  assert.ok(flowList, '#myTreesHubFlowList must exist');
  assert.ok(flowList[0].includes('preview-flow-list'), '#myTreesHubFlowList must retain preview-flow-list class');
});

test('3. My Trees flow controls retain preview-flow-controls', () => {
  const html = read('pages/my-trees.html');
  const flowControls = html.match(/<[^>]*\bid="myTreesHubFlowControls"[^>]*>/);
  assert.ok(flowControls, '#myTreesHubFlowControls must exist');
  assert.ok(flowControls[0].includes('preview-flow-controls'), '#myTreesHubFlowControls must retain preview-flow-controls class');
});

test('4. My Trees JS stage adds preview-flow-stage', () => {
  const js = read('js/my-trees/my-trees-preview-hub.js');
  assert.ok(js.includes('preview-flow-stage'), 'my-trees-preview-hub.js must add preview-flow-stage to stage elements');
});

test('5. My Trees JS label adds preview-flow-stage-label', () => {
  const js = read('js/my-trees/my-trees-preview-hub.js');
  assert.ok(js.includes('preview-flow-stage-label'), 'my-trees-preview-hub.js must add preview-flow-stage-label to label elements');
});

test('6. My Trees JS toggle adds preview-flow-toggle', () => {
  const js = read('js/my-trees/my-trees-preview-hub.js');
  assert.ok(js.includes('preview-flow-toggle'), 'my-trees-preview-hub.js must add preview-flow-toggle to toggle button');
});

test('7. Browse renderer adds preview-flow-slot and preview-flow-slot-loading to loading flow card', () => {
  const renderer = read('js/search/search-preview-renderer.js');
  assert.ok(
    renderer.includes('preview-focus-flow-card-loading'),
    'Loading flow card section must exist'
  );
  assert.ok(
    renderer.includes('preview-flow-slot-loading'),
    'Loading flow card must have preview-flow-slot-loading class'
  );
  assert.ok(
    renderer.includes('class="preview-focus-flow-card preview-flow-slot preview-flow-slot-loading preview-focus-flow-card-loading"'),
    'Loading flow card must have preview-flow-slot and preview-flow-slot-loading class'
  );
  // Check the inline style no longer has the old geometry tokens
  assert.ok(
    !renderer.includes('padding:20px;border-radius:1rem;margin-bottom:16px;'),
    'Loading flow card must not have the old inline geometry block'
  );
});

test('8. Browse renderer adds preview-flow-slot to no-moments flow card', () => {
  const renderer = read('js/search/search-preview-renderer.js');
  assert.ok(
    renderer.includes('preview-focus-flow-card-empty'),
    'No-moments flow card section must exist'
  );
  assert.ok(
    renderer.includes('class="preview-focus-flow-card preview-flow-slot preview-focus-flow-card-empty"'),
    'No-moments flow card must have preview-flow-slot class'
  );
  assert.ok(
    !renderer.includes('padding:20px;'),
    'No-moments flow card must not have inline padding'
  );
  assert.ok(
    !renderer.includes('margin-bottom:16px;'),
    'No-moments flow card must not have inline margin-bottom'
  );
});

test('9. Browse renderer adds preview-flow-slot to normal flow card', () => {
  const renderer = read('js/search/search-preview-renderer.js');
  assert.ok(
    renderer.includes('class="preview-focus-flow-card preview-flow-slot"'),
    'Normal flow card must have preview-flow-slot class (unique class pattern)'
  );
  assert.ok(
    !renderer.includes('padding:20px;'),
    'Normal flow card must not have inline padding'
  );
  assert.ok(
    !renderer.includes('margin-bottom:16px;'),
    'Normal flow card must not have inline margin-bottom'
  );
});

test('10. Shared CSS owns flow slot base geometry (loading excluded from margin-bottom)', () => {
  const shared = read('css/shared/preview-hub-content-slots.css');
  assert.ok(shared.includes('.preview-flow-slot'), 'Shared CSS must have .preview-flow-slot selector');
  assert.ok(shared.includes('.preview-flow-slot:not(.preview-flow-slot-loading)'), 'Shared CSS must have loading-excluded margin rule');
  assert.ok(shared.includes('margin-bottom: 16px'), 'Shared CSS must set margin-bottom for non-loading slots');
  assert.ok(shared.includes('padding: 20px'), '.preview-flow-slot must set padding');
  assert.ok(shared.includes('box-sizing: border-box'), '.preview-flow-slot must set box-sizing');
  assert.ok(shared.includes('min-width: 0'), '.preview-flow-slot must set min-width');
  // Loading flow must be excluded from 16px margin
  assert.ok(!shared.match(/\.preview-flow-slot-loading\s*\{[^}]*margin-bottom/), 'Shared CSS must not define margin for loading state');
});

test('11. Loading flow card has no margin-bottom (preview-flow-slot-loading excluded)', () => {
  const shared = read('css/shared/preview-hub-content-slots.css');
  assert.ok(
    shared.includes('.preview-flow-slot:not(.preview-flow-slot-loading)'),
    'Shared CSS must exclude .preview-flow-slot-loading from margin-bottom'
  );
  // Normal and no-moments flow cards must still have margin-bottom via the :not selector
  assert.ok(
    !shared.match(/\.preview-flow-slot\s*\{\s*margin-bottom/),
    'Base .preview-flow-slot must not have margin-bottom (only on :not(.preview-flow-slot-loading))'
  );
});

test('12. Normal and no-moments flow cards retain 16px margin via :not(.preview-flow-slot-loading)', () => {
  // Normal card (no extra class) — inherits margin-bottom via .preview-flow-slot:not(.preview-flow-slot-loading)
  const renderer = read('js/search/search-preview-renderer.js');
  const normalMatch = renderer.match(/class="preview-focus-flow-card preview-flow-slot"/g);
  assert.ok(normalMatch, 'Normal flow card must have preview-flow-slot class only');
  const noMomentsMatch = renderer.match(/class="preview-focus-flow-card preview-flow-slot preview-focus-flow-card-empty"/g);
  assert.ok(noMomentsMatch, 'No-moments flow card must have preview-flow-slot class (no preview-flow-slot-loading)');
  // Verify only the loading card gets the loading class
  const loadingMatch = renderer.match(/preview-flow-slot-loading/g);
  assert.equal(loadingMatch.length, 1, 'Only one template should have preview-flow-slot-loading');
});

test('13. My Trees flow.css no longer retains duplicate desktop/base geometry', () => {
  const flow = read('css/my-trees/my-trees-preview-hub/flow.css');
  // Surface-specific properties kept
  assert.ok(flow.includes('background: linear-gradient(180deg,'), 'flow.css must keep background');
  assert.ok(flow.includes('border-radius: 1rem'), 'flow.css must keep border-radius');
  // Base geometry removed
  assert.ok(!flow.includes('box-sizing: border-box;'), 'flow.css must not have duplicate box-sizing');
  assert.ok(!flow.includes('margin-bottom: 16px;'), 'flow.css must not have duplicate margin-bottom');
  assert.ok(!flow.includes('padding: 20px;'), 'flow.css must not have duplicate padding');
  // Grid/desktop and stage removed
  assert.ok(!flow.includes('grid-template-columns:'), 'flow.css must not retain duplicate grid rules');
  assert.ok(!flow.includes('height: 42px'), 'flow.css must not retain stage height rule');
  assert.ok(!flow.includes('.my-trees-hub-flow-list'), 'flow.css must not retain .my-trees-hub-flow-list (moved to Browse)');
  assert.ok(!flow.includes('.my-trees-hub-flow-stage-label'), 'flow.css must not retain .my-trees-hub-flow-stage-label (moved to Browse)');
  assert.ok(!flow.includes('.my-trees-hub-flow-toggle'), 'flow.css must not retain .my-trees-hub-flow-toggle (moved to Browse)');
  // Owner-specific rules kept
  assert.ok(flow.includes('.my-trees-hub-flow-label'), 'flow.css must keep .my-trees-hub-flow-label');
  assert.ok(flow.includes('.my-trees-hub-flow-stage-index'), 'flow.css must keep .my-trees-hub-flow-stage-index');
  assert.ok(flow.includes('#myTreesHubFlowControls[hidden]'), 'flow.css must keep #myTreesHubFlowControls[hidden]');
  assert.ok(flow.includes('.my-trees-hub-flow-controls:empty'), 'flow.css must keep .my-trees-hub-flow-controls:empty');
});

test('12. Browse flow.css retains list/stage/controls/toggle baseline', () => {
  const browseFlow = read('css/search/search-preview-sidebar/flow.css');
  assert.ok(browseFlow.includes('.preview-flow-list'), 'Browse flow.css must retain .preview-flow-list');
  assert.ok(browseFlow.includes('.preview-flow-stage'), 'Browse flow.css must retain .preview-flow-stage');
  assert.ok(browseFlow.includes('.preview-flow-stage-label'), 'Browse flow.css must retain .preview-flow-stage-label');
  assert.ok(browseFlow.includes('.preview-flow-controls'), 'Browse flow.css must retain .preview-flow-controls');
  assert.ok(browseFlow.includes('.preview-flow-toggle'), 'Browse flow.css must retain .preview-flow-toggle');
  assert.ok(browseFlow.includes('grid-template-columns:'), 'Browse flow.css must retain grid rules');
});

test('13. Browse responsive.css retains desktop 2-column and responsive overrides', () => {
  const browseResp = read('css/search/search-preview-sidebar/responsive.css');
  assert.ok(browseResp.includes('@media (min-width: 1025px)'), 'Browse responsive.css must keep 1025px+ 2-column rule');
  assert.ok(browseResp.includes('.preview-flow-stage'), 'Browse responsive.css must retain .preview-flow-stage overrides');
  assert.ok(browseResp.includes('@media (max-width: 768px)'), 'Browse responsive.css must retain 768px overrides');
  assert.ok(browseResp.includes('@media (max-width: 375px)'), 'Browse responsive.css must retain 375px overrides');
});

test('14. My Trees 375px compact pill delta preserved', () => {
  const responsive = read('css/my-trees/my-trees-preview-hub/responsive.css');
  assert.ok(responsive.includes('border-radius: 999px !important;'), '375px compact pill delta must preserve border-radius: 999px');
  assert.ok(responsive.includes('min-height: 32px !important;'), '375px compact pill delta must preserve min-height: 32px');
});

test('15. My Trees 768px flow padding delta preserved (owner-specific responsive)', () => {
  const responsive = read('css/my-trees/my-trees-preview-hub/responsive.css');
  assert.ok(
    /@media\s*\(max-width:\s*768px\)[^}]*\.my-trees-hub-flow\s*\{[^}]*padding:\s*16px\s*!important;[^}]*\}/.test(responsive),
    'responsive.css must preserve .my-trees-hub-flow padding: 16px !important at <=768px'
  );
});

test('16. My Trees 375px flow padding delta preserved (owner-specific responsive)', () => {
  const responsive = read('css/my-trees/my-trees-preview-hub/responsive.css');
  assert.ok(
    /@media\s*\(max-width:\s*375px\)[^}]*\.my-trees-hub-flow\s*\{[^}]*padding:\s*12px\s*!important;[^}]*\}/.test(responsive),
    'responsive.css must preserve .my-trees-hub-flow padding: 12px !important at <=375px'
  );
});

test('17. Existing IDs and data attributes preserved', () => {
  const myTreesJs = read('js/my-trees/my-trees-preview-hub.js');
  assert.ok(myTreesJs.includes('data-my-trees-moment-index'), 'data-my-trees-moment-index must be preserved');
  assert.ok(myTreesJs.includes('data-my-trees-flow-toggle'), 'data-my-trees-flow-toggle must be preserved');
  assert.ok(myTreesJs.includes('role="button"'), 'role="button" must be preserved');
  assert.ok(myTreesJs.includes('tabindex="0"'), 'tabindex="0" must be preserved');
});

test('18. Audit document Phase 2d section exists', () => {
  const audit = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
  assert.ok(audit.includes('Phase 2d completed'), 'Audit must mention Phase 2d completed');
  assert.ok(audit.includes('preview-flow-slot'), 'Audit must mention preview-flow-slot');
  assert.ok(audit.includes('preview-flow-stage'), 'Audit must mention preview-flow-stage');
  assert.ok(audit.includes('preview-flow-stage-label'), 'Audit must mention preview-flow-stage-label');
  assert.ok(audit.includes('preview-flow-toggle'), 'Audit must mention preview-flow-toggle');
});

test('19. Audit Refs verified', () => {
  const audit = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
  assert.ok(audit.includes('Refs #2923'), 'Audit must contain Refs #2923');
  assert.ok(audit.includes('Refs #2903'), 'Audit must contain Refs #2903');
  assert.ok(audit.includes('Refs #1882'), 'Audit must contain Refs #1882');
});

test('20. No Closes/Fixes/Resolves #1882 in audit', () => {
  const audit = read('docs/engineering/BROWSE_MY_TREES_CANONICAL_STRUCTURE_AUDIT.md');
  assert.ok(!audit.includes('Closes #1882'), 'Audit must not contain Closes #1882');
  assert.ok(!audit.includes('Fixes #1882'), 'Audit must not contain Fixes #1882');
  assert.ok(!audit.includes('Resolves #1882'), 'Audit must not contain Resolves #1882');
});
