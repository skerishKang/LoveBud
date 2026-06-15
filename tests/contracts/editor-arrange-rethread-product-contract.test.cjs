'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const docPath = 'docs/product/lovebud-editor-arrange-rethread-product-contract.md';
const editorCanvasPath = 'js/editor/editor-canvas.js';

test('arrange and rethread are clearly distinguished as separate concepts', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /## Definitions/, 'document must have a definitions section');
  assert.match(doc, /### Arrange/, 'arrange must be defined as its own section');
  assert.match(doc, /### Rethread/, 'rethread must be defined as its own section');
  assert.match(doc, /visual-only canvas layout/, 'arrange must be defined as visual-only');
  assert.match(doc, /saved LoveTree flow\/edge/, 'rethread must be defined as edge-mutating');
});

test('arrange must explicitly forbid saved edge mutation', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /modify saved parent\/child edge/, 'arrange must explicitly forbid edge mutation');
  assert.match(doc, /must not.*saved edge/i, 'document must state arrange may not mutate saved edges');
});

test('rethread must require preview and confirm', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /preview.*confirm|confirm.*preview/i, 'rethread must require preview and confirm');
  assert.match(doc, /destructive\/structural/, 'rethread must be described as destructive/structural');
});

test('doc must distinguish remembered date from content date', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /Remembered date/i, 'document must define remembered date');
  assert.match(doc, /Content date/i, 'document must define content date');
  assert.ok(
    doc.indexOf('Remembered date') !== doc.indexOf('Content date'),
    'remembered date and content date must be separate definitions'
  );
});

test('LoveTree edge must be described as emotional/story flow', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /emotional\/story flow/i, 'LoveTree edge must be defined as emotional/story flow');
});

test('editor-canvas.js runtime implementation is explicitly deferred by this contract', () => {
  const source = fs.readFileSync(editorCanvasPath, 'utf8');
  const doc = fs.readFileSync(docPath, 'utf8');
  const stat = fs.statSync(editorCanvasPath);

  assert.ok(stat.size > 0, 'editor-canvas.js must still exist');
  assert.match(doc, /editor-canvas\.js runtime modification:\s*none/i,
    'status must record no editor-canvas.js runtime modification');
  assert.match(doc, /editor-canvas\.js may not be modified/i,
    'implementation gate must explicitly defer editor-canvas.js changes');
  assert.doesNotMatch(source, /arrange-rethread|rethread|arrange controls|rethread controls/i,
    'editor-canvas.js must not contain arrange/rethread runtime implementation');
});

test('no DB/API/schema/persistence/Scout/provider/Browse/Search changes are allowed', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /Database\/schema migration:\s*none/i,
    'status must record no database/schema migration');
  assert.match(doc, /API behavior change:\s*none/i,
    'status must record no API behavior change');
  assert.match(doc, /No DB\/API\/schema changes/i,
    'implementation gate must forbid DB/API/schema changes');
  assert.match(doc, /No Browse\/Search behavior changes/i,
    'implementation gate must forbid Browse/Search changes');
  assert.match(doc, /No Scout\/provider\/AI integration/i,
    'implementation gate must forbid Scout/provider/AI integration');
});

test('Obsidian or relationship graph expansion must be explicitly forbidden in the document', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /No expansion into.*relationship graph|must not.*expand.*relationship graph/i,
    'document must explicitly forbid expansion into relationship graph features');
  assert.match(doc, /Obsidian/i,
    'document must reference Obsidian when forbidding expansion');
});

test('no merge with #2464 or #2465 work is allowed', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /#2464/i, 'document must reference #2464 boundary');
  assert.match(doc, /#2465/i, 'document must reference #2465 boundary');
  assert.match(doc, /No merge with #2464.*#2465/i,
    'contract must explicitly keep #2464/#2465 work separate');
  assert.doesNotMatch(doc, /editor-rename-ui|editor-sidebar-template|editor-overrides\.css|momentReactionsCard|editor-reaction-label|ftbBranchBtn/i,
    'contract must not absorb #2464/#2465 runtime implementation details');
});

test('#2471 closure condition is met by this docs/contracts slice', () => {
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.match(doc, /closure/i, 'document must address issue closure');
  assert.match(doc, /may be closed/i, 'document must recommend closure of #2471');
  assert.match(doc, /further.*runtime.*follow-up/i, 'document must defer runtime work to follow-up issues');
});
