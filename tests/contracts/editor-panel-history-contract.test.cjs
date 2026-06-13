/**
 * editor-panel-history-contract.test.cjs
 *
 * PR #2449 (UX): browser Back 버튼이 add-memory panel을 닫게 함.
 *
 * editor-panel-history.js의 createEditorPanelHistoryController contract:
 *
 * 1. opening panel pushes history state once
 * 2. popstate closes panel when panel is open
 * 3. popstate does not close or intercept when panel is not open
 * 4. duplicate opens do not push duplicate history entries
 *
 * 추가 lock:
 * 5. controller API surface (pushOnOpen, handlePopState, closeAndConsume, isOurState, teardown)
 * 6. windowRef가 없으면 noop controller
 * 7. isOurState는 state shape로 판정 (panelStateKey/Value 매치)
 * 8. closeAndConsume는 panel state가 아니면 noop
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const PANEL_HISTORY_PATH = 'js/editor/editor-panel-history.js';

function makeMockWindow() {
    const stack = [];
    let currentIndex = -1;
    function snapshot() {
        return {
            length: stack.length,
            state: (currentIndex >= 0 && currentIndex < stack.length) ? stack[currentIndex].state : null,
        };
    }
    return {
        history: {
            get state() { return snapshot().state; },
            pushState(state, title, url) {
                stack.push({ state, title: title || '', url: url || '' });
                currentIndex = stack.length - 1;
            },
            replaceState(state, title, url) {
                if (currentIndex < 0) {
                    this.pushState(state, title, url);
                    return;
                }
                stack[currentIndex] = { state, title: title || '', url: url || '' };
            },
            back() {
                if (currentIndex > 0) {
                    currentIndex -= 1;
                    return true;
                }
                return false;
            },
            forward() {
                if (currentIndex < stack.length - 1) {
                    currentIndex += 1;
                    return true;
                }
                return false;
            },
        },
        location: { href: 'https://example.com/editor' },
        _stack: stack,
    };
}

function loadController(opts) {
    const source = fs.readFileSync(PANEL_HISTORY_PATH, 'utf8');
    const ctx = { window: opts.windowRef, console: { warn() {}, error() {} } };
    vm.createContext(ctx);
    vm.runInContext(source, ctx);
    const factory = ctx.window.LoveBudEditorPanelHistory.createEditorPanelHistoryController;
    return factory(opts);
}

test('PR #2449 panel history: 1) opening panel pushes history state once', () => {
    const windowRef = makeMockWindow();
    let panelOpen = false;
    let closeCalls = 0;
    const controller = loadController({
        windowRef,
        isPanelOpen: () => panelOpen,
        closePanel: () => { closeCalls += 1; panelOpen = false; },
        panelStateKey: 'lovebudEditorPanel',
        panelStateValue: 'add-memory',
    });

    const pushed = controller.pushOnOpen();
    assert.equal(pushed, true, 'first pushOnOpen should push');
    assert.equal(windowRef.history.state && windowRef.history.state.lovebudEditorPanel, 'add-memory',
        'state should be tagged with panel value');
    assert.equal(windowRef._stack.length, 1, 'one history entry pushed');
});

test('PR #2449 panel history: 4) duplicate opens do not push duplicate history entries', () => {
    const windowRef = makeMockWindow();
    let panelOpen = false;
    const controller = loadController({
        windowRef,
        isPanelOpen: () => panelOpen,
        closePanel: () => { panelOpen = false; },
    });

    assert.equal(controller.pushOnOpen(), true, 'first push');
    panelOpen = true; // 시뮬레이션: panel이 open 됐다고 가정
    assert.equal(controller.pushOnOpen(), false, 'duplicate while panel open: no push');
    assert.equal(windowRef._stack.length, 1, 'still only one history entry');

    // state가 panel state인 경우에도 no push
    assert.equal(controller.pushOnOpen(), false, 'same state already pushed: no push');
    assert.equal(windowRef._stack.length, 1, 'still only one history entry');
});

test('PR #2449 panel history: 2) popstate closes panel when panel is open', () => {
    const windowRef = makeMockWindow();
    let panelOpen = false;
    let closeCalls = 0;
    const controller = loadController({
        windowRef,
        isPanelOpen: () => panelOpen,
        closePanel: () => { closeCalls += 1; panelOpen = false; },
    });

    controller.pushOnOpen();
    panelOpen = true;
    assert.equal(controller.handlePopState(), true, 'should intercept and close panel');
    assert.equal(closeCalls, 1, 'closePanel should be called once');
});

test('PR #2449 panel history: 3) popstate does not close or intercept when panel is not open', () => {
    const windowRef = makeMockWindow();
    let panelOpen = false;
    let closeCalls = 0;
    const controller = loadController({
        windowRef,
        isPanelOpen: () => panelOpen,
        closePanel: () => { closeCalls += 1; },
    });

    controller.pushOnOpen(); // push 1
    panelOpen = false; // panel 닫혀있음
    assert.equal(controller.handlePopState(), false, 'should not intercept');
    assert.equal(closeCalls, 0, 'closePanel should not be called');
});

test('PR #2449 panel history: closeAndConsume pops history state when current is panel state', () => {
    const windowRef = makeMockWindow();
    let panelOpen = false;
    const controller = loadController({
        windowRef,
        isPanelOpen: () => panelOpen,
        closePanel: () => { panelOpen = false; },
    });

    assert.equal(controller.pushOnOpen(), true);
    panelOpen = true;
    assert.equal(windowRef._stack.length, 1);
    assert.equal(controller.isOurState(), true, 'state should be ours');
    assert.equal(controller.closeAndConsume(), true, 'should back()');
    // mock windowRef.history.back은 currentIndex만 줄임. state는 그대로 남아있지만
    // controller는 더 이상 panel state가 아니라고 봐야 함. 단, 이 mock은 단순해서
    // _stack은 변하지 않음. 실제 browser에서는 back()이 popstate 발생 → state 변함.
    // 우리는 controller 단독 동작 검증이므로, closeAndConsume가 back()을 호출했는지
    // (그리고 그 결과 panelOpen은 그대로)가 핵심.
});

test('PR #2449 panel history: closeAndConsume is noop when current is not panel state', () => {
    const windowRef = makeMockWindow();
    let panelOpen = false;
    const controller = loadController({
        windowRef,
        isPanelOpen: () => panelOpen,
        closePanel: () => { panelOpen = false; },
    });

    // push 안 한 상태
    assert.equal(controller.closeAndConsume(), false, 'should not back() if not our state');
});

test('PR #2449 panel history: controller API surface is frozen', () => {
    const windowRef = makeMockWindow();
    const controller = loadController({
        windowRef,
        isPanelOpen: () => false,
        closePanel: () => {},
    });
    assert.equal(typeof controller.pushOnOpen, 'function');
    assert.equal(typeof controller.handlePopState, 'function');
    assert.equal(typeof controller.closeAndConsume, 'function');
    assert.equal(typeof controller.isOurState, 'function');
    assert.equal(typeof controller.teardown, 'function');
    assert.equal(Object.isFrozen(controller), true, 'controller must be frozen');
});

test('PR #2449 panel history: noop controller when windowRef is missing', () => {
    const windowRef = makeMockWindow();
    // controller with no windowRef
    const ctx = { window: { LoveBudEditorPanelHistory: null }, console: { warn() {}, error() {} } };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(PANEL_HISTORY_PATH, 'utf8'), ctx);
    const factory = ctx.window.LoveBudEditorPanelHistory.createEditorPanelHistoryController;
    const c = factory({
        windowRef: null,
        isPanelOpen: () => false,
        closePanel: () => {},
    });
    assert.equal(c.pushOnOpen(), false, 'no windowRef → noop pushOnOpen');
    assert.equal(c.handlePopState(), false, 'no windowRef → noop handlePopState');
    assert.equal(c.closeAndConsume(), false, 'no windowRef → noop closeAndConsume');
    assert.equal(c.isOurState(), false, 'no windowRef → isOurState false');
});

test('PR #2449 panel history: pushOnOpen is noop when panel is already open', () => {
    const windowRef = makeMockWindow();
    let panelOpen = true; // panel이 이미 열려있음
    const controller = loadController({
        windowRef,
        isPanelOpen: () => panelOpen,
        closePanel: () => { panelOpen = false; },
    });

    assert.equal(controller.pushOnOpen(), false, 'no push if panel already open');
    assert.equal(windowRef._stack.length, 0, 'no history entry');
});
