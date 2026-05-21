/**
 * LoveBud Viewer Data Loader Contract Tests
 * Issue #1282
 * 
 * #1282의 다음 helper extraction 전에 loadPublicData의 API/data-shape 계약을 
 * 고정하는 static contract test.
 * 아직 viewer-data-loader.js는 존재하지 않음. 
 * 이 테스트는 helper extraction의 사전 안전장치임.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function extractFunctionBody(code, funcName) {
    const match = code.match(new RegExp(`async\\s+function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm'));
    return match ? match[1] : '';
}

test('viewer loadPublicData uses community cached memories API with flat fallback', () => {
    const code = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    assert.ok(code.includes('async function loadPublicData(treeId)'), 'async function loadPublicData(treeId) must exist');
    
    const body = extractFunctionBody(code, 'loadPublicData');
    assert.ok(body.includes('window.apiClient.communityApi.getCachedCommunityMemories'), 'primary API path must exist');
    assert.ok(body.includes('window.apiClient.getCachedCommunityMemories'), 'fallback API path must exist');
});

test('viewer loadPublicData throws when community memories API is unavailable', () => {
    const code = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    const body = extractFunctionBody(code, 'loadPublicData');
    assert.ok(body.includes("throw new Error('Community API not available')"), 'must throw correctly when API unavailable');
});

test('viewer loadPublicData requests tree memories with limit 100', () => {
    const code = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    const body = extractFunctionBody(code, 'loadPublicData');
    assert.ok(body.includes('{ treeId: treeId, limit: 100 }'), 'must request with treeId and limit 100');
});

test('viewer loadPublicData filters public memories only', () => {
    const code = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    const body = extractFunctionBody(code, 'loadPublicData');
    assert.ok(body.includes("m.visibility === 'public'"), 'must filter by public visibility');
});

test('viewer loadPublicData returns empty array for non-array responses', () => {
    const code = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    const body = extractFunctionBody(code, 'loadPublicData');
    assert.ok(body.includes('Array.isArray(memories)'), 'must check if memories is an array');
    assert.ok(body.includes('[]'), 'must fallback to empty array');
});

test('viewer loadPublicData does not leak orchestration responsibilities', () => {
    const code = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    const body = extractFunctionBody(code, 'loadPublicData');
    assert.ok(!body.includes('DT.buildBranches'), 'must not call DT.buildBranches directly');
    assert.ok(!body.includes('State.'), 'must not mutate or create viewer State directly');
    assert.ok(!body.includes('RenderTree'), 'must not interact with RenderTree');
    assert.ok(!body.includes('Panels'), 'must not interact with Panels');
});

test('postgres client exposes cached community memories contract for viewer loader', () => {
    const pgClient = fs.readFileSync('js/postgres-client.js', 'utf8');
    assert.ok(pgClient.includes('getCachedCommunityMemories'), 'must expose getCachedCommunityMemories');
    assert.ok(pgClient.includes('publicMemoriesByTreeCache'), 'must use publicMemoriesByTreeCache');
    assert.ok(pgClient.includes('publicMemoriesCache'), 'must use publicMemoriesCache');
    assert.ok(pgClient.includes('{ treeId: options.treeId, limit: options.limit || 100 }') || 
              pgClient.includes('limit: options.limit || 100'), 'must forward limit correctly');
});
