const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

function getGuardBlock(varName) {
  const arrayStart = editorSource.indexOf(`const ${varName} = [`);
  assert.notEqual(arrayStart, -1, `${varName} array must exist`);

  const nextGuardStart = editorSource.indexOf(`if (${varName}.length)`, arrayStart);
  assert.notEqual(nextGuardStart, -1, `${varName} guard must exist`);

  const returnEnd = editorSource.indexOf('return;', nextGuardStart);
  assert.notEqual(returnEnd, -1, `${varName} guard must return`);

  return editorSource.slice(arrayStart, returnEnd + 'return;'.length);
}

function assertMissingListGuard({ varName, entries }) {
  const block = getGuardBlock(varName);

  assert.match(
    block,
    new RegExp(`const\\s+${varName}\\s*=\\s*\\[`)
  );

  for (const [name, binding] of entries) {
    assert.match(
      block,
      new RegExp(`\\['${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}',\\s*${binding}\\]`)
    );
  }

  assert.match(
    block,
    /\.filter\(\(\[, helper\]\) => typeof helper !== 'function'\)/
  );

  assert.match(
    block,
    new RegExp(
      `if \\(${varName}\\.length\\) \\{ reportEditorBootstrapMissingList\\(${varName}\\); return;`
    )
  );
}

test('editor bootstrap text resolver missing-list guard uses shared structure', () => {
  assertMissingListGuard({
    varName: 'missingTextResolvers',
    entries: [
      ['LoveBudEditorHelpers.safeI18nText', 'safeI18nText'],
      ['LoveBudEditorHelpers.resolveHintText', 'resolveHintText'],
      ['LoveBudEditorHelpers.resolveTreeTitleText', 'resolveTreeTitleText'],
      ['LoveBudEditorHelpers.resolveInfoText', 'resolveInfoText']
    ]
  });
});

test('editor bootstrap media resolver missing-list guard uses shared structure', () => {
  assertMissingListGuard({
    varName: 'missingMediaResolvers',
    entries: [
      ['LoveBudEditorHelpers.escapeHtml', 'escapeHtml'],
      ['LoveBudEditorHelpers.safeUrl', 'safeUrl'],
      ['LoveBudEditorHelpers.resolveMemoryThumbnail', 'resolveMemoryThumbnail']
    ]
  });
});

test('editor bootstrap root helper missing-list guard uses shared structure', () => {
  assertMissingListGuard({
    varName: 'missingRootHelpers',
    entries: [
      ['LoveBudEditorUtils.findRootMemory', 'findRootMemory'],
      ['LoveBudEditorUtils.getCanonicalRootId', 'getCanonicalRootId'],
      ['LoveBudEditorUtils.isRootMemory', 'isRootMemory']
    ]
  });
});

test('editor bootstrap missing-list guards stay before startEditor', () => {
  const startEditorIndex = editorSource.indexOf('const startEditor = async () => {');
  assert.notEqual(startEditorIndex, -1, 'startEditor must exist');

  for (const varName of ['missingTextResolvers', 'missingMediaResolvers', 'missingRootHelpers']) {
    const guardIndex = editorSource.indexOf(`const ${varName} = [`);
    assert.notEqual(guardIndex, -1, `${varName} must exist`);
    assert.ok(guardIndex < startEditorIndex, `${varName} guard must stay before startEditor`);
  }
});

test('editor bootstrap missing-list contract stays in bootstrap domain only', () => {
  const startEditorIndex = editorSource.indexOf('const startEditor = async () => {');
  const startEditorBody = editorSource.slice(startEditorIndex);

  assert.doesNotMatch(startEditorBody, /missingTextResolvers/);
  assert.doesNotMatch(startEditorBody, /missingMediaResolvers/);
  assert.doesNotMatch(startEditorBody, /missingRootHelpers/);
  assert.doesNotMatch(startEditorBody, /reportEditorBootstrapMissingDependency\(/);
});
