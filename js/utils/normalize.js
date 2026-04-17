/**
 * Memory data normalization utilities
 * 
 * Converts various memory data formats (API flat camelCase, snake_case fallback)
 * into a standardized flat camelCase shape.
 * 
 * Used by: detail.js, editor.js, and any other page handling memory data.
 */

(function (global) {
    'use strict';

    /**
     * Normalize a memory object to standard flat camelCase shape.
     * 
     * @param {Object} mem - Raw memory data from API, cache, or mock
     * @returns {Object|null} Normalized memory object or null if input is falsy
     */
    function normalizeMemory(mem) {
        if (!mem) return null;

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

    // Expose to global scope for browser usage
    global.LoveBudNormalize = {
        normalizeMemory,
        normalizeMemoryList
    };

})(typeof window !== 'undefined' ? window : global);
