/**
 * LoveBud Embedded Browser Google Login — Contract Test
 *
 * Locks the post-fix invariants for embedded-browser Google login.
 *
 *   1. auth-firebase.js exposes an isEmbeddedBrowser() helper that
 *      detects (a) running inside a frame/iframe (self !== top),
 *      and (b) common WebView markers (wv / webview / inapp /
 *      app_webview) in the user agent.
 *
 *   2. signInWithGoogle uses signInWithRedirect as the primary path
 *      when isEmbeddedBrowser() returns true. The legacy signInWithPopup
 *      path must NOT be reached on embedded environments.
 *
 *   3. signInWithGoogle still tries signInWithPopup first on regular
 *      browsers, but the redirect fallback (signInWithRedirect) now
 *      runs on ALL pages, not just the login page.
 *
 *   4. The popup-fallback error code list is broadened to cover more
 *      failure modes (auth/popup-closed-by-user, auth/internal-error).
 *
 *   5. initAuth() calls firebase.auth().getRedirectResult() so any
 *      error from a signInWithRedirect flow (e.g. auth/internal-error,
 *      auth/network-request-failed) surfaces a friendly message
 *      instead of leaving the user staring at a logged-in UI that
 *      never actually authenticated.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const authFirebaseJs = fs.readFileSync(
    path.join(ROOT, 'js/auth/auth-firebase.js'),
    'utf8'
);

// ── 1) isEmbeddedBrowser helper exists with proper detection ─────────
test('isEmbeddedBrowser() helper exists in auth-firebase.js', () => {
    assert.match(
        authFirebaseJs,
        /function\s+isEmbeddedBrowser\s*\(\s*\)\s*\{/,
        'auth-firebase.js must define an isEmbeddedBrowser() helper'
    );
});

test('isEmbeddedBrowser() detects running inside a frame (self !== top)', () => {
    assert.match(
        authFirebaseJs,
        /window\.self\s*!==\s*window\.top/,
        'isEmbeddedBrowser must check window.self !== window.top to detect iframe'
    );
});

test('isEmbeddedBrowser() detects cross-origin frame access as embedded', () => {
    // When window.top access throws (cross-origin), treat as embedded
    assert.match(
        authFirebaseJs,
        /cross-?origin\s+frame\s+access/i,
        'isEmbeddedBrowser must treat cross-origin frame access errors as embedded'
    );
});

test('isEmbeddedBrowser() detects common WebView markers in UA', () => {
    // WebView, wv, inapp, app_webview
    assert.match(
        authFirebaseJs,
        /['"]wv['"]/,
        'isEmbeddedBrowser must check for the "wv" WebView marker'
    );
    assert.match(
        authFirebaseJs,
        /['"]webview['"]/,
        'isEmbeddedBrowser must check for the "webview" marker'
    );
    assert.match(
        authFirebaseJs,
        /['"]inapp['"]/,
        'isEmbeddedBrowser must check for the "inapp" marker'
    );
});

// ── 2) signInWithGoogle uses redirect as primary on embedded ─────────
test('signInWithGoogle routes embedded browsers straight to signInWithRedirect', () => {
    assert.match(
        authFirebaseJs,
        /var\s+embedded\s*=\s*isEmbeddedBrowser\(\)/,
        'signInWithGoogle must call isEmbeddedBrowser() into a local var'
    );
    assert.match(
        authFirebaseJs,
        /if\s*\(\s*embedded\s*\)\s*\{[\s\S]*?signInWithRedirect\s*\(\s*provider\s*\)/,
        'signInWithGoogle must call signInWithRedirect(provider) when embedded is true'
    );
});

test('signInWithGoogle does NOT call signInWithPopup in the embedded branch', () => {
    const embeddedBranchMatch = authFirebaseJs.match(
        /if\s*\(\s*embedded\s*\)\s*\{([\s\S]*?)\}/
    );
    assert.ok(embeddedBranchMatch, 'must find embedded branch block');
    const embeddedBranch = embeddedBranchMatch[1];
    assert.ok(
        !/signInWithPopup\s*\(\s*provider\s*\)/.test(embeddedBranch),
        'Embedded branch must NOT call signInWithPopup (the popup fails silently on embedded browsers)'
    );
});

// ── 3) Popup fallback now works on ALL pages, not just login ──────────
test('Popup-to-redirect fallback no longer requires login page', () => {
    assert.ok(
        !/shouldTryRedirectFallback\s*=\s*loginPage\s*&&\s*popupFallbackCodes/.test(authFirebaseJs),
        'Legacy loginPage-AND fallback must be retired (popup errors on non-login pages now also fall back)'
    );
    assert.match(
        authFirebaseJs,
        /shouldTryRedirectFallback\s*=\s*popupFallbackCodes\s*\[\s*error\s*&&\s*error\.code\s*\]/,
        'Popup-to-redirect fallback must now be: popupFallbackCodes[error && error.code]'
    );
});

test('Popup-fallback error code list is broadened', () => {
    assert.match(
        authFirebaseJs,
        /['"]auth\/popup-closed-by-user['"]/,
        'popup-closed-by-user must be in the fallback list'
    );
    assert.match(
        authFirebaseJs,
        /['"]auth\/internal-error['"]/,
        'auth/internal-error must be in the fallback list (covers unknown popup errors)'
    );
});

// ── 4) getRedirectResult handler is installed in initAuth ───────────
test('initAuth calls firebase.auth().getRedirectResult()', () => {
    assert.match(
        authFirebaseJs,
        /firebase\.auth\(\)\.getRedirectResult\(\)/,
        'initAuth must call firebase.auth().getRedirectResult() to handle the redirect callback'
    );
});

test('getRedirectResult surfaces friendly error message on redirect failure', () => {
    assert.match(
        authFirebaseJs,
        /\.catch\(function\(redirectError\)/,
        'getRedirectResult promise must have a catch handler'
    );
    assert.match(
        authFirebaseJs,
        /getFriendlyErrorMessage\(\s*redirectError\s*,\s*true\s*\)/,
        'Redirect error catch handler must format a friendly message'
    );
});

test('getRedirectResult ignores the no-auth-event code (initial page load)', () => {
    assert.match(
        authFirebaseJs,
        /redirectError\.code\s*!==\s*['"]auth\/no-auth-event['"]/,
        'getRedirectResult catch must ignore auth/no-auth-event (initial page load)'
    );
});

test('getRedirectResult persists the auth session on success', () => {
    assert.match(
        authFirebaseJs,
        /result\s*&&\s*result\.user[\s\S]*?persistConfirmedAuthSession\(\s*result\.user/,
        'getRedirectResult success path must call persistConfirmedAuthSession'
    );
});