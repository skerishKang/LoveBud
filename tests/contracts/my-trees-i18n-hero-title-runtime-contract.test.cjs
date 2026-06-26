'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('1. my-trees-i18n-refresh.js must not contain my-trees-title-line class', () => {
  const i18nRefreshJs = read('js/my-trees/my-trees-i18n-refresh.js');
  assert.doesNotMatch(i18nRefreshJs, /my-trees-title-line/, 'Must not have my-trees-title-line class in i18n-refresh.js');
});

test('2. my-trees-i18n-refresh.js must not contain my-trees-title-accent class', () => {
  const i18nRefreshJs = read('js/my-trees/my-trees-i18n-refresh.js');
  assert.doesNotMatch(i18nRefreshJs, /my-trees-title-accent/, 'Must not have my-trees-title-accent class in i18n-refresh.js');
});

test('3. Korean runtime markup has exactly 3 title-line and 1 title-accent with correct order', () => {
  const i18nRefreshJs = read('js/my-trees/my-trees-i18n-refresh.js');

  // Check Korean markup exists with correct classes
  assert.match(i18nRefreshJs, /<span class="title-line">내가 키운<\/span>/, 'Korean first line must have title-line class');
  assert.match(i18nRefreshJs, /<span class="title-line title-accent">러브트리를<\/span>/, 'Korean second line must have title-line and title-accent classes');
  assert.match(i18nRefreshJs, /<span class="title-line">다시 열어보세요<\/span>/, 'Korean third line must have title-line class');

  // Extract Korean section by finding the lines containing Korean text
  const lines = i18nRefreshJs.split('\n');
  let koreanMarkup = '';
  let inKoreanSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('내가 키운')) {
      inKoreanSection = true;
    }
    if (inKoreanSection) {
      koreanMarkup += line + '\n';
      if (line.trim().endsWith(';')) {
        break;
      }
    }
  }
  assert.ok(koreanMarkup, 'Korean markup section must be found');

  const titleLineMatches = (koreanMarkup.match(/class="[^"]*title-line[^"]*"/g) || []).length;
  const titleAccentMatches = (koreanMarkup.match(/class="[^"]*title-accent[^"]*"/g) || []).length;

  assert.strictEqual(titleLineMatches, 3, 'Korean markup must have exactly 3 title-line classes');
  assert.strictEqual(titleAccentMatches, 1, 'Korean markup must have exactly 1 title-accent class');
});

test('4. English runtime markup has exactly 2 title-line and 1 title-accent', () => {
  const i18nRefreshJs = read('js/my-trees/my-trees-i18n-refresh.js');

  // Check English markup exists with correct classes
  assert.match(i18nRefreshJs, /<span class="title-line">Open and continue<\/span>/, 'English first line must have title-line class');
  assert.match(i18nRefreshJs, /<span class="title-line title-accent">Your LoveTrees<\/span>/, 'English second line must have title-line and title-accent classes');

  // Extract English assignment
  const lines = i18nRefreshJs.split('\n');
  let englishMarkup = '';
  let inEnglishSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('Open and continue')) {
      inEnglishSection = true;
    }
    if (inEnglishSection) {
      englishMarkup += line + '\n';
      if (line.trim().endsWith(';')) {
        break;
      }
    }
  }
  assert.ok(englishMarkup, 'English markup section must be found');

  const titleLineMatches = (englishMarkup.match(/class="[^"]*title-line[^"]*"/g) || []).length;
  const titleAccentMatches = (englishMarkup.match(/class="[^"]*title-accent[^"]*"/g) || []).length;

  assert.strictEqual(titleLineMatches, 2, 'English markup must have exactly 2 title-line classes');
  assert.strictEqual(titleAccentMatches, 1, 'English markup must have exactly 1 title-accent class');
});

test('5. pages/my-trees.html initial hero markup uses shared class structure', () => {
  const myTreesHtml = read('pages/my-trees.html');

  assert.match(myTreesHtml, /<span class="title-line">내가 키운<\/span>/, 'Initial HTML first span must have title-line class');
  assert.match(myTreesHtml, /<span class="title-line title-accent">러브트리를<\/span>/, 'Initial HTML second span must have title-line and title-accent classes');
  assert.match(myTreesHtml, /<span class="title-line">다시 열어보세요<\/span>/, 'Initial HTML third span must have title-line class');

  assert.doesNotMatch(myTreesHtml, /my-trees-title-line/, 'Initial HTML must not have my-trees-title-line class');
  assert.doesNotMatch(myTreesHtml, /my-trees-title-accent/, 'Initial HTML must not have my-trees-title-accent class');
});

test('6. search-hero-controls.css has required shared title-line rules', () => {
  const sharedCss = read('css/search/search-hero-controls.css');

  assert.match(sharedCss, /\.search-panel-header h1 \.title-line\s*{\s*display:\s*block;/, 'Must have display: block for .title-line in shared CSS');
  assert.match(sharedCss, /\.title-accent\s*{\s*color:\s*var\(--primary\);\s*font-weight:\s*780;/, 'Must have correct styling for .title-accent');
});
