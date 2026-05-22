const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const STATIC_PAGE_ALIASES = [
  { from: '/intro.html', to: '/pages/intro.html' },
  { from: '/login.html', to: '/pages/login.html' },
  { from: '/search.html', to: '/pages/search.html' },
  { from: '/detail.html', to: '/pages/detail.html' },
  { from: '/editor.html', to: '/pages/editor.html' },
  { from: '/my-trees.html', to: '/pages/my-trees.html' },
];

function aliasTargetExists(alias) {
  const relPath = alias.to.replace(/^\//, '');
  return fs.existsSync(path.join(ROOT, relPath));
}

function allAliases() {
  return STATIC_PAGE_ALIASES;
}

module.exports = {
  allAliases,
  aliasTargetExists,
};
