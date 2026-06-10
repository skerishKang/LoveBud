const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const settingsJsPath = path.join(__dirname, '..', '..', 'js', 'settings.js');

test('settings page does not block shared profile dropdown trigger clicks', () => {
  const source = fs.readFileSync(settingsJsPath, 'utf8');

  assert.match(source, /function bindCloseInteractions\(\)/);
  assert.doesNotMatch(source, /document\.addEventListener\(\s*['"]click['"][\s\S]*?user-dropdown-trigger[\s\S]*?preventDefault\(\)[\s\S]*?stopPropagation\(\)[\s\S]*?true\s*\)/);
  assert.doesNotMatch(source, /e\.target\.closest\(['"]\.user-dropdown-trigger['"]\)[\s\S]*?e\.preventDefault\(\)[\s\S]*?e\.stopPropagation\(\)/);
});
