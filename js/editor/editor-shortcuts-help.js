(function() {
    'use strict';

    const HELP_MODAL_ID = 'editorShortcutHelpModal';
    const HELP_MODAL_CLOSE_ID = 'editorShortcutHelpCloseBtn';

    function getDocumentRef() {
        return typeof document !== 'undefined' ? document : null;
    }

    function getWindowRef() {
        return typeof window !== 'undefined' ? window : null;
    }

    function createShortcutHelpController(options) {
        options = options || {};
        const doc = options.documentRef || getDocumentRef();
        const win = options.windowRef || getWindowRef();
        const i18n = options.i18n;

        let modalEl = null;
        let closeBtn = null;
        let lastFocusedEl = null;
        let bound = false;

        function element(id, tagName, className) {
            const el = doc.createElement(tagName || 'div');
            el.id = id;
            if (className) el.className = className;
            return el;
        }

        function t(key, fallback) {
            if (typeof i18n === 'function') {
                const val = i18n(key);
                if (val && val !== key) return val;
            }
            return fallback;
        }

        function ensureModal() {
            if (!doc || !doc.createElement || !doc.body) return null;
            if (modalEl && modalEl.parentElement) return modalEl;

            modalEl = element(HELP_MODAL_ID, 'div', 'editor-rename-modal');
            modalEl.setAttribute('role', 'presentation');
            modalEl.hidden = true;

            const isMobile = win.matchMedia && win.matchMedia('(max-width: 768px)').matches;
            const condDesktop = isMobile ? ' (데스크톱 전용)' : '';

            modalEl.innerHTML = [
                '<div id="editorShortcutHelpModalBackdrop" class="editor-rename-modal-backdrop" aria-hidden="true"></div>',
                '<section class="editor-rename-modal-card" role="dialog" aria-modal="true" aria-labelledby="editorShortcutHelpTitle" aria-describedby="editorShortcutHelpDesc" style="max-width: 480px;">',
                '<div class="editor-rename-modal-header" style="margin-bottom: 16px;">',
                '<span class="editor-rename-modal-kicker">' + t('editor_shortcut_kicker', '도움말') + '</span>',
                '<h2 id="editorShortcutHelpTitle" style="margin-top: 8px;">' + t('editor_shortcut_title', '키보드 단축키') + '</h2>',
                '<p id="editorShortcutHelpDesc" style="font-size: 13px; color: var(--on-surface-note); margin-top: 4px;">캔버스 조작과 선택한 순간의 액션을 빠르게 실행할 수 있습니다.</p>',
                '</div>',
                '<div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; max-height: 280px; overflow-y: auto;">',
                
                // 1. Arrow navigation
                '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(197, 146, 128, 0.15); padding-bottom: 8px;">',
                '  <span style="font-size: 13px; font-weight: 600; color: var(--on-surface);">' + t('editor_shortcut_nav', '이전 / 다음 순간 선택') + condDesktop + '</span>',
                '  <div style="display: flex; gap: 4px;">',
                '    <kbd style="display: inline-block; padding: 2px 6px; font-size: 11px; font-family: inherit; font-weight: bold; background: rgba(144, 73, 81, 0.08); border: 1px solid rgba(144, 73, 81, 0.2); border-radius: 4px; color: var(--primary);">← / ↑</kbd>',
                '    <kbd style="display: inline-block; padding: 2px 6px; font-size: 11px; font-family: inherit; font-weight: bold; background: rgba(144, 73, 81, 0.08); border: 1px solid rgba(144, 73, 81, 0.2); border-radius: 4px; color: var(--primary);">→ / ↓</kbd>',
                '  </div>',
                '</div>',

                // 2. Selection opening (Enter / Space)
                '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(197, 146, 128, 0.15); padding-bottom: 8px;">',
                '  <span style="font-size: 13px; font-weight: 600; color: var(--on-surface);">' + t('editor_shortcut_select', '선택한 순간 상세 열기') + '</span>',
                '  <div style="display: flex; gap: 4px;">',
                '    <kbd style="display: inline-block; padding: 2px 6px; font-size: 11px; font-family: inherit; font-weight: bold; background: rgba(144, 73, 81, 0.08); border: 1px solid rgba(144, 73, 81, 0.2); border-radius: 4px; color: var(--primary);">Enter</kbd>',
                '    <span style="font-size: 11px; color: var(--on-surface-note);">또는</span>',
                '    <kbd style="display: inline-block; padding: 2px 6px; font-size: 11px; font-family: inherit; font-weight: bold; background: rgba(144, 73, 81, 0.08); border: 1px solid rgba(144, 73, 81, 0.2); border-radius: 4px; color: var(--primary);">Space</kbd>',
                '  </div>',
                '</div>',

                // 3. E
                '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(197, 146, 128, 0.15); padding-bottom: 8px;">',
                '  <span style="font-size: 13px; font-weight: 600; color: var(--on-surface);">' + t('editor_shortcut_edit', '선택한 순간 편집') + '</span>',
                '  <kbd style="display: inline-block; padding: 2px 6px; font-size: 11px; font-family: inherit; font-weight: bold; background: rgba(144, 73, 81, 0.08); border: 1px solid rgba(144, 73, 81, 0.2); border-radius: 4px; color: var(--primary);">E</kbd>',
                '</div>',

                // 4. C
                '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(197, 146, 128, 0.15); padding-bottom: 8px;">',
                '  <span style="font-size: 13px; font-weight: 600; color: var(--on-surface);">' + t('editor_shortcut_continue', '새 순간 뻗어내기') + '</span>',
                '  <kbd style="display: inline-block; padding: 2px 6px; font-size: 11px; font-family: inherit; font-weight: bold; background: rgba(144, 73, 81, 0.08); border: 1px solid rgba(144, 73, 81, 0.2); border-radius: 4px; color: var(--primary);">C</kbd>',
                '</div>',

                // 5. V
                '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(197, 146, 128, 0.15); padding-bottom: 8px;">',
                '  <span style="font-size: 13px; font-weight: 600; color: var(--on-surface);">' + t('editor_shortcut_view', '선택한 순간 감상') + '</span>',
                '  <kbd style="display: inline-block; padding: 2px 6px; font-size: 11px; font-family: inherit; font-weight: bold; background: rgba(144, 73, 81, 0.08); border: 1px solid rgba(144, 73, 81, 0.2); border-radius: 4px; color: var(--primary);">V</kbd>',
                '</div>',

                // 6. Delete / Backspace
                '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(197, 146, 128, 0.15); padding-bottom: 8px;">',
                '  <span style="font-size: 13px; font-weight: 600; color: var(--on-surface);">' + t('editor_shortcut_delete', '선택한 순간 삭제') + '</span>',
                '  <div style="display: flex; gap: 4px;">',
                '    <kbd style="display: inline-block; padding: 2px 6px; font-size: 11px; font-family: inherit; font-weight: bold; background: rgba(144, 73, 81, 0.08); border: 1px solid rgba(144, 73, 81, 0.2); border-radius: 4px; color: var(--primary);">Delete</kbd>',
                '    <span style="font-size: 11px; color: var(--on-surface-note);">또는</span>',
                '    <kbd style="display: inline-block; padding: 2px 6px; font-size: 11px; font-family: inherit; font-weight: bold; background: rgba(144, 73, 81, 0.08); border: 1px solid rgba(144, 73, 81, 0.2); border-radius: 4px; color: var(--primary);">Backspace</kbd>',
                '  </div>',
                '</div>',

                // 7. Escape
                '<div style="display: flex; justify-content: space-between; align-items: center;">',
                '  <span style="font-size: 13px; font-weight: 600; color: var(--on-surface);">' + t('editor_shortcut_escape', '선택 취소 및 창 닫기') + '</span>',
                '  <kbd style="display: inline-block; padding: 2px 6px; font-size: 11px; font-family: inherit; font-weight: bold; background: rgba(144, 73, 81, 0.08); border: 1px solid rgba(144, 73, 81, 0.2); border-radius: 4px; color: var(--primary);">Esc</kbd>',
                '</div>',

                '</div>',
                '<div class="editor-rename-modal-actions">',
                '<button type="button" id="' + HELP_MODAL_CLOSE_ID + '" class="editor-rename-modal-btn editor-rename-modal-btn-primary" style="width: 100%;">' + t('editor_shortcut_close', '닫기') + '</button>',
                '</div>',
                '</section>'
            ].join('');

            doc.body.appendChild(modalEl);

            const backdropEl = doc.getElementById('editorShortcutHelpModalBackdrop');
            if (backdropEl) {
                backdropEl.addEventListener('click', closeHelpModal);
            }

            closeBtn = doc.getElementById(HELP_MODAL_CLOSE_ID);

            if (!bound) {
                modalEl.addEventListener('click', function(event) {
                    const target = event.target || {};
                    if (target === modalEl || target.id === 'editorShortcutHelpModalBackdrop') {
                        closeHelpModal();
                    }
                });

                doc.addEventListener('keydown', function(event) {
                    if ((event.key === 'Escape' || event.keyCode === 27) && isOpen()) {
                        closeHelpModal();
                    }
                });

                if (closeBtn) {
                    closeBtn.addEventListener('click', closeHelpModal);
                }
                bound = true;
            }

            return modalEl;
        }

        function isOpen() {
            return !!(modalEl && !modalEl.hidden);
        }

        function closeHelpModal() {
            if (!isOpen()) return;
            modalEl.hidden = true;
            if (doc.body && doc.body.classList) {
                doc.body.classList.remove('editor-rename-modal-open');
            }
            if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
                lastFocusedEl.focus();
            }
        }

        function openHelpModal() {
            const opened = ensureModal();
            if (!opened) return null;

            lastFocusedEl = doc.activeElement || null;
            modalEl.hidden = false;
            if (doc.body && doc.body.classList) {
                doc.body.classList.add('editor-rename-modal-open');
            }
            if (closeBtn && typeof closeBtn.focus === 'function') {
                closeBtn.focus();
            }
            return modalEl;
        }

        return {
            open: openHelpModal,
            close: closeHelpModal,
            isOpen: isOpen
        };
    }

    if (typeof window !== 'undefined') {
        window.LoveBudEditorShortcutHelp = {
            createShortcutHelpController: createShortcutHelpController
        };
    }
})();
