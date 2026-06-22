/**
 * LoveBud My Trees Mobile Preview Sheet Contract Test
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

test('My Trees loads mobile preview sheet script and integrates correctly', () => {
    const html = fs.readFileSync(path.join(ROOT, 'pages', 'my-trees.html'), 'utf8');
    const controllerJs = fs.readFileSync(path.join(ROOT, 'js', 'my-trees', 'my-trees-mobile-preview-sheet.js'), 'utf8');
    const responsiveCss = fs.readFileSync(path.join(ROOT, 'css', 'my-trees', 'my-trees-preview-hub', 'responsive.css'), 'utf8');

    // Verify script inclusion
    assert.match(
        html,
        /<script src="..\/js\/my-trees\/my-trees-mobile-preview-sheet.js\?v=[^"]+"><\/script>/,
        'pages/my-trees.html must include the script tag for my-trees-mobile-preview-sheet.js'
    );

    // Verify references in JS controller
    assert.match(
        controllerJs,
        /document\.getElementById\(\s*['"]myTreesHubPanel['"]\s*\)/,
        'Controller must reference #myTreesHubPanel ID'
    );
    assert.match(
        controllerJs,
        /document\.getElementById\(\s*['"]myTreesHubClose['"]\s*\)/,
        'Controller must reference #myTreesHubClose ID'
    );

    // Verify overlay/backdrop logic is present
    assert.match(
        controllerJs,
        /document\.createElement\(\s*['"]div['"]\s*\)/,
        'Controller must create overlay element'
    );
    assert.match(
        controllerJs,
        /preview-sheet-overlay/,
        'Controller must use preview-sheet-overlay class'
    );

    // Verify body scroll lock logic is present
    assert.match(
        controllerJs,
        /preview-sheet-open/,
        'Controller must toggle preview-sheet-open class on body'
    );

    // Verify close path only closes the sheet and does NOT automatically clear owner selections
    assert.doesNotMatch(
        controllerJs,
        /closeMobilePreview\(\)\s*\{[\s\S]*?showPlaceholder\(\)/,
        'closeMobilePreview must NOT directly call showPlaceholder()'
    );
    assert.doesNotMatch(
        controllerJs,
        /closeMobilePreview\(\)\s*\{[\s\S]*?markSelectedCard\(/,
        'closeMobilePreview must NOT directly clear selected cards'
    );

    // Verify responsive CSS sets preview-sidebar styles inside media query with scoped selector
    assert.match(
        responsiveCss,
        /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?#myTreesHubPanel\.preview-sidebar[\s\S]*?position:\s*fixed;?[\s\S]*?\}/,
        'CSS must define mobile bottom sheet styles with scoped selector #myTreesHubPanel.preview-sidebar'
    );

    // Confirm owner-only actions are preserved
    assert.match(
        html,
        /id="myTreesHubOpenBtn"/,
        'My Trees must preserve #myTreesHubOpenBtn'
    );
    assert.match(
        html,
        /id="myTreesHubEditBtn"/,
        'My Trees must preserve #myTreesHubEditBtn'
    );
});
