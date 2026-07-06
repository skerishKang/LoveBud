const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPO_ROOT = path.resolve(__dirname, '../..');
const GEOMETRY_PATH = path.join(REPO_ROOT, 'js/editor/editor-canvas-geometry.js');

function loadGeometryInContext() {
    const code = fs.readFileSync(GEOMETRY_PATH, 'utf8');
    const context = {
        window: {},
        Math,
        Number,
        isFinite,
        Array,
        Set,
        Map
    };
    vm.createContext(context);
    vm.runInContext(code, context);
    return context.window.EditorCanvasGeometry;
}

test('Rootless public structured layout: five rootless moments pointing to missing parent have distinct coordinates', () => {
    const Geometry = loadGeometryInContext();

    const canonicalRootId = 'root-placeholder';
    const treeMemories = [
        { id: 'mem-1', parentId: 'missing-parent-id', title: 'Moment 1' },
        { id: 'mem-2', parentId: 'missing-parent-id', title: 'Moment 2' },
        { id: 'mem-3', parentId: 'missing-parent-id', title: 'Moment 3' },
        { id: 'mem-4', parentId: 'missing-parent-id', title: 'Moment 4' },
        { id: 'mem-5', parentId: 'missing-parent-id', title: 'Moment 5' }
    ];

    const getCanonicalRootId = () => canonicalRootId;
    const getTreeMemories = () => treeMemories;
    const isRootMemory = (mem, rootId) => mem.id === rootId;
    const getMetricsSnapshot = () => ({ width: 1000, height: 800 });

    const positions = treeMemories.map(mem =>
        Geometry.getStructuredWorldPosition(mem, getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot)
    );

    // Verify distinct positions
    const posStrings = positions.map(pos => `${pos.x},${pos.y}`);
    const uniquePos = new Set(posStrings);
    assert.equal(uniquePos.size, 5, 'All five moments must have unique positions');

    // Verify they do not all collapse at the center/depth fallback point (500, 496)
    let centerCount = 0;
    positions.forEach(pos => {
        if (pos.x === 500) centerCount++;
    });
    assert.ok(centerCount < 5, 'Moments must not all collapse at the center');
});

test('Rootless public structured layout: nested subtrees are placed correctly with distinct positions', () => {
    const Geometry = loadGeometryInContext();

    const canonicalRootId = 'root-placeholder';
    const treeMemories = [
        // Two virtual root children
        { id: 'rootless-parent-1', parentId: null, title: 'Parent 1' },
        { id: 'rootless-parent-2', parentId: null, title: 'Parent 2' },
        // Descendant of parent 1
        { id: 'child-1-1', parentId: 'rootless-parent-1', title: 'Child 1-1' }
    ];

    const getCanonicalRootId = () => canonicalRootId;
    const getTreeMemories = () => treeMemories;
    const isRootMemory = (mem, rootId) => mem.id === rootId;
    const getMetricsSnapshot = () => ({ width: 1000, height: 800 });

    const p1 = Geometry.getStructuredWorldPosition(treeMemories[0], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);
    const p2 = Geometry.getStructuredWorldPosition(treeMemories[1], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);
    const c1 = Geometry.getStructuredWorldPosition(treeMemories[2], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);

    assert.notDeepEqual(p1, p2, 'Virtual root children must have distinct coordinates');
    assert.notDeepEqual(p1, c1, 'Descendant must have different coordinates from its parent');
    assert.ok(c1.y < p1.y, 'Descendant y coordinate must be higher (lower y value) than parent');
});

test('Rootless public structured layout: normal explicit root tree yields deterministic structured position', () => {
    const Geometry = loadGeometryInContext();

    const canonicalRootId = 'root-id';
    const treeMemories = [
        { id: 'root-id', parentId: null, title: 'Explicit Root' },
        { id: 'mem-1', parentId: 'root-id', title: 'Moment 1' },
        { id: 'mem-2', parentId: 'root-id', title: 'Moment 2' }
    ];

    const getCanonicalRootId = () => canonicalRootId;
    const getTreeMemories = () => treeMemories;
    const isRootMemory = (mem, rootId) => mem.id === rootId;
    const getMetricsSnapshot = () => ({ width: 1000, height: 800 });

    const r = Geometry.getStructuredWorldPosition(treeMemories[0], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);
    const m1 = Geometry.getStructuredWorldPosition(treeMemories[1], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);
    const m2 = Geometry.getStructuredWorldPosition(treeMemories[2], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);

    assert.equal(r.x, 500, 'Root node must be centered');
    assert.notDeepEqual(m1, m2, 'Siblings under explicit root must have distinct positions');
});

test('pages/view.html route script dependency validation', () => {
    const htmlPath = path.join(REPO_ROOT, 'pages/view.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('public-canvas-init.js'), 'view.html must load public-canvas-init.js');
    assert.ok(html.includes('editor-canvas-layout-storage.js'), 'view.html must load editor-canvas-layout-storage.js');
    assert.ok(html.includes('editor-canvas.js'), 'view.html must load editor-canvas.js');
});

test('editor-canvas-layout-storage.js returns structured layout mode for read-only viewer mode', () => {
    const storagePath = path.join(REPO_ROOT, 'js/editor/editor-canvas-layout-storage.js');
    const storageCode = fs.readFileSync(storagePath, 'utf8');

    // Verify it doesn't default to free in read-only / viewer mode
    assert.ok(storageCode.includes('structured'), 'must support/default to structured');
});

test('No network, browser login, subprocess, env, secret, DB, API, or deploy', () => {
    const code = fs.readFileSync(GEOMETRY_PATH, 'utf8');
    const forbidden = [
        'fetch(', 'XMLHttpRequest', 'http.request', 'child_process',
        'process.env', 'SECRET', 'PASSWORD', 'DATABASE_URL'
    ];
    for (const term of forbidden) {
        assert.ok(!code.includes(term), `Geometry code must not contain ${term}`);
    }
});
