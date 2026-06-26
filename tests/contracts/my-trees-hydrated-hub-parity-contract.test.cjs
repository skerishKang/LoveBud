'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('My Trees hydrated flow stage uses shared preview-flow-stage class', () => {
  const stateJs = read('js/my-trees/my-trees-preview-state.js');
  assert.match(
    stateJs,
    /class="my-trees-hub-flow-stage preview-flow-stage' \+ activeClass \+ '"/,
    'buildFlowStages must emit stage with both my-trees-hub-flow-stage and preview-flow-stage classes'
  );
});

test('My Trees hydrated flow stage has role="button" tabindex="0" and data-my-trees-moment-index', () => {
  const stateJs = read('js/my-trees/my-trees-preview-state.js');
  assert.match(
    stateJs,
    /role="button" tabindex="0" data-my-trees-moment-index="' \+ stageIndex \+ '"/,
    'buildFlowStages must emit stage with role, tabindex, and data attr'
  );
});

test('My Trees hydrated flow stage label uses shared preview-flow-stage-label class', () => {
  const stateJs = read('js/my-trees/my-trees-preview-state.js');
  assert.match(
    stateJs,
    /class="my-trees-hub-flow-stage-label preview-flow-stage-label"/,
    'buildFlowStages must emit label with both my-trees-hub-flow-stage-label and preview-flow-stage-label classes'
  );
});

test('My Trees hydrated flow stage label has title and aria-label', () => {
  const stateJs = read('js/my-trees/my-trees-preview-state.js');
  assert.match(
    stateJs,
    /my-trees-hub-flow-stage-label[^"]*"\s+title="[^"]*"\s+aria-label="[^"]*"/,
    'stage label must include both title and aria-label'
  );
});

test('My Trees hydrated flow toggle uses shared preview-flow-toggle class', () => {
  const stateJs = read('js/my-trees/my-trees-preview-state.js');
  assert.match(
    stateJs,
    /flowToggle\.className\s*=\s*['"]my-trees-hub-flow-toggle preview-flow-toggle['"]/,
    'buildFlowToggle must emit toggle with both my-trees-hub-flow-toggle and preview-flow-toggle classes'
  );
});

test('My Trees hydrated flow toggle has data-my-trees-flow-toggle', () => {
  const stateJs = read('js/my-trees/my-trees-preview-state.js');
  assert.match(
    stateJs,
    /flowToggle\.setAttribute\(\s*['"]data-my-trees-flow-toggle['"]\s*,\s*['"]['"]\s*\)/,
    'buildFlowToggle must emit toggle with data-my-trees-flow-toggle attribute'
  );
});

test('My Trees hydrated flow toggle is created as button element', () => {
  const stateJs = read('js/my-trees/my-trees-preview-state.js');
  assert.match(
    stateJs,
    /document\.createElement\(\s*['"]button['"]\s*\)/,
    'buildFlowToggle must create a button element'
  );
});

test('My Trees hydrated flow toggle sets type="button"', () => {
  const stateJs = read('js/my-trees/my-trees-preview-state.js');
  assert.match(
    stateJs,
    /flowToggle\.type\s*=\s*['"]button['"]/,
    'buildFlowToggle must set button type attribute'
  );
});