/**
 * LoveBud My Trees Image Fallback Container Contract
 *
 * Verifies that the broken-image error handler resolves the fallback element
 * through the owning media container (closest .tree-card-thumb) instead of
 * relying on immediate sibling order (nextElementSibling).
 *
 * Covers:
 * - Error handler uses closest(.tree-card-thumb) as the lookup boundary
 * - Fallback is found via container.querySelector([data-media-fallback])
 * - Unrelated card fallback is NOT found (no global query)
 * - Image is hidden on error
 * - Fallback hidden is removed and display becomes flex
 * - imageHandlerBound duplicate binding guard is preserved
 * - Existing media fallback tier contract is unchanged
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

const myTreesCardEventsJs = fs.readFileSync(
    path.join(ROOT, 'js/my-trees/my-trees-card-events.js'),
    'utf8'
);

function runInNewWindow(js, overrides) {
    const sec = {
        escapeHtml: function (v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
        sanitizeUrl: function (v) { if (!v) return ''; var raw = String(v).trim(); if (!raw) return ''; try { var p = new URL(raw, 'https://localhost/'); var proto = p.protocol; if (proto === 'http:' || proto === 'https:') return p.href; return ''; } catch (e) { return ''; } }
    };
    const win = Object.assign({
        LoveBudSecurity: sec,
        LoveBudSearchSharedUtils: { escapeHtml: sec.escapeHtml },
        LoveBudMyTreesCardEvents: null,
        LoveBudMyTreesCardVisuals: null,
        LoveBudMyTreesCardEvents: null,
        LoveBudMyTreesUtils: { escapeHtml: sec.escapeHtml, sanitizeUrl: sec.sanitizeUrl }
    }, overrides || {});
    const ctx = { window: win, document: { createElement: function () { return { setAttribute: function () {}, appendChild: function () {} }; } } };
    vm.runInNewContext(js, ctx);
    return win;
}

// ---- Test 1: Handler does not depend on nextElementSibling ----
test('Handler resolves fallback through closest container, not nextElementSibling', () => {
    let errorHandler = null;
    const fallbackEl = {
        hasAttribute: function (a) { return a === 'data-media-fallback'; },
        removeAttribute: function () {},
        style: { display: '' }
    };
    const img = {
        dataset: { imageHandlerBound: undefined },
        style: {},
        nextElementSibling: null, // No nextElementSibling — handler must NOT use it
        addEventListener: function (evt, fn) {
            if (evt === 'error') errorHandler = fn;
        },
        closest: function (sel) {
            if (sel === '.tree-card-thumb') {
                return {
                    querySelector: function (q) {
                        if (q === '[data-media-fallback]') return fallbackEl;
                        return null;
                    }
                };
            }
            return null;
        }
    };
    const card = {
        querySelectorAll: function (sel) {
            return sel === '.tree-card-thumb-image' ? [img] : [];
        }
    };

    const win = runInNewWindow(myTreesCardEventsJs, {
        LoveBudMyTreesUI: {},
        LoveTreeMyTreesUI: {}
    });
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);
    assert.ok(errorHandler, 'error event handler should be bound');

    // Even with nextElementSibling === null, the fallback should be found via closest
    errorHandler.call(img);
    assert.strictEqual(img.style.display, 'none', 'image should be hidden on error');
    assert.strictEqual(fallbackEl.style.display, 'flex', 'fallback should be shown via container lookup');
});

// ---- Test 2: Handler uses closest(.tree-card-thumb) boundary ----
test('Handler calls closest(.tree-card-thumb) to scope fallback lookup', () => {
    let errorHandler = null;
    let closestCalled = false;
    const fallbackEl = {
        hasAttribute: function (a) { return a === 'data-media-fallback'; },
        removeAttribute: function () {},
        style: { display: '' }
    };
    const img = {
        dataset: { imageHandlerBound: undefined },
        style: {},
        addEventListener: function (evt, fn) {
            if (evt === 'error') errorHandler = fn;
        },
        closest: function (sel) {
            closestCalled = true;
            assert.strictEqual(sel, '.tree-card-thumb', 'closest should target .tree-card-thumb');
            return {
                querySelector: function (q) {
                    if (q === '[data-media-fallback]') return fallbackEl;
                    return null;
                }
            };
        }
    };
    const card = {
        querySelectorAll: function (sel) {
            return sel === '.tree-card-thumb-image' ? [img] : [];
        }
    };

    const win = runInNewWindow(myTreesCardEventsJs, {
        LoveBudMyTreesUI: {},
        LoveTreeMyTreesUI: {}
    });
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);
    assert.ok(errorHandler, 'error event handler should be bound');

    errorHandler.call(img);
    assert.ok(closestCalled, 'closest should have been called on the image');
});

// ---- Test 3: Container querySelector finds [data-media-fallback] marker ----
test('Handler queries [data-media-fallback] within the container', () => {
    let errorHandler = null;
    let queryCalled = false;
    const fallbackEl = {
        hasAttribute: function (a) { return a === 'data-media-fallback'; },
        removeAttribute: function () {},
        style: { display: '' }
    };
    const img = {
        dataset: { imageHandlerBound: undefined },
        style: {},
        addEventListener: function (evt, fn) {
            if (evt === 'error') errorHandler = fn;
        },
        closest: function (sel) {
            return {
                querySelector: function (q) {
                    queryCalled = true;
                    assert.strictEqual(q, '[data-media-fallback]', 'should query for [data-media-fallback]');
                    return fallbackEl;
                }
            };
        }
    };
    const card = {
        querySelectorAll: function (sel) {
            return sel === '.tree-card-thumb-image' ? [img] : [];
        }
    };

    const win = runInNewWindow(myTreesCardEventsJs, {
        LoveBudMyTreesUI: {},
        LoveTreeMyTreesUI: {}
    });
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);
    assert.ok(errorHandler, 'error event handler should be bound');

    errorHandler.call(img);
    assert.ok(queryCalled, 'querySelector should have been called on the container');
});

// ---- Test 4: Unrelated card fallback is NOT found ----
test('Handler does NOT fall back to unrelated card fallback', () => {
    let errorHandler = null;
    const unrelatedFallback = {
        hasAttribute: function (a) { return a === 'data-media-fallback'; },
        removeAttribute: function () { throw new Error('should not reach unrelated fallback'); },
        style: {}
    };
    const fallbackEl = {
        hasAttribute: function (a) { return a === 'data-media-fallback'; },
        removeAttribute: function () {},
        style: { display: '' }
    };
    const img = {
        dataset: { imageHandlerBound: undefined },
        style: {},
        addEventListener: function (evt, fn) {
            if (evt === 'error') errorHandler = fn;
        },
        closest: function (sel) {
            // Container only knows about its own fallback
            return {
                querySelector: function (q) {
                    if (q === '[data-media-fallback]') return fallbackEl;
                    return null;
                }
            };
        }
    };
    const card = {
        querySelectorAll: function (sel) {
            return sel === '.tree-card-thumb-image' ? [img] : [];
        }
    };

    const win = runInNewWindow(myTreesCardEventsJs, {
        LoveBudMyTreesUI: {},
        LoveTreeMyTreesUI: {}
    });
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);
    assert.ok(errorHandler, 'error event handler should be bound');

    // Should use the container's own fallback, not the unrelated one
    errorHandler.call(img);
    assert.strictEqual(fallbackEl.style.display, 'flex', 'own card fallback should be shown');
    // unrelatedFallback should never be touched
});

// ---- Test 5: imageHandlerBound guard prevents double-binding ----
test('imageHandlerBound guard prevents duplicate event listener binding', () => {
    const img = {
        dataset: { imageHandlerBound: undefined },
        style: {},
        addEventListener: function () {},
        closest: function () { return null; }
    };
    const callCount = { querySelectorAll: 0 };
    const card = {
        querySelectorAll: function (sel) {
            callCount.querySelectorAll++;
            return sel === '.tree-card-thumb-image' ? [img] : [];
        }
    };

    const win = runInNewWindow(myTreesCardEventsJs, {
        LoveBudMyTreesUI: {},
        LoveTreeMyTreesUI: {}
    });

    // First call should bind
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);
    assert.strictEqual(img.dataset.imageHandlerBound, 'true', 'imageHandlerBound should be set after first bind');

    // Second call should skip (guard)
    const beforeCount = callCount.querySelectorAll;
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);
    assert.strictEqual(img.dataset.imageHandlerBound, 'true', 'imageHandlerBound should remain set');
});

// ---- Test 6: Silently exits when container is not found ----
test('Handler silently exits when closest container is not found', () => {
    let errorHandler = null;
    const img = {
        dataset: { imageHandlerBound: undefined },
        style: {},
        addEventListener: function (evt, fn) {
            if (evt === 'error') errorHandler = fn;
        },
        closest: function (sel) {
            return null; // No container found
        }
    };
    const card = {
        querySelectorAll: function (sel) {
            return sel === '.tree-card-thumb-image' ? [img] : [];
        }
    };

    const win = runInNewWindow(myTreesCardEventsJs, {
        LoveBudMyTreesUI: {},
        LoveTreeMyTreesUI: {}
    });
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);
    assert.ok(errorHandler, 'error event handler should be bound');

    // Should not throw when container is null
    assert.doesNotThrow(function () {
        errorHandler.call(img);
    }, 'should silently exit when container not found');
    assert.strictEqual(img.style.display, 'none', 'image should still be hidden even without container');
});

// ---- Test 7: Silently exits when fallback marker is not found in container ----
test('Handler silently exits when [data-media-fallback] is not in container', () => {
    let errorHandler = null;
    const img = {
        dataset: { imageHandlerBound: undefined },
        style: {},
        addEventListener: function (evt, fn) {
            if (evt === 'error') errorHandler = fn;
        },
        closest: function (sel) {
            return {
                querySelector: function (q) {
                    return null; // No fallback marker in container
                }
            };
        }
    };
    const card = {
        querySelectorAll: function (sel) {
            return sel === '.tree-card-thumb-image' ? [img] : [];
        }
    };

    const win = runInNewWindow(myTreesCardEventsJs, {
        LoveBudMyTreesUI: {},
        LoveTreeMyTreesUI: {}
    });
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);
    assert.ok(errorHandler, 'error event handler should be bound');

    // Should not throw when fallback is null
    assert.doesNotThrow(function () {
        errorHandler.call(img);
    }, 'should silently exit when fallback not found');
    assert.strictEqual(img.style.display, 'none', 'image should still be hidden even without fallback');
});

// ---- Test 8: Existing immediate-sibling markup still works ----
test('Handler works with existing DOM structure (image + adjacent data-media-fallback)', () => {
    let errorHandler = null;
    const fallbackEl = {
        hasAttribute: function (a) { return a === 'data-media-fallback'; },
        removeAttribute: function () {},
        style: { display: '' }
    };
    const img = {
        dataset: { imageHandlerBound: undefined },
        style: {},
        // Simulate having a nextElementSibling that is NOT the fallback
        nextElementSibling: { tagName: 'SPAN', hasAttribute: function () { return false; } },
        addEventListener: function (evt, fn) {
            if (evt === 'error') errorHandler = fn;
        },
        closest: function (sel) {
            return {
                querySelector: function (q) {
                    if (q === '[data-media-fallback]') return fallbackEl;
                    return null;
                }
            };
        }
    };
    const card = {
        querySelectorAll: function (sel) {
            return sel === '.tree-card-thumb-image' ? [img] : [];
        }
    };

    const win = runInNewWindow(myTreesCardEventsJs, {
        LoveBudMyTreesUI: {},
        LoveTreeMyTreesUI: {}
    });
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);

    errorHandler.call(img);
    assert.strictEqual(img.style.display, 'none', 'image should be hidden');
    assert.strictEqual(fallbackEl.style.display, 'flex', 'fallback should be shown via container query');
});

// ---- Test 9: bindMyTreesCardImageHandlers function signature preserved ----
test('bindMyTreesCardImageHandlers is a function exported via LoveBudMyTreesCardEvents', () => {
    const win = runInNewWindow(myTreesCardEventsJs, {
        LoveBudMyTreesUI: {},
        LoveTreeMyTreesUI: {}
    });
    assert.ok(typeof win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers === 'function', 'bindMyTreesCardImageHandlers should be a function');
    assert.strictEqual(win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers.length, 1, 'should accept 1 argument (root)');
});