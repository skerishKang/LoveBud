const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('1. Browse large and compact cards have fixed height constraints and do not affect list/My Trees', () => {
  const css = read('css/tree-view-mode.css');

  // Verify Browse modes have height constraints
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-card\s*\{[^}]*height:/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-card\s*\{[^}]*height:/);

  // Verify list mode is height: auto / min-height
  assert.match(css, /#resultsList\[data-tree-view-mode="list"\]\s+\.tree-card\s*\{[^}]*height:\s*auto;/);

  // Verify My Trees selector .trees-grid large/compact is not modified to have fixed card height
  assert.doesNotMatch(css, /\.trees-grid\[data-tree-view-mode="large"\]\s+\.tree-card\s*\{[^}]*height:/);
});

test('2. Browse large/compact body layout constraints (no calc height, flex layout, min-height 0)', () => {
  const css = read('css/tree-view-mode.css');

  // Must not use height calc
  assert.doesNotMatch(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-card-body\s*\{[^}]*height:\s*calc/);
  assert.doesNotMatch(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-card-body\s*\{[^}]*height:\s*calc/);

  // Must use flex-grow or equivalent and min-height 0
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-card-body\s*\{[^}]*flex:\s*1\s+1\s+auto/);
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-card-body\s*\{[^}]*min-height:\s*0/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-card-body\s*\{[^}]*flex:\s*1\s+1\s+auto/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-card-body\s*\{[^}]*min-height:\s*0/);

  // Verify grid columns / rows setup
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-card-body\s*\{[^}]*display:\s*grid/);
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-card-body\s*\{[^}]*grid-template-rows:/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-card-body\s*\{[^}]*display:\s*grid/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-card-body\s*\{[^}]*grid-template-rows:/);
});

test('3. Nested grid for metadata/tag slot with fixed row constraints', () => {
  const css = read('css/tree-view-mode.css');

  // grid-template-rows: minmax(0, 1fr) 24px/22px and grid-row: 2 for tags
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-card-metadata-slot\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+24px/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-card-metadata-slot\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+22px/);

  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-public-tags\s*\{[^}]*grid-row:\s*2/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-public-tags\s*\{[^}]*grid-row:\s*2/);

  // min-height: 0 and overflow: hidden for public metadata block
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-public-metadata\s*\{[^}]*min-height:\s*0/);
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-public-metadata\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-public-metadata\s*\{[^}]*min-height:\s*0/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-public-metadata\s*\{[^}]*overflow:\s*hidden/);
});

test('4. Title and description clamping is defined', () => {
  const css = read('css/tree-view-mode.css');

  // Large title clamps to 2 lines
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-title\s*\{[^}]*-webkit-line-clamp:\s*2/);
  // Compact title/subtitle nowrap/ellipses clamps (but broad block overrides this)
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-title\s*\{[^}]*white-space:\s*nowrap/);

  // Description inside metadata clamping
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-public-metadata-desc\s*\{[^}]*-webkit-line-clamp:\s*1/);
  assert.match(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-public-metadata-desc\s*\{[^}]*-webkit-line-clamp:\s*1/);
});

test('5. Footer does not force fixed height', () => {
  const css = read('css/tree-view-mode.css');

  // Must not force fixed height on meta row
  assert.doesNotMatch(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-meta-row\s*\{[^}]*height:/);
  assert.doesNotMatch(css, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-meta-row\s*\{[^}]*height:/);
});

test('6. Metadata slot and tag structures rendering', () => {
  const helperSource = read('js/search/search-public-metadata-helper.js');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(helperSource, context);
  const helper = context.window.LoveBudSearchPublicMetadataHelper;

  // 1. Wrapper slot always present
  const emptyHtml = helper.renderCardMetadata({});
  assert.match(emptyHtml, /class="tree-card-metadata-slot"/);
  assert.match(emptyHtml, /class="tree-public-tags"/);

  // 2. All tags are generated in markup, plus overflow block
  const threeTagsHtml = helper.renderCardMetadata({
    tags: ['tag1', 'tag2', 'tag3']
  });
  assert.match(threeTagsHtml, /class="tree-public-tag">#tag1/);
  assert.match(threeTagsHtml, /class="tree-public-tag">#tag2/);
  assert.match(threeTagsHtml, /class="tree-public-tag">#tag3/);
  assert.match(threeTagsHtml, /class="tree-public-tag-overflow">[^<]*\+1/);

  // 3. Overflow markup sanity (no interaction markers)
  assert.doesNotMatch(threeTagsHtml, /button/i);
  assert.doesNotMatch(threeTagsHtml, /link/i);
  assert.doesNotMatch(threeTagsHtml, /role=/i);
  assert.doesNotMatch(threeTagsHtml, /tabindex=/i);
  assert.doesNotMatch(threeTagsHtml, /title=/i);
});

test('7. Tag display and overflow CSS layout', () => {
  const contentCss = read('css/search/search-tree-card/content.css');
  const metaCss = read('css/search/search-tree-card/public-metadata.css');

  assert.doesNotMatch(
    contentCss,
    /#resultsList\s+\.tree-card-metadata-slot/,
    'metadata slot styling must not leak into Browse list mode'
  );

  assert.doesNotMatch(
    contentCss,
    /#resultsList\s+\.tree-public-tags/,
    'tag row styling must not leak into Browse list mode'
  );

  assert.doesNotMatch(
    contentCss,
    /#resultsList\s+\.tree-public-tag(?:\s|\{|,)/,
    'tag styling must not leak into Browse list mode'
  );

  assert.doesNotMatch(
    contentCss,
    /#resultsList\s+\.tree-public-tag-overflow/,
    '+N styling must not leak into Browse list mode'
  );

  // Large selectors positive assertions
  assert.match(contentCss, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-card-metadata-slot/);
  assert.match(contentCss, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-public-tags/);
  assert.match(contentCss, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-public-tag/);
  assert.match(contentCss, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-public-tag-overflow/);

  // Compact selectors positive assertions
  assert.match(contentCss, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-card-metadata-slot/);
  assert.match(contentCss, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-public-tags/);
  assert.match(contentCss, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-public-tag/);
  assert.match(contentCss, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-public-tag-overflow/);

  // Compression via nth-of-type(n + 3) in large/compact modes
  assert.match(contentCss, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-public-tag:nth-of-type\(n\s*\+\s*3\)/);
  assert.match(contentCss, /#resultsList\[data-tree-view-mode="compact"\]\s+\.tree-public-tag:nth-of-type\(n\s*\+\s*3\)/);

  // Overflow is display: none by default in public-metadata.css
  assert.match(metaCss, /\.tree-public-tag-overflow\s*\{\s*display:\s*none;\s*\}/);

  // List mode display constraints
  assert.match(metaCss, /#resultsList\[data-tree-view-mode="list"\]\s+\.tree-card-metadata-slot\s*\{\s*display:\s*contents;\s*\}/);
  assert.match(metaCss, /#resultsList\[data-tree-view-mode="list"\]\s+\.tree-card-metadata-slot\s*>\s*\.tree-public-tags:empty\s*\{\s*display:\s*none;\s*\}/);

  // List mode has no nth-of-type or overflow visible override rules
  assert.doesNotMatch(metaCss, /#resultsList\[data-tree-view-mode="list"\][^{]*nth-of-type/);
  assert.doesNotMatch(contentCss, /#resultsList\[data-tree-view-mode="list"\][^{]*nth-of-type/);
  assert.doesNotMatch(metaCss, /#resultsList\[data-tree-view-mode="list"\][^{]*tree-public-tag-overflow[^{]*inline-block/);
  assert.doesNotMatch(contentCss, /#resultsList\[data-tree-view-mode="list"\][^{]*tree-public-tag-overflow[^{]*inline-block/);
});

test('8. Generic truncation conservation and Browse large override', () => {
  const css = read('css/tree-view-mode.css');

  // Main generic truncation blocks must be conserved
  assert.match(css, /\.tree-card\s+\.tree-title\s*\{[^}]*white-space:\s*nowrap;/);
  assert.match(css, /\.tree-card\s+\.tree-subtitle\s*\{[^}]*white-space:\s*nowrap;/);

  // Large override white-space: normal
  assert.match(css, /#resultsList\[data-tree-view-mode="large"\]\s+\.tree-title,\s*#resultsList\[data-tree-view-mode="large"\]\s+\.tree-subtitle\s*\{[^}]*white-space:\s*normal/);
});

test('9. Verification of static boundaries and other files integrity', () => {
  const css = read('css/tree-view-mode.css');

  // Verify list mode and trees-grid existing selectors properties are intact
  assert.match(css, /\.trees-grid\[data-tree-view-mode="compact"\]\s+\.tree-card-thumb\s*\{[^}]*height:\s*140px;/);
  assert.match(css, /\.trees-grid\[data-tree-view-mode="compact"\]\s+\.tree-card-title\s*\{[^}]*font-size:\s*0\.95rem;/);

  // Ensure no closes/fixes/resolves statements match
  const testFile = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(testFile, new RegExp('closes' + '\\s+' + '#1882', 'i'));
  assert.doesNotMatch(testFile, new RegExp('fixes' + '\\s+' + '#1882', 'i'));
  assert.doesNotMatch(testFile, new RegExp('resolves' + '\\s+' + '#1882', 'i'));
});
