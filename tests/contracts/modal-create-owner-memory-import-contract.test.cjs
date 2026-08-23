const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = path.resolve(__dirname, '..', '..', 'modal_compute', 'app.py');

test('private memory POST imports and calls create_owner_memory', () => {
  const source = fs.readFileSync(APP, 'utf8');

  const ownerWritesImport = source.match(
    /from modal_compute\.owner_writes import \(([\s\S]*?)\n\)/
  );

  assert.ok(ownerWritesImport, 'missing owner_writes import block');
  assert.match(
    ownerWritesImport[1],
    /\bcreate_owner_memory,\s*$/m,
    'owner_writes import block must include create_owner_memory'
  );

  assert.match(
    source,
    /@web_app\.post\("\/modal\/private\/memories"\)[\s\S]*?return create_owner_memory\(principal\["legacyOwnerId"\], payload\)/,
    'private memory POST must call imported create_owner_memory with the principal legacyOwnerId'
  );
});
