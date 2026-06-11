const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const homeLayoutCss = fs.readFileSync(path.join(ROOT, 'css', 'index', 'layout.css'), 'utf8');
const homeResponsiveCss = fs.readFileSync(path.join(ROOT, 'css', 'index', 'responsive.css'), 'utf8');
const homeComponentsCss = fs.readFileSync(path.join(ROOT, 'css', 'index', 'components.css'), 'utf8');
const introHeroBaseCss = fs.readFileSync(path.join(ROOT, 'css', 'intro', 'hero', 'base.css'), 'utf8');
const introHeroLayoutCss = fs.readFileSync(path.join(ROOT, 'css', 'intro', 'hero', 'layout.css'), 'utf8');
const introHeroResponsiveCss = fs.readFileSync(path.join(ROOT, 'css', 'intro', 'hero', 'responsive.css'), 'utf8');
const introI18n = fs.readFileSync(path.join(ROOT, 'js', 'i18n', 'i18n-intro.js'), 'utf8');

function assertSharedRule({ homeCss, introCss, rule, label }) {
  assert.match(homeCss, rule, `home must keep ${label}`);
  assert.match(introCss, rule, `intro must match home ${label}`);
}

test('intro hero uses distinct explanatory copy instead of duplicating home hero copy', () => {
  assert.match(introI18n, /러브트리는/);
  assert.match(introI18n, /마음이 자라는/);
  assert.match(introI18n, /기록 공간이에요/);
  assert.match(introI18n, /내 마음이 깊어진 경로를 천천히 보여줍니다/);

  assert.doesNotMatch(introI18n, /첫 순간이 하나의/);
  assert.doesNotMatch(introI18n, /반했던 장면과 오래 남은 마음을/);
  assert.doesNotMatch(introI18n, /마음을,<br class="pc-only">감정이/);
});

test('intro hero desktop shell follows home hero layout rhythm', () => {
  assertSharedRule({
    homeCss: homeLayoutCss,
    introCss: introHeroBaseCss,
    rule: /grid-template-columns:\s*minmax\(0,\s*1\.05fr\)\s+minmax\(420px,\s*0\.95fr\)/,
    label: 'desktop hero grid columns',
  });

  assertSharedRule({
    homeCss: homeLayoutCss,
    introCss: introHeroBaseCss,
    rule: /padding:\s*28px\s+0\s+24px/,
    label: 'desktop hero padding',
  });

  assertSharedRule({
    homeCss: homeLayoutCss,
    introCss: introHeroBaseCss,
    rule: /min-height:\s*min\(820px,\s*calc\(100vh - 108px\)\)/,
    label: 'desktop hero minimum height',
  });
});

test('intro hero mobile title and lead sizing stay aligned with home', () => {
  assertSharedRule({
    homeCss: homeResponsiveCss,
    introCss: introHeroResponsiveCss,
    rule: /font-size:\s*clamp\(2\.25rem,\s*10vw,\s*2\.8rem\)/,
    label: 'mobile title font size',
  });

  assertSharedRule({
    homeCss: homeResponsiveCss,
    introCss: introHeroResponsiveCss,
    rule: /line-height:\s*1\.04/,
    label: 'mobile title line height',
  });

  assertSharedRule({
    homeCss: homeResponsiveCss,
    introCss: introHeroResponsiveCss,
    rule: /font-size:\s*0\.96rem/,
    label: 'mobile lead font size',
  });

  assertSharedRule({
    homeCss: homeResponsiveCss,
    introCss: introHeroResponsiveCss,
    rule: /line-height:\s*1\.72/,
    label: 'mobile lead line height',
  });
});

test('intro hero mobile spacing and CTA sizing stay aligned with home', () => {
  assertSharedRule({
    homeCss: homeResponsiveCss,
    introCss: introHeroResponsiveCss,
    rule: /gap:\s*22px/,
    label: 'mobile hero gap',
  });

  assertSharedRule({
    homeCss: homeResponsiveCss,
    introCss: introHeroResponsiveCss,
    rule: /padding:\s*12px\s+0\s+8px/,
    label: 'mobile hero padding',
  });

  assertSharedRule({
    homeCss: homeResponsiveCss,
    introCss: introHeroResponsiveCss,
    rule: /margin-top:\s*20px/,
    label: 'mobile CTA top margin',
  });

  assertSharedRule({
    homeCss: homeResponsiveCss,
    introCss: introHeroResponsiveCss,
    rule: /min-height:\s*54px/,
    label: 'mobile CTA minimum height',
  });

  assert.match(homeComponentsCss, /\.home-v3-actions\s+\.btn-round\s*{[\s\S]*?font-size:\s*1rem/);
  assert.match(introHeroLayoutCss, /\.intro-hero-actions\s+\.btn-round,[\s\S]*?font-size:\s*1rem/);
});

test('intro hero line color and weight semantics match the home hero', () => {
  assert.match(introHeroLayoutCss, /\.intro-hero h1 \.title-line:nth-child\(1\)\s*{[\s\S]*?color:\s*var\(--on-surface-variant\);[\s\S]*?font-weight:\s*700/);
  assert.match(introHeroLayoutCss, /\.intro-hero h1 \.title-accent\s*{[\s\S]*?color:\s*var\(--primary\);[\s\S]*?font-weight:\s*780/);
  assert.match(introHeroLayoutCss, /\.intro-hero h1 \.title-line:nth-child\(3\)\s*{[\s\S]*?color:\s*#b85c66;[\s\S]*?font-weight:\s*700/);
  assert.doesNotMatch(introHeroLayoutCss, /\.intro-hero h1\s*{[\s\S]*?font-weight:\s*900/);
});
