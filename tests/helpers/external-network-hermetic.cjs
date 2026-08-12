/**
 * Shared hermetic external-network policy for real-local Playwright browser
 * contracts (Issue #4013).
 *
 * Centralizes:
 *   - parse the full request URL ONCE and expose origin/hostname/pathname;
 *   - classify a request as same-origin, known-external, or unexpected-external
 *     using origin/hostname only (never `pathname`, which excludes the host);
 *   - let the caller fulfill known-external requests deterministically so they
 *     never reach the real network;
 *   - fail closed on unexpected-external origins: abort before the network and
 *     record the exact URL so the escape is always visible in diagnostics.
 *
 * Same-origin API/file stubbing stays in each contract. This helper only owns
 * the external-network boundary so the identical policy is not duplicated.
 */

'use strict';

/* Known external provider/font hosts. Matching is hostname-based (exact or
 * suffix), never pathname-based. These are the Google Fonts / Firebase
 * provider origins the real product pages actually reference. */
const KNOWN_EXTERNAL_HOST_SUFFIXES = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com',
  'gstatic.com',
  'googleapis.com',
  'firebase.com',
  'firebaseapp.com',
  'firebasestorage.app',
  'apis.google.com',
];

/**
 * @param {string} hostname
 * @returns {boolean} true when the host is a known external provider/font host.
 */
function isKnownExternalHost(hostname) {
  if (!hostname) return false;
  const h = String(hostname).toLowerCase();
  return KNOWN_EXTERNAL_HOST_SUFFIXES.some(
    (suffix) => h === suffix || h.endsWith('.' + suffix)
  );
}

/**
 * Parse the full request URL once. Throws for non-HTTP schemes
 * (data:, blob:, about:) — callers should treat those as continuable.
 *
 * @param {string} url
 * @returns {{ href: string, origin: string, hostname: string, pathname: string, search: string }}
 */
function parseRequestTarget(url) {
  const parsed = new URL(url);
  return {
    href: parsed.href,
    origin: parsed.origin,
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    search: parsed.search,
  };
}

/* Deterministic fixture replacing the real Google Fonts Material Symbols
 * stylesheet. It reproduces the exact base class rule the real stylesheet
 * serves (so ligature spans keep `font-family: 'Material Symbols Outlined'`
 * and `font-size: 24px`) but WITHOUT any `@font-face`, so no font file is
 * ever requested from the network. Chromium does not raise a console error
 * for an absent `@font-face` font, and this is precisely the rendering state
 * the contracts were validated against: icon ligature text renders literally
 * at 24px, keeping button geometry deterministic and identical to the
 * validated offline state. No contract asserts icon glyph shapes. */
const EXTERNAL_FONT_FIXTURE_CSS = [
  '/* hermetic external font fixture (Issue #4013): deterministic, no real network */',
  '.material-symbols-outlined {',
  "  font-family: 'Material Symbols Outlined';",
  '  font-weight: normal;',
  '  font-style: normal;',
  '  font-size: 24px;',
  '  line-height: 1;',
  '  letter-spacing: normal;',
  '  text-transform: none;',
  '  display: inline-block;',
  '  white-space: nowrap;',
  '  word-wrap: normal;',
  '  direction: ltr;',
  '}',
  '',
].join('\n');

/**
 * Default deterministic stub for a known external provider/font request.
 * Picks a content-type based on the hostname so font CSS and provider JS
 * requests are never confused. Always returns a 200 with a marker body so no
 * real external request is ever made and no 404 console error is produced.
 *
 * @param {import('playwright').Route} route
 * @param {{ hostname: string }} target
 */
async function defaultFulfillExternal(route, target) {
  const h = String(target.hostname).toLowerCase();
  if (h.includes('fonts')) {
    await route.fulfill({
      status: 200,
      contentType: 'text/css; charset=utf-8',
      body: EXTERNAL_FONT_FIXTURE_CSS,
    });
    return;
  }
  if (h.includes('gstatic') || h.includes('firebase') || h.includes('googleapis')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: '/* hermetic external provider fixture */',
    });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/octet-stream',
    body: '',
  });
}

/**
 * Build a `page.route()` global handler that enforces hermeticity.
 *
 * @param {object} opts
 * @param {string} opts.fixtureOrigin exact same-origin base (e.g. `http://127.0.0.1:PORT`).
 * @param {(route: import('playwright').Route, target: ReturnType<typeof parseRequestTarget>) => boolean | Promise<boolean>} [opts.onSameOrigin]
 *        Return true if the contract fulfilled a same-origin request; otherwise
 *        the handler calls `route.continue()` for same-origin traffic.
 * @param {(route: import('playwright').Route, target: ReturnType<typeof parseRequestTarget>) => Promise<void> | void} [opts.fulfillExternal]
 *        Fulfill a known-external request deterministically. Defaults to
 *        `defaultFulfillExternal`.
 * @param {(url: string) => void} [opts.onUnexpectedExternal]
 *        Record the exact URL of any unexpected external origin.
 * @returns {(route: import('playwright').Route) => Promise<void>} the route handler.
 */
function makeHermeticRouteHandler(opts) {
  const fixtureOrigin = opts.fixtureOrigin;
  const onSameOrigin = typeof opts.onSameOrigin === 'function' ? opts.onSameOrigin : null;
  const fulfillExternal =
    typeof opts.fulfillExternal === 'function' ? opts.fulfillExternal : defaultFulfillExternal;
  const onUnexpectedExternal =
    typeof opts.onUnexpectedExternal === 'function' ? opts.onUnexpectedExternal : null;

  return async function hermeticRouteHandler(route) {
    const rawUrl = route.request().url();
    let target;
    try {
      target = parseRequestTarget(rawUrl);
    } catch (e) {
      // Non-HTTP scheme (data:/blob:/about:) — let it proceed unchanged.
      return route.continue().catch(() => {});
    }

    // Same-origin: hand control back to the contract's own stubbing or the
    // local server. Same-origin 4xx/request-failure checks stay untouched.
    if (target.origin === fixtureOrigin) {
      if (onSameOrigin) {
        try {
          if (await onSameOrigin(route, target)) return;
        } catch (e) {
          /* contract stub threw: fall through to continue() */
        }
      }
      return route.continue().catch(() => {});
    }

    // Known external provider/font host: deterministic fixture, no real network.
    if (isKnownExternalHost(target.hostname)) {
      try {
        await fulfillExternal(route, target);
      } catch (e) {
        await route.continue().catch(() => {});
      }
      return;
    }

    // Unexpected external origin: fail closed. Never reach the real network and
    // record the exact URL so the escape is explicit in failure diagnostics.
    if (onUnexpectedExternal) {
      try {
        onUnexpectedExternal(target.href);
      } catch (e) {
        /* recording must not throw */
      }
    }
    return route.abort().catch(() => {});
  };
}

module.exports = {
  KNOWN_EXTERNAL_HOST_SUFFIXES,
  isKnownExternalHost,
  parseRequestTarget,
  makeHermeticRouteHandler,
  defaultFulfillExternal,
  EXTERNAL_FONT_FIXTURE_CSS,
};
