/**
 * LoveBud - My Trees Data
 * v20260429-2
 *
 * Responsibilities:
 * - cache keys
 * - preloadFirstTreeDetail
 * - loadTrees
 */

(function() {
  function isMyTreesDebugEnabled() {
    return window.LOVEBUD_DEBUG === true || window.LOVEBUD_MY_TREES_DEBUG === true;
  }

  function myTreesDebugLog() {
    if (!isMyTreesDebugEnabled() || !window.console || typeof console.log !== 'function') return;
    console.log.apply(console, arguments);
  }

  function getI18n(options) {
    return options?.i18n || window.t || function(k) { return k; };
  }

  var MyTreesJourneyTracker = (function() {
    var activeContexts = Object.create(null);

    function getTaxonomy() {
      try {
        var tax = window && window.LoveBudJourneyOutcomeTaxonomy;
        if (!tax || typeof tax.buildBoundedEvent !== 'function') return null;
        return tax;
      } catch (e) {
        return null;
      }
    }

    function getEvidenceSink() {
      try {
        var sink = window && (window.__LOVE_BUD_JOURNEY_EVIDENCE_SINK__ || window.__LoveBudJourneyOutcomeSink);
        if (!sink) return null;
        if (typeof sink.push === 'function' || typeof sink.emit === 'function' || typeof sink.record === 'function') {
          return sink;
        }
      } catch (e) {}
      return null;
    }

    function deliverEvent(sink, event) {
      if (typeof sink.push === 'function') return sink.push(event);
      if (typeof sink.emit === 'function') return sink.emit(event);
      if (typeof sink.record === 'function') return sink.record(event);
      return undefined;
    }

    function removeContext(generation, context) {
      if (activeContexts[generation] === context) {
        delete activeContexts[generation];
      }
    }

    function createGenerationContext(generation) {
      var context = {
        generation: generation,
        startedAt: Date.now(),
        terminalEmitted: false,
        cancelled: false,
        resultCountBucket: 'unknown'
      };

      context.recordStage = function(stageName, meta) {
        meta = meta && typeof meta === 'object' ? meta : {};
        var isCancelled = stageName === 'CANCELLED';
        var isTerminal = stageName === 'TERMINAL_SUCCESS' || stageName === 'TERMINAL_FAILURE';
        if (isCancelled) {
          if (this.cancelled) return;
          this.cancelled = true;
        }
        if (isTerminal) {
          if (this.terminalEmitted) return;
          this.terminalEmitted = true;
        }

        if (meta.resultCountBucket === 'positive' || meta.resultCountBucket === 'zero') {
          this.resultCountBucket = meta.resultCountBucket;
        }

        try {
          var tax = getTaxonomy();
          var sink = getEvidenceSink();
          if (!tax || !sink || !tax.STAGES) return;
          var canonicalStage = tax.STAGES[stageName];
          if (typeof canonicalStage !== 'string') return;
          var event = tax.buildBoundedEvent({
            stage: canonicalStage,
            statusClass: meta.statusClass,
            expectationClass: meta.expectationClass,
            severity: meta.severity,
            failureCode: meta.failureCode,
            httpStatus: meta.httpStatus,
            latencyMs: Date.now() - this.startedAt,
            resultCountBucket: meta.resultCountBucket || this.resultCountBucket
          });
          deliverEvent(sink, event);
        } catch (e) {
          // Observability is optional. A sink/taxonomy failure must not alter product flow.
        } finally {
          if (isCancelled || isTerminal) removeContext(this.generation, this);
        }
      };

      return context;
    }

    function canonicalFailureCode(name, fallback) {
      try {
        var tax = getTaxonomy();
        return tax && tax.FAILURE_CODES && tax.FAILURE_CODES[name]
          ? tax.FAILURE_CODES[name]
          : fallback;
      } catch (e) {
        return fallback;
      }
    }

    return {
      createContext: function(generation) {
        var ctx = createGenerationContext(generation);
        activeContexts[generation] = ctx;
        return ctx;
      },
      getContext: function(generation) {
        return activeContexts[generation] || null;
      },
      getActiveContextCount: function() {
        return Object.keys(activeContexts).length;
      },
      mapLoadError: function(errorType, apiAvailable) {
        if (errorType === 'generic' && apiAvailable === false) {
          return canonicalFailureCode('LB_JOURNEY_API_UNAVAILABLE', 'LB_UNEXPECTED_FAILURE');
        }
        switch (errorType) {
          case 'auth_prepare_failed': return canonicalFailureCode('LB_JOURNEY_AUTH_PREPARE_FAILED', 'LB_UNEXPECTED_FAILURE');
          case 'fetch_rejected': return canonicalFailureCode('LB_JOURNEY_NETWORK', 'LB_UNEXPECTED_FAILURE');
          case 'parse': return canonicalFailureCode('LB_JOURNEY_RESPONSE_PARSE', 'LB_UNEXPECTED_FAILURE');
          case 'invalid_payload': return canonicalFailureCode('LB_JOURNEY_INVALID_PAYLOAD', 'LB_UNEXPECTED_FAILURE');
          case 'auth': return canonicalFailureCode('LB_JOURNEY_AUTH_REQUIRED', 'LB_UNEXPECTED_FAILURE');
          case 'server': return canonicalFailureCode('LB_JOURNEY_HTTP_5XX', 'LB_UNEXPECTED_FAILURE');
          case 'client': return canonicalFailureCode('LB_JOURNEY_HTTP_4XX', 'LB_UNEXPECTED_FAILURE');
          default: return canonicalFailureCode('LB_UNEXPECTED_FAILURE', 'LB_UNEXPECTED_FAILURE');
        }
      }
    };
  })();

  var TREES_CACHE_KEY = 'my_trees_list';
  var TREE_DETAIL_CACHE_KEY = 'tree_detail_';
  var TREE_MEMORIES_CACHE_KEY = 'tree_memories_';
  var PERSISTENT_TREES_CACHE_KEY = 'lovebud_my_trees_list_cache';
  var PERSISTENT_TREES_CACHE_TTL_MS = 3 * 60 * 1000;

  function capturePrivateCacheScope() {
    var privateCache = window.LoveBudAuthCache || null;
    if (!privateCache) {
      return { privateCache: null, uid: null, authority: null };
    }

    var uid = typeof privateCache.getPrivateCacheOwnerUid === 'function'
      ? privateCache.getPrivateCacheOwnerUid()
      : null;
    var authority = uid && typeof privateCache.capturePrivateCacheAuthority === 'function'
      ? privateCache.capturePrivateCacheAuthority(uid)
      : null;

    return {
      privateCache: privateCache,
      uid: uid,
      authority: authority
    };
  }

  function isPrivateCacheScopeCurrent(scope) {
    // Keep network-only behavior compatible when the auth cache module is not
    // loaded, but never read/write owner-private caches without that authority.
    if (!scope || !scope.privateCache) return true;
    return !!(
      scope.uid &&
      scope.authority &&
      typeof scope.privateCache.isPrivateCacheAuthorityCurrent === 'function' &&
      scope.privateCache.isPrivateCacheAuthorityCurrent(scope.authority)
    );
  }

  function canUsePrivateCache(scope) {
    return !!(
      scope &&
      scope.privateCache &&
      scope.uid &&
      scope.authority &&
      isPrivateCacheScopeCurrent(scope)
    );
  }

  function readPrivateCacheRecord(key, scope) {
    if (
      !canUsePrivateCache(scope) ||
      typeof scope.privateCache.readPrivateCacheRecord !== 'function'
    ) {
      return null;
    }
    return scope.privateCache.readPrivateCacheRecord(key, scope.uid);
  }

  function writePrivateCacheRecord(key, record, scope) {
    if (
      !canUsePrivateCache(scope) ||
      typeof scope.privateCache.writePrivateCacheRecord !== 'function'
    ) {
      return false;
    }
    return scope.privateCache.writePrivateCacheRecord(
      key,
      scope.uid,
      record,
      scope.authority
    ) === true;
  }

  function readPersistentTreesCache(scope) {
    try {
      var parsed = readPrivateCacheRecord(PERSISTENT_TREES_CACHE_KEY, scope);
      if (!parsed) return null;
      if (!Array.isArray(parsed.data)) {
        localStorage.removeItem(PERSISTENT_TREES_CACHE_KEY);
        return null;
      }
      if (parsed.expiry && Date.now() > parsed.expiry) {
        localStorage.removeItem(PERSISTENT_TREES_CACHE_KEY);
        return null;
      }

      return parsed.data;
    } catch (e) {
      console.warn('[my-trees-data] Failed to read persistent trees cache:', e);
      return null;
    }
  }

  function writePersistentTreesCache(trees, scope) {
    scope = scope || capturePrivateCacheScope();
    if (!canUsePrivateCache(scope)) return false;
    try {
      return writePrivateCacheRecord(PERSISTENT_TREES_CACHE_KEY, {
        data: trees,
        expiry: Date.now() + PERSISTENT_TREES_CACHE_TTL_MS,
        cachedAt: Date.now()
      }, scope);
    } catch (e) {
      console.warn('[my-trees-data] Failed to write persistent trees cache:', e);
      return false;
    }
  }

  function preloadFirstTreeDetail(trees, privateCacheScope) {
    try {
      var scope = privateCacheScope || capturePrivateCacheScope();
      if (!canUsePrivateCache(scope)) return;
      if (!trees || !trees.length || !window.apiClient) return;

      var firstTree = trees[0];
      var treeId = firstTree.id || firstTree;
      if (!treeId) return;

      Promise.all([
        window.apiClient.getTree ? window.apiClient.getTree(treeId).catch(function() {}) : Promise.resolve(),
        window.apiClient.getMemoriesByTree ? window.apiClient.getMemoriesByTree(treeId).catch(function() {}) : Promise.resolve()
      ]).then(function(results) {
        if (!canUsePrivateCache(scope)) return;
        var treeDetail = results[0];
        var memories = results[1];

        if (treeDetail) {
          writePrivateCacheRecord(TREE_DETAIL_CACHE_KEY + treeId, {
            data: treeDetail,
            timestamp: Date.now()
          }, scope);
        }

        if (memories && Array.isArray(memories)) {
          writePrivateCacheRecord(TREE_MEMORIES_CACHE_KEY + treeId, {
            data: memories,
            timestamp: Date.now()
          }, scope);
        }

        myTreesDebugLog('[my-trees-data] Preloaded first tree detail:', 'memories:', memories ? memories.length : 0);
      }).catch(function(err) {
        console.warn('[my-trees-data] Preload first tree detail failed:', err.message);
      });
    } catch (e) {
      console.warn('[my-trees-data] Preload first tree detail error:', e);
    }
  }

  function normalizeTreesForList(trees) {
    return (Array.isArray(trees) ? trees : []).map(function(tree) {
      return Object.assign({}, normalizeTreeRecord(tree) || tree);
    });
  }

  function readTreeMemoriesCache(treeId, scope) {
    try {
      var parsed = readPrivateCacheRecord(TREE_MEMORIES_CACHE_KEY + treeId, scope);
      if (!parsed || !Array.isArray(parsed.data)) return null;
      return parsed.data;
    } catch (e) {
      console.warn('[my-trees-data] Failed to read tree memories cache:', e);
      return null;
    }
  }

  function normalizeTreeRecord(tree) {
    if (window.LoveBudNormalize && typeof window.LoveBudNormalize.normalizeTree === 'function') {
      return window.LoveBudNormalize.normalizeTree(tree);
    }
    return tree;
  }

  function normalizeMemoryRecord(memory) {
    if (window.LoveBudNormalize && typeof window.LoveBudNormalize.normalizeMemory === 'function') {
      return window.LoveBudNormalize.normalizeMemory(memory);
    }
    return memory;
  }

  var VALID_PHASES = {
    loaded: true, fetch_rejected: true, auth_prepare_failed: true, parse: true, invalid_payload: true,
    auth: true, client: true, server: true, generic: true, none: true,
    // history / BFCache recovery lifecycle (privacy-safe bounded enums only)
    restore_triggered: true,
    restore_skipped_inflight: true,
    restore_skipped_not_restore: true,
    restore_skipped_terminal: true,
    restore_recovered: true,
    restore_failed: true,
    // stale-generation / supersede lifecycle
    restore_superseded_stale: true,
    restore_coalesced_current: true,
    stale_result_ignored: true
  };
  var VALID_STATUS_CLASSES = { success: true, client: true, server: true, none: true };

  // Generation/epoch owner-list load guard.
  // - Normal boot/retry: single-flight coalesce on activeOwnerListLoad.promise
  // - History restore with supersedeStaleLoad: bump generation so pre-restore
  //   loads become stale and cannot write UI/cache after a recovery starts
  var ownerListGeneration = 0;
  var activeOwnerListLoad = null; // { generation, promise, reason }

  function isOwnerListLoadInFlight() {
    return !!(activeOwnerListLoad && activeOwnerListLoad.promise);
  }

  function isCurrentOwnerListGeneration(generation) {
    return Number(generation) === Number(ownerListGeneration);
  }

  /**
   * Mark any in-flight owner-list generation stale without starting a network
   * request. Used on pagehide so pre-restore loads cannot write after restore.
   */
  function markOwnerListEpochStale() {
    var staleGeneration = ownerListGeneration;
    ownerListGeneration += 1;
    if (activeOwnerListLoad && activeOwnerListLoad.generation === staleGeneration) {
      var staleContext = MyTreesJourneyTracker.getContext(staleGeneration);
      if (staleContext) staleContext.recordStage('CANCELLED');
    }
  }

  function hasVisibleLoadedCards() {
    try {
      var loaded = document.getElementById('state-loaded');
      if (!loaded) return false;
      if (loaded.classList && loaded.classList.contains('state-hidden')) return false;
      if (loaded.style && loaded.style.display === 'none') return false;
      return !!(loaded.querySelectorAll && loaded.querySelectorAll('[data-tree-id]').length > 0);
    } catch (e) {
      return false;
    }
  }

  function normalizePhase(v) {
    return VALID_PHASES[v] ? v : 'generic';
  }

  function normalizeStatusClass(v) {
    return VALID_STATUS_CLASSES[v] ? v : 'none';
  }

  function sanitizeRequestLifecycle(meta) {
    if (!meta || typeof meta !== 'object') return {};
    return {
      attempt: meta.attempt === 2 ? 2 : 1,
      retried: meta.retried === true,
      authHeaderPresent: meta.authHeaderPresent === true,
      statusClass: normalizeStatusClass(meta.statusClass)
    };
  }

  function emitLifecycleDiagnostic(event) {
    if (!event || typeof event !== 'object') return;
    var enabled = !!(window.__LoveBudMyTreesDiagnosticSink || window.LOVEBUD_MY_TREES_DEBUG === true);
    if (!enabled) return;
    try {
      var sink = window.__LoveBudMyTreesDiagnosticSink;
      if (sink && typeof sink === 'object' && typeof sink.emit === 'function') {
        var safeEvent = Object.freeze({
          phase: normalizePhase(event.phase),
          attempt: event.attempt === 2 ? 2 : 1,
          retried: event.retried === true,
          authHeaderPresent: event.authHeaderPresent === true,
          cachePresent: event.cachePresent === true,
          cacheUsed: event.cacheUsed === true,
          statusClass: normalizeStatusClass(event.statusClass),
          resultCountBucket: normalizeCountBucket(event.resultCountBucket)
        });
        sink.emit(safeEvent);
      }
    } catch (e) {}
  }

  function normalizeCountBucket(v) {
    if (v === 'positive' || v === 'zero') return v;
    return 'unknown';
  }

  function sortMemoriesByFirstMoment(memories) {
    return (Array.isArray(memories) ? memories.slice() : []).sort(function(a, b) {
      var left = new Date((a && (a.createdAt || a.created_at || a.timestamp)) || 0).getTime();
      var right = new Date((b && (b.createdAt || b.created_at || b.timestamp)) || 0).getTime();
      return left - right;
    });
  }

  function deriveTreeMemoryMeta(tree, memories) {
    var normalizedTree = normalizeTreeRecord(tree) || tree || {};
    var ordered = sortMemoriesByFirstMoment((Array.isArray(memories) ? memories : []).map(function(memory) {
      return normalizeMemoryRecord(memory) || memory;
    }));
    var firstMoment = ordered[0] || null;

    return {
      memoryCount: ordered.length,
      representativeThumbnail: normalizedTree.representativeThumbnail || normalizedTree.representative_thumbnail || (firstMoment && (firstMoment.thumbnail || firstMoment.sourceUrl)) || '',
      representativeTitle: normalizedTree.representativeTitle || normalizedTree.representative_title || (firstMoment && firstMoment.title) || '',
      representativeMemo: normalizedTree.representativeMemo || normalizedTree.representative_memo || (firstMoment && firstMoment.memo) || ''
    };
  }

  async function enrichTreesWithMemoryMeta(trees, privateCacheScope) {
    if (!Array.isArray(trees) || trees.length === 0 || !window.apiClient || !window.apiClient.getMemoriesByTree) {
      return Array.isArray(trees) ? trees.map(function(tree) {
        return Object.assign({}, normalizeTreeRecord(tree) || tree);
      }) : [];
    }

    var scope = privateCacheScope || capturePrivateCacheScope();
    var enriched = await Promise.all(trees.map(async function(tree) {
      var normalizedTree = normalizeTreeRecord(tree) || tree;
      if (!normalizedTree || !normalizedTree.id) return normalizedTree;

      var cachedMemories = readTreeMemoriesCache(normalizedTree.id, scope);
      var memories = cachedMemories;

      if (!Array.isArray(memories)) {
        try {
          memories = await window.apiClient.getMemoriesByTree(normalizedTree.id);
          if (Array.isArray(memories) && canUsePrivateCache(scope)) {
            writePrivateCacheRecord(TREE_MEMORIES_CACHE_KEY + normalizedTree.id, {
              data: memories,
              timestamp: Date.now()
            }, scope);
          }
        } catch (e) {
          console.warn('[my-trees-data] Failed to fetch memories for tree:', e.message);
          memories = [];
        }
      }

      var meta = deriveTreeMemoryMeta(normalizedTree, memories);
      return Object.assign({}, normalizedTree, meta);
    }));

    return enriched;
  }

  /**
   * Extract a numeric HTTP status from an error object.
   * Supports: error.status, error.statusCode, error.response?.status.
   * Returns undefined if no bounded status is extractable.
   */
  function extractHttpStatus(error) {
    if (!error) return undefined;
    var raw = error.status || error.statusCode || (error.response && error.response.status);
    if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
      return raw;
    }
    return undefined;
  }

  /**
   * Classify an API error into one of:
   * - fetch_rejected       : explicit fetch rejection phase only
   * - auth_prepare_failed  : fetch() never called, auth/token prep failed
   * - parse                : JSON parse failure after successful HTTP response (phase metadata, checked third)
   * - invalid_payload      : successful HTTP response with non-array payload (phase metadata, checked fourth)
   * - auth                 : HTTP 401 or 403
   * - server               : HTTP 5xx
   * - client               : HTTP 4xx other than 401/403
   * - generic              : unphased/status-less unexpected client failure
   *
   * Phase checks precede status checks so that HTTP 200 parse failures
   * and invalid payloads are classified by phase, not by status code.
   *
   * Privacy-safe: never logs or exposes tokens, UIDs, emails, tree IDs, titles, or response bodies.
   */
  function classifyLoadError(error) {
    if (error && error._phase === 'fetch_rejected') return 'fetch_rejected';
    if (error && error._phase === 'auth_prepare_failed') return 'auth_prepare_failed';
    if (error && error._phase === 'json_parse_failed') return 'parse';
    if (error && error._phase === 'invalid_success_payload') return 'invalid_payload';
    var status = extractHttpStatus(error);
    if (status === 401 || status === 403) return 'auth';
    if (status >= 500 && status < 600) return 'server';
    if (status >= 400 && status < 500) return 'client';
    return 'generic';
  }

  async function loadTrees(options) {
    options = options || {};
    var supersedeStaleLoad = options.supersedeStaleLoad === true;
    var reason = options.reason || null;

    // Coalesce concurrent loads.
    if (activeOwnerListLoad && activeOwnerListLoad.promise) {
      var activeCtx = MyTreesJourneyTracker.getContext(activeOwnerListLoad.generation);
      if (supersedeStaleLoad) {
        if (
          activeOwnerListLoad.reason === 'history_recovery' &&
          activeOwnerListLoad.generation === ownerListGeneration
        ) {
          emitLifecycleDiagnostic({
            phase: 'restore_coalesced_current',
            attempt: 1,
            retried: false,
            authHeaderPresent: false,
            cachePresent: false,
            cacheUsed: false,
            statusClass: 'none',
            resultCountBucket: 'unknown'
          });
          emitLifecycleDiagnostic({
            phase: 'restore_skipped_inflight',
            attempt: 1,
            retried: false,
            authHeaderPresent: false,
            cachePresent: false,
            cacheUsed: false,
            statusClass: 'none',
            resultCountBucket: 'unknown'
          });
          if (activeCtx) activeCtx.recordStage('DUPLICATE_SUPPRESSED');
          return activeOwnerListLoad.promise;
        }
        emitLifecycleDiagnostic({
          phase: 'restore_superseded_stale',
          attempt: 1,
          retried: false,
          authHeaderPresent: false,
          cachePresent: false,
          cacheUsed: false,
          statusClass: 'none',
          resultCountBucket: 'unknown'
        });
        if (activeCtx) activeCtx.recordStage('CANCELLED');
        // Fall through: start a new generation without awaiting the stale load.
      } else {
        if (activeCtx) activeCtx.recordStage('DUPLICATE_SUPPRESSED');
        return activeOwnerListLoad.promise;
      }
    }

    var generation = ++ownerListGeneration;
    var ctx = MyTreesJourneyTracker.createContext(generation);
    var privateCacheScope = capturePrivateCacheScope();

    var runPromise = (async function runOwnerListLoad() {
      if (stillCurrent()) ctx.recordStage('ACTION_STARTED');
      var cache = window.LoveBudCache;
      var i18n = getI18n(options);
      var setState = options.setState;
      var stateEnum = options.stateEnum;
      var renderTrees = options.renderTrees;
      var showToast = options.showToast;
      var preserveVisibleList = options.preserveVisibleList === true;
      var requestLifecycle = {
        attempt: 1,
        retried: false,
        authHeaderPresent: false,
        statusClass: 'none'
      };

      function stillCurrent() {
        return isCurrentOwnerListGeneration(generation) &&
          isPrivateCacheScopeCurrent(privateCacheScope);
      }

      function ignoreIfStale(phaseHint) {
        if (stillCurrent()) return false;
        emitLifecycleDiagnostic({
          phase: phaseHint || 'stale_result_ignored',
          attempt: 1,
          retried: false,
          authHeaderPresent: false,
          cachePresent: false,
          cacheUsed: false,
          statusClass: 'none',
          resultCountBucket: 'unknown'
        });
        return true;
      }

      var MAX_ACK_SETTLEMENT_ATTEMPTS = 5;

      function scheduleSettlementBoundary(cb) {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(cb);
          return;
        }
        if (typeof setImmediate === 'function') {
          setImmediate(cb);
          return;
        }
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(cb);
          return;
        }
        cb();
      }

      /**
       * Deterministic settled UI acknowledgement (issue #3796 correction).
       *
       * The page-owned terminal DOM transition (state-section swap, loading
       * manager ready, aria-busy clear) can land one rendering boundary after
       * renderTrees returns. A single synchronous snapshot misrecords a healthy
       * load as UI_ACKNOWLEDGEMENT_FAILED, so we settle through a BOUNDED
       * number of rendering cycles:
       *   - immediate synchronous snapshot first (fast path),
       *   - re-check across requestAnimationFrame boundaries in browsers and
       *     setImmediate turns in Node/VM environments,
       *   - re-validate generation currency on every re-check so pagehide /
       *     supersede cancels pending settlement (no late terminal stages),
       *   - fail closed with LB_UI_ACKNOWLEDGEMENT_FAILED if the terminal DOM
       *     never settles within the window,
       *   - the recordStage terminal guard enforces exactly-once, so the
       *     bounded window may safely re-observe late DOM changes.
       * The window runs to its cap even after a confirmed success; the terminal
       * guard keeps emissions exactly-once while the window observes in-batch
       * DOM changes (a bounded ~5 rendering cycles, well under a single frame
       * budget on the load promise tail; the terminal UI itself is applied by
       * renderTrees before settlement begins, so TTI is unaffected).
       * No arbitrary wall-clock delay and no unbounded polling.
       */
      function settleThenAcknowledge(expectedState, ackFn) {
        return new Promise(function(resolve) {
          var attempts = 0;
          var finished = false;

          function finish() {
            if (finished) return;
            finished = true;
            resolve();
          }

          function recheck() {
            if (finished) return;
            attempts += 1;
            var acknowledged = ackFn ? ackFn(expectedState) : false;
            // NOTE: there is deliberately NO early staleness abort here. Pagehide
            // / supersede is enforced at every terminal decision below via
            // stillCurrent(), so a stale settlement can never emit a terminal
            // stage, and removing those currency checks is observable to the
            // independent negative controls (NC3/NC10). Do not "optimize" this
            // away without re-validating those controls.
            if (acknowledged && stillCurrent()) {
              if (!ctx.terminalEmitted) {
                ctx.recordStage('UI_ACKNOWLEDGED');
              }
              ctx.recordStage('TERMINAL_SUCCESS');
            }
            if (attempts >= MAX_ACK_SETTLEMENT_ATTEMPTS) {
              if (stillCurrent() && !ctx.terminalEmitted) {
                ctx.recordStage('TERMINAL_FAILURE', {
                  failureCode: 'LB_UI_ACKNOWLEDGEMENT_FAILED'
                });
              }
              finish();
              return;
            }
            scheduleSettlementBoundary(recheck);
          }

          recheck();
        });
      }

      var cachedTrees = canUsePrivateCache(privateCacheScope) && cache
        ? cache.get(TREES_CACHE_KEY)
        : null;
      if ((!cachedTrees || !Array.isArray(cachedTrees)) && canUsePrivateCache(privateCacheScope)) {
        cachedTrees = readPersistentTreesCache(privateCacheScope);
        if (cachedTrees && Array.isArray(cachedTrees) && cache && stillCurrent()) {
          cache.set(TREES_CACHE_KEY, cachedTrees, PERSISTENT_TREES_CACHE_TTL_MS);
        }
      }

      // Prefer cache paint; otherwise keep visible cards during history recovery
      // instead of blanking the page into LOADING.
      if (!stillCurrent()) {
        ignoreIfStale('stale_result_ignored');
        ctx.recordStage('CANCELLED');
        return;
      }
      if (cachedTrees && Array.isArray(cachedTrees) && typeof renderTrees === 'function') {
        myTreesDebugLog('[my-trees-data] Rendering cached trees:', cachedTrees.length);
        renderTrees(cachedTrees);
      } else if (preserveVisibleList && hasVisibleLoadedCards()) {
        myTreesDebugLog('[my-trees-data] Preserving visible list during recovery load');
      } else if (typeof setState === 'function' && stateEnum && stateEnum.LOADING) {
        setState(stateEnum.LOADING);
      }

      try {
        var trees;

        if (window.apiClient && window.apiClient.getTrees) {
          if (stillCurrent()) {
            ctx.recordStage('CLIENT_VALIDATION_PASSED');
            ctx.recordStage('REQUEST_DISPATCHED');
          }
          trees = await window.apiClient.getTrees({
            onLifecycle: function(meta) {
              if (!stillCurrent()) return;
              requestLifecycle = sanitizeRequestLifecycle(meta);
            }
          });
        } else {
          throw new Error('apiClient.getTrees is not available');
        }

        // Await returned after possible supersede/account switch — refuse stale writes/UI.
        if (ignoreIfStale('stale_result_ignored')) {
          ctx.recordStage('CANCELLED');
          return;
        }

        if (Array.isArray(trees)) {
          if (stillCurrent()) {
            ctx.recordStage('RESPONSE_ACCEPTED', {
              resultCountBucket: trees.length > 0 ? 'positive' : 'zero'
            });
          }
          trees = normalizeTreesForList(trees);

          if (cache && canUsePrivateCache(privateCacheScope)) {
            cache.set(TREES_CACHE_KEY, trees, 3 * 60 * 1000);
          }
          writePersistentTreesCache(trees);

          if (typeof renderTrees === 'function') {
            renderTrees(trees);
          }

          if (stillCurrent()) {
            ctx.recordStage('CLIENT_STATE_UPDATED');
            ctx.recordStage('NOT_MEASURABLE');
            var expectedState = trees.length > 0 ? 'loaded' : 'empty';
            var ackFn = typeof options.acknowledgeUi === 'function'
              ? options.acknowledgeUi
              : null;
            await settleThenAcknowledge(expectedState, ackFn);
          }

          emitLifecycleDiagnostic({
            phase: 'loaded',
            attempt: requestLifecycle.attempt,
            authHeaderPresent: requestLifecycle.authHeaderPresent,
            retried: requestLifecycle.retried,
            cachePresent: !!cachedTrees,
            cacheUsed: false,
            statusClass: requestLifecycle.statusClass,
            resultCountBucket: trees.length > 0 ? 'positive' : 'zero'
          });

          // Optimization: Defer preloading detail/memories to background to ensure TTI is not blocked
          if (window.requestIdleCallback) {
            window.requestIdleCallback(function() {
              if (!stillCurrent()) return;
              preloadFirstTreeDetail(trees, privateCacheScope);
            }, { timeout: 2000 });
          } else {
            setTimeout(function() {
              if (!stillCurrent()) return;
              preloadFirstTreeDetail(trees, privateCacheScope);
            }, 1000);
          }
        } else {
          var invalidPayloadError = new Error('Invalid owner-tree list payload');
          invalidPayloadError._phase = 'invalid_success_payload';
          invalidPayloadError.status = 200;
          invalidPayloadError.statusCode = 200;
          throw invalidPayloadError;
        }
      } catch (e) {
        // Stale generation/account authority: never surface ERROR/EMPTY/toast.
        if (ignoreIfStale('stale_result_ignored')) {
          ctx.recordStage('CANCELLED');
          return;
        }

        var errorType = classifyLoadError(e);
        console.error('[my-trees-data] loadTrees error (type=' + errorType + ')');

        var failCode = MyTreesJourneyTracker.mapLoadError(errorType, !!(window.apiClient && window.apiClient.getTrees));
        ctx.recordStage('TERMINAL_FAILURE', {
          failureCode: failCode,
          httpStatus: extractHttpStatus(e)
        });

        var errorAttempt = Number(e._attempt) || requestLifecycle.attempt;
        var errorRetried = e._retried === true || requestLifecycle.retried;
        var errorAuthHeaderPresent = e._authHeaderPresent === true || requestLifecycle.authHeaderPresent;

        emitLifecycleDiagnostic({
          phase: errorType,
          attempt: errorAttempt,
          authHeaderPresent: errorAuthHeaderPresent,
          retried: errorRetried,
          cachePresent: !!cachedTrees,
          cacheUsed: !!(cachedTrees && Array.isArray(cachedTrees)),
          statusClass: (function() {
            if (errorType === 'invalid_payload' || errorType === 'parse') return 'success';
            var s = extractHttpStatus(e);
            return s >= 500 ? 'server' : s >= 400 ? 'client' : s > 0 ? 'success' : requestLifecycle.statusClass;
          })(),
          resultCountBucket: 'unknown'
        });

        // auth errors (401/403): do not silently keep stale cache.
        // Show auth error state regardless of cache presence.
        if (errorType === 'auth') {
          if (typeof setState === 'function' && stateEnum && stateEnum.ERROR) {
            setState(stateEnum.ERROR, { errorType: 'auth' });
          } else {
            // setState not injected — DOM fallback
            _domFallbackErrorState('auth');
          }
          return;
        }

        // server / fetch_rejected / generic: keep cached fallback if available.
        // Never fabricate authoritative [] from cancellation/rejection.
        if (cachedTrees && Array.isArray(cachedTrees)) {
          myTreesDebugLog('[my-trees-data] Showing cached trees after ' + errorType + ' error');
          if (typeof renderTrees === 'function') {
            renderTrees(cachedTrees);
          }
          var warnKey = errorType === 'server'
            ? (i18n('myTrees.server_error_cached') || '서버 오류가 발생했습니다. 저장된 목록을 표시합니다.')
            : (i18n('myTrees.offline_mode') || '오프라인 모드 - 캐시된 데이터를 표시합니다');
          if (typeof showToast === 'function') showToast(warnKey, 'warn');
        } else if (preserveVisibleList && hasVisibleLoadedCards()) {
          // Keep already-rendered cards; do not blank to EMPTY on cancel/reject.
          myTreesDebugLog('[my-trees-data] Keeping visible cards after ' + errorType + ' recovery failure');
        } else {
          // No cache: transition to error state
          if (typeof setState === 'function' && stateEnum && stateEnum.ERROR) {
            setState(stateEnum.ERROR, { errorType: errorType });
          } else {
            _domFallbackErrorState(errorType);
          }
          var failKey = errorType === 'server'
            ? (i18n('myTrees.server_load_failed') || '서버 오류로 트리 목록을 불러오지 못했습니다')
            : (i18n('myTrees.load_failed') || '트리 목록을 불러오는데 실패했습니다');
          if (typeof showToast === 'function') showToast(failKey, 'error');
        }
      }
    })();

    activeOwnerListLoad = {
      generation: generation,
      promise: runPromise,
      reason: reason
    };

    try {
      return await runPromise;
    } finally {
      // Never let a stale generation clear a newer active recovery guard.
      if (activeOwnerListLoad && activeOwnerListLoad.generation === generation) {
        activeOwnerListLoad = null;
      }
    }
  }

  /**
   * DOM fallback for error state when setState is not injected.
   * Hides loading, shows state-error with appropriate message.
   */
  function _domFallbackErrorState(errorType) {
    var loading = document.getElementById('state-loading');
    var error = document.getElementById('state-error');
    var empty = document.getElementById('state-empty');
    var loaded = document.getElementById('state-loaded');
    if (loading) loading.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (loaded) loaded.style.display = 'none';
    if (error) {
      error.style.display = 'flex';
      _updateErrorStateMessage(error, errorType);
    }
  }

  /**
   * Update error state DOM message elements based on errorType.
   * Targets h2[data-i18n] and p[data-i18n] inside the error container.
   */
  function _updateErrorStateMessage(errorEl, errorType) {
    if (!errorEl || typeof errorEl.querySelector !== 'function') return;
    var h2 = errorEl.querySelector('h2');
    var p = errorEl.querySelector('p');
    if (errorType === 'auth') {
      if (h2) h2.textContent = '로그인이 필요합니다';
      if (p) p.textContent = '세션이 만료되었거나 인증이 필요합니다. 다시 로그인해 주세요.';
    } else if (errorType === 'server') {
      if (h2) h2.textContent = '서버 오류가 발생했습니다';
      if (p) p.textContent = '잠시 후 다시 시도해 주세요.';
    } else if (errorType === 'fetch_rejected' || errorType === 'network') {
      if (h2) h2.textContent = '불러오기에 실패했습니다';
      if (p) p.textContent = '네트워크 연결을 확인하고 다시 시도해주세요.';
    } else if (errorType === 'parse') {
      if (h2) h2.textContent = '불러오기에 실패했습니다';
      if (p) p.textContent = '데이터를 불러오는데 문제가 발생했습니다. 다시 시도해 주세요.';
    } else if (errorType === 'invalid_payload') {
      if (h2) h2.textContent = '데이터를 불러오는데 문제가 발생했습니다';
      if (p) p.textContent = '올바른 형식의 데이터를 받지 못했습니다. 다시 시도해 주세요.';
    }
  }

  window.LoveBudMyTreesData = {
    TREES_CACHE_KEY: TREES_CACHE_KEY,
    TREE_DETAIL_CACHE_KEY: TREE_DETAIL_CACHE_KEY,
    TREE_MEMORIES_CACHE_KEY: TREE_MEMORIES_CACHE_KEY,
    PERSISTENT_TREES_CACHE_KEY: PERSISTENT_TREES_CACHE_KEY,
    preloadFirstTreeDetail: preloadFirstTreeDetail,
    loadTrees: loadTrees,
    isOwnerListLoadInFlight: isOwnerListLoadInFlight,
    isCurrentOwnerListGeneration: isCurrentOwnerListGeneration,
    markOwnerListEpochStale: markOwnerListEpochStale,
    getOwnerListGeneration: function() { return ownerListGeneration; },
    emitLifecycleDiagnostic: emitLifecycleDiagnostic,
    hasVisibleLoadedCards: hasVisibleLoadedCards,
    JourneyTracker: MyTreesJourneyTracker
  };
})();