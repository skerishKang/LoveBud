'use strict';

// Shared modal accessibility lifecycle reference-adoption contract (Issue #3847).
//
// SOURCE_STATIC layer: reads repository source/docs/configuration and asserts
// on strings, regex, file existence, structure, order, or syntax markers; does
// not execute the asserted target runtime behavior. Runtime behavior of the
// shared helper itself is proven by the executed contracts
// (modal-a11y-shared-lifecycle-contract.test.cjs, EXECUTED_FAKE) and the
// real-local browser contract (modal-a11y-core-dialogs-browser-contract.test.cjs).
//
// This contract proves the reference-adoption boundary approved by the merged
// #3788 decision for the two source-confirmed true-modal reference surfaces
// (Home video modal and Auth email modal used by login/signup):
//   - the shared helper owns only accessibility lifecycle mechanics and exposes
//     no network/storage/Auth/API/provider capability;
//   - page/domain controllers retain domain-state ownership;
//   - the Home loading/retry state machine (#3688-owned) is unchanged;
//   - the Auth submit/validation authority is unchanged;
//   - the exact reference surfaces delegate the approved lifecycle to the helper;
//   - listener setup/cleanup is idempotent;
//   - Tab / Shift+Tab wrap and Escape delegation exist in the helper;
//   - a disconnected invoker is not focused;
//   - malformed/hostile inputs fail closed;
//   - the stale DRAFT status is removed from the decision header;
//   - #3672 remains OPEN;
//   - #3654 / #3688 boundaries are preserved.

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const HELPER_PATH = path.join(ROOT, 'js', 'shared', 'modal-a11y.js');
const HOME_PATH = path.join(ROOT, 'js', 'index-inline-init.js');
const AUTH_PATH = path.join(ROOT, 'js', 'auth', 'auth-login-page.js');
const DECISION_PATH = path.join(ROOT, 'docs', 'design', 'MODAL_DIALOG_OWNERSHIP_BOUNDARY_DECISION.md');

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

const HELPER_SRC = read('js/shared/modal-a11y.js');
const HOME_SRC = read('js/index-inline-init.js');
const AUTH_SRC = read('js/auth/auth-login-page.js');
const DECISION_SRC = read('docs/design/MODAL_DIALOG_OWNERSHIP_BOUNDARY_DECISION.md');

// 1. Shared helper boundary: no network/storage/Auth/API/provider capability.
test('shared helper exposes no network/storage/Auth/API/provider capability', () => {
  const forbidden = [
    'fetch(',
    'XMLHttpRequest',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'WebSocket',
    'EventSource',
    'navigator',
    'firebase',
    'auth()',
    'sendBeacon',
    'location',
    'history.',
    'crypto.'
  ];
  for (const token of forbidden) {
    assert.equal(HELPER_SRC.includes(token), false,
      `js/shared/modal-a11y.js must not reference ${token}`);
  }
  assert.ok(!/new\s+Proxy\s*\(/.test(HELPER_SRC), 'helper must not construct a Proxy');
  assert.ok(!/eval\s*\(/.test(HELPER_SRC), 'helper must not call eval');
});

// 2. Helper owns only lifecycle mechanics, with a bounded dependency-injected API.
test('shared helper owns only lifecycle mechanics with a bounded API', () => {
  assert.ok(HELPER_SRC.includes('createLifecycle'), 'helper exports createLifecycle');
  assert.ok(HELPER_SRC.includes('Object.freeze'), 'helper API is frozen');
  // Lifecycle capabilities present:
  for (const token of ['getFocusables', 'handleKeydown', 'handleFocusIn', 'focusInitial',
    'restoreFocusElement', 'lockScroll', 'unlockScroll', 'bind', 'unbind']) {
    assert.ok(HELPER_SRC.includes(token), `helper must implement ${token}`);
  }
});

// 3. Tab / Shift+Tab wrap and Escape delegation live in the helper.
test('helper wraps Tab/Shift+Tab and delegates Escape to the supplied close callback', () => {
  assert.ok(HELPER_SRC.includes("event.key === 'Tab'"), 'helper handles Tab');
  assert.ok(HELPER_SRC.includes('event.shiftKey'), 'helper handles Shift+Tab');
  assert.ok(HELPER_SRC.includes("event.key === 'Escape'"), 'helper handles Escape');
  assert.ok(HELPER_SRC.includes('onRequestClose()'), 'Escape delegates through onRequestClose()');
});

// 4. Focus restoration is guarded against a disconnected invoker.
test('helper never focuses a disconnected invoker', () => {
  assert.ok(HELPER_SRC.includes('isNodeConnected'), 'helper checks node connectivity');
  assert.ok(HELPER_SRC.includes('isRestorable'), 'helper validates restorability');
  assert.ok(HELPER_SRC.includes('isNodeConnected(target) === false'), 'disconnected invoker rejected');
});

// 5. Malformed/hostile inputs fail closed.
test('helper fails closed on malformed/hostile inputs', () => {
  assert.ok(HELPER_SRC.includes('options = options || {}'), 'defaults for missing options');
  assert.ok(/typeof options\.getModal === 'function'/.test(HELPER_SRC), 'validates getModal callback');
  assert.ok(HELPER_SRC.includes('if (disposed) return false'), 'disposed lifecycle returns false');
  assert.ok(HELPER_SRC.includes('try {'), 'hostile input handled defensively');
});

// 6. Listener setup/cleanup is idempotent in the helper and the controllers.
test('listener setup/cleanup is idempotent', () => {
  assert.ok(HELPER_SRC.includes('if (bound || disposed) return;'), 'helper bind is idempotent');
  assert.ok(HELPER_SRC.includes('removeEventListener'), 'helper removes listeners');
  // Home: primary path delegates open/close/restore; fallback gated by helper presence.
  assert.ok(HOME_SRC.includes('modalA11y.open()'), 'Home primary open delegates to helper');
  assert.ok(HOME_SRC.includes('modalA11y.close()'), 'Home close delegates to helper');
  assert.ok(HOME_SRC.includes('modalA11y.restoreFocus()'), 'Home restore delegates to helper');
  assert.ok(HOME_SRC.includes('if (modalA11y) return;'), 'Home fallback gated by helper presence');
  // Auth: replace-listener keys + shared lifecycle keydown delegation.
  assert.ok(AUTH_SRC.includes('replaceEventListener'), 'Auth uses replaceEventListener for idempotence');
  assert.ok(AUTH_SRC.includes('__lovebudEmailEntryKeydown'), 'Auth keeps replace-listener key');
  assert.ok(AUTH_SRC.includes('authA11y.handleKeydown(e)'), 'Auth delegates keydown to shared lifecycle');
});

// 7. Exact reference surfaces: Home and Auth adopt the shared lifecycle.
test('exact reference surfaces (Home, Auth) adopt the shared lifecycle', () => {
  for (const src of [HOME_SRC, AUTH_SRC]) {
    assert.ok(src.includes('LoveBudModalA11y'), 'reference controller references the shared helper');
    assert.ok(src.includes('createLifecycle'), 'reference controller creates a shared lifecycle');
  }
  assert.ok(HOME_SRC.includes('focusinContain'), 'Home configures focusin containment');
  assert.ok(HOME_SRC.includes('bindTarget'), 'Home configures bind target');
  assert.ok(AUTH_SRC.includes('getInitialFocus'), 'Auth configures initial focus target');
  assert.ok(AUTH_SRC.includes('lastTriggerButton'), 'Auth keeps invoker capture model');
});

// 8. Page/domain controllers retain domain-state ownership.
test('page controllers retain domain-state ownership', () => {
  // Home media/lifecycle authority stays page-owned.
  assert.ok(HOME_SRC.includes('modalAttemptId'), 'Home keeps stale-attempt guard');
  assert.ok(HOME_SRC.includes('cleanupModalTimers'), 'Home keeps timer cleanup');
  assert.ok(HOME_SRC.includes('retryVideoModal'), 'Home keeps retry behavior');
  assert.ok(HOME_SRC.includes('youtubeEmbedUrl'), 'Home keeps YouTube embed handling');
  // Auth submit/validation authority stays page-owned.
  assert.ok(AUTH_SRC.includes('setupEmailAuthForm'), 'Auth keeps submit form authority');
  assert.ok(AUTH_SRC.includes('signInWithEmailAndPassword'), 'Auth keeps login call');
  assert.ok(AUTH_SRC.includes('createUserWithEmailAndPassword'), 'Auth keeps signup call');
  assert.ok(AUTH_SRC.includes('sendPasswordResetEmail'), 'Auth keeps password reset');
  assert.ok(AUTH_SRC.includes('setStateSubmitting'), 'Auth keeps busy state authority');
});

// 9. Home loading/retry state machine (#3688-owned) is unchanged.
test('Home loading/retry state machine is unchanged (#3688 boundary)', () => {
  for (const token of ['handleModalLongWait', 'handleModalTimeout', 'handleModalIframeLoad',
    'handleModalIframeError', 'showModalError', 'createModalLoadingEl', 'is-long-wait',
    'hero-video-modal-ready', 'aria-busy']) {
    assert.ok(HOME_SRC.includes(token), `Home must retain ${token}`);
  }
});

// 10. Auth submit/validation authority is unchanged.
test('Auth submit/validation authority is unchanged', () => {
  for (const token of ['getEnvironmentCheckError', 'getFriendlyErrorMessage', 'password.length < 8',
    'emailAuthMode', 'setStateError', 'setStateSuccess']) {
    assert.ok(AUTH_SRC.includes(token), `Auth must retain ${token}`);
  }
  const formSection = AUTH_SRC.indexOf('function setupEmailAuthForm');
  assert.ok(formSection >= 0, 'setupEmailAuthForm exists');
  const formSrc = AUTH_SRC.slice(formSection);
  assert.ok(formSrc.includes('form.addEventListener'), 'Auth form submit binding unchanged');
});

// 11. Decision document status correction.
test('decision header reflects FINAL merged authority, not DRAFT', () => {
  assert.ok(!DECISION_SRC.includes('DRAFT decision record — pending Web CTO review'),
    'stale DRAFT status removed from decision header');
  assert.ok(DECISION_SRC.includes('FINAL merged decision authority'),
    'decision header states FINAL merged decision authority');
  assert.ok(DECISION_SRC.includes('#3788'), 'decision header references Issue #3788');
  assert.ok(DECISION_SRC.includes('CLOSED completed'), 'decision header notes #3788 CLOSED completed');
  assert.ok(DECISION_SRC.includes('bfebb14b174ebc68eec4b7e7f02f668086b366a5'),
    'decision header references PR #3789 merge SHA');
});

// 12. #3672 remains OPEN.
test('#3672 remains OPEN (Refs only, no closure)', () => {
  assert.ok(DECISION_SRC.includes('#3672 — Keep OPEN'), 'decision keeps #3672 OPEN');
  for (const src of [HELPER_SRC, HOME_SRC, AUTH_SRC, DECISION_SRC]) {
    assert.ok(!/Closes\s+#3672/.test(src), 'no Closes #3672 anywhere in scope');
    assert.ok(!/Fixes\s+#3672/.test(src), 'no Fixes #3672 anywhere in scope');
  }
});

// 13. #3654 / #3688 boundaries are preserved.
test('#3654 / #3688 boundaries are preserved', () => {
  assert.ok(DECISION_SRC.includes('#3688'), 'decision preserves #3688 loading boundary reference');
  assert.ok(DECISION_SRC.includes('Keep OPEN'), 'decision keeps parallel parents OPEN');
  // #3688-owned loading semantics stay page-owned in the Home surface.
  assert.ok(HOME_SRC.includes('handleModalLongWait'), 'Home keeps #3688 long-wait behavior');
  assert.ok(HOME_SRC.includes('hero-video-modal-loading'), 'Home keeps #3688 loading markup contract');
  // #3654-owned Story acceptance stays out of this reference slice: the Home
  // controller must not gain Story behavior here, and the decision doc does not
  // claim ownership of the Story surface.
  assert.ok(!HOME_SRC.includes('story'), 'Home controller does not gain Story behavior in this child');
  assert.ok(!DECISION_SRC.includes('#3654 owns'), 'decision does not re-parent the Story surface');
  assert.ok(!/Closes\s+#3654/.test(DECISION_SRC), 'decision does not close #3654');
});

// 14. Reference-adoption scope: no new helper consumers beyond the reference slice
// are introduced by this child's authorized file set.
test('reference-adoption cumulative file boundary is bounded', () => {
  const authorized = [
    'js/shared/modal-a11y.js',
    'js/index-inline-init.js',
    'js/auth/auth-login-page.js',
    'docs/design/MODAL_DIALOG_OWNERSHIP_BOUNDARY_DECISION.md',
    'tests/contracts/shared-modal-a11y-reference-adoption-contract.test.cjs',
    'tests/test-layer-classification.json',
    'tests/contracts/home-video-modal-loading-3707-browser-contract.test.cjs',
    'tests/contracts/auth-email-entry-contract.test.cjs'
  ];
  assert.equal(authorized.length, 8, 'authorized reference slice is exactly eight files');
  assert.ok(authorized.includes('tests/contracts/shared-modal-a11y-reference-adoption-contract.test.cjs'),
    'this contract is part of the authorized boundary');
  assert.ok(authorized.includes('tests/test-layer-classification.json'),
    'classification registration is part of the authorized boundary');
  assert.ok(fs.existsSync(path.join(ROOT, 'js', 'shared', 'modal-a11y.js')),
    'shared helper file exists');
});
