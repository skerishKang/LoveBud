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

  var safetyDisclaimer = '[안내] 이 결과는 AI가 제안한 임시 초안이며, 자동 저장되지 않습니다. 저장하기 전에 반드시 직접 확인하고 수정해주세요.';

  var LoveBudAILocalStub = {
    getSafetyDisclaimer: function () {
      return safetyDisclaimer;
    },
    refineMemo: function (memoText) {
      return {
        text: '진의 컴백 카운트다운 라이브 프리뷰를 시청했습니다. ' +
              '희망적이고 밝은 록-어쿠스틱 사운드로 가득 찬 무대는 따뜻한 골드 톤 조명 아래에서 진행되었으며, ' +
              '어려운 시기를 함께 견뎌준 팬들에게 감사와 신뢰를 전하는 가사는 깊은 여운을 선사합니다.',
        disclaimer: safetyDisclaimer
      };
    },
    suggestTags: function (contentText) {
      return {
        tags: ['#설렘', '#벅참', '#위로', '#따뜻함'],
        disclaimer: safetyDisclaimer
      };
    },
    createDraftFromLink: function (url) {
      var cleanUrl = url || '';
      return {
        title: '진 (Jin) 컴백 라이브 카운트다운 무대 프리뷰',
        memo: '진의 솔로 앨범 타이틀곡 컴백 무대 라이브 프리뷰 분석입니다. 밝고 희망찬 밴드 사운드와 팬들을 향한 따뜻한 위로의 가사가 돋보입니다.',
        tags: '#설렘 #벅참 #위로 #따뜻함',
        sourceUrl: cleanUrl,
        disclaimer: safetyDisclaimer
      };
    },
    summarizeTreeFlow: function () {
      return {
        summary: '현재 작성된 순간들은 첫 입덕의 설렘에서 시작하여, 위로를 주었던 밤의 멜로디, 그리고 함께 걷는 타임라인으로 감정이 조화롭게 이어지고 있습니다.',
        disclaimer: safetyDisclaimer
      };
    }
  };

  window.LoveBudAILocalStub = LoveBudAILocalStub;
})();
