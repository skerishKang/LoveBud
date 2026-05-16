/**
 * Contract tests for LoveBudSecurity utilities (js/utils/security.js).
 *
 * Uses source pattern matching (like other contract tests) and
 * direct function evaluation in Node.js to validate behavior.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const SECURITY_PATH = path.resolve(__dirname, '../../js/utils/security.js');
const securitySrc = fs.readFileSync(SECURITY_PATH, 'utf8');

// Evaluate the IIFE in Node.js by capturing window
const window = { location: { origin: 'https://lovebud.pages.dev', hostname: 'lovebud.pages.dev' } };
global.window = window;

const fn = new Function(securitySrc);
fn();

const sec = window.LoveBudSecurity;

// ── Helper: hasString / hasRegex (same pattern as other contract tests) ──
function hasString(content, pattern) {
    return content.includes(pattern);
}
function hasRegex(content, pattern) {
    return pattern.test(content);
}
function compact(value) {
    return value.replace(/\s+/g, '').toLowerCase();
}

// ── Unit tests via evaluated function ──

test('escapeHtml escapes & to &amp;', () => {
    assert.strictEqual(sec.escapeHtml('&'), '&amp;');
});

test('escapeHtml escapes < to &lt;', () => {
    assert.strictEqual(sec.escapeHtml('<'), '&lt;');
});

test('escapeHtml escapes > to &gt;', () => {
    assert.strictEqual(sec.escapeHtml('>'), '&gt;');
});

test('escapeHtml escapes " to &quot;', () => {
    assert.strictEqual(sec.escapeHtml('"'), '&quot;');
});

test("escapeHtml escapes ' to &#39;", () => {
    assert.strictEqual(sec.escapeHtml("'"), '&#39;');
});

test('escapeHtml escapes all five entities in mixed string', () => {
    assert.strictEqual(
        sec.escapeHtml('<script>alert("xss&\'test")</script>'),
        '&lt;script&gt;alert(&quot;xss&amp;&#39;test&quot;)&lt;/script&gt;'
    );
});

test('escapeHtml returns empty string for null', () => {
    assert.strictEqual(sec.escapeHtml(null), '');
});

test('escapeHtml returns empty string for undefined', () => {
    assert.strictEqual(sec.escapeHtml(undefined), '');
});

test('escapeHtml preserves number 0 as string "0"', () => {
    assert.strictEqual(sec.escapeHtml(0), '0');
});

test('escapeHtml preserves boolean false as string "false"', () => {
    assert.strictEqual(sec.escapeHtml(false), 'false');
});

test('escapeHtml preserves empty string', () => {
    assert.strictEqual(sec.escapeHtml(''), '');
});

test('escapeHtml passes through plain text unchanged', () => {
    assert.strictEqual(sec.escapeHtml('Hello, 러브트리! 123'), 'Hello, 러브트리! 123');
});

test('escapeHtml handles numbers by converting to string', () => {
    assert.strictEqual(sec.escapeHtml(42), '42');
});

test('sanitizeUrl accepts http:// URLs', () => {
    const result = sec.sanitizeUrl('http://example.com/path');
    assert.ok(result.startsWith('http://example.com/path'));
});

test('sanitizeUrl accepts https:// URLs', () => {
    const result = sec.sanitizeUrl('https://lovebud.pages.dev/pages/search');
    assert.ok(result.startsWith('https://lovebud.pages.dev/pages/search'));
});

test('sanitizeUrl rejects javascript: URLs', () => {
    assert.strictEqual(sec.sanitizeUrl('javascript:alert(1)'), '');
});

test('sanitizeUrl rejects data: URLs', () => {
    assert.strictEqual(sec.sanitizeUrl('data:text/html,<script>alert(1)</script>'), '');
});

test('sanitizeUrl rejects vbscript: URLs', () => {
    assert.strictEqual(sec.sanitizeUrl('vbscript:msgbox(1)'), '');
});

test('sanitizeUrl returns empty string for empty input', () => {
    assert.strictEqual(sec.sanitizeUrl(''), '');
});

test('sanitizeUrl returns empty string for null', () => {
    assert.strictEqual(sec.sanitizeUrl(null), '');
});

test('sanitizeUrl returns empty string for undefined', () => {
    assert.strictEqual(sec.sanitizeUrl(undefined), '');
});

test('sanitizeUrl trims whitespace', () => {
    const result = sec.sanitizeUrl('  https://example.com  ');
    assert.ok(result.startsWith('https://example.com'));
});

test('sanitizeUrl rejects plain text', () => {
    assert.strictEqual(sec.sanitizeUrl('not a url'), '');
});

test('sanitizeUrl accepts URLs with query params', () => {
    const result = sec.sanitizeUrl('https://example.com/path?a=1&b=2');
    assert.ok(result.includes('a=1'));
    assert.ok(result.includes('b=2'));
});

// ── Source pattern contract tests ──

test('security.js file exists', () => {
    assert.ok(fs.existsSync(SECURITY_PATH));
});

test('security.js uses IIFE pattern', () => {
    assert.ok(hasString(securitySrc, '(function()'));
    assert.ok(hasString(securitySrc, '})();'));
});

test('security.js defines window.LoveBudSecurity', () => {
    const normalized = compact(securitySrc);
    assert.ok(hasRegex(normalized, /window\.lovebudsecurity\s*=\s*\{/),
        'Must assign window.LoveBudSecurity = { ... }');
});

test('security.js escapeHtml exports all 5 entity replacements', () => {
    assert.ok(hasRegex(securitySrc, /\.replace\(\/&\/g,\s*'&amp;'\)/));
    assert.ok(hasRegex(securitySrc, /\.replace\(\/<\//));
    assert.ok(hasRegex(securitySrc, /\.replace\(\/>\//));
    assert.ok(hasRegex(securitySrc, /\.replace\(\/"/));
    assert.ok(hasRegex(securitySrc, /\.replace\(\/'\/g,\s*'&#39;'\)/));
});

test('security.js escapeHtml preserves 0 and false (uses == null guard)', () => {
    assert.ok(hasString(securitySrc, 'value == null'),
        'Must use == null guard to preserve 0 and false');
});

test('security.js sanitizeUrl rejects non-http protocols', () => {
    const normalized = compact(securitySrc);
    assert.ok(hasString(normalized, 'http:') && hasString(normalized, 'https:'),
        'sanitizeUrl must whitelist http: and https:');
});

test('security.js sanitizeUrl parses with URL constructor', () => {
    assert.ok(hasString(securitySrc, 'new URL(raw)'),
        'sanitizeUrl must parse with URL constructor');
});
