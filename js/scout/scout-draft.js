/**
 * LoveBud Scout Draft Module
 * Phase 1: Manual draft entrypoint (no AI/fetch/auto-extraction)
 * v20260605-1
 *
 * Allows user to manually provide:
 * - Public source URL
 * - Excerpt/summary/memo text
 * - Optional emotion tags
 * - Prepares draft data for save-to-LoveTree flow
 */

(function() {
    'use strict';

    function isScoutDebugEnabled() {
        return window.LOVEBUD_DEBUG === true || window.LOVEBUD_SCOUT_DEBUG === true;
    }

    function scoutDebugLog() {
        if (!isScoutDebugEnabled() || !window.console || typeof console.log !== 'function') return;
        console.log.apply(console, arguments);
    }

    function scoutDebugWarn(message) {
        if (!isScoutDebugEnabled() || !window.console || typeof console.warn !== 'function') return;
        console.warn(message);
    }

    /**
     * Validates a public source URL.
     * Accepts HTTP/HTTPS URLs. Does not fetch or validate content.
     */
    function validateSourceUrl(rawUrl) {
        if (!rawUrl) return { ok: true, value: '' };
        const trimmed = String(rawUrl).trim();
        if (!trimmed) return { ok: true, value: '' };
        try {
            const url = new URL(trimmed);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return { ok: false, message: '지원하지 않는 프로토콜입니다. http:// 또는 https:// 로 시작하는 링크를 입력해 주세요.' };
            }
            return { ok: true, value: trimmed };
        } catch (e) {
            return { ok: false, message: '올바른 URL 형식이 아닙니다.' };
        }
    }

    /**
     * Validates excerpt/summary text.
     * Optional field - can be empty.
     */
    function validateExcerpt(text) {
        if (!text) return { ok: true, value: '' };
        const trimmed = String(text).trim();
        return { ok: true, value: trimmed };
    }

    /**
     * Validates memo text.
     * Optional field - can be empty.
     */
    function validateMemo(text) {
        if (!text) return { ok: true, value: '' };
        const trimmed = String(text).trim();
        return { ok: true, value: trimmed };
    }

    /**
     * Validates emotion tags.
     * Optional - array of strings, max 4 tags, each max 20 chars.
     */
    function validateEmotionTags(tags) {
        if (!tags || !Array.isArray(tags)) return { ok: true, value: [] };
        const filtered = tags
            .map(t => String(t).trim())
            .filter(t => t.length > 0)
            .slice(0, 4);
        const tooLong = filtered.some(t => t.length > 20);
        if (tooLong) {
            return { ok: false, message: '감정 태그는 20자 이하로 입력해 주세요.' };
        }
        return { ok: true, value: filtered };
    }

    /**
     * Builds a Scout draft object from form inputs.
     * This is the core data structure for Phase 1.
     */
    function buildScoutDraft(options) {
        const {
            sourceUrl,
            excerpt,
            memo,
            emotionTags,
            treeId
        } = options || {};

        const sourceUrlResult = validateSourceUrl(sourceUrl);
        if (!sourceUrlResult.ok) return { ok: false, message: sourceUrlResult.message, field: 'sourceUrl' };

        const excerptResult = validateExcerpt(excerpt);
        if (!excerptResult.ok) return { ok: false, message: excerptResult.message, field: 'excerpt' };

        const memoResult = validateMemo(memo);
        if (!memoResult.ok) return { ok: false, message: memoResult.message, field: 'memo' };

        const emotionTagsResult = validateEmotionTags(emotionTags);
        if (!emotionTagsResult.ok) return { ok: false, message: emotionTagsResult.message, field: 'emotionTags' };

        // Ensure at least one of sourceUrl, excerpt, or memo has content
        const hasSourceUrl = !!sourceUrlResult.value;
        const hasExcerpt = !!excerptResult.value;
        const hasMemo = !!memoResult.value;

        if (!hasSourceUrl && !hasExcerpt && !hasMemo) {
            return {
                ok: false,
                message: '출처 링크나 저장할 내용을 입력해 주세요.',
                field: 'sourceUrl'
            };
        }

        const draft = {
            // Scout-specific metadata
            scoutVersion: 1,
            sourceUrl: sourceUrlResult.value,
            excerpt: excerptResult.value,
            memo: memoResult.value,
            emotionTags: emotionTagsResult.value,
            createdAt: new Date().toISOString(),

            // Tree context for save flow
            treeId: treeId || null,

            // Ready for memory payload conversion
            readyForSave: true
        };

        return { ok: true, data: draft };
    }

    /**
     * Converts a Scout draft to a memory payload format compatible with editor.
     * This enables the save-to-LoveTree flow.
     */
    function convertDraftToMemoryPayload(draft, resolveParentIdForCreate, getSelectedNodeId, getCanonicalRootId, i18n) {
        if (!draft || !draft.readyForSave) {
            return { ok: false, message: '유효하지 않은 드래프트입니다.' };
        }

        const parentId = resolveParentIdForCreate
            ? resolveParentIdForCreate(getSelectedNodeId?.(), getCanonicalRootId?.())
            : (getCanonicalRootId?.() || '');

        // Build title from excerpt or source URL
        let title = '';
        if (draft.excerpt) {
            // Use first 50 chars of excerpt as title
            title = draft.excerpt.slice(0, 50).trim();
            if (draft.excerpt.length > 50) title += '…';
        } else if (draft.sourceUrl) {
            // Fallback: domain from URL
            try {
                const url = new URL(draft.sourceUrl);
                title = url.hostname.replace('www.', '') + ' 순간';
            } catch (e) {
                title = '수동 저장 순간';
            }
        } else {
            title = '새 순간';
        }

        // Build memo: combine excerpt and memo
        let fullMemo = '';
        if (draft.excerpt) fullMemo += draft.excerpt;
        if (draft.memo) {
            if (fullMemo) fullMemo += '\n\n';
            fullMemo += draft.memo;
        }

        const payload = {
            treeId: draft.treeId,
            title: title,
            memo: fullMemo,
            timestamp: draft.createdAt.split('T')[0].replace(/-/g, '.'),
            sourceUrl: draft.sourceUrl,
            sourceType: 'scout',
            emotionTags: draft.emotionTags || [],
            parentId: parentId,
            thumbnail: '',
            artist: '',
            source: 'Scout',
            visibility: 'public'
        };

        return { ok: true, data: payload };
    }

    /**
     * Parses emotion tags from comma-separated string input.
     */
    function parseEmotionTagsInput(input) {
        if (!input) return [];
        return String(input)
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);
    }

    /**
     * Formats emotion tags array for display in input.
     */
    function formatEmotionTagsInput(tags) {
        if (!Array.isArray(tags)) return '';
        return tags.join(', ');
    }

    window.LoveBudScoutDraft = {
        validateSourceUrl,
        validateExcerpt,
        validateMemo,
        validateEmotionTags,
        buildScoutDraft,
        convertDraftToMemoryPayload,
        parseEmotionTagsInput,
        formatEmotionTagsInput
    };

    scoutDebugLog('[LoveBudScoutDraft] Module loaded');
})();