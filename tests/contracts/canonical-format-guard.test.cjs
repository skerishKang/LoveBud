const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('canonical contract test format: no .test.js files in tests/contracts/', () => {
  const dir = path.resolve(__dirname);
  const jsFiles = fs.readdirSync(dir).filter(f => f.endsWith('.test.js'));
  assert.equal(
    jsFiles.length,
    0,
    `Expected 0 .test.js files in tests/contracts/, found ${jsFiles.length}: ${jsFiles.join(', ')}. ` +
    'Canonical contract test extension is .test.cjs. ' +
    'Reintroduction of .test.js files requires a deliberate repository-wide ESM migration.'
  );
});
