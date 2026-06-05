/**
 * Scout Draft Suggestion UI Contract Tests
 * Phase 2: Stub provider wiring verification
 *
 * Guardrails:
 * - No innerHTML/dangerouslySetInnerHTML in UI code
 * - No network calls (fetch/XMLHttpRequest/axios)
 * - No real AI provider (only stub provider)
 * - User review required before save (no auto-save)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const EDITOR_UI_PATH = path.join(__dirname, '../../js/scout/scout-draft-ui.js');
const PROVIDER_PATH = path.join(__dirname, '../../js/scout/scout-suggestion-provider.js');

// ─── Helper Functions ───────────────────────────────────────────────────────────

function readFileSafe(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        return '';
    }
}

// ─── Test Suite ────────────────────────────────────────────────────────────────

console.log('🧪 Scout Draft Suggestion UI Contracts\n');

// Test 1: AI Suggestion button renders in dynamically created modal
{
    const ui = readFileSafe(EDITOR_UI_PATH);
    const buttonPattern = /scoutDraftSuggestBtn/;
    const suggestLabel = /AI 제안 받기|scout_suggest_btn/;
    
    assert.ok(ui.includes('suggestBtn'), 'editor-ui should have suggestBtn ref');
    assert.ok(buttonPattern.test(ui), 'editor-ui should reference suggestDraftSuggestBtn ID');
    assert.ok(suggestLabel.test(ui), 'editor-ui should have Korean label "AI 제안 받기"');
    
    // Verify button is in createModalInDOM
    const createModalPattern = /createModalInDOM[\s\S]*?suggestBtn/;
    assert.ok(createModalPattern.test(ui), 'suggestBtn should be created in createModalInDOM');
    
    console.log('  ✅ AI 제안 받기 button renders in dynamically created modal');
}

// Test 2: Suggestion state management exists
{
    const ui = readFileSafe(EDITOR_UI_PATH);
    
    assert.ok(ui.includes('suggestionState'), 'UI should have suggestionState variable');
    assert.ok(ui.includes('setSuggestionState'), 'UI should have setSuggestionState function');
    assert.ok(ui.includes("state === 'loading'"), 'UI should handle loading state');
    assert.ok(ui.includes("state === 'success'"), 'UI should handle success state');
    assert.ok(ui.includes("state === 'error'"), 'UI should handle error state');
    assert.ok(ui.includes("state === 'unavailable'"), 'UI should handle unavailable state');
    
    console.log('  ✅ Suggestion state management implemented');
}

// Test 3: No innerHTML usage in suggestion-related code
{
    const ui = readFileSafe(EDITOR_UI_PATH);
    
    // Find innerHTML usages - should only be comments
    const innerHtmlMatches = ui.match(/(\.innerHTML\s*=|innerHTML:)/g) || [];
    assert.strictEqual(innerHtmlMatches.length, 0, 'No innerHTML assignments should exist');
    
    // Verify safe DOM methods are used
    assert.ok(ui.includes('.textContent'), 'Should use textContent for text');
    assert.ok(ui.includes('.value'), 'Should use value property for inputs');
    
    console.log('  ✅ No innerHTML usage in suggestion UI code');
}

// Test 4: No network calls in scout-draft-ui.js
{
    const ui = readFileSafe(EDITOR_UI_PATH);
    
    const networkPatterns = [
        /\bfetch\s*\(/,
        /XMLHttpRequest/,
        /\baxios\b/,
        /\.ajax\s*\(/,
        /\bimport\s+['"]fetch\b/,
    ];
    
    for (const pattern of networkPatterns) {
        assert.ok(!pattern.test(ui), `Should not use network pattern: ${pattern}`);
    }
    
    console.log('  ✅ No network calls in scout-draft-ui.js');
}

// Test 5: Stub provider is used, not real AI provider
{
    const ui = readFileSafe(EDITOR_UI_PATH);
    const provider = readFileSafe(PROVIDER_PATH);
    
    // UI should reference the stub provider
    assert.ok(ui.includes('createScoutStubSuggestionProvider'), 'UI should use stub provider');
    
    // Provider should have stub markers
    assert.ok(provider.includes('STUB'), 'Provider should have STUB marking');
    assert.ok(provider.includes('Phase 2'), 'Provider should mark Phase 2');
    
    // No real AI provider imports/usage
    const realAiPatterns = [
        /openai/i,
        /anthropic/i,
        /claude/i,
        /gemini/i,
        /nvidia/i,
        /mistral/i,
        /process\.env\./,
        /apiKey/i,
        /api_key/i,
    ];
    
    for (const pattern of realAiPatterns) {
        assert.ok(!pattern.test(ui), `UI should not reference real AI provider: ${pattern}`);
    }
    
    console.log('  ✅ Stub provider used, no real AI provider references');
}

// Test 6: Suggestions apply to fields, no auto-save
{
    const ui = readFileSafe(EDITOR_UI_PATH);
    
    // Verify suggestions are applied to editable fields
    assert.ok(ui.includes('refs.excerptTextarea.value'), 'Should apply suggestion to excerpt textarea');
    assert.ok(ui.includes('refs.memoTextarea.value'), 'Should apply suggestion to memo textarea');
    assert.ok(ui.includes('refs.emotionTagsInput.value'), 'Should apply suggestion to emotion tags input');
    
    // No auto-save after suggestion (should not call onDraftSave directly in handleSuggest)
    const handleSuggest = ui.match(/async\s*function\s*handleSuggest[\s\S]*?}\s*}/);
    assert.ok(handleSuggest, 'handleSuggest function should exist');
    
    const handleSuggestContent = handleSuggest[0];
    
    // Should NOT auto-save
    assert.ok(!handleSuggestContent.includes('onDraftSave('), 'handleSuggest should NOT call onDraftSave');
    assert.ok(!handleSuggestContent.includes('closeModal('), 'handleSuggest should NOT auto-close modal');
    assert.ok(!handleSuggestContent.includes('showToast('), 'handleSuggest should NOT auto-show save toast');
    
    console.log('  ✅ Suggestions apply to fields, no auto-save behavior');
}

// Test 7: User review required - manual save still available
{
    const ui = readFileSafe(EDITOR_UI_PATH);
    
    // Save button should still exist and be wired
    assert.ok(ui.includes('refs.saveBtn.onclick = handleSave'), 'Save button should be wired in openModal');
    assert.ok(ui.includes('function handleSave'), 'handleSave function should exist');
    
    console.log('  ✅ Manual save flow preserved for user review');
}

// Test 8: Provider input normalization used
{
    const ui = readFileSafe(EDITOR_UI_PATH);
    
    assert.ok(ui.includes('requestedLanguage'), 'Should pass requestedLanguage to provider');
    assert.ok(ui.includes('desiredTone'), 'Should pass desiredTone to provider');
    assert.ok(ui.includes('maxOutputLength'), 'Should pass maxOutputLength to provider');
    
    console.log('  ✅ Provider input normalization used');
}

// Test 9: Safe fallback when provider unavailable
{
    const ui = readFileSafe(EDITOR_UI_PATH);
    
    assert.ok(ui.includes('unavailable'), 'Should handle unavailable state');
    assert.ok(ui.includes('AI 제안을 불러오지 못했습니다'), 'Should have Korean fallback message');
    
    console.log('  ✅ Safe fallback when provider unavailable');
}

// Test 10: Suggestion feedback area in DOM
{
    const ui = readFileSafe(EDITOR_UI_PATH);
    const css = readFileSafe(path.join(__dirname, '../../css/scout/scout-draft.css'));
    
    assert.ok(ui.includes('scoutSuggestFeedback'), 'Should have suggestFeedback ref');
    assert.ok(ui.includes('suggestFeedback'), 'Should reference suggestFeedback element');
    
    // CSS for feedback area
    assert.ok(css.includes('.scout-suggest-feedback'), 'CSS should style suggestion feedback area');
    
    console.log('  ✅ Suggestion feedback area in DOM and CSS');
}

console.log('\n✅ All Scout Draft Suggestion UI contracts passed.');
console.log('Guardrails verified: no innerHTML, no network, no real AI provider, no auto-save.\n');