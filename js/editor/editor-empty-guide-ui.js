(function () {
    const emptyGuideUI = window.LoveBudEditorEmptyGuideUI || {};

    // Root helper 공통 predicate를 우선 사용 (editor-root-helpers.js)
    // fallback은 root helper와 같은 기준 (PR #2448 정밀화: real content-aware)
    const rootUtils = (typeof window !== 'undefined' && window.LoveBudEditorUtils) || {};
    const sharedIsRootLikeMemory = typeof rootUtils.isRootLikeMemory === 'function'
        ? rootUtils.isRootLikeMemory
        : null;
    const sharedHasRealMomentContent = typeof rootUtils.hasRealMomentContent === 'function'
        ? rootUtils.hasRealMomentContent
        : null;

    // inline fallback — root helper와 같은 ROOT_PLACEHOLDER_TITLES 집합
    const ROOT_PLACEHOLDER_TITLES = new Set([
        'root', 'Root', 'ROOT',
        '루트',
        '새 트리', '새 러브트리', '새 트리입니다', '새 러브트리입니다',
        'untitled', 'Untitled', 'UNTITLED',
        '새 moment', '새 순간', 'root placeholder'
    ]);

    emptyGuideUI.createCanvasEmptyGuideUpdater = function(options) {
        const getTreeMemories = options && options.getTreeMemories;
        const log = options && options.log;

        // local fallback — root helper와 같은 기준 (PR #2448 정밀화)
        function hasRealMomentContent(memory) {
            if (sharedHasRealMomentContent) {
                return sharedHasRealMomentContent(memory);
            }
            if (!memory) return false;
            if (memory.sourceUrl && String(memory.sourceUrl).trim()) return true;
            if (memory.source && String(memory.source).trim()) return true;
            if (memory.thumbnail && String(memory.thumbnail).trim()) return true;
            if (memory.memo && String(memory.memo).trim()) return true;
            if (memory.quote && String(memory.quote).trim()) return true;
            if (Array.isArray(memory.emotionTags) && memory.emotionTags.length > 0) return true;
            const title = memory.title ? String(memory.title).trim() : '';
            if (title && !ROOT_PLACEHOLDER_TITLES.has(title)) return true;
            return false;
        }

        function isRootLikeMemory(memory) {
            if (sharedIsRootLikeMemory) {
                return sharedIsRootLikeMemory(memory);
            }
            if (!memory) return false;
            const parentId = memory.parentId;
            if (memory.id === 'root') return true;
            if (parentId === '') return true;
            if (parentId === memory.id) return true;
            if (parentId === null || parentId === undefined) {
                return !hasRealMomentContent(memory);
            }
            return false;
        }

        function hasVisibleMoment(memories) {
            if (!Array.isArray(memories)) return false;
            return memories.some((memory) => {
                if (!memory) return false;
                // hard-coded root placeholder는 real content가 있어도 root
                // (PR #2448: id='root', parentId='', parentId===id)
                if (memory.id === 'root') return false;
                if (memory.parentId === '') return false;
                if (memory.parentId === memory.id) return false;
                // 그 외 (parentId null/undefined 또는 parentId가 다른 노드):
                // real content가 있으면 visible moment
                if (hasRealMomentContent(memory)) return true;
                return false;
            });
        }

        return function updateCanvasEmptyGuide() {
            const guide = document.getElementById('canvasEmptyGuide');
            if (!guide) {
                if (typeof log === 'function') {
                    log('WARNING: #canvasEmptyGuide not found during update attempt');
                }
                return;
            }

            const memories = typeof getTreeMemories === 'function' ? getTreeMemories() : [];
            const hasMoments = hasVisibleMoment(memories);

            if (typeof log === 'function') {
                log(`Updating empty guide visibility. hasMoments=${hasMoments}`);
            }

            guide.classList.toggle('editor-canvas-empty-guide-hidden', hasMoments);
        };
    };

    /**
     * PR #2449 (UX): 빈 가이드 CTA 단순화
     *
     * - video/text/YouTube 직접 입력 경로 제거
     * - primary CTA 1개: #canvasEmptyStartBtn → showAddMemoryForm()
     * - 영상/텍스트/YouTube 입력은 add-memory form 안에서 선택 (기존 경로)
     *
     * 하위 호환:
     * - createMemoryFromQuickYoutube / fetchYoutubeTitle / isYoutubeUrl 함수 정의와
     *   export(return)는 유지. 다른 entry에서 사용할 가능성과 기존 contract test 호환
     *   (editor-empty-guide-oembed-title-xss-contract.test.cjs)을 위해.
     */
    emptyGuideUI.bindEmptyGuideEvents = function(options) {
        const showAddMemoryForm = options && options.showAddMemoryForm;
        const panelHistory = options && options.panelHistory;
        const addMemoryFromForm = options && options.addMemoryFromForm;
        const getTreeMemories = options && options.getTreeMemories;
        const showToast = options && options.showToast;
        const i18n = options && options.i18n;
        const getEditorCanvas = options && options.getEditorCanvas;

        const canvasEmptyStartBtn = document.getElementById('canvasEmptyStartBtn');

        // 보존: 다른 entry에서 사용할 가능성과 기존 contract test 호환을 위해
        // function 정의는 유지 (UI에서 더 이상 binding은 없음)
        function isYoutubeUrl(url) {
            return /(youtube\.com|youtu\.be|youtube\.com\/shorts\/)/i.test(url || '');
        }

        async function fetchYoutubeTitle(url) {
            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                const response = await fetch(oembedUrl);
                if (!response.ok) return '';
                const data = await response.json();
                return data && data.title ? data.title : '';
            } catch (error) {
                console.warn('[editor] YouTube oEmbed title lookup failed', error);
                return '';
            }
        }

        async function createMemoryFromQuickYoutube(rawUrl) {
            const url = (rawUrl || '').trim();
            if (!url) return;
            if (!isYoutubeUrl(url)) {
                if (typeof showToast === 'function') {
                    showToast(i18n('invalid_youtube') || '유효한 YouTube 링크를 입력해 주세요.', 'warn');
                }
                return;
            }

            if (typeof showToast === 'function') {
                showToast(i18n('saving') || '기록 중...', 'info');
            }

            const title = await fetchYoutubeTitle(url);

            if (typeof showAddMemoryForm === 'function') showAddMemoryForm();
            const memoryModeLinkBtn = document.getElementById('memoryModeLinkBtn');
            const memoryUrlInput = document.getElementById('memoryUrlInput');
            const memoryTitleInput = document.getElementById('memoryTitleInput');

            if (memoryModeLinkBtn) memoryModeLinkBtn.click();
            if (memoryUrlInput) {
                memoryUrlInput.value = url;
                memoryUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (memoryTitleInput && title) {
                memoryTitleInput.value = title;
                memoryTitleInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            const memories = typeof getTreeMemories === 'function' ? getTreeMemories() : [];
            const beforeIds = new Set(memories.map((memory) => memory && memory.id));

            if (typeof addMemoryFromForm === 'function') await addMemoryFromForm();

            const updatedMemories = typeof getTreeMemories === 'function' ? getTreeMemories() : [];
            const createdMemory = updatedMemories.find((memory) => memory && !beforeIds.has(memory.id));
            const editorCanvas = typeof getEditorCanvas === 'function' ? getEditorCanvas() : null;
            if (createdMemory && editorCanvas) {
                if (typeof editorCanvas.initCanvas === 'function') editorCanvas.initCanvas();
                if (typeof editorCanvas.focusNodeById === 'function') editorCanvas.focusNodeById(createdMemory.id);
            }
        }

        // Primary CTA: 첫 순간 만들기
        if (canvasEmptyStartBtn && canvasEmptyStartBtn.dataset.bound !== '1') {
            canvasEmptyStartBtn.dataset.bound = '1';
            canvasEmptyStartBtn.addEventListener('click', () => {
                if (typeof showAddMemoryForm === 'function') showAddMemoryForm();
                if (panelHistory && typeof panelHistory.pushOnOpen === 'function') {
                    panelHistory.pushOnOpen('add-memory');
                }
            });
        }

        return { createMemoryFromQuickYoutube, fetchYoutubeTitle };
    };

    window.LoveBudEditorEmptyGuideUI = emptyGuideUI;
})();
