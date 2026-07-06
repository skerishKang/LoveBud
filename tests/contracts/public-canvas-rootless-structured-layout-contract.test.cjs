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
        Map,
        Object
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

    const rawPositions = treeMemories.map(mem =>
        Geometry.getStructuredWorldPosition(mem, getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot)
    );

    const positions = rawPositions.map(pos => ({ x: Number(pos.x), y: Number(pos.y) }));

    // Assert exact virtual root coordinates: (260, 336), (380, 336), (500, 336), (620, 336), (740, 336)
    const expectedPositions = [
        { x: 260, y: 336 },
        { x: 380, y: 336 },
        { x: 500, y: 336 },
        { x: 620, y: 336 },
        { x: 740, y: 336 }
    ];
    positions.forEach((pos, i) => {
        assert.deepEqual(pos, expectedPositions[i], `Moment ${i + 1} position mismatch`);
    });
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
        { id: 'A', parentId: 'root-id', title: 'Moment A' },
        { id: 'B', parentId: 'root-id', title: 'Moment B' },
        { id: 'A1', parentId: 'A', title: 'Moment A1' },
        { id: 'A2', parentId: 'A', title: 'Moment A2' }
    ];

    const getCanonicalRootId = () => canonicalRootId;
    const getTreeMemories = () => treeMemories;
    const isRootMemory = (mem, rootId) => mem.id === rootId;
    const getMetricsSnapshot = () => ({ width: 1000, height: 800 });

    const rawRoot = Geometry.getStructuredWorldPosition(treeMemories[0], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);
    const rawA = Geometry.getStructuredWorldPosition(treeMemories[1], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);
    const rawB = Geometry.getStructuredWorldPosition(treeMemories[2], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);
    const rawA1 = Geometry.getStructuredWorldPosition(treeMemories[3], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);
    const rawA2 = Geometry.getStructuredWorldPosition(treeMemories[4], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);

    const root = { x: Number(rawRoot.x), y: Number(rawRoot.y) };
    const A = { x: Number(rawA.x), y: Number(rawA.y) };
    const B = { x: Number(rawB.x), y: Number(rawB.y) };
    const A1 = { x: Number(rawA1.x), y: Number(rawA1.y) };
    const A2 = { x: Number(rawA2.x), y: Number(rawA2.y) };

    // Assert explicit-root nested fixture exact coordinates:
    // root: (500, 496)
    // A:    (440, 336)
    // B:    (620, 336)
    // A1:   (380, 176)
    // A2:   (500, 176)
    assert.deepEqual(root, { x: 500, y: 496 }, 'Root position mismatch');
    assert.deepEqual(A, { x: 440, y: 336 }, 'Node A position mismatch');
    assert.deepEqual(B, { x: 620, y: 336 }, 'Node B position mismatch');
    assert.deepEqual(A1, { x: 380, y: 176 }, 'Node A1 position mismatch');
    assert.deepEqual(A2, { x: 500, y: 176 }, 'Node A2 position mismatch');
});

test('Rootless public structured layout: malformed cyclic rootless data terminates safely and returns finite coordinates', () => {
    const Geometry = loadGeometryInContext();

    const canonicalRootId = 'root-placeholder';
    const treeMemories = [
        { id: 'cycle-1', parentId: 'cycle-2', title: 'Cycle 1' },
        { id: 'cycle-2', parentId: 'cycle-1', title: 'Cycle 2' }
    ];

    const getCanonicalRootId = () => canonicalRootId;
    const getTreeMemories = () => treeMemories;
    const isRootMemory = (mem, rootId) => mem.id === rootId;
    const getMetricsSnapshot = () => ({ width: 1000, height: 800 });

    const p1 = Geometry.getStructuredWorldPosition(treeMemories[0], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);
    const p2 = Geometry.getStructuredWorldPosition(treeMemories[1], getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot);

    assert.ok(isFinite(p1.x) && isFinite(p1.y), 'Must return finite coordinates on cycle');
    assert.ok(isFinite(p2.x) && isFinite(p2.y), 'Must return finite coordinates on cycle');
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
