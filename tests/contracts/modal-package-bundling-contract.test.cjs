const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODAL_APP = path.join(ROOT, 'modal_compute', 'app.py');

function readModalApp() {
  return fs.readFileSync(MODAL_APP, 'utf8').replace(/\r\n/g, '\n');
}

test('modal image includes the local modal_compute package source', () => {
  const content = readModalApp();
  const imageDefinition = content.slice(
    content.indexOf('image = ('),
    content.indexOf('web_app = FastAPI(')
  );

  assert.ok(
    imageDefinition.includes('.add_local_python_source("modal_compute")'),
    'Modal image must include modal_compute sibling modules in deployed containers'
  );
});
