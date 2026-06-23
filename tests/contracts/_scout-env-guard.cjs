'use strict';

var path = require('path');

function toFileUrl(absPath) {
  return 'file:///' + absPath.replace(/\\/g, '/');
}

function shouldSkip() {
  if (!process.env.SCOUT_TESTS_ENABLED) {
    console.log('[scout-env-guard] SCOUT_TESTS_ENABLED not set \u2014 skipping Scout contract tests');
    return true;
  }
  return false;
}

module.exports = { shouldSkip: shouldSkip, safeImport: function(absPath) { return import(toFileUrl(absPath)); }, toFileUrl: toFileUrl };
