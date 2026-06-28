const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('Editor Add Memory Form Label Association Contract', async (t) => {
  const template = read('js/editor/templates/editor-add-memory-form-template.js');

  await t.test('all 6 label ids exist in the template', () => {
    const labelIds = ['memoryUrlLabel', 'memoryStartTimeLabel', 'memoryEndTimeLabel',
                      'memoryTitleLabel', 'memoryTagsLabel', 'memoryMemoLabel'];
    for (const id of labelIds) {
      assert.ok(template.includes('id="' + id + '"'),
        'Template must contain label id="' + id + '"');
    }
  });

  await t.test('all 6 control ids exist in the template', () => {
    const controlIds = ['memoryUrlInput', 'memoryStartTimeInput', 'memoryEndTimeInput',
                        'memoryTitleInput', 'memoryTagsInput', 'memoryMemoInput'];
    for (const id of controlIds) {
      assert.ok(template.includes('id="' + id + '"'),
        'Template must contain control id="' + id + '"');
    }
  });

  await t.test('each label\'s for value matches the correct control id', () => {
    const pairs = [
      ['memoryUrlLabel', 'memoryUrlInput'],
      ['memoryStartTimeLabel', 'memoryStartTimeInput'],
      ['memoryEndTimeLabel', 'memoryEndTimeInput'],
      ['memoryTitleLabel', 'memoryTitleInput'],
      ['memoryTagsLabel', 'memoryTagsInput'],
      ['memoryMemoLabel', 'memoryMemoInput']
    ];
    for (const [labelId, controlId] of pairs) {
      assert.ok(template.includes('id="' + labelId + '" for="' + controlId + '"'),
        'Label ' + labelId + ' must have for="' + controlId + '"');
    }
  });

  await t.test('URL, start, end, title, tags labels are associated with <input> elements', () => {
    const inputLabelIds = ['memoryUrlLabel', 'memoryStartTimeLabel', 'memoryEndTimeLabel',
                           'memoryTitleLabel', 'memoryTagsLabel'];
    for (const labelId of inputLabelIds) {
      const controlId = labelId.replace('Label', 'Input');
      const inputTag = template.match(new RegExp('<input[^>]*id="' + controlId + '"'));
      assert.ok(inputTag, controlId + ' must be an <input> element');
    }
  });

  await t.test('memo label is associated with a <textarea> element', () => {
    assert.ok(template.includes('<textarea id="memoryMemoInput"'),
      'memoryMemoInput must be a <textarea> element');
  });

  await t.test('existing start/end label associations are preserved', () => {
    assert.ok(template.includes('id="memoryStartTimeLabel" for="memoryStartTimeInput"'),
      'Start time label-for association must be preserved');
    assert.ok(template.includes('id="memoryEndTimeLabel" for="memoryEndTimeInput"'),
      'End time label-for association must be preserved');
  });

  await t.test('no aria-label workaround used on label or control elements', () => {
    // Count explicit for= attributes on labels (should be 6)
    const forCount = (template.match(/for="/g) || []).length;
    assert.strictEqual(forCount, 6,
      'Template must use 6 for= attributes (not aria-label or placeholder workarounds)');
  });
});
