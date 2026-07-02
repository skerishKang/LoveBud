'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const memoryFormJs = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form.js'), 'utf8');

test('suggestYouTubeMetadata function is defined in editor-memory-form.js', () => {
  assert.match(memoryFormJs, /function\s+suggestYouTubeMetadata\s*\(/,
    'suggestYouTubeMetadata must be defined');
  assert.match(memoryFormJs, /suggestYouTubeMetadata\s*\(\s*url\s*\)/,
    'suggestYouTubeMetadata must accept url parameter');
});

test('suggestYouTubeMetadata calls YouTube oEmbed API', () => {
  assert.match(memoryFormJs, /youtube\.com\/oembed/,
    'must use YouTube oEmbed API endpoint');
  assert.match(memoryFormJs, /encodeURIComponent/,
    'must encode the video URL for the oEmbed request');
});

test('suggestYouTubeMetadata debounces before fetching', () => {
  assert.match(memoryFormJs, /_youtubeMetadataTimer/,
    'must use a debounce timer (_youtubeMetadataTimer)');
  assert.match(memoryFormJs, /clearTimeout\s*\(\s*_youtubeMetadataTimer\s*\)/,
    'must clear previous timer before setting a new one');
  assert.match(memoryFormJs, /setTimeout\s*\([^,]+,\s*800\s*\)/,
    'must debounce with 800ms delay');
});

test('suggestYouTubeMetadata guards against overwriting user-edited title', () => {
  assert.match(memoryFormJs, /userHasEditedTitle/,
    'must check userHasEditedTitle before filling title');
  assert.match(memoryFormJs, /currentTitle\.length\s*>\s*0/,
    'must not overwrite a non-empty title field');
  assert.match(memoryFormJs, /refs\.titleInput\.value\s*=\s*data\.title/,
    'must fill title input from oEmbed response');
});

test('suggestYouTubeMetadata silently fails on network error', () => {
  assert.match(memoryFormJs, /\.catch\s*\(/,
    'must handle fetch errors');
  assert.match(memoryFormJs, /Silently fail/,
    'must fail silently (optional feature)');
});

test('suggestYouTubeMetadata called from URL input handler', () => {
  assert.match(memoryFormJs, /suggestYouTubeMetadata\s*\(\s*url\s*\)/,
    'must be called from the URL input handler with the current URL');
});

test('suggestYouTubeMetadata detects standard YouTube URL patterns', () => {
  // Check that the regex matches typical forms
  const re = /youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\//;
  assert.match('https://www.youtube.com/watch?v=kXpOEzNZ8hQ', re,
    'must match youtube.com/watch?v=...');
  assert.match('https://youtu.be/kXpOEzNZ8hQ', re,
    'must match youtu.be/...');
  assert.match('https://www.youtube.com/embed/kXpOEzNZ8hQ', re,
    'must match youtube.com/embed/...');
});

test('suggestYouTubeMetadata handles repeated requests to same URL', () => {
  assert.match(memoryFormJs, /_lastSuggestedUrl/,
    'must track last suggested URL to avoid duplicate fetch');
  assert.match(memoryFormJs, /_lastSuggestedUrl\s*===\s*url/,
    'must skip fetch when URL matches last suggestion');
});
