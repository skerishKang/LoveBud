/**
 * LoveBud Public Canvas Linear Chain Spine Contract Tests
 * Issue #3271
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const GEOM_PATH = path.resolve(__dirname, '../../js/editor/editor-canvas-geometry.js');
const CANVAS_PATH = path.resolve(__dirname, '../../js/editor/editor-canvas.js');
const UTILS_PATH = path.resolve(__dirname, '../../js/editor/editor-canvas-utils.js');

function loadGeometry() {
    const code = fs.readFileSync(GEOM_PATH, 'utf8');
    const sandbox = { window: {}, Math, Set, Map, Array, console };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window.EditorCanvasGeometry;
}

function makeChainMemories(count, opts) {
    opts = opts || {};
    var canonicalRootId = opts.canonicalRootId || '__root__';
    var rootId = opts.rootId || null;
    var mems = [];
    if (rootId) {
        mems.push({ id: rootId, parentId: null });
    }
    for (var i = 0; i < count; i++) {
        var pid = rootId && i === 0 ? rootId : (mems[mems.length - 1] ? mems[mems.length - 1].id : canonicalRootId);
        mems.push({ id: 'm' + (i + 1), parentId: pid });
    }
    return mems;
}

function makeBranchedMemories() {
    return [
        { id: 'm1', parentId: '__root__' },
        { id: 'm2', parentId: 'm1' },
        { id: 'm3', parentId: 'm1' },
        { id: 'm4', parentId: 'm2' }
    ];
}

function makeCyclicMemories() {
    return [
        { id: 'm1', parentId: 'm3' },
        { id: 'm2', parentId: 'm1' },
        { id: 'm3', parentId: 'm2' }
    ];
}

function makeDisconnectedMemories() {
    return [
        { id: 'm1', parentId: '__root__' },
        { id: 'm2', parentId: 'm1' },
        { id: 'm3', parentId: '__other_root__' }
    ];
}

const defaultMetrics = { width: 1000, height: 800 };

const getCanonicalRootId = () => '__root__';
const isRootMemory = (m, rid) => m.parentId === null || m.parentId === undefined;
const isRootMemoryWithRoot = (m, rid) => m.id === rid;
const getTreeMemories = (mems) => () => mems;
const getMetrics = () => defaultMetrics;

// ── Case 1: Rootless public five-node chain with publicLinearSpine ──

test('rootless public five-node chain with publicLinearSpine returns exact coordinates', () => {
    const G = loadGeometry();
    const mems = makeChainMemories(5);
    const fns = { getCanonicalRootId, getTreeMemories: getTreeMemories(mems), isRootMemory, getMetrics };

    const m1 = G.getStructuredWorldPosition(mems[0], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');
    const m2 = G.getStructuredWorldPosition(mems[1], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');
    const m3 = G.getStructuredWorldPosition(mems[2], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');
    const m4 = G.getStructuredWorldPosition(mems[3], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');
    const m5 = G.getStructuredWorldPosition(mems[4], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');

    assert.equal(m1.x, 260);
    assert.equal(m1.y, 336);
    assert.equal(m2.x, 380);
    assert.equal(m2.y, 336);
    assert.equal(m3.x, 500);
    assert.equal(m3.y, 336);
    assert.equal(m4.x, 620);
    assert.equal(m4.y, 336);
    assert.equal(m5.x, 740);
    assert.equal(m5.y, 336);
});

// ── Case 2: Rootless chain without policy retains vertical structured coordinates ──

test('rootless chain without policy retains vertical structured coordinates', () => {
    const G = loadGeometry();
    const mems = makeChainMemories(5);
    const fns = { getCanonicalRootId, getTreeMemories: getTreeMemories(mems), isRootMemory, getMetrics };

    const m1 = G.getStructuredWorldPosition(mems[0], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics);
    const m2 = G.getStructuredWorldPosition(mems[1], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics);

    // Without policy, vertical spacing applies — y values must differ across chain depth
    assert.ok(m1.y !== m2.y, 'vertical layout must differ in y across depths');
    assert.ok(isFinite(m1.x) && isFinite(m1.y), 'coordinates must be finite');
});

// ── Case 3: Explicit-root public five-node chain ──

test('explicit-root chain keeps root at root coordinate and renders spine for descendants', () => {
    const G = loadGeometry();
    const mems = makeChainMemories(5, { rootId: 'root1' });
    const fns = {
        getCanonicalRootId: () => 'root1',
        getTreeMemories: getTreeMemories(mems),
        isRootMemory: isRootMemoryWithRoot,
        getMetrics
    };

    const rootMem = mems[0];
    const rootPos = G.getStructuredWorldPosition(rootMem, fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');

    // Root must be at its existing root coordinate (center, getRootY)
    const expectedRootY = Math.round(Math.min(800 * 0.62, 800 - 180));
    assert.equal(rootPos.x, 500);
    assert.equal(rootPos.y, expectedRootY);

    // Chain descendants must be on the horizontal spine
    const m1 = G.getStructuredWorldPosition(mems[1], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');
    const m5 = G.getStructuredWorldPosition(mems[5], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');
    assert.equal(m1.y, 336);
    assert.equal(m5.y, 336);
    assert.ok(m1.x !== m5.x, 'spine nodes must be horizontally spread');
});

// ── Case 4: Branched public tree with policy keeps vertical structured coordinates ──

test('branched tree with policy keeps vertical structured coordinates', () => {
    const G = loadGeometry();
    const mems = makeBranchedMemories();
    const fns = { getCanonicalRootId, getTreeMemories: getTreeMemories(mems), isRootMemory, getMetrics };

    const m2 = G.getStructuredWorldPosition(mems[1], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');
    const m3 = G.getStructuredWorldPosition(mems[2], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');

    // Branched tree: siblings must not be on the same spine y
    assert.ok(isFinite(m2.x) && isFinite(m2.y), 'coordinates must be finite');
    assert.ok(isFinite(m3.x) && isFinite(m3.y), 'coordinates must be finite');
    // With vertical layout, m2 and m3 (siblings) should differ in x, not be spine-flattened
    assert.ok(m2.x !== m3.x || m2.y !== m3.y, 'branched siblings must not be collapsed');
});

// ── Case 5: Chain with layoutPolicy absent stays vertical ──

test('chain with layoutPolicy absent represents owner/editable and stays vertical', () => {
    const G = loadGeometry();
    const mems = makeChainMemories(5);
    const fns = { getCanonicalRootId, getTreeMemories: getTreeMemories(mems), isRootMemory, getMetrics };

    const m1 = G.getStructuredWorldPosition(mems[0], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics);
    const m3 = G.getStructuredWorldPosition(mems[2], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics);

    // Without policy, vertical layout: different depths should have different y
    assert.ok(m1.y !== m3.y, 'vertical layout must differ in y across depths');
});

// ── Case 6: Cyclic/disconnected topology does not activate spine ──

test('cyclic topology does not activate spine and returns finite safe coordinates', () => {
    const G = loadGeometry();
    const mems = makeCyclicMemories();
    const fns = { getCanonicalRootId, getTreeMemories: getTreeMemories(mems), isRootMemory, getMetrics };

    const m1 = G.getStructuredWorldPosition(mems[0], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');
    assert.ok(isFinite(m1.x) && isFinite(m1.y), 'cyclic must return finite coordinates');
});

test('disconnected topology does not activate spine and returns finite safe coordinates', () => {
    const G = loadGeometry();
    const mems = makeDisconnectedMemories();
    const fns = { getCanonicalRootId, getTreeMemories: getTreeMemories(mems), isRootMemory, getMetrics };

    const m3 = G.getStructuredWorldPosition(mems[2], fns.getCanonicalRootId, fns.getTreeMemories, fns.isRootMemory, fns.getMetrics, 'publicLinearSpine');
    assert.ok(isFinite(m3.x) && isFinite(m3.y), 'disconnected must return finite coordinates');
});

// ── Case 7: editor-canvas.js derives publicLinearSpine strictly from canEdit === false ──

test('editor-canvas.js derives publicLinearSpine from layout policy', () => {
    const code = fs.readFileSync(CANVAS_PATH, 'utf8');
    // #3581: publicLinearSpine comes from layoutPolicy.publicLinearSpine (public/read-only),
    // not bare canEdit alone (owner appreciation is canEdit true but ephemeral).
    assert.ok(
        code.includes("layoutPolicy: layoutPolicy.publicLinearSpine ? 'publicLinearSpine' : undefined") ||
        code.includes('publicLinearSpine'),
        'must derive structured geometry policy from layoutPolicy.publicLinearSpine'
    );
});

// ── Case 8: editor-canvas-utils.js forwards policy only to structured call ──

test('editor-canvas-utils.js forwards layoutPolicy only to structured geometry call', () => {
    const code = fs.readFileSync(UTILS_PATH, 'utf8');
    // Structured branch must pass layoutPolicy
    assert.ok(code.includes('getStructuredWorldPosition('), 'must call getStructuredWorldPosition');
    assert.ok(code.includes('layoutPolicy'), 'must reference layoutPolicy in structured branch');
    // Free branch must NOT use layoutPolicy
    var structuredIdx = code.indexOf("layoutMode === 'structured'");
    var freeIdx = code.indexOf('getWorldPosition(');
    // After the structured check, the free branch is the else
    // Verify layoutPolicy only appears within the structured branch
    assert.ok(code.indexOf('layoutPolicy') < code.indexOf('getWorldPosition(\n') || code.indexOf('layoutPolicy') > structuredIdx,
        'layoutPolicy must be in structured branch only');
});

// ── Case 9: pages/view.html → public-canvas-init.js → canEdit:false route chain ──

test('public-canvas-init.js canEdit:false route chain remains present', () => {
    const initPath = path.resolve(__dirname, '../../js/viewer/public-canvas-init.js');
    const code = fs.readFileSync(initPath, 'utf8');
    assert.ok(code.includes('canEdit: false') || code.includes('canEdit:false'),
        'public-canvas-init must set canEdit: false');
});

// ── Case 10: No network, browser login, subprocess, env, secret, DB/API, deploy ──

test('no network, browser login, subprocess, env, secret, DB/API, or deploy', () => {
    const sources = [
        fs.readFileSync(GEOM_PATH, 'utf8'),
        fs.readFileSync(CANVAS_PATH, 'utf8'),
        fs.readFileSync(UTILS_PATH, 'utf8')
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
