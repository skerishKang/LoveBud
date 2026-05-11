/**
 * LoveBud Search Data Adapter
 * v20260512-1058-2
 *
 * Data processing layer: transforms raw memories/trees into tree view models.
 * UI-agnostic - focuses on data transformation only.
 */

(function() {
    'use strict';

    function firstStringValue(source, keys) {
        if (!source) return '';
        for (const key of keys) {
            const value = source[key];
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return '';
    }

    function getYouTubeIdFromThumbnail(url) {
        if (!url) return '';
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
            if (!host.includes('ytimg.com') && !host.includes('img.youtube.com')) return '';
            const parts = parsed.pathname.split('/').filter(Boolean);
            const viIndex = parts.indexOf('vi');
            if (viIndex >= 0 && parts[viIndex + 1]) return parts[viIndex + 1];
        } catch (e) {
            return '';
        }
        return '';
    }

    function normalizePublicMemory(memory) {
        if (!memory || typeof memory !== 'object') return memory;
        const explicitSourceUrl = firstStringValue(memory, [
            'sourceUrl',
            'sourceURL',
            'videoUrl',
            'videoURL',
            'mediaUrl',
            'mediaURL',
            'url',
            'linkUrl',
            'linkURL'
        ]);
        const thumbnail = firstStringValue(memory, ['thumbnail', 'thumbnailUrl', 'thumbnailURL', 'imageUrl', 'imageURL']);
        const youtubeId = getYouTubeIdFromThumbnail(thumbnail);
        const sourceUrl = explicitSourceUrl || (youtubeId ? `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}` : '');
        return sourceUrl ? { ...memory, sourceUrl } : memory;
    }

    function filterPublicMemories(memories) {
        if (!Array.isArray(memories)) return [];
        return memories
            .filter(m => m.id !== 'root' && m.visibility === 'public')
            .map(normalizePublicMemory);
    }

    function groupMemoriesByTree(memories) {
        const grouped = {};
        memories.forEach(m => {
            const tid = m.treeId || 'ungrouped';
            if (!grouped[tid]) grouped[tid] = [];
            grouped[tid].push(m);
        });
        return grouped;
    }

    function estimateStage(count) {
        if (count <= 2) return '입덕';
        if (count <= 4) return '성장';
        return '최애';
    }

    function extractTheme(memories) {
        if (!memories || memories.length === 0) return 'Mixed';
        return memories[0].artist || 'Mixed';
    }

    function calculateTimeRange(memories) {
        if (!memories || memories.length === 0) return 'recently';
        const timestamps = memories.map(m => m.timestamp).filter(Boolean);
        if (timestamps.length < 2) return timestamps[0] || 'recently';
        return `${timestamps[0]} ~ ${timestamps[timestamps.length - 1]}`;
    }

    function collectEmotionTags(memories) {
        if (!memories || memories.length === 0) return [];
        const allTags = [];
        memories.forEach(m => {
            let tags = [];
            if (window.LoveBudNormalize?.normalizeMemory) {
                const normalized = window.LoveBudNormalize.normalizeMemory(m);
                tags = window.LoveBudNormalize.normalizeEmotionTags(normalized?.emotionTags) || [];
            } else {
                tags = m.emotionTags || [];
            }
            allTags.push(...tags);
        });
        return [...new Set(allTags)].slice(0, 3);
    }

    function buildTreeData(memories, trees) {
        if (!Array.isArray(trees)) return [];
        const validMemories = filterPublicMemories(memories);
        const grouped = groupMemoriesByTree(validMemories);

        return trees.map(tree => {
            const treeMems = grouped[tree.id] || [];
            const sortedMems = treeMems.sort((a, b) => {
                const timeA = a.timestamp || a.createdAt || 0;
                const timeB = b.timestamp || b.createdAt || 0;
                return new Date(timeA) - new Date(timeB);
            });
            const memoryCount = sortedMems.length;
            const emotionTags = collectEmotionTags(sortedMems);
            const timeRange = calculateTimeRange(sortedMems);
            const theme = extractTheme(sortedMems);
            const stage = estimateStage(memoryCount);
            return {
                ...tree,
                memories: sortedMems,
                memoryCount: memoryCount,
                emotionTags: emotionTags,
                timeRange: timeRange,
                representativeThumbnail: sortedMems[0]?.thumbnail || '',
                representativeSourceUrl: sortedMems[0]?.sourceUrl || '',
                theme: theme,
                stage: stage
            };
        }).filter(t => t.memoryCount > 0);
    }

    function matchesQuery(tree, query) {
        if (!query) return true;
        const q = query.toLowerCase();
        const treeFields = [tree.title, tree.theme, tree.memo].filter(Boolean);
        const memoryFields = tree.memories?.flatMap(m => [m.title, m.artist, m.memo].filter(Boolean)) || [];
        return [...treeFields, ...memoryFields].some(field => field && field.toLowerCase().includes(q));
    }

    function matchesCategory(tree, category) {
        if (category === '전체' || category === '전체 경로') return true;
        return tree.stage === category;
    }

    function filterTrees(trees, query, category) {
        if (!Array.isArray(trees)) return [];
        return trees.filter(t => matchesQuery(t, query) && matchesCategory(t, category));
    }

    window.LoveBudSearchAdapter = {
        buildTreeData: buildTreeData,
        filterTrees: filterTrees,
        matchesQuery: matchesQuery,
        matchesCategory: matchesCategory,
        estimateStage: estimateStage,
        _filterPublicMemories: filterPublicMemories,
        _groupMemoriesByTree: groupMemoriesByTree,
        _calculateTimeRange: calculateTimeRange,
        _collectEmotionTags: collectEmotionTags,
        _normalizePublicMemory: normalizePublicMemory,
        _getYouTubeIdFromThumbnail: getYouTubeIdFromThumbnail
    };

    console.log('[LoveBudSearchAdapter] Search data adapter loaded v20260512-1058-2');
})();
