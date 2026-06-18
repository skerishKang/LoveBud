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
  assert.ok(introI18n.includes('\ub7ec\ube0c\ud2b8\ub9ac\ub294'));
  assert.ok(introI18n.includes('\ub9c8\uc74c\uc774 \uc790\ub77c\ub294'));
  assert.ok(introI18n.includes('\uae30\ub85d \uacf5\uac04\uc774\uc5d0\uc694'));
  assert.ok(introI18n.includes('\ub0b4 \ub9c8\uc74c\uc774 \uae4a\uc5b4\uc9c4 \uacbd\ub85c\ub97c \ucc9c\ucc9c\ud788 \ubcf4\uc5ec\uc90d\ub2c8\ub2e4'));

  assert.ok(!introI18n.includes('\uccab \uc21c\uac04\uc774 \ud558\ub098\uc758'));
  assert.ok(!introI18n.includes('\ubc18\ud588\ub358 \uc7a5\uba74\uacfc \uc624\ub798 \ub0a8\uc740 \ub9c8\uc74c\uc744'));
  assert.ok(!introI18n.includes('\ub9c8\uc74c\uc744,<br class="pc-only">\uac10\uc815\uc774'));
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
    rule: /font-size:\s*clamp\(2\.95rem,\s*10vw,\s*4\.3rem\)/,
    label: 'mobile title font size',
  });

  assertSharedRule({
    homeCss: homeLayoutCss,
    introCss: introHeroLayoutCss,
    rule: /line-height:\s*0\.99/,
    label: 'hero title line height',
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

test('home and intro rotating hero titles share the 640px mobile title size', () => {
  assert.match(
    homeResponsiveCss,
    /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.home-v3-title\s*{[\s\S]*?font-size:\s*clamp\(2\.25rem,\s*10vw,\s*2\.8rem\);[\s\S]*?line-height:\s*1\.04;[\s\S]*?}/,
    'home rotating hero title sets must share the compact 640px title size'
  );

  assert.match(
    introHeroResponsiveCss,
    /@media \(max-width:\s*640px\)\s*{[\s\S]*?body\s+\.intro-hero h1\s*{[\s\S]*?font-size:\s*clamp\(2\.25rem,\s*10vw,\s*2\.8rem\);[\s\S]*?line-height:\s*1\.04;[\s\S]*?}/,
    'intro rotating hero title sets must share the compact 640px title size'
  );
});

test('intro hero mobile spacing and CTA sizing stay aligned with home', () => {
  assertSharedRule({
    homeCss: homeResponsiveCss,
    introCss: introHeroResponsiveCss,
    rule: /gap:\s*22px/,
    label: 'mobile hero gap',
  });

  assert.match(homeResponsiveCss, /\.home-v3-main\s*{[\s\S]*?padding:\s*24px\s+0\s+72px/,
    'home must keep mobile shell padding');
  assert.match(homeResponsiveCss, /\.home-v3-hero\s*{[\s\S]*?padding:\s*12px\s+0\s+8px/,
    'home must keep mobile hero inner padding');
  assert.match(introHeroResponsiveCss, /body\s+\.intro-hero\s*{[\s\S]*?padding:\s*36px\s+0\s+80px/,
    'intro must match home combined mobile hero vertical rhythm');

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
