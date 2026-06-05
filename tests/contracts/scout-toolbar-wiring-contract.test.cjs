/**
 * Scout Toolbar Wiring Contract Test
 * 
 * Verifies that the floating toolbar dropdown correctly forwards
 * scoutAction and selectedNode to bindDropdownEvents.
 * 
 * Phase 1: Manual MVP - no AI/fetch/auto-extraction
 * 
 * This test uses static analysis of the source code to verify wiring.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

test('Scout Toolbar Wiring Contract - Source Code Analysis', () => {
    // Read the dropdown module source
    const dropdownPath = path.join(ROOT, 'js', 'editor', 'editor-floating-toolbar-dropdown.js');
    const dropdownSource = fs.readFileSync(dropdownPath, 'utf8');
    
    // Test 1: bindToolbarDropdown function signature includes scoutAction and selectedNode
    {
        assert.ok(
            dropdownSource.includes('scoutAction: ctx.scoutAction'),
            'bindToolbarDropdown should pass scoutAction to bindDropdownEvents'
        );
        
        assert.ok(
            dropdownSource.includes('selectedNode: ctx.selectedNode'),
            'bindToolbarDropdown should pass selectedNode to bindDropdownEvents'
        );
        
        // Check JSDoc includes the new params
        assert.ok(
            dropdownSource.includes('@param {HTMLElement} [ctx.scoutAction]'),
            'JSDoc should document scoutAction parameter'
        );
        
        assert.ok(
            dropdownSource.includes('@param {Function|HTMLElement} [ctx.selectedNode]'),
            'JSDoc should document selectedNode parameter'
        );
    }
    
    // Test 2: bindDropdownEvents handles scoutAction click
    {
        assert.ok(
            dropdownSource.includes('if (scoutAction)'),
            'bindDropdownEvents should check for scoutAction'
        );
        
        assert.ok(
            dropdownSource.includes('scoutAction.addEventListener'),
            'bindDropdownEvents should add click listener to scoutAction'
        );
        
        assert.ok(
            dropdownSource.includes('window.LoveBudScoutDraftUI.open'),
            'scoutAction click should call LoveBudScoutDraftUI.open'
        );
        
        // Check that selectedNode getter function is supported
        assert.ok(
            dropdownSource.includes('typeof selectedNodeEl === \'function\''),
            'bindDropdownEvents should support selectedNode as getter function'
        );
        
        assert.ok(
            dropdownSource.includes('selectedNodeEl = selectedNodeEl()'),
            'bindDropdownEvents should call selectedNode getter function'
        );
        
        assert.ok(
            dropdownSource.includes('selectedNodeEl.dataset.id'),
            'should extract data-id from selected node element'
        );
    }
    
    // Test 3: editor-floating-toolbar.js passes function reference
    {
        const toolbarPath = path.join(ROOT, 'js', 'editor', 'editor-floating-toolbar.js');
        const toolbarSource = fs.readFileSync(toolbarPath, 'utf8');
        
        assert.ok(
            toolbarSource.includes('selectedNode: getSelectedNodeEl'),
            'editor-floating-toolbar.js should pass getSelectedNodeEl function reference, not call it'
        );
        
        assert.ok(
            !toolbarSource.includes('selectedNode: getSelectedNodeEl()'),
            'should NOT pass stale element (getSelectedNodeEl())'
        );
        
        assert.ok(
            toolbarSource.includes('scoutAction: scoutAction'),
            'should pass scoutAction to bindToolbarDropdown'
        );
    }
    
    // Test 4: getSelectedNodeEl function exists and is exported
    {
        const toolbarPath = path.join(ROOT, 'js', 'editor', 'editor-floating-toolbar.js');
        const toolbarSource = fs.readFileSync(toolbarPath, 'utf8');
        
        assert.ok(
            toolbarSource.includes('function getSelectedNodeEl()'),
            'getSelectedNodeEl function should exist'
        );
        
        assert.ok(
            toolbarSource.includes('window.LoveBudFloatingToolbarSelection'),
            'should delegate to LoveBudFloatingToolbarSelection helper'
        );
    }
});

test('Scout Toolbar Wiring Contract - Module Loading', async () => {
    // Simple test that modules can be loaded without syntax errors
    const modules = [
        'js/editor/editor-floating-toolbar-elements.js',
        'js/editor/editor-floating-toolbar-dropdown.js',
        'js/editor/editor-floating-toolbar.js'
    ];
    
    for (const mod of modules) {
        const filePath = path.join(ROOT, mod);
        const code = fs.readFileSync(filePath, 'utf8');
        
        const vm = require('node:vm');
        const context = {
            window: {},
            document: {
                getElementById: () => null,
                querySelector: () => null,
                querySelectorAll: () => [],
                createElement: () => ({}),
                body: { appendChild: () => {} },
                addEventListener: () => {}
            },
            navigator: { clipboard: { writeText: () => Promise.resolve() } },
            MutationObserver: class { observe() {} disconnect() {} },
            requestAnimationFrame: (cb) => setTimeout(cb, 0),
            console: { log: () => {}, warn: () => {}, error: () => {} },
            URL: URL
        };
        
        vm.createContext(context);
        
        // Should not throw
        vm.runInContext(code, context);
        
        // Verify the module exposes its API
        const moduleName = mod.split('/').pop().replace('.js', '');
        if (moduleName.includes('elements')) {
            assert.ok(context.window.LoveBudFloatingToolbarElements, `${mod} should expose LoveBudFloatingToolbarElements`);
        } else if (moduleName.includes('dropdown')) {
            assert.ok(context.window.LoveBudFloatingToolbarDropdown, `${mod} should expose LoveBudFloatingToolbarDropdown`);
            assert.ok(typeof context.window.LoveBudFloatingToolbarDropdown.bindToolbarDropdown === 'function', 'bindToolbarDropdown should be a function');
        } else if (moduleName.includes('editor-floating-toolbar') && !moduleName.includes('dropdown') && !moduleName.includes('elements')) {
            // Main toolbar module doesn't expose a global API, just initializes
        }
    }
});