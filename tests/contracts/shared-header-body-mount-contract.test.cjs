const fs = require('fs');
const path = require('path');
const assert = require('assert');

const targetPages = [
  'index.html',
  'pages/intro.html',
  'pages/search.html',
  'pages/my-trees.html',
  'pages/settings.html'
];

let failed = false;

function check(msg, cond) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    console.error(`  ✗ ${msg}`);
    failed = true;
  }
}

console.log('Running shared-header-body-mount-contract.test.cjs...');

targetPages.forEach(pagePath => {
  const fullPath = path.join(__dirname, '../../', pagePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${pagePath}`);
    failed = true;
    return;
  }
  const content = fs.readFileSync(fullPath, 'utf8');

  // Check 1: Exactly one #shared-header
  const matches = content.match(/id="shared-header"/g);
  check(`${pagePath} has exactly one #shared-header`, matches && matches.length === 1);

  // Check 2: No raw header nav markup
  check(`${pagePath} does not have raw header markup`, !content.includes('<header class="shared-header"'));

  // Check 3: Position in document.
  let wrapperClass = '';
  if (pagePath === 'index.html') wrapperClass = 'home-v3-shell';
  else if (pagePath.includes('intro')) wrapperClass = 'intro-wrapper';
  else if (pagePath.includes('search')) wrapperClass = 'search-container';
  else if (pagePath.includes('my-trees')) wrapperClass = 'my-trees-layout';
  else if (pagePath.includes('settings')) wrapperClass = 'settings-layout';

  const headerIdx = content.indexOf('id="shared-header"');
  // Handle case where wrapper class might be combined with other classes
  const match = content.match(new RegExp(`class="[^"]*\\b${wrapperClass}\\b[^"]*"`));
  const wrapperIdx = match ? match.index : -1;

  if (headerIdx !== -1 && wrapperIdx !== -1) {
    check(`${pagePath} mounts #shared-header before ${wrapperClass}`, headerIdx < wrapperIdx);
  } else {
    check(`Could not find header or wrapper in ${pagePath}`, false);
  }
});

const sharedHeaderJsPath = path.join(__dirname, '../../js/shared-header.js');
if (fs.existsSync(sharedHeaderJsPath)) {
  const jsContent = fs.readFileSync(sharedHeaderJsPath, 'utf8');
  check('js/shared-header.js handles the markup rendering', jsContent.includes('window.renderSharedHeader = function'));
}

if (failed) {
  console.error('shared-header body-mount contracts failed.');
  process.exit(1);
} else {
  console.log('All shared-header body-mount contracts passed.');
}
