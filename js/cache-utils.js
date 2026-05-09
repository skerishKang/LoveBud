/**
 * LoveBud MVP - 간단한 캐시 유틸리티
 * window 메모리 캐시 우선, sessionStorage 보조 사용
 * auth 캐시와 별도 관리, TTL 지원
 */

(function() {
  'use strict';

  const CACHE_PREFIX = 'lb_';
  const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5분

  // 메모리 캐시 (전역)
  window.loveBudCache = window.loveBudCache || {};

  /**
   * 캐시 키 생성 (prefix 추가)
   */
  function cacheKey(key) {
    return CACHE_PREFIX + key;
  }

  /**
   * 캐시 데이터 가져오기
   * @param {string} key - 캐시 키
   * @param {boolean} useSession - sessionStorage도 확인할지 여부
   * @returns {any|null} 캐시된 값 또는 null
   */
  function getCache(key, useSession = true) {
    const fullKey = cacheKey(key);
    
    // 1. 메모리 캐시 우선 확인
    if (window.loveBudCache[fullKey]) {
      const item = window.loveBudCache[fullKey];
      if (item.expiry && Date.now() > item.expiry) {
        delete window.loveBudCache[fullKey];
        return null;
      }
      return item.value;
    }
    
    // 2. sessionStorage 보조 확인
    if (useSession) {
      try {
        const raw = sessionStorage.getItem(fullKey);
        if (raw) {
          const item = JSON.parse(raw);
          if (item.expiry && Date.now() > item.expiry) {
            sessionStorage.removeItem(fullKey);
            return null;
          }
          // 메모리 캐시로 복원
          window.loveBudCache[fullKey] = item;
          return item.value;
        }
      } catch (e) {
        console.warn('[cache] SessionStorage read failed:', e);
      }
    }
    
    return null;
  }

  /**
   * 캐시 데이터 설정
   * @param {string} key - 캐시 키
   * @param {any} value - 저장할 값
   * @param {number} ttlMs - TTL (밀리초, 기본 5분)
   * @param {boolean} useSession - sessionStorage에도 저장할지 여부
   */
  function setCache(key, value, ttlMs = DEFAULT_TTL_MS, useSession = true) {
    const fullKey = cacheKey(key);
    const item = {
      value: value,
      expiry: ttlMs > 0 ? Date.now() + ttlMs : null,
      cachedAt: Date.now()
    };
    
    // 메모리 캐시에 저장
    window.loveBudCache[fullKey] = item;
    
    // sessionStorage에도 저장 (보조)
    if (useSession) {
      try {
        sessionStorage.setItem(fullKey, JSON.stringify(item));
      } catch (e) {
        console.warn('[cache] SessionStorage write failed:', e);
      }
    }
  }

  /**
   * 캐시 데이터 삭제
   * @param {string} key - 삭제할 캐시 키 (prefix 없이)
   */
  function clearCache(key) {
    const fullKey = cacheKey(key);
    delete window.loveBudCache[fullKey];
    try {
      sessionStorage.removeItem(fullKey);
    } catch (e) {
      console.warn('[cache] SessionStorage remove failed:', e);
    }
  }

  /**
   * 패턴으로 캐시 삭제 (prefix 기반)
   * @param {string} pattern - 삭제할 키 패턴 (예: 'trees_')
   */
  function clearCachePattern(pattern) {
    const fullPattern = cacheKey(pattern);
    
    // 메모리 캐시에서 삭제
    Object.keys(window.loveBudCache).forEach(key => {
      if (key.startsWith(fullPattern)) {
        delete window.loveBudCache[key];
      }
    });
    
    // sessionStorage에서 삭제
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(fullPattern)) {
          sessionStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('[cache] SessionStorage pattern remove failed:', e);
    }
  }

  /**
   * 모든 LoveBud 캐시 삭제 (로그아웃 등에서 사용)
   */
  function clearAllCache() {
    // 메모리 캐시 초기화
    window.loveBudCache = {};
    
    // sessionStorage에서 lb_ prefix 가진 것만 삭제
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('[cache] SessionStorage clear failed:', e);
    }
  }

  /**
   * 캐시 상태 확인 (디버깅용)
   */
  function getCacheStatus() {
    const memoryKeys = Object.keys(window.loveBudCache);
    let sessionKeys = [];
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          sessionKeys.push(key);
        }
      }
    } catch (e) {}
    
    return {
      memory: memoryKeys.length,
      session: sessionKeys.length,
      keys: memoryKeys
    };
  }

  // 전역에 노출
  window.LoveBudCache = {
    get: getCache,
    set: setCache,
    clear: clearCache,
    clearPattern: clearCachePattern,
    clearAll: clearAllCache,
    status: getCacheStatus
  };

  console.log('[cache-utils] Cache system initialized');
})();
