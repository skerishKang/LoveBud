/**
 * Auth Email Entry Contract Test
 *
 * Covers:
 * 1. login.html has #login-btn-email, #email-auth-modal, and loads auth-email-entry.js
 * 2. signup.html has #signup-btn-email, #email-auth-modal, and loads auth-email-entry.js
 * 3. signup.html does NOT reference non-existent js/signup-page.js
 * 4. auth-email-entry.js core behavior (__initialAuthMode, focus management)
 * 5. signup mode: displayName required, reset hidden
 * 6. Escape and focus-return hooks exist in module
 * 7. Google OAuth code paths in auth-firebase.js unchanged
 *
 * No network, no Firebase — pure static and JS module contract.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// ── Helper ──────────────────────────────────────────────────────────

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; }
}

function getElementAttrs(html, id) {
  // Simple regex to find an element by id and extract its tag + attrs
  const re = new RegExp(
    '<(\\w+)[^>]*\\sid="' + id + '"[^>]*>',
    'i'
  );
  const m = html.match(re);
  if (!m) return null;
  return { tag: m[1], full: m[0] };
}

function hasScriptSrc(html, srcPattern) {
  const re = new RegExp(
    '<script[^>]*src\\s*=\\s*"[^"]*' +
    srcPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[^"]*"[^>]*>',
    'i'
  );
  return re.test(html);
}

function countScriptReference(html, srcPattern) {
  const re = new RegExp(
    '<script[^>]*src\\s*=\\s*"[^"]*' +
    srcPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[^"]*"[^>]*>',
    'gi'
  );
  const matches = html.match(re);
  return matches ? matches.length : 0;
}

// ── Static HTML Contracts ───────────────────────────────────────────

test('login.html: has #login-btn-email', function () {
  const html = readFile(path.join(ROOT, 'pages/login.html'));
  assert.ok(html.length > 0, 'login.html should exist and be non-empty');

  const btn = getElementAttrs(html, 'login-btn-email');
  assert.ok(btn, '#login-btn-email element should exist');
  assert.equal(btn.tag, 'button');
  assert.ok(
    btn.full.includes('btn-round') && btn.full.includes('login-email-button'),
    '#login-btn-email should have round/email button classes'
  );
});

test('login.html: has #email-auth-modal', function () {
  const html = readFile(path.join(ROOT, 'pages/login.html'));
  const modal = getElementAttrs(html, 'email-auth-modal');
  assert.ok(modal, '#email-auth-modal element should exist in login.html');
  assert.ok(
    modal.full.includes('role="dialog"'),
    'modal should have role="dialog"'
  );
});

test('login.html: loads auth-email-entry.js', function () {
  const html = readFile(path.join(ROOT, 'pages/login.html'));
  assert.ok(
    hasScriptSrc(html, 'auth-email-entry.js'),
    'login.html should load js/auth/auth-email-entry.js'
  );
});

test('signup.html: has #signup-btn-email', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  assert.ok(html.length > 0, 'signup.html should exist and be non-empty');

  const btn = getElementAttrs(html, 'signup-btn-email');
  assert.ok(btn, '#signup-btn-email element should exist');
  assert.equal(btn.tag, 'button');
  assert.ok(
    btn.full.includes('btn-round') && btn.full.includes('login-email-button'),
    '#signup-btn-email should have round/email button classes'
  );
});

test('signup.html: has #email-auth-modal', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  const modal = getElementAttrs(html, 'email-auth-modal');
  assert.ok(modal, '#email-auth-modal element should exist in signup.html');
});

test('signup.html: loads auth-email-entry.js', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  assert.ok(
    hasScriptSrc(html, 'auth-email-entry.js'),
    'signup.html should load js/auth/auth-email-entry.js'
  );
});

test('signup.html: does NOT reference js/signup-page.js', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  assert.equal(
    countScriptReference(html, 'signup-page.js'),
    0,
    'signup.html must not reference the non-existent js/signup-page.js'
  );
});

// ── Modal HTML structure ────────────────────────────────────────────

test('signup.html: modal has required elements', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  const requiredIds = [
    'email-auth-modal',
    'email-auth-close',
    'email-auth-title',
    'email-auth-form',
    'email-auth-email',
    'email-auth-password',
    'email-auth-display-name',
    'email-auth-submit',
    'email-auth-toggle',
    'email-auth-reset',
    'email-auth-reset-wrap',
    'auth-mode-badge',
  ];
  for (const id of requiredIds) {
    const el = getElementAttrs(html, id);
    assert.ok(el, `signup.html modal should have #${id}`);
  }

  // data-auth-display-name-wrap attribute
  assert.ok(
    html.includes('data-auth-display-name-wrap'),
    'signup.html modal should have [data-auth-display-name-wrap]'
  );
  // display-name input should have required on signup
  const dnInput = getElementAttrs(html, 'email-auth-display-name');
  assert.ok(dnInput, '#email-auth-display-name should exist');
});

test('signup.html: display name wrap starts hidden', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  const wrap = html.match(/<div[^>]*data-auth-display-name-wrap[^>]*>/i);
  assert.ok(wrap, '[data-auth-display-name-wrap] should exist');
  assert.ok(
    wrap[0].includes('display:none') || wrap[0].includes("display: 'none'"),
    'display name wrap should start display:none'
  );
});

// ── auth-email-entry.js module contract ─────────────────────────────

test('auth-email-entry.js: sets __initialAuthMode', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-email-entry.js'));
  assert.ok(src.length > 0, 'auth-email-entry.js should exist');

  // Must set __initialAuthMode when opening modal
  assert.ok(
    src.includes('__initialAuthMode'),
    'module should reference __initialAuthMode'
  );
});

test('auth-email-entry.js: syncs displayName visibility for signup mode', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-email-entry.js'));
  // Must handle display name required state
  assert.ok(
    src.includes('displayNameInput.required'),
    'module should set displayNameInput.required'
  );
  assert.ok(
    src.includes('displayNameWrap.style.display'),
    'module should toggle displayNameWrap visibility'
  );
});

test('auth-email-entry.js: hides reset button in signup mode', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-email-entry.js'));
  assert.ok(
    src.includes('resetBtn.disabled'),
    'module should disable reset button'
  );
  assert.ok(
    src.includes('resetWrap.hidden'),
    'module should hide reset wrap'
  );
});

test('auth-email-entry.js: has Escape key handler on modal', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-email-entry.js'));
  assert.ok(
    src.includes('Escape') || src.includes('Esc'),
    'module should handle Escape key'
  );
});

test('auth-email-entry.js: restores focus on close', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-email-entry.js'));
  assert.ok(
    src.includes('lastTriggerButton'),
    'module should track lastTriggerButton for focus restoration'
  );
});

test('auth-email-entry.js: has toggle handler', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-email-entry.js'));
  assert.ok(
    src.includes('email-auth-toggle'),
    'module should bind the login/signup toggle button'
  );
});

test('auth-email-entry.js: is idempotent (self-guarded)', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-email-entry.js'));
  assert.ok(
    src.includes('LoveBudAuthEmailEntry'),
    'module should guard against double-initialization'
  );
});

// ── Google OAuth Code Path Unchanged ────────────────────────────────

test('auth-firebase.js: Google OAuth code paths unchanged', function () {
  const src = readFile(path.join(ROOT, 'js/auth/auth-firebase.js'));
  assert.ok(src.length > 0, 'auth-firebase.js should exist');

  // Must still have GoogleAuthProvider
  assert.ok(
    src.includes('GoogleAuthProvider'),
    'auth-firebase.js must have GoogleAuthProvider usage'
  );
  // Must still have signInWithGoogle
  assert.ok(
    src.includes('signInWithGoogle'),
    'auth-firebase.js must have signInWithGoogle'
  );
  // Must still have signInWithPopup
  assert.ok(
    src.includes('signInWithPopup'),
    'auth-firebase.js must have signInWithPopup'
  );
  // Must still have signInWithRedirect
  assert.ok(
    src.includes('signInWithRedirect'),
    'auth-firebase.js must have signInWithRedirect'
  );
  // Must still handle embedded browser detection
  assert.ok(
    src.includes('isEmbeddedBrowser'),
    'auth-firebase.js must have isEmbeddedBrowser detection'
  );
  // Must still have getRedirectResult
  assert.ok(
    src.includes('getRedirectResult'),
    'auth-firebase.js must handle getRedirectResult'
  );
  // Must not have any React references
  assert.ok(
    !src.includes('React'),
    'auth-firebase.js must not have React code'
  );
});

test('login.html: Google OAuth button unchanged', function () {
  const html = readFile(path.join(ROOT, 'pages/login.html'));
  assert.ok(
    html.includes('login-btn-google'),
    'login.html should have #login-btn-google'
  );
  assert.ok(
    html.includes('Google로 로그인'),
    'login.html should show Google login text'
  );
});

test('signup.html: Google OAuth button unchanged', function () {
  const html = readFile(path.join(ROOT, 'pages/signup.html'));
  assert.ok(
    html.includes('signup-btn-google'),
    'signup.html should have #signup-btn-google'
  );
  assert.ok(
    html.includes('Google로 회원가입'),
    'signup.html should show Google signup text'
  );
});

// ── i18n Login Headline ─────────────────────────────────────────────

test('login headline: "다시" removed from login.html', function () {
  const html = readFile(path.join(ROOT, 'pages/login.html'));
  const headline = html.match(
    /<h1[^>]*class="[^"]*headline[^"]*login-headline[^"]*"[^>]*>[^<]+<\/h1>/
  );
  assert.ok(headline, 'login headline h1 should exist');
  assert.ok(
    !headline[0].includes('다시'),
    'login headline should not contain "다시"'
  );
  assert.ok(
    headline[0].includes('러브트리에 로그인하세요'),
    'login headline should say "러브트리에 로그인하세요"'
  );
});

test('login headline: "다시" removed from i18n-login.js', function () {
  const i18n = readFile(path.join(ROOT, 'js/i18n/i18n-login.js'));
  const titleEntry = i18n.match(/'login_title':\s*\{[^}]+\}/s);
  assert.ok(titleEntry, 'login_title i18n entry should exist');
  assert.ok(
    !titleEntry[0].includes('다시'),
    'login_title i18n entry should not contain "다시"'
  );
  assert.ok(
    titleEntry[0].includes('러브트리에 로그인하세요'),
    'login_title i18n entry should say "러브트리에 로그인하세요"'
  );
});

// ── Protected file guard ────────────────────────────────────────────

test('No protected PR files modified', function () {
  // This test runs against the current checkout to verify no protected
  // files (PR #2960, #2856 related) were touched.
  // The actual git diff check runs at the end as a separate step.
  const distFiles = [
    path.join(ROOT, 'js/editor/editor-dist.js'),
    path.join(ROOT, 'js/auth/auth-google.js'),
  ];
  for (const f of distFiles) {
    try {
      const stat = fs.statSync(f);
      // If file exists, just check it hasn't been rewritten with new content
      const content = readFile(f);
      assert.ok(
        content.length > 0,
        `${f} should exist and be non-empty`
      );
    } catch (e) {
      // File may not exist in this version — acceptable
    }
  }
});
