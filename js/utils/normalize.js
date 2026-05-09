/**
 * Memory/Tree data normalization utilities
 *
 * Canonical contract target:
 * - flat camelCase response objects
 *
 * Transitional compatibility only:
 * - snake_case fields are still accepted during migration
 * - legacy response compatibility must not be treated as the long-term contract
 * - remove fallback paths after API and cache responses are fully aligned
 *
 * Used by: detail.js, editor.js, and other pages handling memory/tree data.
 */

(function (global) {
    'use strict';

    /**
     * Normalize a memory object to standard flat camelCase shape.
     * 
     * @param {Object} mem - Raw memory data from API or cache
     * @returns {Object|null} Normalized memory object or null if input is falsy
     */
    function normalizeMemory(mem) {
        if (!mem) return null;

        // Transitional fallback block:
        // Accept legacy snake_case fields during migration.
        // New code and server responses must prefer flat camelCase only.
        return {
            id: mem.id,
            treeId: mem.treeId || mem.tree_id || null,
            parentId: mem.parentId ?? mem.parent_id ?? null,
            title: mem.title || '',
            memo: mem.memo || mem.description || '',
            quote: mem.quote || '',
            timestamp: mem.timestamp || '',
            thumbnail: mem.thumbnail || '',
            visibility: mem.visibility || 'private',
            artist: mem.artist || '',
            source: mem.source || '',
            sourceUrl: mem.sourceUrl || mem.source_url || '',
            sourceType: mem.sourceType || mem.source_type || 'youtube',
            emotionTags: mem.emotionTags || mem.emotion_tags || [],
            createdAt: mem.createdAt || mem.created_at || null,
            updatedAt: mem.updatedAt || mem.updated_at || null,
            // Editor-specific fields (optional, undefined if not present)
            delay: mem.delay,
            x: mem.x,
            y: mem.y
        };
    }

    /**
     * Normalize a list of memories.
     *
     * @param {Array} memories - Array of raw memory objects
     * @returns {Array} Array of normalized memory objects (null items filtered out)
     */
    function normalizeMemoryList(memories) {
        if (!Array.isArray(memories)) return [];
        return memories.map(normalizeMemory).filter(Boolean);
    }

    /**
     * Normalize a tree object to standard flat camelCase shape.
     *
     * @param {Object} tree - Raw tree data from API or cache
     * @returns {Object|null} Normalized tree object or null if input is falsy
     */
    function normalizeTree(tree) {
        if (!tree) return null;

        // Transitional fallback block:
        // Accept legacy snake_case fields during migration.
        // New code and server responses must prefer flat camelCase only.
        return {
            id: tree.id,
            userId: tree.userId || tree.user_id || null,
            title: tree.title || '나의 러브트리',
            visibility: tree.visibility || 'private',
            createdAt: tree.createdAt || tree.created_at || null,
            updatedAt: tree.updatedAt || tree.updated_at || null,
            memoryCount: tree.memoryCount || tree.memory_count || 0,
            isArchived: tree.isArchived || tree.is_archived || false
        };
    }

    /**
     * Normalize a list of trees.
     *
     * @param {Array} trees - Array of raw tree objects
     * @returns {Array} Array of normalized tree objects (null items filtered out)
     */
    function normalizeTreeList(trees) {
        if (!Array.isArray(trees)) return [];
        return trees.map(normalizeTree).filter(Boolean);
    }

    /**
     * Normalize emotion tags array (dedupe, filter empty).
     *
     * @param {Array} tags - Raw tags array
     * @returns {Array} Normalized tags array
     */
    function normalizeEmotionTags(tags) {
        if (!Array.isArray(tags)) return [];
        return [...new Set(tags.filter(Boolean))];
    }

    // Expose to global scope for browser usage
    global.LoveBudNormalize = {
        normalizeMemory,
        normalizeMemoryList,
        normalizeTree,
        normalizeTreeList,
        normalizeEmotionTags
    };

})(typeof window !== 'undefined' ? window : global);
