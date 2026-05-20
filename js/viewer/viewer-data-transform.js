(function() {
    'use strict';

    var MARKER = 'LoveBudViewerDataTransformLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    // ── i18n helper (self-contained, uses window globals) ──────────────

    function t(key, fallbackKo, fallbackEn) {
        var dict = window.i18nViewer && window.i18nViewer[key];
        if (dict && typeof dict === 'object') {
            var locale = (window.i18n && window.i18n.currentLang || 'ko').toLowerCase();
            return dict[locale] || dict.ko || dict.en || fallbackKo;
        }
        return dict || fallbackKo || fallbackEn || key;
    }

    // ── Memory helpers (pure) ──────────────────────────────────────────

    function getMemoryKey(memory) {
        return memory && memory.id ? String(memory.id) : '';
    }

    function getParentKey(memory) {
        return memory && (memory.parentId || memory.parent_id) ? String(memory.parentId || memory.parent_id) : '';
    }

    function mapBranchMoment(memory, index, tValue) {
        return {
            id: 'moment-' + index,
            title: memory.title || memory.emotionMemo || '',
            tag: (memory.emotionTags && memory.emotionTags[0]) || '',
            caption: memory.emotionMemo || memory.title || '',
            emoji: '??',
            t: tValue,
            channelId: memory.channelId || memory.channel_id || '',
            channelName: memory.channelName || memory.channel_name || '',
            channelUrl: memory.channelUrl || memory.channel_url || ''
        };
    }

    // ── Branch path / fork helpers (pure) ──────────────────────────────

    function collectBranchPath(startKey, childrenByParent, memoryByKey, indexByKey) {
        var path = [];
        var queue = [startKey];
        var seen = {};

        while (queue.length) {
            var key = queue.shift();
            if (!key || seen[key]) return null;
            var memory = memoryByKey[key];
            if (!memory) continue;

            seen[key] = true;
            path.push(memory);

            var children = (childrenByParent[key] || []).slice().sort(function(a, b) {
                return (indexByKey[a] || 0) - (indexByKey[b] || 0);
            });
            for (var i = 0; i < children.length; i++) queue.push(children[i]);
        }

        return path;
    }

    // ── Fork branch builder ────────────────────────────────────────────

    function buildForkBranches(memories) {
        var memoryByKey = {};
        var indexByKey = {};
        var childrenByParent = {};

        memories.forEach(function(memory, index) {
            var key = getMemoryKey(memory);
            if (!key) return;
            memoryByKey[key] = memory;
            indexByKey[key] = index;
        });

        memories.forEach(function(memory) {
            var key = getMemoryKey(memory);
            var parentKey = getParentKey(memory);
            if (!key || !parentKey || !memoryByKey[parentKey]) return;
            if (!childrenByParent[parentKey]) childrenByParent[parentKey] = [];
            childrenByParent[parentKey].push(key);
        });

        var forkParentKey = '';
        Object.keys(childrenByParent).some(function(parentKey) {
            if (childrenByParent[parentKey].length < 2) return false;
            forkParentKey = parentKey;
            return true;
        });
        if (!forkParentKey) return null;

        var colors = ['rose', 'amber', 'emerald', 'violet'];
        var children = childrenByParent[forkParentKey].slice().sort(function(a, b) {
            return (indexByKey[a] || 0) - (indexByKey[b] || 0);
        });
        var branches = [];

        for (var branchIndex = 0; branchIndex < children.length; branchIndex++) {
            var branchPath = collectBranchPath(children[branchIndex], childrenByParent, memoryByKey, indexByKey);
            if (!branchPath || !branchPath.length) return null;

            var moments = branchPath.map(function(memory, momentIndex) {
                return mapBranchMoment(memory, indexByKey[getMemoryKey(memory)], (momentIndex + 0.5) / Math.max(branchPath.length, 1));
            });
            var sideLeft = branchIndex % 2 === 0;
            var startY = 77 - (branchIndex * 9);
            var endY = Math.max(14, 48 - (branchIndex * 9));
            var endX = sideLeft ? 18 + Math.min(branchIndex, 2) * 4 : 82 - Math.min(branchIndex, 2) * 4;

            branches.push({
                id: 'branch-' + (branchIndex + 1),
                name: 'Branch ' + (branchIndex + 1),
                side: sideLeft ? 'left' : 'right',
                color: colors[branchIndex % colors.length],
                startY: startY,
                endY: endY,
                endX: endX,
                curveA: sideLeft ? 36 : 64,
                curveB: sideLeft ? 28 : 72,
                caption: moments.length + t('viewer.momentsConnected', 'connected moments', ' connected moments'),
                count: moments.length,
                moments: moments
            });
        }

        return branches.length >= 2 ? branches : null;
    }

    // ── Main branch builder ────────────────────────────────────────────

    function buildBranches(memories) {
        var moments = memories.map(function(m, i) {
            var moment = mapBranchMoment(m, i, (i + 0.5) / Math.max(memories.length, 1));
            moment.emoji = '✦';
            return moment;
        });

        var branch = {
            id: 'main',
            name: t('viewer.mainBranch', '전체 흐름', 'Full Flow'),
            side: 'left',
            color: 'rose',
            startY: 77,
            endY: 16,
            endX: 22,
            curveA: 38,
            curveB: 28,
            caption: memories.length + t('viewer.momentsConnected', '개의 순간이 이어져 있어요', ' connected moments'),
            count: memories.length,
            moments: moments
        };

        var forkBranches = buildForkBranches(memories);
        var branches = forkBranches || [branch];
        var rootBranch = branches[0] || branch;

        var rootSeed = {
            id: 'moment-root',
            branchId: rootBranch.id,
            title: t('viewer.rootOverviewAnchor', '러브트리의 시작점', 'LoveTree starting point'),
            tag: t('viewer.fullFlowAnchor', '전체 흐름', 'Full flow'),
            caption: t('viewer.rootOverviewCaption', '전체 흐름의 기준점', 'The anchor for the full tree overview'),
            color: 'from-rose-200 via-rose-100 to-amber-50',
            emoji: '✦'
        };

        return {
            branches: branches,
            rootSeed: rootSeed,
            palette: {
                rose: { stroke:'#e99aac', soft:'#fff1f3', text:'#be123c', dim:'rgba(251,113,133,.16)' },
                amber: { stroke:'#eac86f', soft:'#fff7df', text:'#a16207', dim:'rgba(251,191,36,.15)' },
                emerald: { stroke:'#8fd8bc', soft:'#ecfdf5', text:'#047857', dim:'rgba(110,231,183,.16)' },
                violet: { stroke:'#c8b8f8', soft:'#f5f3ff', text:'#7c3aed', dim:'rgba(167,139,250,.16)' }
            },
            curvePoint: function(branch, t) {
                var x0=50, y0=branch.startY;
                var x1=branch.curveA, y1=branch.startY-8;
                var x2=branch.curveB, y2=branch.endY+8;
                var x3=branch.endX, y3=branch.endY;
                var mt=1-t;
                return { x: mt*mt*mt*x0 + 3*mt*mt*t*x1 + 3*mt*t*t*x2 + t*t*t*x3,
                         y: mt*mt*mt*y0 + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y3 };
            },
            tree: {
                title: (memories[0] && memories[0].treeTitle) || t('viewer.treeTitle', '러브트리', 'LoveTree'),
                creator: (memories[0] && memories[0].artist ? '@' + memories[0].artist : '@lovetree_viewer') || '',
                meta: memories.length + t('viewer.metaMoments', '개의 순간 · 공개 러브트리', ' moments · public LoveTree')
            },
            treeComments: [],
            momentComments: {}
        };
    }

    // ── Public API ─────────────────────────────────────────────────────

    window.LoveBudViewerDataTransform = {
        getMemoryKey: getMemoryKey,
        getParentKey: getParentKey,
        mapBranchMoment: mapBranchMoment,
        collectBranchPath: collectBranchPath,
        buildForkBranches: buildForkBranches,
        buildBranches: buildBranches
    };
})();
