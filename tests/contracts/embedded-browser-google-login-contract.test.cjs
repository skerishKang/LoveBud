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
 *   2. signInWithGoogle ALWAYS uses signInWithRedirect — there is no
 *      signInWithPopup branch anymore. This guarantees the login flow
 *      works in embedded browsers, with popup blockers, and in any
 *      other environment that suppresses popups. Behavior is identical
 *      across all environments.
 *
 *   3. initAuth() calls firebase.auth().getRedirectResult() so any
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
    assert.match(
        authFirebaseJs,
        /cross-?origin\s+frame\s+access/i,
        'isEmbeddedBrowser must treat cross-origin frame access errors as embedded'
    );
});

test('isEmbeddedBrowser() detects common WebView markers in UA', () => {
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

// ── 2) signInWithGoogle ALWAYS uses signInWithRedirect ───────────────
test('signInWithGoogle does NOT call signInWithPopup anywhere', () => {
    assert.ok(
        !/firebase\.auth\(\)\.signInWithPopup\s*\(\s*provider\s*\)/.test(authFirebaseJs),
        'signInWithGoogle must NOT call signInWithPopup anywhere — always use signInWithRedirect'
    );
});

test('signInWithGoogle always calls signInWithRedirect', () => {
    assert.match(
        authFirebaseJs,
        /await\s+firebase\.auth\(\)\.signInWithRedirect\s*\(\s*provider\s*\)/,
        'signInWithGoogle must call signInWithRedirect(provider) — always'
    );
});

// ── 3) Popup-fallback error code list is retired ─────────────────────
test('Popup-fallback error code list is retired', () => {
    // The legacy popupFallbackCodes object must be gone since popup
    // is no longer used as a path.
    assert.ok(
        !/popupFallbackCodes/.test(authFirebaseJs),
        'Legacy popupFallbackCodes must not appear after popup is retired'
    );
    assert.ok(
        !/shouldTryRedirectFallback/.test(authFirebaseJs),
        'Legacy shouldTryRedirectFallback guard must not appear'
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
        /getFriendlyErrorMessage\(\s*safeRedirectError\s*,\s*true\s*\)/,
        'Redirect error catch handler must format a friendly message using a safe wrapper'
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

// ── 5) Race-condition guard: persist BEFORE redirect ────────────────
test('getRedirectResult callback is an async function (allows await)', () => {
    assert.match(
        authFirebaseJs,
        /\.getRedirectResult\(\)\.then\(async function/,
        'getRedirectResult callback must be async so it can await persistConfirmedAuthSession'
    );
});

test('getRedirectResult awaits persistConfirmedAuthSession before navigating', () => {
    // The persist call must be `await`ed, not fire-and-forgotten.
    // The old (buggy) form was: persistConfirmedAuthSession(result.user).catch(function() {});
    // The new form must be: await persistConfirmedAuthSession(result.user);
    assert.ok(
        !/persistConfirmedAuthSession\(\s*result\.user\s*\)\.catch\(\s*function\s*\(\s*\)\s*\{/.test(authFirebaseJs),
        'Legacy fire-and-forget persistConfirmedAuthSession(...).catch(function(){}) must not return (caused the redirect race)'
    );
    assert.match(
        authFirebaseJs,
        /await\s+persistConfirmedAuthSession\(\s*result\.user\s*\)/,
        'persistConfirmedAuthSession must be awaited before redirect navigation'
    );
});

test('getRedirectResult does NOT navigate when persistConfirmedAuthSession rejects', () => {
    // If persist fails, we must surface the error to the user and skip
    // the window.location.replace — otherwise protected routes read an
    // empty cache and bounce the user back to /pages/login, looking
    // like the redirect sign-in never happened.
    const persistCatchBlock = authFirebaseJs.match(
        /catch\s*\(\s*persistError\s*\)\s*\{([\s\S]*?return\s*;[\s\S]*?)\}/m
    );
    assert.ok(persistCatchBlock, 'must find a persist catch block');
    const persistBody = persistCatchBlock[1];
    // Must alert or otherwise surface the failure (not silently swallow)
    assert.match(
        persistBody,
        /alert\s*\(/,
        'persist catch block must alert the user (no silent failure)'
    );
    assert.match(
        persistBody,
        /return\s*;/,
        'persist catch block must return early so window.location.replace is skipped'
    );
});

test('getRedirectResult and persist failure paths do NOT pass raw error objects to getFriendlyErrorMessage', () => {
    // Check that redirectError is wrapped in safeRedirectError
    assert.match(
        authFirebaseJs,
        /var\s+safeRedirectError\s*=\s*\{\s*code:\s*redirectError\.code\s*||\s*['"]['"]\s*,\s*name:\s*redirectError\.name\s*||\s*['"]['"]\s*,\s*message:\s*['"]['"]\s*\};/,
        'Redirect path must construct safeRedirectError wrapper'
    );
    // Check that persistError is wrapped in safePersistError
    assert.match(
        authFirebaseJs,
        /var\s+safePersistError\s*=\s*\{\s*code:\s*persistError\s*&&\s*persistError\.code\s*||\s*['"]['"]\s*,\s*name:\s*persistError\s*&&\s*persistError\.name\s*||\s*['"]['"]\s*,\s*message:\s*['"]['"]\s*\};/,
        'Persist path must construct safePersistError wrapper'
    );
    // Check that getFriendlyErrorMessage is called with safe wrapper
    assert.match(
        authFirebaseJs,
        /friendlyPersist\s*=\s*getFriendlyErrorMessage\(\s*safePersistError\s*,\s*true\s*\)/,
        'Persist error catch must format friendly message using safe wrapper'
    );
});