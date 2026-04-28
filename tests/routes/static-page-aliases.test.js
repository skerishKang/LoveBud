const test = require('node:test');
const assert = require('node:assert/strict');
const { allAliases, aliasTargetExists } = require('../helpers/route-aliases');

test('static page aliases: target pages exist', (t) => {
  const aliases = allAliases();
  for (const alias of aliases) {
    assert.ok(
      aliasTargetExists(alias),
      `missing target page: ${alias.to} (for alias ${alias.from} -> ${alias.to})`
    );
  }
});