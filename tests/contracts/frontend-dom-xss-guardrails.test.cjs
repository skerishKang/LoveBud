const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scan = require('../helpers/dom-sink-scan.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

const POLICY_DOC = path.join(ROOT, 'docs/security/FRONTEND_RENDERING_DOM_XSS_GUARDRAILS.md');
const INVENTORY_PATH = path.join(ROOT, 'docs/security/frontend-dom-sink-inventory-4533.json');
const COUNT_GUARD_PATH = path.join(ROOT, 'tests/contracts/dom-xss-renderer-guardrail-contract.test.cjs');

const HIGH_RISK_FRONTEND_FILES = [
  'js/editor/editor-detail-ui.js',
  'js/editor/editor-canvas-node.js',
  'js/viewer/public-tree-viewer.js',
  'js/viewer/tree-viewer.js',
  'js/editor/editor-memory-form-preview.js'
];

// Representative high-risk renderers named by #4533 (active folder runtime, not root legacy duplicates).
const HIGH_RISK_RENDERERS = [
  'js/search/search-card-renderer.js',
  'js/search/search-preview-renderer.js',
  'js/import/youtube-playlist-preview-ui.js',
  'js/viewer/public-tree-viewer.js',
  'js/editor/editor-detail-ui.js',
  'js/editor/editor-canvas-node.js',
  'js/editor/editor-memory-form-preview.js',
  'js/my-trees/my-trees-preview-hub.js',
  'js/visitor-viewer/visitor-viewer.js'
];

const USER_CONTROLLED_FIELD_PATTERN = scan.USER_VOCAB;
const HTML_SINK_PATTERN = /\.(?:innerHTML|outerHTML)\s*=|\.insertAdjacentHTML\s*\(/;
const SAFE_BOUNDARY_PATTERN = scan.SAFE_BOUNDARY;

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

// #4533: bounded, template-aware statement window. The previous one-line window
// missed multiline template sinks, so safety changes inside a multi-line
// assignment were invisible to this representative guard.
function getStatementWindow(content, index) {
  return scan.extractStatement(content, index);
}

function findUnsafeHtmlSinkWindows(content) {
  const matches = [];
  const sinkRegex = new RegExp(HTML_SINK_PATTERN.source, 'g');
  let match;

  while ((match = sinkRegex.exec(content)) !== null) {
    const windowText = getStatementWindow(content, match.index);
    const isDynamicHtml = windowText.includes('${') || windowText.includes(' + ') || windowText.includes('+=');
    const mentionsUserField = USER_CONTROLLED_FIELD_PATTERN.test(windowText);
    const hasSafeBoundary = SAFE_BOUNDARY_PATTERN.test(windowText);

    if (isDynamicHtml && mentionsUserField && !hasSafeBoundary) {
      matches.push({
        line: getLineNumber(content, match.index),
        snippet: windowText.trim()
      });
    }
  }

  return matches;
}

function loadInventory() {
  assert.ok(fs.existsSync(INVENTORY_PATH), 'sink inventory should exist');
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
}

// Which per-file signed counts are declared by the Layer-1 count guard.
function readLayer1SignedCounts() {
  const text = fs.readFileSync(COUNT_GUARD_PATH, 'utf8');
  const counts = new Map();
  const re = /'((?:js)\/[^']+)'\s*:\s*\{\s*count:\s*(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) counts.set(m[1], Number(m[2]));
  return counts;
}

function countSinks(sourceText) {
  const re = scan.sinkPattern();
  return (sourceText.match(re) || []).length;
}

function classifySnippet(sourceText, filePath, options) {
  const re = /\.(?:innerHTML|outerHTML)\s*=|\.insertAdjacentHTML\s*\(/g;
  const m = re.exec(sourceText);
  assert.ok(m, 'snippet must contain a sink');
  const stmt = scan.extractStatement(sourceText, m.index);
  return scan.classifyStatement(stmt, sourceText, filePath, options).classification;
}

// Classify the LAST sink of a source, so a fixture can append its own sink to a
// real file's source and still be analysed at the declared call-site path.
function classifyLastSink(sourceText, filePath, options) {
  const re = new RegExp(HTML_SINK_PATTERN.source, 'g');
  let m;
  let last = -1;
  while ((m = re.exec(sourceText)) !== null) last = m.index;
  assert.ok(last >= 0, 'fixture must contain a sink');
  const stmt = scan.extractStatement(sourceText, last);
  return scan.classifyStatement(stmt, sourceText, filePath, options).classification;
}

function sinkStatementFor(sink) {
  const source = read(sink.path);
  const pattern = scan.sinkPattern();
  let match;
  let seen = 0;
  let found = null;
  while ((match = pattern.exec(source)) !== null) {
    if (match[1].trim() !== sink.sinkType) continue;
    seen += 1;
    if (seen === sink.occurrence) { found = match; break; }
  }
  assert.ok(found, `${sink.identity}: recorded sink occurrence must still exist`);
  return { source, statement: scan.extractStatement(source, found.index) };
}

test('frontend DOM XSS rendering policy document exists', () => {
  assert.ok(fs.existsSync(POLICY_DOC), 'frontend rendering DOM XSS guardrails policy should exist');

  const content = fs.readFileSync(POLICY_DOC, 'utf8');
  assert.match(content, /User-controlled fields/, 'policy should define user-controlled fields');
  assert.match(content, /textContent/, 'policy should prefer textContent for text rendering');
  assert.match(content, /innerHTML/, 'policy should document innerHTML boundaries');
  assert.match(content, /escapeHtml/, 'policy should require explicit escaping for unavoidable HTML');
});

test('#4533 policy states the two-layer contract', () => {
  const content = fs.readFileSync(POLICY_DOC, 'utf8');
  for (const marker of [
    'count-only',
    'not sufficient',
    'same-count',
    'review_needed',
    'DORMANT',
    'frontend-dom-sink-inventory-4533.json'
  ]) {
    assert.ok(content.includes(marker), `policy should mention ${marker}`);
  }
});

test('representative high-risk frontend render files exist', () => {
  HIGH_RISK_FRONTEND_FILES.forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `${relativePath} should exist`);
  });
  HIGH_RISK_RENDERERS.forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `${relativePath} should exist`);
  });
});

test('high-risk frontend files do not directly interpolate obvious user-controlled fields into HTML sinks', () => {
  const violations = [];

  HIGH_RISK_FRONTEND_FILES.forEach((relativePath) => {
    const content = read(relativePath);
    const fileViolations = findUnsafeHtmlSinkWindows(content);
    fileViolations.forEach((violation) => {
      violations.push(`${relativePath}:${violation.line} ${violation.snippet}`);
    });
  });

  assert.deepEqual(
    violations,
    [],
    `User-controlled fields must use textContent, DOM node creation, URL validation, or explicit escaping before HTML sinks:\n${violations.join('\n')}`
  );
});

test('multiline template sink statements are analysed as a whole, not line by line', () => {
  const multiline = [
    'node.innerHTML = `',
    '  <div>${escapeHtml(memory.title)}</div>',
    '  <span>${escapeHtml(tag)}</span>',
    '`;',
    'other.innerHTML = `',
    '  <div>${memory.title}</div>',
    '`;',
  ].join('\n');

  const firstSink = multiline.indexOf('.innerHTML');
  const windowText = scan.extractStatement(multiline, firstSink);
  assert.ok(windowText.split('\n').length > 3, 'the statement window must span multiple lines');
  assert.ok(windowText.includes('escapeHtml(memory.title)'), 'later lines must be inside the window');

  // the second sink (raw user value on its own line) must be visible from its sink index
  const secondSink = multiline.indexOf('.innerHTML', firstSink + 1);
  const secondWindow = scan.extractStatement(multiline, secondSink);
  assert.ok(secondWindow.includes('${memory.title}'), 'raw interpolation must be captured');
  assert.equal(scan.classifyStatement(secondWindow, multiline).classification, 'REVIEW_NEEDED');
});

test('Editor detail render path keeps obvious user text on textContent or escaped boundaries', () => {
  const content = read('js/editor/editor-detail-ui.js');

  assert.match(content, /headerEl\.textContent\s*=/, 'detail header should be assigned through textContent');
  assert.match(content, /dateEl\.textContent\s*=/, 'detail date text should be assigned through textContent');
  assert.match(content, /textEl\.textContent\s*=/, 'save status text should be assigned through textContent');
  assert.match(content, /escapeHtml/, 'editor detail UI should keep an explicit escaped HTML boundary available');
});

test('Public viewer render path keeps escaped HTML boundary visible when HTML templates are used', () => {
  const content = read('js/viewer/public-tree-viewer.js');

  if (HTML_SINK_PATTERN.test(content)) {
    assert.match(content, /escapeHtml|textContent|createElement|setAttribute/, 'public viewer HTML sinks should keep visible safe-rendering boundaries');
  }
});

// ─── #4533 Layer 2: sink-level semantic classification ───────────────────────

test('#4533 sink inventory is re-derived from the exact tree and matches 1:1', () => {
  const inventory = loadInventory();
  const { sinks } = scan.buildSinkInventory();

  const derived = sinks.map((s) => s.identity).sort();
  const recorded = inventory.sinks.map((s) => s.identity).sort();

  const missing = derived.filter((id) => !recorded.includes(id));
  const stale = recorded.filter((id) => !derived.includes(id));

  assert.deepEqual(missing, [], 'every derived sink must be recorded in the inventory (new sink => FAIL)');
  assert.deepEqual(stale, [], 'no stale inventory sink may remain (removed or edited sink => FAIL)');
  assert.equal(recorded.length, derived.length, 'identity multisets must be the same size');
  assert.equal(derived.length, scan.listJsFiles().reduce((n, f) => n + countSinks(read(f)), 0),
    'inventory size must equal the raw sink count of js/');
});

test('#4533 every sink carries a vocabulary classification and a surface', () => {
  const { sinks } = scan.buildSinkInventory();
  const allowed = new Set(scan.CLASSIFICATION_VOCABULARY.concat(['DORMANT_OR_MOCK']));

  const bad = [];
  for (const s of sinks) {
    if (!allowed.has(s.classification)) bad.push(`${s.identity}: classification=${s.classification}`);
    if (!scan.SURFACE_VOCABULARY.includes(s.surface)) bad.push(`${s.identity}: surface=${s.surface}`);
    if (!s.safeBoundary) bad.push(`${s.identity}: missing safeBoundary`);
    if (!s.reason) bad.push(`${s.identity}: missing reason`);
    assert.ok(s.occurrence >= 1, `${s.identity}: occurrence must be >= 1`);
    assert.ok(s.sinkType, `${s.identity}: sink type required`);
  }
  assert.deepEqual(bad, []);
});

test('#4533 active sink count guard: ACTIVE_REVIEW_NEEDED_COUNT is zero', () => {
  const { sinks } = scan.buildSinkInventory();
  const summary = scan.summarise(sinks);
  const offenders = sinks.filter((s) => s.active && s.classification === 'REVIEW_NEEDED');

  assert.deepEqual(
    offenders.map((s) => `${s.path} #${s.occurrence} ${s.statementPreview}`),
    [],
    'an active Product sink may never sit in review_needed'
  );
  assert.equal(summary.activeReviewNeeded, 0);
  assert.equal(summary.total, 187, 'sink total drift must be reviewed against the inventory');
});

test('#4533 declared inventory totals match a fresh derivation', () => {
  const inventory = loadInventory();
  const summary = scan.summarise(scan.buildSinkInventory().sinks);

  assert.equal(inventory.totals.TOTAL_JS_HTML_SINKS, summary.total);
  assert.equal(inventory.totals.ACTIVE_PRODUCT_SINKS, summary.bySurface.ACTIVE_PRODUCT);
  assert.equal(inventory.totals.DORMANT_OR_MOCK_SINKS,
    summary.bySurface.DORMANT_UNLINKED + summary.bySurface.MOCK_PROTOTYPE);
  assert.equal(inventory.totals.ACTIVE_REVIEW_NEEDED_COUNT, summary.activeReviewNeeded);
  assert.equal(inventory.totals.REVIEW_NEEDED, summary.byClassification.REVIEW_NEEDED);
  assert.equal(inventory.totals.CLEAR_CONTAINER, summary.byClassification.CLEAR_CONTAINER);
  assert.equal(inventory.totals.STATIC_TRUSTED_TEMPLATE, summary.byClassification.STATIC_TRUSTED_TEMPLATE);
  assert.equal(inventory.totals.EXPLICIT_ESCAPED_DYNAMIC, summary.byClassification.EXPLICIT_ESCAPED_DYNAMIC);
  assert.equal(inventory.totals.SANITIZED_URL_DYNAMIC, summary.byClassification.SANITIZED_URL_DYNAMIC);
  assert.equal(inventory.totals.APPROVED_RENDERER_BOUNDARY, summary.byClassification.APPROVED_RENDERER_BOUNDARY);
  assert.equal(inventory.totals.DORMANT_OR_MOCK, summary.byClassification.DORMANT_OR_MOCK);
});

test('#4533 dormant/mock prototype surfaces are freshly verified, not inherited', () => {
  const { sinks, surfaceMap } = scan.buildSinkInventory();

  // chat-first-workspace: the only page that loads it has no inbound navigation
  assert.equal(surfaceMap.get('js/chat-first-workspace.js'), 'MOCK_PROTOTYPE');
  assert.equal(surfaceMap.get('js/product/youtube-segment-player-poc.js'), 'MOCK_PROTOTYPE');
  const loaderHtml = read('pages/chat-first-workspace.html');
  assert.ok(loaderHtml.includes('js/chat-first-workspace.js'), 'the prototype page must still load the prototype');

  // no other page links to the prototype page (direct URL access is not navigation)
  const inbound = scan.listHtmlFiles().filter((p) => {
    if (p === 'pages/chat-first-workspace.html') return false;
    return read(p).includes('chat-first-workspace');
  });
  assert.deepEqual(inbound, [], 'no active page may link the dormant prototype');

  // legacy root/search duplicates are not reachable either
  assert.equal(surfaceMap.get('js/search.js'), 'DORMANT_UNLINKED');
  assert.equal(surfaceMap.get('js/search/search-index.js'), 'DORMANT_UNLINKED');
  assert.equal(surfaceMap.get('js/viewer/public-tree-viewer.js'), 'DORMANT_UNLINKED');

  // the active Browse runtime keeps its sinks classified as active
  assert.equal(surfaceMap.get('js/search/index.js'), 'ACTIVE_PRODUCT');
  assert.equal(surfaceMap.get('js/search/search-card-renderer.js'), 'ACTIVE_PRODUCT');
  assert.equal(surfaceMap.get('js/search/search-preview-renderer.js'), 'ACTIVE_PRODUCT');

  // non-active surfaces may never be counted as active Product acceptance
  for (const s of sinks.filter((x) => x.surface !== 'ACTIVE_PRODUCT')) {
    assert.equal(s.classification, 'DORMANT_OR_MOCK', `${s.identity} must not be reported as active`);
    assert.equal(s.active, false);
  }
});

// ─── #4533 negative controls ─────────────────────────────────────────────────

test('NC1 same-count escaping removal is detected by the semantic guard', () => {
  const before = 'target.innerHTML = `<div>${escapeHtml(tree.title)}</div>`;\n';
  const after = 'target.innerHTML = `<div>${tree.title}</div>`;\n';

  assert.equal(countSinks(before), countSinks(after), 'the file-level sink count must be unchanged');
  assert.equal(scan.statementDigest(before.trim()), scan.statementDigest(before.trim()));
  assert.notEqual(scan.statementDigest(before.trim()), scan.statementDigest(after.trim()),
    'the sink identity must change when the escaping is removed');

  assert.equal(classifySnippet(before), 'EXPLICIT_ESCAPED_DYNAMIC');
  assert.equal(classifySnippet(after), 'REVIEW_NEEDED',
    'removing escapeHtml from the same sink must fail the semantic guard');
});

test('NC2 same-count approved renderer replacement is detected', () => {
  const callSite = 'js/search/search-preview-renderer.js';
  const sinkLine = 'el.innerHTML = renderEmotionTags(tree.emotionTags);';
  const broken = [
    read(callSite),
    'function renderEmotionTags(tags) {',
    "  return '<span>' + tags.join(',') + '</span>';",
    '}',
    sinkLine,
    ''
  ].join('\n');
  const replaced = `${read(callSite)}\nel.innerHTML = tree.emotionTags.join(',');\n`;

  assert.equal(countSinks(broken), countSinks(replaced), 'the file-level sink count must be unchanged');
  assert.equal(classifyLastSink(`${read(callSite)}\n${sinkLine}\n`, callSite), 'APPROVED_RENDERER_BOUNDARY',
    'the declared contract must approve its own call site');
  assert.equal(classifyLastSink(broken, callSite), 'REVIEW_NEEDED',
    'an approved boundary that stops escaping its returned fragment must fail');
  assert.equal(classifyLastSink(replaced, callSite), 'REVIEW_NEEDED',
    'replacing the approved renderer with a raw user value must fail');
});

test('NC3 a new unregistered sink fails the count guard and the inventory', () => {
  const signed = readLayer1SignedCounts();
  const target = 'js/search/search-preview-renderer.js';
  assert.ok(signed.has(target), 'the count guard must sign this file');

  const original = read(target);
  assert.equal(countSinks(original), signed.get(target), 'Layer 1 must match the current tree');

  const mutated = original + "\nel.insertAdjacentHTML('beforeend', tree.title);\n";
  assert.notEqual(countSinks(mutated), signed.get(target),
    'an added sink must change the per-file count so Layer 1 fails');

  const derivedIds = new Set(scan.buildSinkInventory().sinks.map((s) => s.identity));
  const mutatedSink = "\nwindow.x.insertAdjacentHTML('beforeend', tree.title);";
  const stmt = scan.extractStatement(mutatedSink, mutatedSink.indexOf('.insertAdjacentHTML'));
  const digest = scan.statementDigest(stmt);
  const identity = `js/search/search-preview-renderer.js::.insertAdjacentHTML(::#999::${digest}`;
  assert.equal(derivedIds.has(identity), false,
    'an unregistered sink identity is absent from the signed inventory');
  assert.equal(scan.classifyStatement(stmt, '').classification, 'REVIEW_NEEDED',
    'a raw insertAdjacentHTML sink must classify as review_needed');
});

test('NC4 a static application template is still accepted', () => {
  const snippet = "el.innerHTML = '<span class=\"material-symbols-outlined\">edit</span>';\n";
  assert.equal(countSinks(snippet), 1);
  assert.equal(classifySnippet(snippet), 'STATIC_TRUSTED_TEMPLATE');

  const templated = 'el.innerHTML = `<div class=\"row\"><span>${tText(\'a.b\', \'x\')}</span></div>`;\n';
  assert.equal(classifySnippet(templated), 'STATIC_TRUSTED_TEMPLATE',
    'i18n application text is not user-controlled content');
});

test('NC5 a clear-container sink is still accepted', () => {
  const snippet = "el.innerHTML = '';\n";
  assert.equal(countSinks(snippet), 1);
  assert.equal(classifySnippet(snippet), 'CLEAR_CONTAINER');
});

// ─── #4533 correction: return-proven renderer contracts ─────────────────────

test('#4533 every declared renderer contract is exact-source-bound and return-proven', () => {
  const contracts = Object.entries(scan.APPROVED_RENDERER_CONTRACTS);
  assert.ok(contracts.length > 0, 'at least one renderer contract must be declared');

  const failures = [];
  for (const [name, contract] of contracts) {
    if (!fs.existsSync(path.join(ROOT, contract.source))) failures.push(`${name}: owner source ${contract.source} is missing`);
    if (!Array.isArray(contract.callSites) || contract.callSites.length === 0) failures.push(`${name}: no call site declared`);
    for (const site of contract.callSites || []) {
      if (!fs.existsSync(path.join(ROOT, site))) failures.push(`${name}: declared call site ${site} is missing`);
    }
    if (!Array.isArray(contract.producers) || contract.producers.length === 0) failures.push(`${name}: no producer declared`);
    for (const producer of contract.producers || []) {
      if (!fs.existsSync(path.join(ROOT, producer.source))) failures.push(`${name}: producer source ${producer.source} is missing`);
    }
    // the proof is re-derived from the exact owner source on every run — never
    // from the helper name, and never from another file's same-name helper
    const verdict = scan.rendererApproval(name, contract.source, read(contract.source));
    if (!verdict.ok) failures.push(`${name}: ${verdict.why}`);
  }

  assert.deepEqual(failures, [], `every declared contract must be provable from its exact source:\n${failures.join('\n')}`);
});

test('#4533 a declared producer that stops escaping its returned fragment loses approval', () => {
  const callSite = 'js/search/search-preview-playable-hub-patch.js';
  const producer = 'js/search/search-share-link.js';
  const callerSource = read(callSite);
  const producerSource = read(producer);

  assert.equal(scan.rendererApproval('renderSocialBar', callSite, callerSource).ok, true,
    'the real cross-file delegating contract must be proven');

  // remove the escaping of a user-bearing value from the producer's returned fragment
  const stripped = producerSource.replace("escapeHtml(String(tree.id || ''))", "String(tree.id || '')");
  assert.notEqual(stripped, producerSource, 'the negative control must actually remove an escaping call');

  const verdict = scan.rendererApproval('renderSocialBar', callSite, callerSource, { sources: { [producer]: stripped } });
  assert.equal(verdict.ok, false, 'a producer return that stops escaping must lose the approval');
  assert.match(verdict.why, /is not proven/, 'the failure must be reported as an unproven returned fragment');
});

test('#4533 every approved renderer sink is bound to a declared, proven contract', () => {
  const { sinks } = scan.buildSinkInventory();
  const approved = sinks.filter((s) => s.classification === 'APPROVED_RENDERER_BOUNDARY');
  const names = Object.keys(scan.APPROVED_RENDERER_CONTRACTS);

  // signed expectation: a new approval needs a declared contract, not a new name
  assert.equal(approved.length, 9,
    'the approved-renderer sink set changed — declare a contract with exact-source return proofs instead of relying on a name');

  const unbound = [];
  for (const s of approved) {
    assert.equal(s.surface, 'ACTIVE_PRODUCT', `${s.identity} must be an active surface`);
    assert.equal(s.safeBoundary, 'approved-renderer', `${s.identity} must carry the approved-renderer boundary`);
    const { source, statement } = sinkStatementFor(s);
    const bound = names.filter((n) => new RegExp(`\\b${n}\\b`).test(statement));
    if (bound.length === 0) unbound.push(`${s.identity}: no declared contract name in the sink statement`);
    for (const name of bound) {
      const verdict = scan.rendererApproval(name, s.path, source);
      if (!verdict.ok) unbound.push(`${s.identity}: ${name} — ${verdict.why}`);
    }
  }
  assert.deepEqual(unbound, [], `every approved sink must resolve through a declared, proven contract:\n${unbound.join('\n')}`);
});

test('#4533 positive control: an exact-owner renderer with a proven returned fragment is approved', () => {
  const owner = 'js/__fixture__/render-safe.js';
  const source = [
    'function renderSafe(tree) {',
    "  return '<div>' + escapeHtml(tree.title) + '</div>';",
    '}',
    'target.innerHTML = renderSafe(tree);',
    ''
  ].join('\n');
  const contracts = {
    renderSafe: { source: owner, callSites: [owner], producers: [{ source: owner, name: 'renderSafe' }] },
  };

  assert.equal(scan.proveReturnFragment("return '<div>' + escapeHtml(tree.title) + '</div>';", source).ok, true,
    'an escaped returned fragment must be provable');
  assert.equal(classifyLastSink(source, owner, { contracts }), 'APPROVED_RENDERER_BOUNDARY',
    'an exactly-sourced renderer whose returned fragment escapes the user value must be approved');
  assert.equal(classifyLastSink(source, owner), 'REVIEW_NEEDED',
    'without the declared contract the same source must never be approved');

  const broken = source.replace('escapeHtml(tree.title)', 'tree.title');
  assert.equal(classifyLastSink(broken, owner, { contracts }), 'REVIEW_NEEDED',
    'the contract must fail the moment the returned fragment stops escaping');
});

test('NC6 unrelated escape inside a helper never approves a raw returned fragment', () => {
  const callSite = 'js/__fixture__/render-unsafe.js';
  const fixture = [
    'function renderUnsafe(tree) {',
    '  const ignored = escapeHtml(tree.memo);',
    "  return '<div>' + tree.title + '</div>';",
    '}',
    'target.innerHTML = renderUnsafe(tree);',
    ''
  ].join('\n');

  assert.match(fixture, /escapeHtml\(tree\.memo\)/, 'the unrelated escape must be present in the helper body');
  const fragment = scan.proveReturnFragment("return '<div>' + tree.title + '</div>';", fixture);
  assert.equal(fragment.ok, false, 'an unrelated escape must not prove a raw returned fragment');
  assert.match(fragment.violations.join('\n'), /tree/, 'the raw returned user value must be reported');
  assert.equal(classifyLastSink(fixture, callSite), 'REVIEW_NEEDED',
    'an undeclared helper is never an approved renderer boundary');

  // declaring the name in a contract does not help: the proof fails on the return
  const contracts = {
    renderUnsafe: { source: callSite, callSites: [callSite], producers: [{ source: callSite, name: 'renderUnsafe' }] },
  };
  const verdict = scan.rendererApproval('renderUnsafe', callSite, fixture, { contracts });
  assert.equal(verdict.ok, false, 'a declared name alone must never approve a helper');
  assert.match(verdict.why, /return is not proven/, 'the failure must be attributed to the returned fragment');
  assert.equal(classifyLastSink(fixture, callSite, { contracts }), 'REVIEW_NEEDED',
    'escaping `tree.memo` must never approve a returned `tree.title`');
});

test('NC7 a safe same-name helper in another file never approves an unsafe local helper', () => {
  const declaredSite = 'js/search/search-preview-renderer.js';
  const localUnsafe = [
    'function renderEmotionTags(tags) {',
    "  return '<span>' + tags.join(',') + '</span>';",
    '}',
    'el.innerHTML = renderEmotionTags(tree.emotionTags);',
    ''
  ].join('\n');

  // the declared owner (and the builders file it delegates to) do escape tags
  assert.equal(scan.rendererApproval('renderEmotionTags', declaredSite, read(declaredSite)).ok, true,
    'the real declared renderer must stay proven');

  // the same helper name defined unsafely in a foreign file is never blessed by it
  assert.equal(classifyLastSink(localUnsafe, 'js/legacy/other-search.js'), 'REVIEW_NEEDED',
    'an unsafe same-name helper outside the declared owner must fail');

  // and an undeclared call site may not borrow the declared owner either
  assert.equal(classifyLastSink(localUnsafe, 'js/legacy/other-search.js', {
    contracts: {
      renderEmotionTags: scan.APPROVED_RENDERER_CONTRACTS.renderEmotionTags,
    },
  }), 'REVIEW_NEEDED', 'a call site that is not declared must never be approved');

  assert.equal(classifyLastSink(read(declaredSite) + '\n' + 'el.innerHTML = renderEmotionTags(tree.emotionTags);\n', declaredSite),
    'APPROVED_RENDERER_BOUNDARY', 'the declared owner call site must stay approved');
});

test('#4533 classification never judges a sink by variable name alone', () => {
  // Same vocabulary token, opposite verdicts depending on the safe boundary.
  assert.equal(classifySnippet('el.innerHTML = `<b>${escapeHtml(title)}</b>`;\n'), 'EXPLICIT_ESCAPED_DYNAMIC');
  assert.equal(classifySnippet('el.innerHTML = `<b>${title}</b>`;\n'), 'REVIEW_NEEDED');
  // Application text resolved from an i18n definition is not a user payload.
  const appText = [
    'const backConfig = { browse: { label: tText(\'back_to_browse_soft\', \'돌아가기\') } };',
    'const config = backConfig.browse;',
    'el.innerHTML = `<span>${config.label}</span>`;',
    ''
  ].join('\n');
  assert.equal(classifySnippet(appText), 'STATIC_TRUSTED_TEMPLATE');
});
