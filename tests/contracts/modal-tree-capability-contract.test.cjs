'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODAL_APP = path.join(ROOT, 'modal_compute', 'app.py');

function readModalApp() {
  return fs.readFileSync(MODAL_APP, 'utf8');
}

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function getTopLevelFunction(source, functionName) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => (
    new RegExp(`^(?:async\\s+)?def\\s+${functionName}\\s*\\(`).test(line)
  ));
  if (start === -1) return '';
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^(?:async\s+)?def\s+\w+\s*\(/.test(lines[index]) || /^class\s+\w+/.test(lines[index]) || /^@\w/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

test('get_private_tree_capability auth contract and logic checks', () => {
  const source = readModalApp();
  const body = getTopLevelFunction(source, 'get_private_tree_capability');
  assert.ok(body.length > 0, 'get_private_tree_capability endpoint must exist');
  
  const normalized = compact(body);
  assert.match(normalized, /require_firebase_user\(authorization\)/, 'must require firebase user');
  assert.match(normalized, /fetch_owner_tree\(safe_tree_id,user\["uid"\]\)/, 'must query owner tree');
  assert.match(normalized, /"viewercanedit":treeisnotnone/, 'must return capability boolean mapping');
});
