'use strict';

const { pathToFileURL } = require('node:url');

/**
 * Dynamically import a module from an absolute filesystem path.
 * Windows-safe: drive letters must not be treated as URL schemes.
 *
 * @param {string} absolutePath Absolute path to an ES module file
 * @returns {Promise<any>} Module namespace
 */
function importAbsolute(absolutePath) {
  if (typeof absolutePath !== 'string' || absolutePath.length === 0) {
    return Promise.reject(new TypeError('importAbsolute requires a non-empty absolute path string'));
  }
  return import(pathToFileURL(absolutePath).href);
}

module.exports = {
  importAbsolute,
  pathToFileURL,
};
