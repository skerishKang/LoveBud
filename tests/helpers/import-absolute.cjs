'use strict';

const { ReadableStream } = require('node:stream/web');
const { TextEncoder } = require('node:util');
const { pathToFileURL } = require('node:url');

/**
 * Dynamically import a module from an absolute filesystem path.
 * Windows-safe: drive letters must not be treated as URL schemes.
 *
 * Legacy Scout endpoint contract tests use lightweight request doubles that
 * expose text() but predate Request.body streaming. Keep production request
 * handling stream-only while upgrading those doubles at the test import seam.
 * Real Request objects, and any double that already provides body, are left
 * untouched.
 *
 * @param {string} absolutePath Absolute path to an ES module file
 * @returns {Promise<any>} Module namespace
 */
function importAbsolute(absolutePath) {
  if (typeof absolutePath !== 'string' || absolutePath.length === 0) {
    return Promise.reject(new TypeError('importAbsolute requires a non-empty absolute path string'));
  }

  return import(pathToFileURL(absolutePath).href).then((mod) => {
    const normalized = absolutePath.replace(/\\/g, '/');
    const isScoutSuggest = normalized.endsWith('/functions/api/scout/suggest.js');

    if (!isScoutSuggest || typeof mod.onRequestPost !== 'function') {
      return mod;
    }

    return {
      ...mod,
      onRequestPost: (context) => mod.onRequestPost(withStreamBackedLegacyScoutRequest(context)),
    };
  });
}

function withStreamBackedLegacyScoutRequest(context) {
  const request = context && context.request;
  if (!request || request.body != null || typeof request.text !== 'function') {
    return context;
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        const text = await request.text();
        const encoded = encoder.encode(String(text ?? ''));
        if (encoded.byteLength > 0) {
          controller.enqueue(encoded);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return {
    ...context,
    request: {
      ...request,
      body,
    },
  };
}

module.exports = {
  importAbsolute,
  pathToFileURL,
};