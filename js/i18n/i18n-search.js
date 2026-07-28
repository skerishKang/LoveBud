/**
 * LoveBud - i18n Search Dictionary
 * v20260422-3
 *
 * 검색/둘러보기 페이지(search.html) 번역 키
 */

(function() {
  'use strict';

  window.i18nSearch = {
    'search.eyebrow': {
      ko: '러브트리 둘러보기',
      en: 'Browse LoveTrees'
    },
    'search.title': {
      ko: '<span class="title-line">다른 사람의</span><span class="title-line title-accent">러브트리를</span><span class="title-line">둘러보세요</span>',
      en: '<span class="title-line">Gently explore</span><span class="title-line title-accent">other people\'s</span><span class="title-line">LoveTrees</span>'
    },
    'search.subtitle': {
      ko: '첫 순간과 이어진 마음,<br class="pc-only">깊어진 감정의 흐름을 가볍게 살펴보세요.',
      en: 'Gently explore the first moments, connected hearts,<br class="pc-only">and the deepening flow of emotion.'
    },
    'search.resultsHeading': {
      ko: '둘러볼 러브트리',
      en: 'LoveTrees to browse'
    },
    'search.resultsPopularHeading': {
      ko: '많이 감상한 러브트리',
      en: 'Popular LoveTrees'
    },
    'search.resultsViewsHeading': {
      ko: '많이 본 러브트리',
      en: 'Most Viewed LoveTrees'
    },
    'search.resultsLikesHeading': {
      ko: '많이 좋아한 러브트리',
      en: 'Most Liked LoveTrees'
    },
    'search.intentNote': {
      ko: '트리를 고르면 열려요.',
      en: 'Choose a tree to open it.'
    },
    'search.growingTreesTitle': {
      ko: '새로 자라는 러브트리',
      en: 'Newly Growing LoveTrees'
    },
    'search.growingTreesSubtitle': {
      ko: '막 자라기 시작한 마음들',
      en: 'Feelings just beginning to grow'
    },
    'search.growingTreesBadge': {
      ko: '자라는 중',
      en: 'Growing'
    },
    'search.growingTreesError': {
      ko: '새로 자라는 트리를 불러오지 못했어요. 나중에 다시 확인해 주세요.',
      en: 'Could not load growing trees. Please check again later.'
    },

    // 빈 상태 / 오류 상태
    'search.noTreesHeading': {
      ko: '아직 공개된 러브트리가 없어요',
      en: 'No public LoveTrees yet'
    },
    'search.noTreesBody': {
      ko: '다른 팬이 공개한 러브트리가 생기면 이곳에서 만날 수 있어요.',
      en: 'Public LoveTrees will appear here once someone shares one.'
    },
    'search.emptySearchHeading': {
      ko: '조건에 맞는 트리가 없어요',
      en: 'No matches found'
    },
    'search.emptySearchBody': {
      ko: '다른 키워드나 필터로 다시 찾아보세요.',
      en: 'Try a different keyword or filter.'
    },
    'search.errorHeading': {
      ko: '불러오지 못했어요',
      en: 'Could not load'
    },
    'search.errorBody': {
      ko: '네트워크 상태를 확인하고 다시 시도해 주세요.',
      en: 'Check your connection and try again.'
    },
    'search.retryButton': {
      ko: '다시 시도',
      en: 'Retry'
    },

    // #3655 Story view foundation (Browse-only fourth view mode)
    'search.viewMode.story': {
      ko: '스토리',
      en: 'Story'
    },
    'search.story.regionLabel': {
      ko: '스토리 보기',
      en: 'Story view'
    },
    'search.story.previous': {
      ko: '이전 스토리 그룹',
      en: 'Previous story group'
    },
    'search.story.next': {
      ko: '다음 스토리 그룹',
      en: 'Next story group'
    },
    'search.story.position': {
      ko: '스토리 {current} / {total}',
      en: 'Story {current} of {total}'
    },

    // 미리보기
    'search.previewTitle': {
      ko: '감상 허브',
      en: 'Viewing Hub'
    },
    'search.previewBadge': {
      ko: '선택한 트리',
      en: 'Selected Tree'
    },
    'search.previewKicker': {
      ko: '러브트리를 고르면 흐름이 열려요.',
      en: 'Choose a LoveTree to open its flow.'
    },
    'search.previewPlaceholder': {
      ko: '러브트리를 고르면',
      en: 'Choose a LoveTree'
    },
    'search.previewDescriptionPlaceholder': {
      ko: '이어진 순간의 흐름이 여기에 열려요.',
      en: 'to open its connected moments here.'
    },
    'search.previewEmptyLead': {
      ko: '러브트리를 고르면',
      en: 'Choose a LoveTree'
    },
    'search.previewEmptyBody': {
      ko: '이어진 순간의 흐름이 여기에 열려요.',
      en: 'to open its connected moments here.'
    },
    'search.previewNoMomentTitle': {
      ko: '아직 이어진 순간을 기다리는 트리예요.',
      en: 'This tree is still waiting for connected moments.'
    },
    'search.previewNoMomentBody': {
      ko: '대표 순간이 더해지면 이곳에서 감정의 흐름을 볼 수 있어요.',
      en: 'Once a featured moment is added, its emotional flow will open here.'
    },
    'search.previewStartFromFirstMoment': {
      ko: '대표 순간부터 감상하기',
      en: 'Start from the featured moment'
    },
    'search.previewTimelineHeading': {
      ko: '이어진 흐름',
      en: 'Connected flow'
    },
    'search.previewTimelineEmpty': {
      ko: '아직 흐름으로 펼칠 순간이 없어요.',
      en: 'There are no moments to unfold yet.'
    },
'search.previewTimelineEmptyBody': {
      ko: '대표 순간이 남겨지면 이 감상 허브에서 먼저 보여드릴게요.',
      en: 'When a featured moment is saved, it will appear in this viewing hub first.'
    },
    'search.previewCopyToMyTrees': {
      ko: '내 러브트리로 가져오기',
      en: 'Copy to my LoveTrees'
    },
    'search.previewCopyingToMyTrees': {
      ko: '가져오는 중이에요',
      en: 'Copying...'
    },
    'search.previewCopyToMyTreesDone': {
      ko: '내 러브트리로 복사됐어요',
      en: 'Copied to my LoveTrees'
    },
    'search.previewCopyToMyTreesFailed': {
      ko: '가져오지 못했어요',
      en: 'Copy failed'
    },
    'search.previewCopyToMyTreesFailedBody': {
      ko: '가져오지 못했어요. 다시 시도해 주세요.',
      en: 'Copy failed. Please try again.'
    },
    'search.previewCopyToMyTreesRetry': {
      ko: '다시 시도',
      en: 'Try again'
    },
    'search.previewCopyToMyTreesLoginRequired': {
      ko: '로그인이 필요해요',
      en: 'Login required'
    },
    'search.previewOpenCopiedTree': {
      ko: '복사된 트리 열기',
      en: 'Open copied tree'
    },
    'search.previewNoRecordsYet': {
      ko: '아직 보여줄 순간 수는 없지만',
      en: 'There are no visible moments yet, but'
    },
    'search.previewNoRecordsFollowup': {
      ko: '첫 순간이 이어지면 이곳에 조용히 열려요.',
      en: 'the first connected moment will open here gently.'
    },
    'search.previewNoRecordsLine': {
      ko: '{countLabel} {followup}',
      en: '{countLabel} {followup}'
    },
    'search.previewNewTreeInfo': {
      ko: '숫자보다 첫 순간을 기다리는 공개 러브트리예요.',
      en: 'This public LoveTree is waiting for its first moment, not showing a metric yet.'
    },
    'search.previewJourneyCta': {
      ko: '마음이 닿는 순간으로',
      en: 'To the moment that draws you in'
    },
    'search.previewMomentCountSuffix': {
      ko: '개의 순간',
      en: ' moments'
    },
    'search.previewDurationPending': {
      ko: '첫 순간을 기다리는 중',
      en: 'Waiting for the first moment'
    },
    'search.previewStatsPending': {
      ko: '첫 순간을 기다리는 중',
      en: 'Waiting for the first moment'
    },
    'search.previewEmotionTagsLabel': {
      ko: '이어진 감정',
      en: 'Connected Feelings'
    },
    'search.previewNoEmotionTags': {
      ko: '감정의 결이 이곳에 놓여요.',
      en: 'The feeling tone appears here.'
    },
    'search.previewTimelineRecentUpdate': {
      ko: '최근에 이어진 감정',
      en: 'Recently added moment'
    },
    'search.previewTimelineLastMoment': {
      ko: '가장 최근에 남은 순간',
      en: 'Latest saved moment'
    },
    'search.previewTimelineCreated': {
      ko: '처음 남긴 날',
      en: 'First saved on'
    },
    'search.previewTimelineUnavailable': {
      ko: '아직 첫 순간을 기다리는 중이에요',
      en: 'Still waiting for the first moment'
    },
    'search.previewDefaultTreeName': {
      ko: '러브트리',
      en: 'LoveTree'
    },
    'search.previewUnknownRange': {
      ko: '아직 흐름이 또렷하지 않아요',
      en: 'The flow is not clear yet'
    },
    'search.previewMoreMoments': {
      ko: '... 그리고 {count}개의 순간 더',
      en: '... and {count} more moments'
    },
    'search.previewOpenViewingCta': {
      ko: '감상 열기',
      en: 'Open viewing'
    },
    'search.previewOpenTreeCta': {
      ko: '트리 열기',
      en: 'Open tree'
    },
    'search.previewFallbackMomentCount': {
      ko: '{count}개의 순간이 이어져 있어요.',
      en: '{count} moments are connected.'
    },
    'search.previewSummaryThemeStart': {
      ko: '<strong style="color:var(--on-surface);">{title}</strong>는 <strong style="color:var(--on-surface);">{theme}</strong>와 함께 막 시작된 러브트리예요.',
      en: '<strong style="color:var(--on-surface);">{title}</strong> has just begun with <strong style="color:var(--on-surface);">{theme}</strong>.'
    },
    'search.previewSummaryStart': {
      ko: '<strong style="color:var(--on-surface);">{title}</strong>는 이제 막 시작된 러브트리예요.',
      en: '<strong style="color:var(--on-surface);">{title}</strong> has just begun.'
    },
    'search.previewSummaryThemeRange': {
      ko: '<strong style="color:var(--on-surface);">{theme}</strong>와 함께한 <span style="color:var(--primary);font-weight:700;">{count}개의 순간</span>이 <strong>{range}</strong>에 걸쳐 이어졌어요.',
      en: '<strong style="color:var(--on-surface);">{count} moments</strong> with <strong style="color:var(--on-surface);">{theme}</strong> continued across <strong>{range}</strong>.'
    },
    'search.previewSummaryRange': {
      ko: '<strong style="color:var(--on-surface);">{title}</strong>에 담긴 <span style="color:var(--primary);font-weight:700;">{count}개의 순간</span>이 <strong>{range}</strong>에 걸쳐 이어졌어요.',
      en: '<strong style="color:var(--on-surface);">{count} moments</strong> in <strong style="color:var(--on-surface);">{title}</strong> continued across <strong>{range}</strong>.'
    },
    'search.previewSummaryThemeNoRange': {
      ko: '<strong style="color:var(--on-surface);">{theme}</strong>와 함께한 <span style="color:var(--primary);font-weight:700;">{count}개의 순간</span>이 이어졌어요.',
      en: '<strong style="color:var(--on-surface);">{count} moments</strong> with <strong style="color:var(--on-surface);">{theme}</strong> are connected.'
    },
    'search.previewSummaryNoRange': {
      ko: '<strong style="color:var(--on-surface);">{title}</strong>에 담긴 <span style="color:var(--primary);font-weight:700;">{count}개의 순간</span>이 이어졌어요.',
      en: '<strong style="color:var(--on-surface);">{count} moments</strong> in <strong style="color:var(--on-surface);">{title}</strong> are connected.'
    },
    'search.previewLoadingLead': {
      ko: '대표 순간을 불러오는 중이에요.',
      en: 'Loading the featured moment.'
    },
    'search.previewLoadingHeading': {
      ko: '감상 허브를 여는 중',
      en: 'Opening the preview hub'
    },
    'search.loadingPublicTrees': {
      ko: '공개 러브트리를 불러오고 있어요',
      en: 'Loading public LoveTrees'
    },
    'search.previewLoadingBody': {
      ko: '대표 순간이 열려요.',
      en: 'The featured moment opens here.'
    },
    'search.previewShareLink': {
      ko: '감상 링크 복사',
      en: 'Copy view link'
    },
    'search.previewShareLinkCopied': {
      ko: '링크가 복사됐어요',
      en: 'Link copied'
    },
    'search.previewShareLinkFailed': {
      ko: '복사하지 못했어요',
      en: 'Copy failed'
    },

    // 검색 입력
    'search.placeholder': {
      ko: '아티스트, 첫 순간, 감정으로 찾아보기',
      en: 'Search by artist, first moment, or feeling'
    },

    // 필터
    'search.filter.all': {
      ko: '전체',
      en: 'All'
    },
    'search.filter.newbie': {
      ko: '첫 순간',
      en: 'First moment'
    },
    'search.filter.growing': {
      ko: '이어진 마음',
      en: 'Connected feelings'
    },
    'search.filter.fan': {
      ko: '깊어진 마음',
      en: 'Deepened feelings'
    },

    // 기타
    'browse_lovetrees': {
      ko: '러브트리 둘러보기',
      en: 'Browse LoveTrees'
    },
    'browse_label': {
      ko: '둘러보기',
      en: 'Browse'
    },
    'unknown_artist': {
      ko: 'Unknown',
      en: 'Unknown'
    }
  };

  function loadSearchCopyUi() {
    if (!/\/pages\/search(?:\.html)?$/.test(window.location.pathname)) return;
    if (document.querySelector('script[data-lovebud-search-copy-ui]')) return;
    const script = document.createElement('script');
    script.src = '../js/search/search-copy-ui.js?v=20260426-1';
    script.defer = true;
    script.dataset.lovebudSearchCopyUi = 'true';
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSearchCopyUi, { once: true });
  } else {
    loadSearchCopyUi();
  }
})();
