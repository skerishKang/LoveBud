/**
 * LoveBud Search Data Adapter
 * v20260418-1
 *
 * Data processing layer: transforms raw memories/trees into tree view models.
 * UI-agnostic - focuses on data transformation only.
 */

// 1. /api/community/trees camelCase-only
// 2. /api/community/memories camelCase-only
// 3. mock browse camelCase-only

(function() {
    'use strict';

    /**
     * Validates and filters public memories
     * @param {Array} memories - Raw memories array
     * @returns {Array} Filtered public memories (excludes 'root' and non-public)
     */
    function filterPublicMemories(memories) {
        if (!Array.isArray(memories)) return [];
        return memories.filter(m => m.id !== 'root' && m.visibility === 'public');
    }

    /**
     * Groups memories by treeId
     * @param {Array} memories - Filtered memories
     * @returns {Object} Object with treeId keys and memory arrays
     */
    function groupMemoriesByTree(memories) {
        const grouped = {};
        memories.forEach(m => {
            const tid = m.treeId || 'ungrouped';
            if (!grouped[tid]) grouped[tid] = [];
            grouped[tid].push(m);
        });
        return grouped;
    }

    /**
     * Estimates tree stage based on memory count
     * @param {number} count - Memory count
     * @returns {string} '입덕' | '성장' | '최애'
     */
    function estimateStage(count) {
        if (count <= 2) return '입덕';
        if (count <= 4) return '성장';
        return '최애';
    }

    /**
     * Extracts representative theme from memories
     * @param {Array} memories - Sorted memories
     * @returns {string} Artist name or 'Mixed'
     */
    function extractTheme(memories) {
        if (!memories || memories.length === 0) return 'Mixed';
        return memories[0].artist || 'Mixed';
    }

    /**
     * Calculates time range from timestamps
     * @param {Array} memories - Sorted memories
     * @returns {string} Formatted time range
     */
    function calculateTimeRange(memories) {
        if (!memories || memories.length === 0) return 'recently';
        
        const timestamps = memories
            .map(m => m.timestamp)
            .filter(Boolean);
        
        if (timestamps.length < 2) {
            return timestamps[0] || 'recently';
        }
        
        // Assume sorted by timestamp
        return `${timestamps[0]} ~ ${timestamps[timestamps.length - 1]}`;
    }

    /**
     * Collects unique emotion tags from memories (max 3)
     * @param {Array} memories - Sorted memories
     * @returns {Array} Array of unique tags (max 3)
     */
    function collectEmotionTags(memories) {
        if (!memories || memories.length === 0) return [];
        
        const allTags = [];
        memories.forEach(m => {
            // Use LoveBudNormalize if available
            let tags = [];
            if (window.LoveBudNormalize?.normalizeMemory) {
                const normalized = window.LoveBudNormalize.normalizeMemory(m);
                tags = window.LoveBudNormalize.normalizeEmotionTags(normalized?.emotionTags) || [];
            } else {
                tags = m.emotionTags || [];
            }
            allTags.push(...tags);
        });
        
        // Dedupe and limit to 3
        const unique = [...new Set(allTags)];
        return unique.slice(0, 3);
    }

    /**
     * Builds tree view models from raw memories and trees
     * 
     * @param {Array} memories - Raw memories from API/mock
     * @param {Array} trees - Raw trees from API/mock
     * @returns {Array} Array of tree view models ready for rendering
     */
    function buildTreeData(memories, trees) {
        if (!Array.isArray(trees)) return [];
        
        // Filter and group memories
        const validMemories = filterPublicMemories(memories);
        const grouped = groupMemoriesByTree(validMemories);
        
        return trees.map(tree => {
            const treeMems = grouped[tree.id] || [];
            
            // Sort by timestamp
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
                theme: theme,
                stage: stage
            };
        }).filter(t => t.memoryCount > 0);
    }

    // ─────────────────────────────────────────────────────────
    // Filter Logic (search-specific, but UI-agnostic)
    // ─────────────────────────────────────────────────────────

    /**
     * Checks if tree matches search query
     * @param {Object} tree - Tree view model
     * @param {string} query - Search query
     * @returns {boolean}
     */
    function matchesQuery(tree, query) {
        if (!query) return true;
        
        const q = query.toLowerCase();
        
        // Search tree fields
        const treeFields = [tree.title, tree.theme, tree.memo].filter(Boolean);
        
        // Search memory fields
        const memoryFields = tree.memories?.flatMap(m => 
            [m.title, m.artist, m.memo].filter(Boolean)
        ) || [];
        
        return [...treeFields, ...memoryFields].some(field =>
            field && field.toLowerCase().includes(q)
        );
    }

    /**
     * Checks if tree matches category/stage filter
     * @param {Object} tree - Tree view model
     * @param {string} category - Category ('전체', '입덕', '성장', '최애')
     * @returns {boolean}
     */
    function matchesCategory(tree, category) {
        if (category === '전체' || category === '전체 경로') return true;
        return tree.stage === category;
    }

    /**
     * Filters trees by query and category
     * @param {Array} trees - Tree view models
     * @param {string} query - Search query
     * @param {string} category - Category filter
     * @returns {Array} Filtered trees
     */
    function filterTrees(trees, query, category) {
        if (!Array.isArray(trees)) return [];
        
        return trees.filter(t =>
            matchesQuery(t, query) && matchesCategory(t, category)
        );
    }

    // ─────────────────────────────────────────────────────────
    // Exports
    // ─────────────────────────────────────────────────────────

    window.LoveBudSearchAdapter = {
        buildTreeData: buildTreeData,
        filterTrees: filterTrees,
        matchesQuery: matchesQuery,
        matchesCategory: matchesCategory,
        estimateStage: estimateStage,
        // Exported for testing/debugging
        _filterPublicMemories: filterPublicMemories,
        _groupMemoriesByTree: groupMemoriesByTree,
        _calculateTimeRange: calculateTimeRange,
        _collectEmotionTags: collectEmotionTags
    };

    console.log('[LoveBudSearchAdapter] Search data adapter loaded v20260418-1');
})();