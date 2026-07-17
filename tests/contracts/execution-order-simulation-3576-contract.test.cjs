/**
 * #3576 EXECUTION ORDER SIMULATION (EXECUTED_FAKE)
 *
 * This is NOT actual browser execution. It uses node:vm with:
 *   - sidebarSrc.replace(/export\s+function/, 'function')
 *   - fabricated DOMContentLoaded sequencing
 * and therefore cannot prove real module evaluation order.
 *
 * Real browser evidence lives in:
 *   tests/contracts/editor-sidebar-module-browser-runtime-3576-contract.test.cjs
 *   tests/contracts/editor-owner-tree-scope-browser-runtime-3576-contract.test.cjs
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const SHARED = 'js/shared/canonical-appreciation-detail-presentation.js';
const SIDEBAR_TEMPLATE = 'js/editor/templates/editor-sidebar-template.js';

/**
 * SIMULATION helper only. Source transformation is intentional and marks this
 * as EXECUTED_FAKE — not actual module evaluation.
 */
function simulateExecutionOrder() {
  const log = [];

  log.push({ phase: 'parser-start', msg: 'Document parsing begins (simulated)' });

  const sharedSandbox = {
    window: {},
    globalThis: null,
    document: { createElement: () => ({}), createTextNode: () => ({}) },
    log
  };
  sharedSandbox.globalThis = sharedSandbox;
  const sharedCtx = vm.createContext(sharedSandbox);
  vm.runInContext(read(SHARED), sharedCtx);
  log.push({ phase: 'classic-shared-loaded', msg: 'Shared presentation builder loaded (classic, during parse)' });

  // INTENTIONAL FAKE: strip export so classic vm can run the source.
  const sidebarSrc = read(SIDEBAR_TEMPLATE);
  const sidebarClean = sidebarSrc.replace(/export\s+function/, 'function');

  const sidebarSandbox = {
    window: {
      LoveBudCanonicalAppreciationDetailPresentation:
        sharedSandbox.window.LoveBudCanonicalAppreciationDetailPresentation
    },
    _mountObj: { id: 'editorSidebarTemplateMount', outerHTML: '' },
    document: {
      getElementById: (id) => {
        if (id === 'editorSidebarTemplateMount') {
          log.push({ phase: 'sidebar-mount-replaced', msg: '#editorSidebarTemplateMount outerHTML replaced' });
          return sidebarSandbox._mountObj;
        }
        if (id === 'detailTreeMetaMount') {
          log.push({ phase: 'tree-meta-mount-queried', msg: '#detailTreeMetaMount getElementById called' });
          return { id };
        }
        return null;
      }
    },
    console
  };
  sidebarSandbox.globalThis = sidebarSandbox;
  const sidebarCtx = vm.createContext(sidebarSandbox);
  vm.runInContext(sidebarClean, sidebarCtx);

  const createdHtml = sidebarSandbox.document.getElementById('editorSidebarTemplateMount').outerHTML;
  const hasMount = createdHtml.includes('id="detailTreeMetaMount"');
  log.push({
    phase: 'sidebar-after',
    msg: `Sidebar template executed (SIMULATED), #detailTreeMetaMount in output: ${hasMount}`
  });

  // Fabricated event — not a real browser DOMContentLoaded.
  log.push({ phase: 'DOMContentLoaded', msg: 'DOMContentLoaded (SIMULATED — not browser)' });
  log.push({
    phase: 'detail-ui-init',
    msg: `#detailTreeMetaMount ${hasMount ? 'EXISTS' : 'MISSING'} when createEditorDetailUI would run (simulated)`
  });

  return log;
}

test('#3576 SIMULATION EXECUTED_FAKE: deferred module ordering is simulated only', () => {
  const executionLog = simulateExecutionOrder();

  const sidebarAfterEvents = executionLog.filter((e) => e.phase === 'sidebar-after');
  const detailUIEvents = executionLog.filter((e) => e.phase === 'detail-ui-init');

  assert.ok(sidebarAfterEvents.length > 0, 'Sidebar template simulation must run');
  assert.ok(detailUIEvents.length > 0, 'Detail UI init simulation phase must be reached');

  const sidebarIdx = executionLog.findIndex((e) => e.phase === 'sidebar-after');
  const domIdx = executionLog.findIndex((e) => e.phase === 'DOMContentLoaded');
  assert.ok(sidebarIdx >= 0 && domIdx > sidebarIdx, 'Simulation places sidebar before fabricated DOMContentLoaded');

  const mountLog = executionLog.find((e) => e.phase === 'sidebar-after');
  assert.ok(mountLog.msg.includes('true'), `#detailTreeMetaMount must be in simulated sidebar HTML. Log: ${mountLog.msg}`);
});

test('#3576 SIMULATION EXECUTED_FAKE: sidebar HTML contains #detailTreeMetaMount (export stripped)', () => {
  const sidebarSrc = read(SIDEBAR_TEMPLATE);
  // Explicitly not actual module execution:
  const sidebarClean = sidebarSrc.replace(/export\s+function/, 'function');

  let mountReplaced = false;
  let mountHtml = '';

  const sandbox = {
    window: {
      LoveBudCanonicalAppreciationDetailPresentation: null
    },
    document: {
      getElementById: (id) => {
        if (id === 'editorSidebarTemplateMount') {
          const mount = { id, outerHTML: '' };
          Object.defineProperty(mount, 'outerHTML', {
            set(val) {
              mountReplaced = true;
              mountHtml = val;
            },
            get() {
              return mountHtml;
            }
          });
          return mount;
        }
        return null;
      }
    },
    console
  };
  sandbox.globalThis = sandbox;

  const shared = vm.createContext({
    window: {},
    globalThis: null,
    document: { createElement: () => ({}), createTextNode: () => ({}) }
  });
  shared.globalThis = shared;
  vm.runInContext(read(SHARED), shared);
  sandbox.window.LoveBudCanonicalAppreciationDetailPresentation =
    shared.window.LoveBudCanonicalAppreciationDetailPresentation;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(sidebarClean, ctx);

  assert.ok(mountReplaced, 'mount.outerHTML must be set in simulation');
  const mountCount = (mountHtml.match(/id="detailTreeMetaMount"/g) || []).length;
  assert.equal(mountCount, 1, 'Exactly one #detailTreeMetaMount must exist in sidebar HTML');
  assert.ok(mountHtml.includes('id="detailTreeMetaSection"'), 'detailTreeMetaSection must exist');
  assert.equal(
    mountHtml.includes('id="detailCurrentMomentTitle"'),
    false,
    'Right-rail moment title must NOT appear in sidebar'
  );
  assert.ok(mountHtml.includes('data-tree-scope-source='), 'tree-scope source marker must be present');
  assert.ok(
    mountHtml.includes('data-appreciation-region="tree-scope"'),
    'tree-scope region marker must be present'
  );
});

test('#3576 SIMULATION source guards: editor.html keeps sidebar as type=module', () => {
  const editorHtml = read('pages/editor.html');
  const modulePattern = /<script type="module" src="[^"]*editor-[^"]*-template\.js[^"]*"[^>]*>/g;
  const moduleMatches = editorHtml.match(modulePattern) || [];
  assert.equal(moduleMatches.length, 9, 'all 9 template scripts must be type="module"');

  const sidebarMatch = moduleMatches.find((m) => m.includes('editor-sidebar-template.js'));
  assert.ok(sidebarMatch, 'editor-sidebar-template.js must be loaded as type="module"');

  const sharedIdx = editorHtml.indexOf('canonical-appreciation-detail-presentation.js');
  const firstTemplateIdx = editorHtml.indexOf('type="module"');
  assert.ok(
    sharedIdx >= 0 && firstTemplateIdx > sharedIdx,
    'Shared presentation builder must load before any module template'
  );
});

test('#3576 SIMULATION source guards: sidebar source uses export function pattern', () => {
  const src = read(SIDEBAR_TEMPLATE);
  assert.ok(
    src.includes('export function buildSidebarTemplate'),
    'editor-sidebar-template.js must use export function buildSidebarTemplate (ESM)'
  );
});

test('#3576 SIMULATION EXECUTED_FAKE: fabricated sequence includes mount before DOMContentLoaded', () => {
  const executionSequence = [];

  const sharedSandbox = {
    window: {},
    globalThis: null,
    document: { createElement: () => ({}), createTextNode: () => ({}) }
  };
  sharedSandbox.globalThis = sharedSandbox;
  const sharedCtx = vm.createContext(sharedSandbox);
  vm.runInContext(read(SHARED), sharedCtx);
  executionSequence.push('classic-shared-loaded');

  let mountCreated = false;
  const sidebarClean = read(SIDEBAR_TEMPLATE).replace(/export\s+function/, 'function');
  const sidebarSandbox = {
    window: {
      LoveBudCanonicalAppreciationDetailPresentation:
        sharedSandbox.window.LoveBudCanonicalAppreciationDetailPresentation
    },
    document: {
      getElementById: (id) => {
        if (id === 'editorSidebarTemplateMount') {
          const mount = { id, outerHTML: '' };
          Object.defineProperty(mount, 'outerHTML', {
            set(val) {
              mountCreated = val.includes('id="detailTreeMetaMount"');
            },
            get() {
              return '';
            }
          });
          return mount;
        }
        return null;
      }
    },
    console
  };
  sidebarSandbox.globalThis = sidebarSandbox;
  const sidebarCtx = vm.createContext(sidebarSandbox);
  vm.runInContext(sidebarClean, sidebarCtx);
  executionSequence.push('deferred-sidebar-executed');
  executionSequence.push(`mount-exists=${mountCreated}`);
  executionSequence.push('DOMContentLoaded');

  const mountStep = executionSequence.find((s) => s.startsWith('mount-exists'));
  assert.ok(
    mountStep === 'mount-exists=true',
    `At simulated DOMContentLoaded, #detailTreeMetaMount must exist. Sequence: ${executionSequence.join(' → ')}`
  );
  assert.equal(executionSequence.length, 4, 'Expected 4 simulated execution phases');
  assert.equal(executionSequence[0], 'classic-shared-loaded');
  assert.equal(executionSequence[1], 'deferred-sidebar-executed');
  assert.ok(executionSequence[2].startsWith('mount-exists='));
  assert.equal(executionSequence[3], 'DOMContentLoaded');
});
