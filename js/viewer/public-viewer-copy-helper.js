(function() {
    'use strict';

    var TEXT_RULES = [
        { selector: '.editor-panel-headline', text: '선택한 순간' },
        { selector: '#detailTreeStatusLabel', text: '러브트리 정보' },
        { selector: '#detailCurrentMomentBadge', text: '선택한 순간' },
        { selector: '#detailCurrentMomentHint', text: '이 순간의 장면과 메모를 감상해 보세요.' },
        { selector: '#detailMomentInfoLabel', text: '순간 기록' },
        { selector: '#detailDateLabel', text: '기록일' },
        { selector: '#detailTagsLabel', text: '감정 태그' },
        { selector: '#detailMemoLabel', text: '남긴 메모' }
    ];

    var RAW_LAYOUT_LABELS = {
        editor_layout_free: '자유 배치',
        editor_layout_structured: '구조 보기'
    };

    function cloneTextRule(rule) {
        return {
            selector: rule.selector,
            text: rule.text
        };
    }

    function getTextRules() {
        return TEXT_RULES.map(cloneTextRule);
    }

    function getRawLayoutLabel(value) {
        return RAW_LAYOUT_LABELS[String(value || '').trim()] || null;
    }

    window.LoveBudPublicViewerCopyHelper = {
        getTextRules: getTextRules,
        getRawLayoutLabel: getRawLayoutLabel
    };
})();
