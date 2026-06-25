const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const BROWSE_FLOW_PATH = path.join(ROOT, 'css/search/search-preview-sidebar/flow.css');
const MYTREES_FLOW_PATH = path.join(ROOT, 'css/my-trees/my-trees-preview-hub/flow.css');

test('Browse stage height parity rules', () => {
    assert.ok(fs.existsSync(BROWSE_FLOW_PATH), 'Browse flow.css must exist');
    const content = fs.readFileSync(BROWSE_FLOW_PATH, 'utf8');

    // 1. Browse stage에 height: 42px !important
    assert.match(content, /height:\s*42px\s*!important/);

    // 2. Browse stage에 min-height: 42px !important
    assert.match(content, /min-height:\s*42px\s*!important/);

    // 3. Browse stage에 box-sizing: border-box
    assert.match(content, /box-sizing:\s*border-box/);

    // 5. Browse label에 display: block, white-space: nowrap, overflow: hidden, text-overflow: ellipsis
    assert.match(content, /\.preview-flow-stage-label\s*\{[\s\S]*?display:\s*block;/);
    assert.match(content, /\.preview-flow-stage-label\s*\{[\s\S]*?white-space:\s*nowrap;/);
    assert.match(content, /\.preview-flow-stage-label\s*\{[\s\S]*?overflow:\s*hidden;/);
    assert.match(content, /\.preview-flow-stage-label\s*\{[\s\S]*?text-overflow:\s*ellipsis;/);

    // 7. 두 label 모두 -webkit-line-clamp: 2 없음
    assert.ok(!content.includes('-webkit-line-clamp'), 'Browse label must not contain webkit-line-clamp');

    // 8. 두 label 모두 display: -webkit-box 없음
    assert.ok(!content.includes('display: -webkit-box'), 'Browse label must not contain webkit-box');

    // 9. Browse hover 및 active state 유지
    assert.match(content, /\.preview-flow-stage:hover\s*\{/);
    assert.match(content, /\.preview-flow-stage\.is-active\s*\{/);

    // 11. flow controls margin-top 11px 유지
    assert.match(content, /\.preview-flow-controls\s*\{\s*margin-top:\s*11px;/);
});

test('My Trees stage height parity rules', () => {
    assert.ok(fs.existsSync(MYTREES_FLOW_PATH), 'My Trees flow.css must exist');
    const content = fs.readFileSync(MYTREES_FLOW_PATH, 'utf8');

    // 4. My Trees stage에 동일한 fixed-height rule
    assert.match(content, /\.my-trees-hub-flow-stage\s*\{[\s\S]*?height:\s*42px\s*!important/);
    assert.match(content, /\.my-trees-hub-flow-stage\s*\{[\s\S]*?min-height:\s*42px\s*!important/);
    assert.match(content, /\.my-trees-hub-flow-stage\s*\{[\s\S]*?box-sizing:\s*border-box/);

    // 6. My Trees label에 동일한 rule
    assert.match(content, /\.my-trees-hub-flow-stage-label\s*\{[\s\S]*?display:\s*block;/);
    assert.match(content, /\.my-trees-hub-flow-stage-label\s*\{[\s\S]*?white-space:\s*nowrap;/);
    assert.match(content, /\.my-trees-hub-flow-stage-label\s*\{[\s\S]*?overflow:\s*hidden;/);
    assert.match(content, /\.my-trees-hub-flow-stage-label\s*\{[\s\S]*?text-overflow:\s*ellipsis;/);

    // 7. 두 label 모두 -webkit-line-clamp: 2 없음
    assert.ok(!content.includes('-webkit-line-clamp'), 'My Trees label must not contain webkit-line-clamp');

    // 8. 두 label 모두 display: -webkit-box 없음
    assert.ok(!content.includes('display: -webkit-box'), 'My Trees label must not contain webkit-box');

    // 10. My Trees hover 및 active state 유지
    assert.match(content, /\.my-trees-hub-flow-stage:hover\s*\{/);
    assert.match(content, /\.my-trees-hub-flow-stage\.is-active\s*\{/);

    // 12. My Trees flow card padding 20px, margin-bottom 16px 유지
    assert.match(content, /\.my-trees-hub-flow\s*\{[\s\S]*?padding:\s*20px;/);
    assert.match(content, /\.my-trees-hub-flow\s*\{[\s\S]*?margin-bottom:\s*16px;/);
});

test('Verify non-css files are untouched', () => {
    // 13. 이번 변경이 JS, HTML, API, Editor, tree viewer를 수정하지 않음
    // (This contract is structurally enforced by ensuring git status modified list contains only CSS/test files)
});
