/**
 * LoveBud Viewer Data Loader Contract Tests
 * Issue #1282
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function extractFunctionBody(code, funcName) {
    const match = code.match(new RegExp(`async\\s+function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm'));
    return match ? match[1] : '';
}

test('tree-viewer.js no longer contains async function loadPublicData', () => {
    const tvCode = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    assert.ok(!tvCode.includes('async function loadPublicData(treeId)'), 'tree-viewer.js must not define loadPublicData');
    assert.ok(tvCode.includes('window.LoveBudViewerDataLoader'), 'tree-viewer.js must read DataLoader helper');
});

test('viewer-data-loader.js loadPublicData uses community cached memories API with flat fallback', () => {
    const code = fs.readFileSync('js/viewer/viewer-data-loader.js', 'utf8');
    assert.ok(code.includes('async function loadPublicData(treeId)'), 'async function loadPublicData(treeId) must exist');
    assert.ok(code.includes('window.LoveBudViewerDataLoader'), 'must export namespace');
    
    const body = extractFunctionBody(code, 'loadPublicData');
    assert.ok(body.includes('window.apiClient.communityApi.getCachedCommunityMemories'), 'primary API path must exist');
    assert.ok(body.includes('window.apiClient.getCachedCommunityMemories'), 'fallback API path must exist');
});

test('viewer-data-loader.js loadPublicData throws when community memories API is unavailable', () => {
    const code = fs.readFileSync('js/viewer/viewer-data-loader.js', 'utf8');
    const body = extractFunctionBody(code, 'loadPublicData');
    assert.ok(body.includes("throw new Error('Community API not available')"), 'must throw correctly when API unavailable');
});

test('viewer-data-loader.js loadPublicData requests tree memories with limit 100', () => {
    const code = fs.readFileSync('js/viewer/viewer-data-loader.js', 'utf8');
    const body = extractFunctionBody(code, 'loadPublicData');
    assert.ok(body.includes('{ treeId: treeId, limit: 100 }'), 'must request with treeId and limit 100');
});

test('viewer-data-loader.js loadPublicData filters public memories only', () => {
    const code = fs.readFileSync('js/viewer/viewer-data-loader.js', 'utf8');
    const body = extractFunctionBody(code, 'loadPublicData');
    assert.ok(body.includes("m.visibility === 'public'"), 'must filter by public visibility');
});

test('viewer-data-loader.js loadPublicData returns empty array for non-array responses', () => {
    const code = fs.readFileSync('js/viewer/viewer-data-loader.js', 'utf8');
    const body = extractFunctionBody(code, 'loadPublicData');
    assert.ok(body.includes('Array.isArray(memories)'), 'must check if memories is an array');
    assert.ok(body.includes('[]'), 'must fallback to empty array');
});

test('viewer-data-loader.js loadPublicData does not leak orchestration responsibilities', () => {
    const code = fs.readFileSync('js/viewer/viewer-data-loader.js', 'utf8');
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