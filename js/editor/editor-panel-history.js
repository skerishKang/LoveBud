/**
 * editor-panel-history.js
 *
 * 에디터 모달/패널(예: add-memory form) 열고 닫음에 따라
 * browser history를 가볍게 wrap하는 controller.
 *
 * PR #2449 (UX): browser Back 버튼으로 panel을 닫기
 *
 * - panel이 열릴 때 history state 1회 push (panelStateValue로 tagging)
 *   - 이미 같은 state면 중복 push 안 함
 * - popstate에서 panel이 열려있으면 panel을 닫고 history 조작은 하지 않음
 *   (browser가 이미 pop 했음)
 * - panel을 정상적으로 닫을 때(X/Esc/outside click) closeAndConsume() 호출 →
 *   현재 state가 panel state면 history.back()으로 panel state를 pop
 *   → 다음 Back은 정상 navigation
 *
 * 외부 진입점:
 *   window.LoveBudEditorPanelHistory.createEditorPanelHistoryController(options)
 *
 * 옵션:
 *   - windowRef: window (test에서 stub 가능)
 *   - isPanelOpen: () => boolean (현재 panel 열려있는지)
 *   - closePanel: () => void (panel을 닫는 함수)
 *   - panelStateKey: string (default 'lovebudEditorPanel')
 *   - panelStateValue: string (default 'add-memory')
 *
 * 반환:
 *   - pushOnOpen(): panel state push. 이미 push 됐거나 panel 열려있으면 noop
 *   - handlePopState(): popstate 핸들러. panel open이면 close + true; 아니면 false
 *   - closeAndConsume(): panel 정상 닫기. panel state면 history.back()
 *   - isOurState(): 현재 history state가 panel state인지
 *   - teardown(): cleanup
 */

(function () {
    'use strict';

    function noop() {}

    function createEditorPanelHistoryController(options) {
        const opts = options || {};
        const windowRef = opts.windowRef || (typeof window !== 'undefined' ? window : null);
        const isPanelOpen = opts.isPanelOpen;
        const closePanel = opts.closePanel;
        const panelStateKey = opts.panelStateKey || 'lovebudEditorPanel';
        const panelStateValue = opts.panelStateValue || 'add-memory';

        function getHistory() {
            return windowRef && windowRef.history ? windowRef.history : null;
        }

        function isOurState(state) {
            return Boolean(
                state
                && typeof state === 'object'
                && state[panelStateKey] === panelStateValue
            );
        }

        function currentIsOurState() {
            const h = getHistory();
            if (!h || !h.state) return false;
            return isOurState(h.state);
        }

        function pushOnOpen() {
            const h = getHistory();
            if (!h || typeof h.pushState !== 'function') return false;
            if (currentIsOurState()) return false;
            // panel이 이미 열려있다면 (caller가 명시적으로 close를 깜빡한 경우) push 안 함
            if (typeof isPanelOpen === 'function' && isPanelOpen()) return false;
            try {
                h.pushState(
                    { [panelStateKey]: panelStateValue },
                    '',
                    (windowRef.location && windowRef.location.href) || ''
                );
                return true;
            } catch (err) {
                return false;
            }
        }

        function handlePopState() {
            // panel이 닫혀있으면 intercept 안 함 — browser navigation 그대로 진행
            if (typeof isPanelOpen !== 'function') return false;
            if (!isPanelOpen()) return false;
            if (typeof closePanel === 'function') {
                try {
                    closePanel();
                } catch (err) {
                    // closePanel 실패는 intercept 결과를 true로 두지 않음
                    return false;
                }
            }
            return true;
        }

        function closeAndConsume() {
            const h = getHistory();
            if (!h || typeof h.back !== 'function') return false;
            if (!currentIsOurState()) return false;
            try {
                h.back();
                return true;
            } catch (err) {
                return false;
            }
        }

        function teardown() {
            // 현재 controller는 popstate listener를 자체 등록하지 않음 —
            // caller가 addEventListener/removeEventListener를 직접 관리.
            // 따라서 별도 정리 없음. 향후 listener 보유 시 여기서 정리.
        }

        return Object.freeze({
            pushOnOpen,
            handlePopState,
            closeAndConsume,
            isOurState: currentIsOurState,
            teardown,
        });
    }

    const api = Object.freeze({ createEditorPanelHistoryController });

    if (typeof window !== 'undefined') {
        window.LoveBudEditorPanelHistory = api;
    }
})();
