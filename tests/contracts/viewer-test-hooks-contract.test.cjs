/**
 * LoveBud Viewer Test Hooks Contract Tests
 * Issue #1282
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('viewer-init-flow.js delegates test hooks export to helper', () => {
    const tvCode = fs.readFileSync('js/viewer/viewer-init-flow.js', 'utf8');
    assert.ok(tvCode.includes('TestHooks.exportTestHooks'), 'viewer-init-flow.js must call exportTestHooks');
    assert.ok(tvCode.includes('DT: DT'), 'viewer-init-flow.js must pass DT to test hooks helper');
    assert.ok(tvCode.includes('Route: Route'), 'viewer-init-flow.js must pass Route to test hooks helper');
    assert.ok(tvCode.includes('ShellRender: ShellRender'), 'viewer-init-flow.js must pass ShellRender to test hooks helper');
});

test('viewer-test-hooks.js correctly implements test hooks contract', () => {
    const code = fs.readFileSync('js/viewer/viewer-test-hooks.js', 'utf8');
    assert.ok(code.includes('window.LoveBudViewerTestHooks'), 'must export namespace');
    assert.ok(code.includes('function exportTestHooks(context)'), 'must accept context');
    assert.ok(code.includes('window.__LOVE_BUD_TREE_VIEWER_TEST_HOOKS__'), 'must check test hooks feature flag');
    assert.ok(code.includes('window.LoveBudTreeViewerTestHooks = {'), 'must assign test hooks global object');
    assert.ok(code.includes('buildBranches: context.DT.buildBranches'), 'must export buildBranches');
    assert.ok(code.includes('getTreeId: context.Route && context.Route.getTreeId'), 'must export getTreeId');
    assert.ok(code.includes('renderShell: context.ShellRender && context.ShellRender.renderShell'), 'must export renderShell');
});
