/**
 * LoveBud Public Viewer Default Structured Layout Contract Tests
 * Issue #3271
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('createInitialState defaults layoutMode to hierarchy', () => {
    const code = fs.readFileSync(
        path.resolve(__dirname, '../../js/viewer/viewer-state.js'), 'utf8'
    );

    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);

    const state = sandbox.window.LoveBudViewerState.createInitialState();
    assert.equal(state.layoutMode, 'hierarchy');
});

test('viewer-init-flow obtains state through State.createInitialState', () => {
    const code = fs.readFileSync(
        path.resolve(__dirname, '../../js/viewer/viewer-init-flow.js'), 'utf8'
    );
    assert.ok(code.includes('State.createInitialState()'),
        'viewer-init-flow must call State.createInitialState()');
});

test('hierarchy mode routes to renderHierarchyTree', () => {
    const code = fs.readFileSync(
        path.resolve(__dirname, '../../js/visitor-viewer/visitor-viewer-render-tree.js'), 'utf8'
    );
    assert.ok(code.includes("layoutMode === 'hierarchy'"),
        'must check for hierarchy layoutMode');
    assert.ok(code.includes('renderHierarchyTree('),
        'must call renderHierarchyTree for hierarchy mode');
});

test('organic mode routes to renderOrganicTree', () => {
    const code = fs.readFileSync(
        path.resolve(__dirname, '../../js/visitor-viewer/visitor-viewer-render-tree.js'), 'utf8'
    );
    assert.ok(code.includes('renderOrganicTree('),
        'must call renderOrganicTree for organic mode');
});

test('hierarchy renderer falls back to organic when layout cannot be built', () => {
    const code = fs.readFileSync(
        path.resolve(__dirname, '../../js/visitor-viewer/visitor-viewer-render-tree.js'), 'utf8'
    );
    const hierarchyStart = code.indexOf('function renderHierarchyTree(');
    assert.ok(hierarchyStart !== -1, 'renderHierarchyTree must exist');

    const hierarchyBody = code.substring(
        hierarchyStart,
        code.indexOf('function renderOrganicTree(', hierarchyStart)
    );
    assert.ok(hierarchyBody.includes('renderOrganicTree('),
        'renderHierarchyTree must fall back to renderOrganicTree');
});

test('no network, browser request, subprocess, env, secret, DB, API, or deploy', () => {
    const sources = [
        fs.readFileSync(path.resolve(__dirname, '../../js/viewer/viewer-state.js'), 'utf8'),
        fs.readFileSync(path.resolve(__dirname, '../../js/viewer/viewer-init-flow.js'), 'utf8'),
        fs.readFileSync(path.resolve(__dirname, '../../js/visitor-viewer/visitor-viewer-render-tree.js'), 'utf8')
    ];
    const forbidden = [
        'fetch(', 'XMLHttpRequest', 'http.request', 'https.request',
        'child_process', 'process.env', 'SECRET', 'PASSWORD',
        'DATABASE_URL'
    ];
    for (const src of sources) {
        for (const term of forbidden) {
            assert.ok(!src.includes(term), `source must not contain ${term}`);
        }
    }
});
