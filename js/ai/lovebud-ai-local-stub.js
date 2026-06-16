/**
 * LoveBud AI Local Stub Suggestion Engine
 * v20260616-ai-panel-1
 *
 * Requirements:
 * - window.LoveBudAILocalStub export
 * - Deterministic responses only
 * - No fetch / no network / no provider SDK / no secrets
 * - Inclusion of safety warnings: "자동 저장되지 않음", "직접 확인 필요"
 * - Action handlers:
 *   - refineMemo (메모 다듬기)
 *   - suggestTags (감정 태그 추천)
 *   - createDraftFromLink (링크로 순간 초안 만들기)
 *   - summarizeTreeFlow (이 트리 흐름 요약)
 */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  var safetyDisclaimer = '[안내] 이 결과는 AI가 제안한 임시 초안이며, 자동 저장되지 않음. 저장 전 직접 확인 필요.';

  var LoveBudAILocalStub = {
    getSafetyDisclaimer: function () {
      return safetyDisclaimer;
    },
    refineMemo: function (memoText) {
      return {
        text: '이 순간의 감정을 조금 더 부드럽게 정리해볼 수 있어요. 저장 전 직접 확인해 주세요.',
        disclaimer: safetyDisclaimer
      };
    },
    suggestTags: function (contentText) {
      return {
        tags: ['설렘', '기대', '응원'],
        disclaimer: safetyDisclaimer
      };
    },
    createDraftFromLink: function (url) {
      var cleanUrl = url || '';
      return {
        title: '링크 분석 초안',
        memo: '현재 버전은 외부 링크를 읽지 않습니다. 링크를 직접 확인한 뒤 순간으로 남겨보세요.',
        tags: ['설렘', '기대', '응원'],
        sourceUrl: cleanUrl,
        disclaimer: safetyDisclaimer
      };
    },
    summarizeTreeFlow: function () {
      return {
        summary: '현재 트리 흐름 요약은 local_stub preview입니다. 저장 전 직접 확인해 주세요.',
        disclaimer: safetyDisclaimer
      };
    }
  };

  window.LoveBudAILocalStub = LoveBudAILocalStub;
})();
