/**
 * Scout Draft Validation Contract Test
 * 
 * Verifies that Scout Draft validation correctly rejects empty drafts
 * and accepts valid drafts with at least one content field.
 * 
 * Phase 1: Manual MVP - no AI/fetch/auto-extraction
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCOUT_DRAFT_PATH = path.join(ROOT, 'js', 'scout', 'scout-draft.js');

// Load the Scout Draft module
function loadScoutDraft() {
    const code = fs.readFileSync(SCOUT_DRAFT_PATH, 'utf8');
    const vm = require('node:vm');
    const context = {
        window: {},
        console: { log: () => {}, warn: () => {} },
        URL: URL
    };
    vm.createContext(context);
    vm.runInContext(code, context);
    return context.window.LoveBudScoutDraft;
}

test('Scout Draft Validation Contract', async () => {
    const ScoutDraft = loadScoutDraft();
    
    // Test 1: Empty sourceUrl + empty excerpt + empty memo → reject
    {
        const result = ScoutDraft.buildScoutDraft({
            sourceUrl: '',
            excerpt: '',
            memo: '',
            emotionTags: [],
            treeId: 'test-tree'
        });
        assert.strictEqual(result.ok, false, 'should reject completely empty draft');
        assert.strictEqual(result.field, 'sourceUrl');
        assert.ok(result.message.includes('출처 링크나 저장할 내용'), 'should have Korean error message');
    }
    
    // Test 2: Whitespace-only inputs → reject
    {
        const result = ScoutDraft.buildScoutDraft({
            sourceUrl: '   ',
            excerpt: '   ',
            memo: '   ',
            emotionTags: [],
            treeId: 'test-tree'
        });
        assert.strictEqual(result.ok, false, 'should reject whitespace-only draft');
    }
    
    // Test 3: sourceUrl only → ok
    {
        const result = ScoutDraft.buildScoutDraft({
            sourceUrl: 'https://example.com/video',
            excerpt: '',
            memo: '',
            emotionTags: [],
            treeId: 'test-tree'
        });
        assert.strictEqual(result.ok, true, 'should accept draft with only sourceUrl');
        assert.strictEqual(result.data.sourceUrl, 'https://example.com/video');
        assert.strictEqual(result.data.readyForSave, true);
    }
    
    // Test 4: excerpt only → ok
    {
        const result = ScoutDraft.buildScoutDraft({
            sourceUrl: '',
            excerpt: '이것은 발췌문입니다.',
            memo: '',
            emotionTags: [],
            treeId: 'test-tree'
        });
        assert.strictEqual(result.ok, true, 'should accept draft with only excerpt');
        assert.strictEqual(result.data.excerpt, '이것은 발췌문입니다.');
    }
    
    // Test 5: memo only → ok
    {
        const result = ScoutDraft.buildScoutDraft({
            sourceUrl: '',
            excerpt: '',
            memo: '내 메모입니다.',
            emotionTags: [],
            treeId: 'test-tree'
        });
        assert.strictEqual(result.ok, true, 'should accept draft with only memo');
        assert.strictEqual(result.data.memo, '내 메모입니다.');
    }
    
    // Test 6: Invalid URL → reject
    {
        const result = ScoutDraft.buildScoutDraft({
            sourceUrl: 'not-a-url',
            excerpt: '',
            memo: '',
            emotionTags: [],
            treeId: 'test-tree'
        });
        assert.strictEqual(result.ok, false, 'should reject invalid URL');
        assert.strictEqual(result.field, 'sourceUrl');
    }
    
    // Test 7: Valid URL + excerpt + memo → ok
    {
        const result = ScoutDraft.buildScoutDraft({
            sourceUrl: 'https://youtube.com/watch?v=abc123',
            excerpt: '핵심 내용 요약',
            memo: '개인 메모',
            emotionTags: ['감동', '행복'],
            treeId: 'test-tree'
        });
        assert.strictEqual(result.ok, true, 'should accept complete draft');
        assert.strictEqual(result.data.emotionTags.length, 2);
        assert.deepStrictEqual(result.data.emotionTags, ['감동', '행복']);
    }
    
    // Test 8: Emotion tags trim/filter/max 4 유지
    {
        const result = ScoutDraft.buildScoutDraft({
            sourceUrl: 'https://example.com',
            excerpt: '',
            memo: '',
            emotionTags: ['  태그1  ', '', '태그2', '태그3', '태그4', '태그5', '태그6'],
            treeId: 'test-tree'
        });
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.data.emotionTags.length, 4, 'should limit to 4 tags');
        assert.deepStrictEqual(result.data.emotionTags, ['태그1', '태그2', '태그3', '태그4']);
    }
    
    // Test 9: Emotion tag too long → reject
    {
        const result = ScoutDraft.buildScoutDraft({
            sourceUrl: 'https://example.com',
            excerpt: '',
            memo: '',
            emotionTags: ['이 태그는 스무 자를 초과하는 매우 긴 태그입니다'],
            treeId: 'test-tree'
        });
        assert.strictEqual(result.ok, false, 'should reject tag > 20 chars');
        assert.strictEqual(result.field, 'emotionTags');
    }
    
    // Test 10: sourceUrl with http/https only
    {
        const httpResult = ScoutDraft.buildScoutDraft({
            sourceUrl: 'http://example.com',
            excerpt: '',
            memo: '',
            emotionTags: [],
            treeId: 'test-tree'
        });
        assert.strictEqual(httpResult.ok, true, 'should accept http URL');
        
        const httpsResult = ScoutDraft.buildScoutDraft({
            sourceUrl: 'https://example.com',
            excerpt: '',
            memo: '',
            emotionTags: [],
            treeId: 'test-tree'
        });
        assert.strictEqual(httpsResult.ok, true, 'should accept https URL');
        
        const ftpResult = ScoutDraft.buildScoutDraft({
            sourceUrl: 'ftp://example.com',
            excerpt: '',
            memo: '',
            emotionTags: [],
            treeId: 'test-tree'
        });
        assert.strictEqual(ftpResult.ok, false, 'should reject ftp URL');
    }
});