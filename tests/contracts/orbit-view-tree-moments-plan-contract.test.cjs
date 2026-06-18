const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Orbit View Tree Moments Plan Contract Test', async (t) => {
  const planPath = path.join(__dirname, '../../docs/product/lovebud-orbit-view-tree-moments-plan.md');

  await t.test('Plan file exists and is not empty', () => {
    assert.ok(fs.existsSync(planPath), 'Plan file does not exist');
    const content = fs.readFileSync(planPath, 'utf8');
    assert.ok(content.length > 500, 'Plan file is too short or empty');
  });

  await t.test('Plan contains Refs #2692 and no automatic closing keywords', () => {
    const content = fs.readFileSync(planPath, 'utf8');
    assert.match(content, /Refs #2692/, 'Plan must contain Refs #2692');

    const forbiddenClosingKeywords = [
      /Closes #2692/i,
      /Fixes #2692/i,
      /Resolves #2692/i,
      /Closes #1882/i,
      /Fixes #1882/i,
      /Resolves #1882/i
    ];

    for (const pattern of forbiddenClosingKeywords) {
      assert.ok(!pattern.test(content), `Plan contains forbidden pattern: ${pattern}`);
    }
  });

  await t.test('Plan documents product scopes and priorities', () => {
    const content = fs.readFileSync(planPath, 'utf8');
    assert.match(content, /Priority 1: Tree-Internal Moment Orbit View/i);
    assert.match(content, /Home Hero 3D Preview/i);
    assert.match(content, /My Trees.*Hub 3D Preview/i);
    assert.match(content, /#2678 Boundary/i);
    assert.match(content, /opt-in & read-only/i);
    assert.match(content, /editor flow.*unchanged/i);
    assert.match(content, /트리 보기 \/ 입체 보기/);
  });

  await t.test('Plan documents technical constraints and fallbacks', () => {
    const content = fs.readFileSync(planPath, 'utf8');
    assert.match(content, /CSS 3D \/ Transform-First/i);
    assert.match(content, /WebGL\/Three\.js/i);
    assert.match(content, /reduced-motion fallback/i);
    assert.match(content, /mobile fallback/i);
    assert.match(content, /Scout integration/i);
    assert.match(content, /Cloudflare env/i);
    assert.match(content, /production activation/i);
    assert.match(content, /blocked/i);
  });
});
