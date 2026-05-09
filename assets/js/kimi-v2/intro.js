/**
 * LoveTree Kimi-v2 Intro Page JavaScript
 * 트리 성장 단계 자동 전환
 */

(function() {
  'use strict';

  const stages = document.querySelectorAll('.tree-stage');
  const indicators = document.querySelectorAll('.indicator');
  let currentStage = 0;
  let autoPlayInterval;

  // 단계 전환 함수
  function switchStage(index) {
    // 모든 단계 비활성화
    stages.forEach((stage, i) => {
      stage.classList.remove('active');
      indicators[i].classList.remove('active');
    });

    // 선택한 단계 활성화
    stages[index].classList.add('active');
    indicators[index].classList.add('active');
    currentStage = index;
  }

  // 다음 단계로
  function nextStage() {
    const next = (currentStage + 1) % stages.length;
    switchStage(next);
  }

  // 인디케이터 클릭 이벤트
  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => {
      switchStage(index);
      resetAutoPlay();
    });
  });

  // 자동 재생
  function startAutoPlay() {
    autoPlayInterval = setInterval(nextStage, 4000);
  }

  function resetAutoPlay() {
    clearInterval(autoPlayInterval);
    startAutoPlay();
  }

  // 터치/스와이프 지원
  let touchStartX = 0;
  let touchEndX = 0;

  const treeContainer = document.querySelector('.tree-wrapper');

  treeContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  treeContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // 왼쪽 스와이프 - 다음
        nextStage();
      } else {
        // 오른쪽 스와이프 - 이전
        const prev = (currentStage - 1 + stages.length) % stages.length;
        switchStage(prev);
      }
      resetAutoPlay();
    }
  }

  // 초기화
  function init() {
    startAutoPlay();
  }

  // DOM 로드 후 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
