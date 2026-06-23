/**
 * LoveBud - i18n Scout Dictionary
 * Phase 1: Manual draft entrypoint
 * v20260605-1
 */

(function() {
    'use strict';

    window.i18nScout = {
        // Modal title
        'scout_draft_title': {
            ko: 'Scout 드래프트',
            en: 'Scout Draft'
        },

        // Form fields
        'scout_source_url_label': {
            ko: '출처 링크',
            en: 'Source URL'
        },
        'scout_source_url_placeholder': {
            ko: '공개 링크를 붙여넣으세요 (http:// 또는 https://)',
            en: 'Paste a public link (http:// or https://)'
        },
        'scout_source_url_hint': {
            ko: 'YouTube 영상 등 공개 링크를 붙여넣으면 그 페이지를 바탕으로 순간 후보를 잡아드려요.',
            en: 'Paste a public link like a YouTube video and Scout will draft a moment from it.'
        },
        'scout_excerpt_label': {
            ko: '발췌 / 요약',
            en: 'Excerpt / Summary'
        },
        'scout_excerpt_placeholder': {
            ko: '인상 깊었던 구절이나 핵심 내용을 적어보세요 (선택)',
            en: 'Write a memorable passage or key points (optional)'
        },
        'scout_excerpt_hint': {
            ko: '원문에서 발췌한 텍스트나 직접 요약한 내용을 남겨두면 나중에 다시 보기 좋습니다.',
            en: 'Save an excerpt or your own summary for later reference.'
        },
        'scout_memo_label': {
            ko: '내 메모',
            en: 'My Note'
        },
        'scout_memo_placeholder': {
            ko: '이 순간이 왜 의미있는지, 어떤 감정이 들었는지 자유롭게 적어보세요 (선택)',
            en: 'Why this moment matters, how you felt — write freely (optional)'
        },
        'scout_memo_hint': {
            ko: '나만의 감정 기록을 남겨두세요.',
            en: 'Leave your personal emotional note.'
        },
        'scout_emotion_tags_label': {
            ko: '감정 태그',
            en: 'Emotion Tags'
        },
        'scout_emotion_tags_placeholder': {
            ko: '감동, 행복, 그리움, 설렘... (쉼표로 구분, 최대 4개)',
            en: 'moving, happy, longing, excitement... (comma separated, max 4)'
        },
        'scout_emotion_tags_hint': {
            ko: '태그는 최대 4개까지, 각각 20자 이하로 입력 가능합니다.',
            en: 'Up to 4 tags, each 20 characters max.'
        },

        // Buttons
        'scout_preview_btn': {
            ko: '미리보기',
            en: 'Preview'
        },
        'scout_save_btn': {
            ko: '러브트리에 저장',
            en: 'Save to LoveTree'
        },
        'scout_cancel_btn': {
            ko: '취소',
            en: 'Cancel'
        },

        // Preview
        'scout_preview_title': {
            ko: '저장 미리보기',
            en: 'Save Preview'
        },
        'scout_preview_title_label': {
            ko: '제목',
            en: 'Title'
        },
        'scout_preview_source_label': {
            ko: '출처',
            en: 'Source'
        },
        'scout_preview_excerpt_label': {
            ko: '발췌 / 메모',
            en: 'Excerpt / Note'
        },
        'scout_preview_tags_label': {
            ko: '감정 태그',
            en: 'Emotion Tags'
        },
        'scout_preview_edit': {
            ko: '수정',
            en: 'Edit'
        },
        'scout_preview_confirm': {
            ko: '확인 및 저장',
            en: 'Confirm & Save'
        },

        // Toasts / Messages
        'scout_draft_saved': {
            ko: 'Scout 드래프트가 저장되었습니다.',
            en: 'Scout draft saved.'
        },
        'scout_draft_save_failed': {
            ko: '저장에 실패했습니다. 다시 시도해 주세요.',
            en: 'Failed to save. Please try again.'
        },
        'scout_invalid_url': {
            ko: '올바른 URL을 입력해 주세요.',
            en: 'Please enter a valid URL.'
        },
        'scout_tag_too_long': {
            ko: '감정 태그는 20자 이하로 입력해 주세요.',
            en: 'Emotion tags must be 20 characters or less.'
        },
        'scout_no_tree_context': {
            ko: '트리 컨텍스트가 없습니다. 편집기에서 다시 시도해 주세요.',
            en: 'No tree context. Please try from the editor.'
        },

        // Trigger button (for editor toolbar, etc.)
        'scout_trigger_label': {
            ko: 'Scout로 순간 저장',
            en: 'Save Moment with Scout'
        },
        'scout_trigger_tooltip': {
            ko: '링크나 거친 기억을 붙여넣고, 제목·감정 메모·감정 태그를 제안 받아 검토 후 저장해요. AI 제안은 선택이며 직접 쓴 내용으로도 저장할 수 있어요.',
            en: 'Paste a link or rough memory, get a suggested title, memo and tags, then review before saving. AI is optional — you can always write your own.'
        },
        // Intro helper shown at the top of the Scout modal
        'scout_intro_help': {
            ko: 'YouTube 링크나 떠오르는 기억을 붙여넣어 순간 후보를 만들어요. AI 제안으로 제목·감정 메모·감정 태그를 채우고, 저장 전에 직접 다듬어주세요.',
            en: 'Paste a YouTube link or a rough memory to start a moment. Use AI to draft a title, memo and tags, then refine it yourself before saving.'
        },

        // Suggestion button & messages
        'scout_suggest_btn': {
            ko: 'AI로 제목·감정 메모·감정 태그 제안 받기',
            en: 'Suggest title, memo & tags with AI'
        },
        'scout_suggest_applied': {
            ko: '제안을 채웠어요. 저장 전에 직접 검토하고 고쳐주세요.',
            en: 'We filled in a suggestion. Review and edit before saving.'
        },
        'scout_suggest_unavailable': {
            ko: 'AI 제안을 불러오지 못했습니다. 직접 입력 후 저장할 수 있습니다.',
            en: 'AI suggestion unavailable. You can enter content and save manually.'
        },
        'scout_suggest_error': {
            ko: 'AI 제안을 불러오지 못했습니다.',
            en: 'Failed to get AI suggestion.'
        },
        'scout_suggest_pending': {
            ko: 'AI 제안 설정이 아직 준비되지 않았습니다. 직접 입력 후 저장할 수 있습니다.',
            en: 'AI suggestions are not configured yet. You can enter content and save manually.'
        },
        'scout_suggest_manual_available': {
            ko: '직접 입력 후 저장하실 수 있습니다.',
            en: 'You can enter content and save manually.'
        }
    };
})();