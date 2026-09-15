const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function createSandbox(extraGlobals) {
    const noopElement = {
        style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        dataset: {},
        value: '',
        addEventListener() {},
        removeEventListener() {},
        closest: () => null,
        contains: () => false,
        focus() {},
        getAttribute: () => '',
        setAttribute() {},
        removeAttribute() {}
    };
    return vm.createContext(Object.assign({
        console,
        setTimeout,
        window: Object.assign({
            apiClient: null,
            LoveBudEditorMemoryFormMode: {},
            LoveBudEditorMemoryFormPreview: {},
            LoveBudEditorMemoryFormTime: {},
            LoveBudEditorMemoryFormPayload: {}
        }, extraGlobals || {}),
        document: {
            getElementById: () => ({ ...noopElement }),
            querySelector: () => ({ ...noopElement }),
            addEventListener() {},
            removeEventListener() {}
        }
    }, extraGlobals || {}));
}

function defaultDeps(overrides) {
    return Object.assign({
        i18n: (key) => key,
        treeId: 'tree-1',
        updateSaveStatus: () => {},
        showToast: () => {},
        nextMemoryId: () => 'memory-1',
        normalizeMemory: (m) => m,
        getTreeMemories: () => [],
        setTreeMemories: () => {},
        setLocalSaveMode: () => {},
        drawNode: () => {},
        drawBranch: () => {},
        calcPosition: () => ({}),
        updateSidebarStatus: () => {},
        updateFocusSelectedBtn: () => {},
        setDetailEmptyState: () => {},
        selectNode: () => {},
        treeMemories: () => [],
        setCachedMemories: () => {},
        rerenderCanvas: () => {},
        focusNodeById: () => {},
        getCanonicalRootId: () => 'root',
        getSelectedNodeId: () => 'root',
        resolveParentIdForCreate: () => 'root',
        getYouTubeInputErrorMessage: () => 'invalid',
        editorDebugLog: () => {}
    }, overrides || {});
}

test('editor-memory-form-save script loads before editor-memory-form in pages/editor.html', () => {
    const html = fs.readFileSync(path.join(ROOT, 'pages/editor.html'), 'utf8');
    const saveIdx = html.indexOf('editor-memory-form-save.js');
    const formIdx = html.indexOf('editor-memory-form.js');
    assert.ok(saveIdx >= 0, 'editor-memory-form-save.js must be referenced in editor.html');
    assert.ok(formIdx >= 0, 'editor-memory-form.js must be referenced in editor.html');
    assert.ok(saveIdx < formIdx, 'editor-memory-form-save.js must load BEFORE editor-memory-form.js');
});

test('window.LoveBudEditorMemoryFormSave is a function after loading', () => {
    const sandbox = createSandbox();
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    assert.equal(typeof sandbox.window.LoveBudEditorMemoryFormSave, 'function');
});

test('new save runtime returns expected function surface', () => {
    const sandbox = createSandbox();
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps());
    assert.equal(typeof save.createMemoryWithFallback, 'function');
    assert.equal(typeof save.commitMemoryToTree, 'function');
    assert.equal(typeof save.shouldEnrichChannelMetadata, 'function');
    assert.equal(typeof save.enrichPayloadChannelMetadata, 'function');
});

test('existing factory export window.createEditorMemoryForm is preserved', () => {
    const sandbox = createSandbox({ window: { LOVEBUD_DEBUG: false } });
    sandbox.window.LoveBudEditorMemoryFormSave = function() {
        return {
            createMemoryWithFallback: async () => ({ createdMemory: null, useApi: false }),
            commitMemoryToTree: () => {},
            shouldEnrichChannelMetadata: () => false,
            enrichPayloadChannelMetadata: async (p) => p
        };
    };
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form.js'), 'utf8'), sandbox);
    assert.equal(typeof sandbox.window.createEditorMemoryForm, 'function');
    const form = sandbox.window.createEditorMemoryForm(defaultDeps());
    assert.equal(typeof form.showAddMemoryForm, 'function');
    assert.equal(typeof form.hideAddMemoryForm, 'function');
    assert.equal(typeof form.addMemoryFromForm, 'function');
    assert.equal(typeof form.addMemoryFromScoutPayload, 'function');
    assert.equal(typeof form.isFormOpen, 'function');
    assert.equal(typeof form.enrichPayloadChannelMetadata, 'function');
});

test('addMemoryFromForm delegation preserves order: validation -> manual_saving -> hide -> enrich -> create -> commit -> restore', async () => {
    const calls = [];
    const sandbox = createSandbox({
        window: {
            LOVEBUD_DEBUG: false,
            LoveBudEditorMemoryFormMode: {},
            LoveBudEditorMemoryFormPreview: { hide: () => {}, update: () => {} },
            LoveBudEditorMemoryFormTime: {},
            LoveBudEditorMemoryFormPayload: {
                buildMemoryPayload: () => ({ ok: true, data: { title: 'test' } })
            }
        }
    });
    sandbox.window.LoveBudEditorMemoryFormSave = function(deps) {
        return {
            enrichPayloadChannelMetadata: async (p) => { calls.push('enrich'); return p; },
            createMemoryWithFallback: async () => { calls.push('create'); return { createdMemory: { id: 'm1' }, useApi: false }; },
            commitMemoryToTree: () => { calls.push('commit'); }
        };
    };
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form.js'), 'utf8'), sandbox);
    const form = sandbox.window.createEditorMemoryForm(defaultDeps({
        updateSaveStatus: (status) => { if (status === 'manual_saving') calls.push('manual_saving'); }
    }));
    await form.addMemoryFromForm();
    assert.deepEqual(calls, ['manual_saving', 'enrich', 'create', 'commit']);
});

test('createMemoryWithFallback returns expected shape via API success', async () => {
    const sandbox = createSandbox();
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    let localSaveModeCalled = false;
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps({
        setLocalSaveMode: () => { localSaveModeCalled = false; }
    }));
    sandbox.window.apiClient = {
        createMemory: async (data) => ({ id: 'api-1', ...data, createdAt: data.timestamp })
    };
    const result = await save.createMemoryWithFallback({ title: 'test', timestamp: '2026-01-01' });
    assert.equal(result.useApi, true);
    assert.equal(result.createdMemory.id, 'api-1');
    assert.equal(localSaveModeCalled, false);
});

test('createMemoryWithFallback falls back to local when API fails with generic error', async () => {
    const sandbox = createSandbox();
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    let localSaveModeVal = false;
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps({
        nextMemoryId: () => 'local-1',
        setLocalSaveMode: (v) => { localSaveModeVal = v; }
    }));
    sandbox.window.apiClient = {
        createMemory: async () => { throw new Error('network error'); }
    };
    const result = await save.createMemoryWithFallback({ title: 'test', timestamp: '2026-01-01' });
    assert.equal(result.useApi, false);
    assert.equal(result.createdMemory.id, 'local-1');
    assert.equal(localSaveModeVal, true);
});

test('createMemoryWithFallback classifies 401/403 as permission error', async () => {
    let toastShown = null;
    const sandbox = createSandbox();
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps({
        nextMemoryId: () => 'local-1',
        setLocalSaveMode: () => {},
        showToast: (msg, level) => { toastShown = { msg, level }; }
    }));
    sandbox.window.apiClient = {
        createMemory: async () => { throw new Error('401 Unauthorized'); }
    };
    await save.createMemoryWithFallback({ title: 'test' });
    assert.equal(toastShown.level, 'warn');
});

test('createMemoryWithFallback classifies 400 as input error', async () => {
    let statusUpdate = null;
    let toastShown = null;
    const sandbox = createSandbox();
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps({
        nextMemoryId: () => 'local-1',
        setLocalSaveMode: () => {},
        updateSaveStatus: (s, m) => { statusUpdate = { s, m }; },
        showToast: (msg, level) => { toastShown = { msg, level }; }
    }));
    sandbox.window.apiClient = {
        createMemory: async () => { throw new Error('400 Bad Request'); }
    };
    await save.createMemoryWithFallback({ title: 'test' });
    assert.equal(statusUpdate.s, 'failed');
    assert.equal(toastShown.level, 'error');
});

test('shouldEnrichChannelMetadata returns false for non-YouTube payload', () => {
    const sandbox = createSandbox();
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps());
    assert.equal(save.shouldEnrichChannelMetadata({ sourceType: 'text' }, 'https://example.com'), false);
});

test('shouldEnrichChannelMetadata returns false when channel metadata already present', () => {
    const sandbox = createSandbox();
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps());
    assert.equal(save.shouldEnrichChannelMetadata(
        { sourceType: 'youtube', channelName: '已有频道', channelUrl: 'https://youtube.com/@existing' },
        'https://youtube.com/watch?v=abc'
    ), false);
});

test('shouldEnrichChannelMetadata returns true for YouTube payload without channel', () => {
    const sandbox = createSandbox();
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    sandbox.window.apiClient = { getYouTubeOEmbedChannel: async () => ({}) };
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps());
    assert.equal(save.shouldEnrichChannelMetadata(
        { sourceType: 'youtube' },
        'https://youtube.com/watch?v=abc'
    ), true);
});

test('enrichPayloadChannelMetadata returns unchanged payload when enrichment not needed', async () => {
    const sandbox = createSandbox();
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps());
    const payload = { sourceType: 'text', title: 'hello' };
    const result = await save.enrichPayloadChannelMetadata(payload, null);
    assert.equal(result, payload);
});

test('enrichPayloadChannelMetadata adds channel data from API', async () => {
    const sandbox = createSandbox();
    sandbox.window.apiClient = {
        getYouTubeOEmbedChannel: async () => ({
            channelId: '@channel',
            channelName: 'Test Channel',
            channelUrl: 'https://youtube.com/@channel'
        })
    };
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps());
    const result = await save.enrichPayloadChannelMetadata(
        { sourceType: 'youtube', sourceUrl: 'https://youtube.com/embed/abc' },
        'https://youtube.com/watch?v=abc'
    );
    assert.equal(result.channelId, '@channel');
    assert.equal(result.channelName, 'Test Channel');
    assert.equal(result.channelUrl, 'https://youtube.com/@channel');
});

test('enrichPayloadChannelMetadata handles API error gracefully', async () => {
    const sandbox = createSandbox();
    sandbox.window.apiClient = {
        getYouTubeOEmbedChannel: async () => { throw new Error('timeout'); }
    };
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps());
    const payload = { sourceType: 'youtube', title: 'safe' };
    const result = await save.enrichPayloadChannelMetadata(payload, 'https://youtube.com/watch?v=abc');
    assert.equal(result, payload);
});

test('commitMemoryToTree appends memory and updates save status', () => {
    const sandbox = createSandbox();
    let treeMemories = [];
    let savedStatus = null;
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps({
        normalizeMemory: (m) => m ? { ...m, id: m.id || 'm1' } : m,
        getTreeMemories: () => treeMemories,
        setTreeMemories: (m) => { treeMemories = m; },
        updateSaveStatus: (s, m) => { savedStatus = { s, m }; },
        rerenderCanvas: () => {},
        updateSidebarStatus: () => {},
        updateFocusSelectedBtn: () => {},
        setDetailEmptyState: () => {},
        getCanonicalRootId: () => 'root'
    }));
    save.commitMemoryToTree({ id: 'm1', title: 'test' }, false);
    assert.equal(treeMemories.length, 1);
    assert.equal(treeMemories[0].id, 'm1');
    assert.equal(savedStatus.s, 'saved');
    assert.ok(savedStatus.m.includes('local'));
});

test('addMemoryFromForm source order: validation → saving → hide → enrich → create → commit → restore', () => {
    const formJs = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form.js'), 'utf8');
    const addFormBody = formJs.match(/const addMemoryFromForm[\s\S]*?};/);
    assert.ok(addFormBody, 'addMemoryFromForm must exist');
    const body = addFormBody[0];

    const validationCall = body.indexOf('if (!payloadResult.ok)');
    const savingCall = body.indexOf("updateSaveStatus('manual_saving'");
    const hideCall = body.indexOf("hideAddMemoryForm({ restoreFocus: false })");
    const enrichCall = body.indexOf('saveRuntime.enrichPayloadChannelMetadata');
    const createCall = body.indexOf('saveRuntime.createMemoryWithFallback');
    const commitCall = body.indexOf('saveRuntime.commitMemoryToTree');
    const restoreCall = body.indexOf('restoreFocusToInvoker()');

    assert.ok(validationCall >= 0, 'validation guard must exist');
    assert.ok(savingCall >= 0, 'updateSaveStatus(saving) must exist');
    assert.ok(hideCall >= 0, 'hideAddMemoryForm({ restoreFocus: false }) must exist');
    assert.ok(enrichCall >= 0, 'enrichPayloadChannelMetadata must exist');
    assert.ok(createCall >= 0, 'createMemoryWithFallback must exist');
    assert.ok(commitCall >= 0, 'commitMemoryToTree must exist');
    assert.ok(restoreCall >= 0, 'restoreFocusToInvoker() must exist');

    assert.ok(validationCall < savingCall, 'validation must precede updateSaveStatus');
    assert.ok(savingCall < hideCall, 'updateSaveStatus must precede hideAddMemoryForm');
    assert.ok(hideCall < enrichCall, 'hideAddMemoryForm must precede enrichPayloadChannelMetadata');
    assert.ok(enrichCall < createCall, 'enrichPayloadChannelMetadata must precede createMemoryWithFallback');
    assert.ok(createCall < commitCall, 'createMemoryWithFallback must precede commitMemoryToTree');
    assert.ok(commitCall < restoreCall, 'commitMemoryToTree must precede restoreFocusToInvoker');
});

test('existing-edit flow enrichPayloadChannelMetadata remains accessible from form', () => {
    const sandbox = createSandbox({
        window: {
            LOVEBUD_DEBUG: false,
            LoveBudEditorMemoryFormMode: {},
            LoveBudEditorMemoryFormPreview: { hide: () => {}, update: () => {} },
            LoveBudEditorMemoryFormTime: {},
            LoveBudEditorMemoryFormPayload: {
                buildMemoryPayload: () => ({ ok: true, data: {} })
            }
        }
    });
    sandbox.window.LoveBudEditorMemoryFormSave = function(deps) {
        return {
            enrichPayloadChannelMetadata: async (p) => ({ ...p, enriched: true }),
            createMemoryWithFallback: async () => ({ createdMemory: {}, useApi: false }),
            commitMemoryToTree: () => {}
        };
    };
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form.js'), 'utf8'), sandbox);
    const form = sandbox.window.createEditorMemoryForm(defaultDeps());
    assert.equal(typeof form.enrichPayloadChannelMetadata, 'function', 'form must expose enrichPayloadChannelMetadata');
});

// ─── #4410 ambiguous Memory-create acknowledgement hardening ──────────────

function install4410SaveRuntime(apiClient) {
    const sandbox = createSandbox();
    sandbox.window.apiClient = apiClient;
    sandbox.window.crypto = {
        randomUUID: () => '11111111-2222-4333-8444-555555555555'
    };
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), sandbox);
    return sandbox;
}

function make4410Error(fields) {
    const error = new Error(fields.message || 'synthetic');
    Object.assign(error, fields);
    return error;
}

test('#4410 COMMIT_OUTCOME_UNKNOWN reconciles exact clientKey with one POST and no local substitute', async () => {
    let createCount = 0;
    let rereadCount = 0;
    let dispatchedPayload = null;
    const localModes = [];
    const sandbox = install4410SaveRuntime({
        createMemory: async (payload) => {
            createCount += 1;
            dispatchedPayload = payload;
            throw make4410Error({ code: 'COMMIT_OUTCOME_UNKNOWN', status: 502 });
        },
        getMemoriesByTree: async (treeId) => {
            rereadCount += 1;
            assert.equal(treeId, 'tree-1');
            return [{ id: 'canonical-4410', treeId, clientKey: dispatchedPayload.clientKey, title: 'canonical' }];
        }
    });
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps({
        setLocalSaveMode: (value) => localModes.push(value)
    }));
    const result = await save.createMemoryWithFallback({ title: 'request-title' });
    assert.equal(createCount, 1);
    assert.equal(rereadCount, 1);
    assert.ok(dispatchedPayload.clientKey);
    assert.ok(dispatchedPayload.clientKey.length <= 100);
    assert.equal(result.useApi, true);
    assert.equal(result.createdMemory.id, 'canonical-4410');
    assert.equal(result.createdMemory.clientKey, dispatchedPayload.clientKey);
    assert.equal(localModes.includes(true), false);
});

test('#4410 unresolved transport ambiguity performs no blind POST retry and no local Memory', async () => {
    let createCount = 0;
    let rereadCount = 0;
    let localIdCount = 0;
    const localModes = [];
    const sandbox = install4410SaveRuntime({
        createMemory: async () => {
            createCount += 1;
            throw make4410Error({ _phase: 'fetch_rejected' });
        },
        getMemoriesByTree: async () => {
            rereadCount += 1;
            return [];
        }
    });
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps({
        nextMemoryId: () => {
            localIdCount += 1;
            return 'must-not-be-created';
        },
        setLocalSaveMode: (value) => localModes.push(value)
    }));
    const result = await save.createMemoryWithFallback({ title: 'request-title' });
    assert.equal(createCount, 1);
    assert.equal(rereadCount, 1);
    assert.equal(localIdCount, 0);
    assert.equal(result.createdMemory, null);
    assert.equal(result.useApi, false);
    assert.equal(result.ambiguous, true);
    assert.equal(localModes.includes(true), false);
});

test('#4410 definitely pre-commit failure retains existing local fallback policy', async () => {
    let createCount = 0;
    let rereadCount = 0;
    let localMode = null;
    const sandbox = install4410SaveRuntime({
        createMemory: async () => {
            createCount += 1;
            throw make4410Error({ code: 'DIRECT_NEON_CONFIG_ABSENT', status: 503 });
        },
        getMemoriesByTree: async () => {
            rereadCount += 1;
            return [];
        }
    });
    const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps({
        nextMemoryId: () => 'local-4410',
        setLocalSaveMode: (value) => { localMode = value; }
    }));
    const result = await save.createMemoryWithFallback({ title: 'request-title' });
    assert.equal(createCount, 1);
    assert.equal(rereadCount, 0);
    assert.equal(localMode, true);
    assert.equal(result.useApi, false);
    assert.equal(result.createdMemory.id, 'local-4410');
});
