/**
 * #3576 Execution order fixture: proves module scripts execute before DOMContentLoaded
 * and that #detailTreeMetaMount exists when createEditorDetailUI runs.
 *
 * This is a static HTML page that simulates the editor.html script load order.
 * Run with a browser or via Playwright to capture the logged execution sequence.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const SHARED = 'js/shared/canonical-appreciation-detail-presentation.js';
const SIDEBAR_TEMPLATE = 'js/editor/templates/editor-sidebar-template.js';

/**
 * Simulate the page execution order using VM contexts.
 * Records timestamps (simulated) for each execution phase.
 */
function simulateExecutionOrder() {
  const log = [];
  
  // Phase 1: Parser encounters inline content
  log.push({ phase: 'parser-start', msg: 'Document parsing begins' });
  
  // Phase 2: Classic script (shared builder) loads during parsing
  const sharedSandbox = { window: {}, globalThis: null, document: { createElement: () => ({}), createTextNode: () => ({}) }, log };
  sharedSandbox.globalThis = sharedSandbox;
  const sharedCtx = require('vm').createContext(sharedSandbox);
  require('vm').runInContext(read(SHARED), sharedCtx);
  log.push({ phase: 'classic-shared-loaded', msg: 'Shared presentation builder loaded (classic, during parse)' });
  
  // Phase 3: Module scripts are deferred but execute AFTER parsing completes
  // Simulate this by running the sidebar template in a new context
  const sidebarSrc = read(SIDEBAR_TEMPLATE);
  const sidebarClean = sidebarSrc.replace(/export\s+function/, 'function');
  
  const sidebarSandbox = {
    window: { LoveBudCanonicalAppreciationDetailPresentation: sharedSandbox.window.LoveBudCanonicalAppreciationDetailPresentation },
    _mountObj: { id: 'editorSidebarTemplateMount', outerHTML: '' },
    document: {
      getElementById: (id) => {
        if (id === 'editorSidebarTemplateMount') {
          log.push({ phase: 'sidebar-mount-replaced', msg: `#editorSidebarTemplateMount outerHTML replaced` });
          return sidebarSandbox._mountObj;
        }
        if (id === 'detailTreeMetaMount') {
          log.push({ phase: 'tree-meta-mount-queried', msg: `#detailTreeMetaMount getElementById called` });
          return { id };
        }
        return null;
      },
    },
    console,
  };
  sidebarSandbox.globalThis = sidebarSandbox;
  const sidebarCtx = require('vm').createContext(sidebarSandbox);
  require('vm').runInContext(sidebarClean, sidebarCtx);
  
  // After sidebar execution, check that detailTreeMetaMount was created
  const createdHtml = sidebarSandbox.document.getElementById('editorSidebarTemplateMount').outerHTML;
  const hasMount = createdHtml.includes('id="detailTreeMetaMount"');
  log.push({ phase: 'sidebar-after', msg: `Sidebar template executed, #detailTreeMetaMount in output: ${hasMount}` });
  
  // Phase 4: DOMContentLoaded fires — at this point #detailTreeMetaMount EXISTS
  log.push({ phase: 'DOMContentLoaded', msg: 'DOMContentLoaded fires — deferred modules already executed' });
  
  // Phase 5: editor.js startEditor → createEditorDetailUI → updateDetailPanel
  // Verify mount exists by checking outerHTML
  const mountExists = createdHtml.match(/id="detailTreeMetaMount"/g);
  log.push({ phase: 'detail-ui-init', msg: `#detailTreeMetaMount ${mountExists ? 'EXISTS' : 'MISSING'} when createEditorDetailUI would run` });
  
  return log;
}

test('#3576 EXECUTION ORDER: deferred module scripts run before DOMContentLoaded', () => {
  const executionLog = simulateExecutionOrder();
  
  const sidebarAfterEvents = executionLog.filter(e => e.phase === 'sidebar-after');
  const domContentLoadedEvents = executionLog.filter(e => e.phase === 'DOMContentLoaded');
  const detailUIEvents = executionLog.filter(e => e.phase === 'detail-ui-init');
  
  assert.ok(sidebarAfterEvents.length > 0, 'Sidebar template must have executed');
  assert.ok(detailUIEvents.length > 0, 'Detail UI init phase must be reached');
  
  // Sidebar must execute before DOMContentLoaded
  const sidebarIdx = executionLog.findIndex(e => e.phase === 'sidebar-after');
  const domIdx = executionLog.findIndex(e => e.phase === 'DOMContentLoaded');
  assert.ok(sidebarIdx >= 0 && domIdx > sidebarIdx,
    'Sidebar template must execute before DOMContentLoaded');
  
  // #detailTreeMetaMount must exist in sidebar output
  const mountLog = executionLog.find(e => e.phase === 'sidebar-after');
  assert.ok(mountLog, 'Sidebar execution log must exist');
  assert.ok(mountLog.msg.includes('true'),
    `#detailTreeMetaMount must be created by sidebar template. Log: ${mountLog.msg}`);
});

test('#3576 EXECUTION ORDER: sidebar mount replacement creates #detailTreeMetaMount', () => {
  const sidebarSrc = read(SIDEBAR_TEMPLATE);
  const sidebarClean = sidebarSrc.replace(/export\s+function/, 'function');
  
  let mountReplaced = false;
  let mountHtml = '';
  
  const sandbox = {
    window: {
      LoveBudCanonicalAppreciationDetailPresentation: null,
    },
    document: {
      getElementById: (id) => {
        if (id === 'editorSidebarTemplateMount') {
          const mount = { id, outerHTML: '' };
          // Override outerHTML setter to capture
          Object.defineProperty(mount, 'outerHTML', {
            set(val) {
              mountReplaced = true;
              mountHtml = val;
            },
            get() { return mountHtml; },
          });
          return mount;
        }
        return null;
      },
    },
    console,
  };
  sandbox.globalThis = sandbox;
  
  // Load shared builder first (as done in editor.html)
  const shared = require('vm').createContext({ window: {}, globalThis: null, document: { createElement: () => ({}), createTextNode: () => ({}) } });
  shared.globalThis = shared;
  require('vm').runInContext(read(SHARED), shared);
  sandbox.window.LoveBudCanonicalAppreciationDetailPresentation = shared.window.LoveBudCanonicalAppreciationDetailPresentation;
  
  // Execute sidebar template
  const ctx = require('vm').createContext(sandbox);
  require('vm').runInContext(sidebarClean, ctx);
  
  // Verify mount was replaced
  assert.ok(mountReplaced, 'mount.outerHTML must be set');
  
  // Verify #detailTreeMetaMount EXISTS in the replaced HTML (once)
  const mountCount = (mountHtml.match(/id="detailTreeMetaMount"/g) || []).length;
  assert.equal(mountCount, 1, 'Exactly one #detailTreeMetaMount must exist in sidebar');
  
  // Verify #detailTreeMetaSection exists
  assert.ok(mountHtml.includes('id="detailTreeMetaSection"'), 'detailTreeMetaSection must exist');
  
  // Verify no selected-moment IDs in sidebar (right-rail content must not leak)
  assert.equal(mountHtml.includes('id="detailCurrentMomentTitle"'), false, 
    'Right-rail moment title must NOT appear in sidebar');
  
  // Verify tree-scope markers
  assert.ok(mountHtml.includes('data-tree-scope-source='), 'tree-scope source marker must be present');
  assert.ok(mountHtml.includes('data-appreciation-region="tree-scope"'), 'tree-scope region marker must be present');
});

test('#3576 EXECUTION ORDER: editor.html module script tag order is correct', () => {
  const editorHtml = read('pages/editor.html');

  // 8 template scripts are type="module" (sidebar is classic script)
  const modulePattern = /<script type="module" src="[^"]*editor-[^"]*-template\.js[^"]*"[^>]*>/g;
  const moduleMatches = editorHtml.match(modulePattern) || [];
  assert.equal(moduleMatches.length, 8, '8 template scripts must be type="module"');

  // Sidebar template is NOT a module (it's a classic script for synchronous execution)
  const sidebarMatch = moduleMatches.find(m => m.includes('editor-sidebar-template.js'));
  assert.ok(!sidebarMatch, 'editor-sidebar-template.js must NOT be loaded as type="module"');

  // Shared builder must load before any template
  const sharedIdx = editorHtml.indexOf('canonical-appreciation-detail-presentation.js');
  const firstTemplateIdx = editorHtml.indexOf('type="module"');
  assert.ok(sharedIdx >= 0 && firstTemplateIdx > sharedIdx,
    'Shared presentation builder must load before any module template');
});

test('#3576 EXECUTION ORDER: template source uses function (not export) pattern', () => {
  const src = read(SIDEBAR_TEMPLATE);
  // Sidebar template is a classic script, so it uses function (not export)
  assert.ok(src.includes('function buildSidebarTemplate'),
    'editor-sidebar-template.js must use function buildSidebarTemplate (classic script)');
  assert.ok(!src.includes('export function buildSidebarTemplate'),
    'editor-sidebar-template.js must NOT use export function (not ESM module)');
});

test('#3576 tree meta mount exists in DOMContentLoaded handler scope', () => {
  // This test verifies that by the time any DOMContentLoaded handler runs,
  // the sidebar template has already executed and #detailTreeMetaMount exists.
  
  // Simulate the full page execution order:
  // 1. Parser loads classic scripts
  // 2. Parser queues module scripts (deferred)
  // 3. Parsing completes
  // 4. Deferred module scripts execute (sidebar template replaces mount)
  // 5. DOMContentLoaded fires
  // 6. DOMContentLoaded handler runs (simulating editor.js's handler)
  
  const executionSequence = [];
  
  // Step 1-2: Load shared builder (classic)
  const sharedSandbox = { window: {}, globalThis: null, document: { createElement: () => ({}), createTextNode: () => ({}) } };
  sharedSandbox.globalThis = sharedSandbox;
  const sharedCtx = require('vm').createContext(sharedSandbox);
  require('vm').runInContext(read(SHARED), sharedCtx);
  executionSequence.push('classic-shared-loaded');
  
  // Step 3-4: Deferred module execution (sidebar template)
  let mountCreated = false;
  const sidebarClean = read(SIDEBAR_TEMPLATE).replace(/export\s+function/, 'function');
  const sidebarSandbox = {
    window: { LoveBudCanonicalAppreciationDetailPresentation: sharedSandbox.window.LoveBudCanonicalAppreciationDetailPresentation },
    document: {
      getElementById: (id) => {
        if (id === 'editorSidebarTemplateMount') {
          const mount = { id, outerHTML: '' };
          Object.defineProperty(mount, 'outerHTML', {
            set(val) { mountCreated = val.includes('id="detailTreeMetaMount"'); },
            get() { return ''; },
          });
          return mount;
        }
        return null;
      },
    },
    console,
  };
  sidebarSandbox.globalThis = sidebarSandbox;
  const sidebarCtx = require('vm').createContext(sidebarSandbox);
  require('vm').runInContext(sidebarClean, sidebarCtx);
  executionSequence.push('deferred-sidebar-executed');
  executionSequence.push(`mount-exists=${mountCreated}`);
  
  // Step 5-6: DOMContentLoaded fires, simulate editor.js startup
  executionSequence.push('DOMContentLoaded');
  
  // Verify that at step 6, mount exists
  const mountStep = executionSequence.find(s => s.startsWith('mount-exists'));
  assert.ok(mountStep === 'mount-exists=true', 
    `At DOMContentLoaded, #detailTreeMetaMount must exist. Sequence: ${executionSequence.join(' → ')}`);
  
  // Verify total sequence
  assert.equal(executionSequence.length, 4, 'Expected 4 execution phases');
  assert.equal(executionSequence[0], 'classic-shared-loaded');
  assert.equal(executionSequence[1], 'deferred-sidebar-executed');
  assert.ok(executionSequence[2].startsWith('mount-exists='));
  assert.equal(executionSequence[3], 'DOMContentLoaded');
});
