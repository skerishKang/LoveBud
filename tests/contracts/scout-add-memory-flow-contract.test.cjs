/**
 * Scout Add-Memory Flow Contract Test
 * 
 * Verifies that Scout Draft payload is correctly wired into
 * the existing add-memory form flow.
 * 
 * Phase 1: Manual MVP - no AI/fetch/auto-extraction
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

test('Scout Add-Memory Flow Contract', async () => {
    // Test 1: editor-memory-form.js returns addMemoryFromScoutPayload
    {
        const filePath = path.join(ROOT, 'js', 'editor', 'editor-memory-form.js');
        const source = fs.readFileSync(filePath, 'utf8');
        
        assert.ok(
            source.includes('addMemoryFromScoutPayload'),
            'editor-memory-form.js should export addMemoryFromScoutPayload'
        );
        
        assert.ok(
            source.includes('return {') && 
            source.includes('addMemoryFromScoutPayload'),
            'return object should include addMemoryFromScoutPayload'
        );
        
        assert.ok(
            source.includes('currentInputMode = \'text\''),
            'addMemoryFromScoutPayload should set currentInputMode to text'
        );
        
        assert.ok(
            source.includes('refs.urlInput.value = \'\''),
            'addMemoryFromScoutPayload should clear urlInput'
        );
        
        assert.ok(
            source.includes('Source:') && source.includes('payload.sourceUrl'),
            'addMemoryFromScoutPayload should include sourceUrl in memo attribution'
        );
        
        assert.ok(
            source.includes('Tags:') && source.includes('draft.emotionTags'),
            'addMemoryFromScoutPayload should include emotionTags in memo attribution'
        );
        
        assert.ok(
            source.includes('Saved via LoveBud Scout'),
            'addMemoryFromScoutPayload should include attribution marker'
        );
        
        assert.ok(
            source.includes('await addMemoryFromForm()'),
            'addMemoryFromScoutPayload should delegate to addMemoryFromForm'
        );
        
        assert.ok(
            !source.includes('refs.urlInput.value = payload.sourceUrl'),
            'should NOT put sourceUrl directly into urlInput'
        );
    }
    
    // Test 2: editor.js wires Scout Draft UI with onDraftSave
    {
        const filePath = path.join(ROOT, 'js', 'editor.js');
        const source = fs.readFileSync(filePath, 'utf8');
        
        assert.ok(
            source.includes('addMemoryFromScoutPayload'),
            'editor.js should destructure addMemoryFromScoutPayload from memoryForm'
        );
        
        assert.ok(
            source.includes('LoveBudScoutDraftUI.createScoutDraftUI'),
            'editor.js should call LoveBudScoutDraftUI.createScoutDraftUI'
        );
        
        assert.ok(
            source.includes('onDraftSave: async (payload, draft) =>'),
            'editor.js should pass onDraftSave callback'
        );
        
        assert.ok(
            source.includes('await addMemoryFromScoutPayload(payload, draft)'),
            'onDraftSave should call addMemoryFromScoutPayload'
        );
        
        assert.ok(
            source.includes('window.LoveBudScoutDraftUI.open = function ()'),
            'editor.js should bridge open method'
        );
        
        assert.ok(
            source.includes('window.LoveBudScoutDraftUI.close = function ()'),
            'editor.js should bridge close method'
        );
        
        assert.ok(
            source.includes('window.LoveBudScoutDraftUI.isOpen = function ()'),
            'editor.js should bridge isOpen method'
        );
        
        assert.ok(
            source.includes('getSelectedNodeId: () => selectedNodeId'),
            'should pass selectedNodeId getter'
        );
        
        assert.ok(
            source.includes('getCanonicalRootId: () => canonicalRootId'),
            'should pass canonicalRootId getter'
        );
        
        assert.ok(
            source.includes('resolveParentIdForCreate: deps.resolveParentIdForCreate'),
            'should pass resolveParentIdForCreate'
        );
    }
    
    // Test 3: No AI/fetch/metadata extraction in Scout modules
    {
        const scoutFiles = [
            'js/scout/scout-draft.js',
            'js/scout/scout-draft-ui.js',
            'js/scout/scout-draft-ui.js'
        ];
        
        for (const file of scoutFiles) {
            const filePath = path.join(ROOT, file);
            if (fs.existsSync(filePath)) {
                const source = fs.readFileSync(filePath, 'utf8');
                
                // No AI provider references
                assert.ok(
                    !source.includes('openai') && !source.includes('anthropic') && 
                    !source.includes('gemini') && !source.includes('mistral') &&
                    !source.includes('cohere') && !source.includes('huggingface'),
                    `${file} should not contain AI provider references`
                );
                
                // No fetch/Axios/HTTP calls
                assert.ok(
                    !source.includes('fetch(') && !source.includes('axios') && 
                    !source.includes('XMLHttpRequest'),
                    `${file} should not contain external fetch calls`
                );
                
                // No API key/env references
                assert.ok(
                    !source.includes('API_KEY') && !source.includes('apiKey') &&
                    !source.includes('process.env.'),
                    `${file} should not contain API key/env references`
                );
                
                // No metadata extraction
                assert.ok(
                    !source.includes('extractYouTube') && !source.includes('OpenGraph') &&
                    !source.includes('metatag') && !source.includes('og:'),
                    `${file} should not contain metadata extraction`
                );
            }
        }
    }
    
    // Test 4: editor-floating-toolbar-dropdown.js passes selectedNode as getter
    {
        const filePath = path.join(ROOT, 'js', 'editor', 'editor-floating-toolbar-dropdown.js');
        const source = fs.readFileSync(filePath, 'utf8');
        
        assert.ok(
            source.includes('selectedNode: ctx.selectedNode'),
            'bindToolbarDropdown should pass selectedNode'
        );
        
        assert.ok(
            source.includes('typeof selectedNodeEl === \'function\'') &&
            source.includes('selectedNodeEl = selectedNodeEl()'),
            'bindDropdownEvents should support selectedNode as getter function'
        );
    }
    
    // Test 5: editor-floating-toolbar.js passes function reference
    {
        const filePath = path.join(ROOT, 'js', 'editor', 'editor-floating-toolbar.js');
        const source = fs.readFileSync(filePath, 'utf8');
        
        assert.ok(
            source.includes('selectedNode: getSelectedNodeEl'),
            'should pass getSelectedNodeEl function reference'
        );
        
        assert.ok(
            !source.includes('selectedNode: getSelectedNodeEl()'),
            'should NOT pass stale element (getSelectedNodeEl())'
        );
    }
    
    // Test 6: Scout Draft still has no innerHTML exception
    {
        const filePath = path.join(ROOT, 'js', 'scout', 'scout-draft-ui.js');
        const source = fs.readFileSync(filePath, 'utf8');
        
        // Check that innerHTML is not used in preview rendering
        const innerHTMLMatches = source.match(/\.innerHTML\s*=/g) || [];
        assert.strictEqual(
            innerHTMLMatches.length,
            0,
            'scout-draft-ui.js should not use innerHTML'
        );
        
        // Should use createElement/textContent/appendChild pattern
        assert.ok(
            source.includes('createElement') && source.includes('textContent') && source.includes('appendChild'),
            'should use safe DOM assembly'
        );
    }
});