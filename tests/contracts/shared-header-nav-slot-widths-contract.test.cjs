const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CSS_FILE = path.join(__dirname, '../../css/global/global-header.css');
const JS_FILE = path.join(__dirname, '../../js/shared-header.js');

function runTests() {
  console.log('Running shared-header-nav-slot-widths-contract.test.cjs...');

  // 1. CSS changes exist
  assert.ok(fs.existsSync(CSS_FILE), 'global-header.css must exist');
  const cssContent = fs.readFileSync(CSS_FILE, 'utf-8');

  // Check display: grid on desktop
  assert.ok(cssContent.includes('display: grid;'), 'must use display: grid on desktop');
  
  // Check 5 slots in grid-template-columns (desktop)
  assert.ok(cssContent.includes('grid-template-columns: 72px 118px 86px 106px 64px;'), 'desktop grid template columns must have 5 slots');

  // Check 5 slots in grid-template-columns (tablet)
  assert.ok(cssContent.includes('grid-template-columns: 60px 98px 74px 92px 56px;'), 'tablet grid template columns must have 5 slots');

  // Check .nav-links a properties
  assert.ok(cssContent.includes('width: 100%;'), '.nav-links a must have width: 100%');
  assert.ok(cssContent.includes('padding: 0;'), '.nav-links a must have padding: 0');
  assert.ok(cssContent.includes('flex: 0 0 auto;'), '.nav-links a must have flex: 0 0 auto');
  
  // Check .nav-links a.nav-highlight margin
  assert.ok(cssContent.includes('margin: 0;'), '.nav-links a.nav-highlight must have margin: 0');

  // Check .headline.header-logo locked font-size
  assert.ok(cssContent.includes('font-size: 24px;'), '.headline.header-logo must have font-size: 24px');

  // Check mobile max-width: 768px block still exists
  assert.ok(cssContent.includes('@media (max-width: 768px)'), 'Mobile max-width 768px block must be preserved');

  // 2. JS file unchanged (rough check to see if it exists and wasn't renamed or deleted)
  assert.ok(fs.existsSync(JS_FILE), 'shared-header.js must exist');

  console.log('shared-header-nav-slot-widths-contract.test.cjs PASSED!');
}

runTests();
