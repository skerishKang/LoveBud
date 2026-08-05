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
    const provider = readFileSafe(PROVIDER_PATH);

    assert.ok(ui.includes('getScoutSuggestionAvailability'), 'UI should check provider availability');
    assert.ok(ui.includes('pending_configuration') || provider.includes('pending_configuration'), 'unavailable/pending boundary should exist');
    assert.ok(ui.includes('scout_suggest_pending') || ui.includes('scout_suggest_unavailable'), 'Should reference pending/unavailable fallback messages');

    console.log(' ✅ Safe fallback when provider unavailable');
}

// Test 10: Provider is resolved lazily at interaction time (no eval-time capture)
{
    const ui = readFileSafe(EDITOR_UI_PATH);

    // The evaluation-time capture was the real-page blocker: it froze the
    // provider to undefined because scout-suggestion-provider.js loads after
    // scout-draft-ui.js on the actual Editor page (issue #3907 B1).
    assert.ok(
        !/const ScoutDraft = window\.LoveBudScoutDraft;\s*\n\s*const ScoutSuggestionProvider = window\.LoveBudScoutSuggestionProvider;/.test(ui),
        'UI must NOT capture the provider at module evaluation time'
    );
    assert.ok(
        ui.includes('const ScoutSuggestionProvider = window.LoveBudScoutSuggestionProvider;'),
        'UI must lazily resolve the provider inside handleSuggest'
    );
    // The lazy lookup must live inside the handler scope, not the module body.
    const handleSuggestMatch = ui.match(/async\s*function\s*handleSuggest\s*\([\s\S]*?const ScoutSuggestionProvider = window\.LoveBudScoutSuggestionProvider;[\s\S]*?\}\s*}/);
    assert.ok(handleSuggestMatch, 'Lazy provider lookup must be scoped to handleSuggest');

    console.log(' ✅ Provider resolved lazily at interaction time (no eval-time capture)');
}

// Test 11: Modal carries dialog semantics and a stable accessible title binding
{
    const ui = readFileSafe(EDITOR_UI_PATH);

    assert.ok(ui.includes("setAttribute('role', 'dialog')"), 'Modal must declare role=dialog');
    assert.ok(ui.includes("setAttribute('aria-modal', 'true')"), 'Modal must declare aria-modal=true');
    assert.ok(ui.includes("setAttribute('aria-labelledby', 'scoutDraftTitle')"), 'Modal must bind aria-labelledby to the stable title id');
    assert.ok(ui.includes("h2.id = 'scoutDraftTitle'"), 'Modal title <h2> must carry the stable id scoutDraftTitle');

    console.log(' ✅ Modal dialog semantics (role/aria-modal/aria-labelledby) present');
}

// Test 12: Shared LoveBudModalA11y lifecycle is used; no competing custom Escape listener
{
    const ui = readFileSafe(EDITOR_UI_PATH);

    assert.ok(ui.includes('LoveBudModalA11y'), 'UI must use the shared modal accessibility lifecycle');
    assert.ok(ui.includes('modalA11y.open()'), 'Lifecycle must own initial focus and bind on open');
    assert.ok(ui.includes('modalA11y.close()'), 'Lifecycle must unbind on close');
    assert.ok(ui.includes('modalA11y.restoreFocus()'), 'Lifecycle must restore focus on close');
    assert.ok(ui.includes('onFallbackFocus'), 'Lifecycle must have a guarded desktop fallback focus');

    // The shared lifecycle owns Escape. The only remaining custom document
    // Escape listener must be the helper-absent fallback, gated inside the
    // `else` branch of `if (modalA11y) { ... }` — never on the primary path.
    assert.ok(
        ui.indexOf("document.addEventListener('keydown', escHandler)") === -1 ||
        ui.indexOf("} else {") < ui.indexOf("document.addEventListener('keydown', escHandler)"),
        'Custom Escape listener must be the helper-absent fallback only (inside the modalA11y else branch)'
    );

    console.log(' ✅ Shared LoveBudModalA11y lifecycle integrated without a competing custom Escape listener');
}

// Test 13: Suggestion feedback area in DOM
{
    const ui = readFileSafe(EDITOR_UI_PATH);
    const css = readFileSafe(path.join(__dirname, '../../css/scout/scout-draft.css'));
    
    assert.ok(ui.includes('scoutSuggestFeedback'), 'Should have suggestFeedback ref');
    assert.ok(ui.includes('suggestFeedback'), 'Should reference suggestFeedback element');
    
    // CSS for feedback area
    assert.ok(css.includes('.scout-suggest-feedback'), 'CSS should style suggestion feedback area');
    
    console.log(' ✅ Suggestion feedback area in DOM and CSS');
    }

    // Test 11: Unavailable/pending does not auto-save or close modal
    {
       const ui = readFileSafe(EDITOR_UI_PATH);

       const handleSuggest = ui.match(/async\s*function\s+handleSuggest[\s\S]*?}\s*}/);
       assert.ok(handleSuggest, 'handleSuggest function should exist');

       const handleSuggestContent = handleSuggest[0];

       // Ensure unavailable/pending branches do not trigger persistence
       assert.ok(!handleSuggestContent.includes('onDraftSave('), 'handleSuggest unavailable branch should NOT call onDraftSave');
       assert.ok(!handleSuggestContent.includes('closeModal('), 'handleSuggest unavailable branch should NOT close modal');

       console.log(' ✅ Unavailable/pending states do not auto-save or close');
    }

    // Test 12: Suggestion failure preserves manual draft values
    {
        const ui = readFileSafe(EDITOR_UI_PATH);

        // Verify the explicit form reset helper exists for manual resets
        assert.ok(ui.includes('function resetForm'), 'resetForm should exist for explicit form reset');

        // Ensure handleSuggest does not reset the form when suggestion fails
        const handleSuggestMatch = ui.match(/async\s*function\s*handleSuggest\s*\([\s\S]*?^\s*\}\s*\/\//m)
          || ui.match(/async\s*function\s*handleSuggest\s*\([\s\S]*?^\s*\}\s*$/m);
        const handleSuggestBody = handleSuggestMatch ? handleSuggestMatch[0] : '';
        assert.ok(!handleSuggestBody.includes('resetForm()'), 'handleSuggest should not reset form on suggestion failure');

        console.log(' ✅ Suggestion failure preserves manual draft values');
    }

    // Test 13: Manual save flow still exists
    {
       const ui = readFileSafe(EDITOR_UI_PATH);

       assert.ok(ui.includes('function handleSave'), 'handleSave should still exist');
       assert.ok(ui.includes('refs.saveBtn.onclick = handleSave'), 'save button should still be wired');

       console.log(' ✅ Manual save flow preserved');
    }

    // Test 14: No real AI provider usage
    {
       const ui = readFileSafe(EDITOR_UI_PATH);

       const realAiPatterns = [
           /openai/i,
           /anthropic/i,
           /claude/i,
           /gemini/i,
           /groq/i,
           /mistral/i,
           /nvidia ai/i,
           /process\.env\./
       ];

       for (const pattern of realAiPatterns) {
           assert.ok(!pattern.test(ui), `UI should not reference real AI provider: ${pattern}`);
       }

       console.log(' ✅ No real AI provider usage');
    }

console.log('\n✅ All Scout Draft Suggestion UI contracts passed.');
console.log('Guardrails verified: no innerHTML, no network, no real AI provider, no auto-save.\n');