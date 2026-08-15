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
   * 캐시에 저장된 공개 Tree record에서 tree id를 추출한다.
   */
  function getTreeRecordId(tree) {
    if (!tree || typeof tree !== 'object') return null;
    const raw = tree.id !== undefined ? tree.id : (tree.treeId !== undefined ? tree.treeId : tree.tree_id);
    return raw === null || raw === undefined ? null : String(raw);
  }

  /**
   * 공개 Browse/Preview projection 캐시만 제거한다 (#4055).
   * - Browse 목록 키 (public_trees_summary_*)
   * - Preview 키 (public_tree_preview_*)
   * 메모리 + sessionStorage 모두 제거하며, auth/session/개인 캐시는 건드리지 않는다.
   */
  function clearPublicBrowseCaches() {
    clearCachePattern('public_trees_summary_');
    clearCachePattern('public_tree_preview_');
  }

  /**
   * 특정 Tree의 공개 projection 캐시를 제거한다 (#4055).
   * - 해당 Tree의 public preview 키 제거
   * - 모든 공개 Browse 목록에서 해당 Tree record 제거 (다른 Tree는 보존)
   * 메모리 + sessionStorage 모두 처리한다.
   */
  function clearPublicTreeCaches(treeId) {
    if (treeId === null || treeId === undefined || treeId === '') {
      return clearPublicBrowseCaches();
    }
    const treeIdStr = String(treeId);

    clearCache('public_tree_preview_' + treeIdStr);
    removeTreeRecordFromBrowseLists(treeIdStr);
  }

  /**
   * 모든 공개 Browse 목록 캐시에서 특정 tree id를 제거한다.
   * 다른 Tree record는 그대로 유지한다 (#4055, Case F per-Tree precision).
   */
  function removeTreeRecordFromBrowseLists(treeIdStr) {
    const browsePrefix = CACHE_PREFIX + 'public_trees_summary_';

    // 메모리 캐시
    Object.keys(window.loveBudCache).forEach((key) => {
      if (!key.startsWith(browsePrefix)) return;
      const item = window.loveBudCache[key];
      if (!item || !Array.isArray(item.value)) return;
      const next = item.value.filter((t) => getTreeRecordId(t) !== treeIdStr);
      if (next.length !== item.value.length) {
        item.value = next;
        if (item.expiry && Date.now() > item.expiry) {
          delete window.loveBudCache[key];
        }
      }
    });

    // sessionStorage 보조
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (!key || !key.startsWith(browsePrefix)) continue;
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        try {
          const item = JSON.parse(raw);
          if (!item || !Array.isArray(item.value)) continue;
          const next = item.value.filter((t) => getTreeRecordId(t) !== treeIdStr);
          if (next.length !== item.value.length) {
            if (next.length === 0) {
              sessionStorage.removeItem(key);
            } else {
              item.value = next;
              sessionStorage.setItem(key, JSON.stringify(item));
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
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
    clearPublicBrowseCaches: clearPublicBrowseCaches,
    clearPublicTreeCaches: clearPublicTreeCaches,
    status: getCacheStatus
  };
})();
