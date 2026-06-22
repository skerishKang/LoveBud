/**
 * Scout Moment-Creation Copy Clarity Contract Test (Issue #2822)
 *
 * Verifies that Scout AI is described through concrete moment-creation flow
 * (link → moment candidate → suggest title/memo/tags → review → save),
 * not abstract AI language. Also guards against overpromising automatic
 * saving/editing, and confirms KO/EN parity for the user-facing copy paths.
 *
 * Static-analysis based. No backend/provider behavior is exercised.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const I18N_SCOUT = 'js/i18n/i18n-scout.js';
const SCOUT_UI = 'js/scout/scout-draft-ui.js';
const SCOUT_CSS = 'css/scout/scout-draft.css';

/* Words that overpromise automation. None of the Scout user-facing copy
   should contain these, because Scout is suggestion-only with a required
   manual review step before saving. */
const FORBIDDEN_OVERPROMISE = [
    '자동 저장',
    '자동저장',
    '완전 자동',
    'auto save',
    'autosave',
    'fully automatic',
    'automatically save',
    'automatically edit'
];

/* Concrete moment-creation anchors that the clarified copy must reference
   so users understand the actual Scout value (not abstract AI language). */
const CONCRETE_VALUE_ANCHORS_KO = [
    { key: 'scout_source_url_hint', needle: 'YouTube' },
    { key: 'scout_trigger_tooltip', needle: '감정 태그' },
    { key: 'scout_intro_help', needle: '저장 전' }
];
const CONCRETE_VALUE_ANCHORS_EN = [
    { key: 'scout_source_url_hint', needle: 'YouTube' },
    { key: 'scout_trigger_tooltip', needle: 'tags' },
    { key: 'scout_intro_help', needle: 'before saving' }
];

/* Extract a single i18n entry's ko / en string value from the dict source. */
function extractEntry(source, key) {
    const blockRe = new RegExp(`'${key}'\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`);
    const m = source.match(blockRe);
    if (!m) return null;
    const block = m[1];
    const ko = block.match(/ko\s*:\s*'((?:[^'\\]|\\.)*)'/);
    const en = block.match(/en\s*:\s*'((?:[^'\\]|\\.)*)'/);
    return {
        ko: ko ? ko[1] : null,
        en: en ? en[1] : null
    };
}

test('1. Intro helper copy exists with concrete moment-creation flow (KO + EN)', () => {
    const src = read(I18N_SCOUT);
    const entry = extractEntry(src, 'scout_intro_help');
    assert.ok(entry, 'scout_intro_help entry must exist in i18n-scout.js');
    assert.ok(entry.ko, 'scout_intro_help must have a ko value');
    assert.ok(entry.en, 'scout_intro_help must have an en value');

    // KO flow: link/memory -> moment -> refine before save
    assert.match(entry.ko, /링크|기억/, 'KO intro should mention link or memory');
    assert.match(entry.ko, /저장 전|검토|다듬/, 'KO intro should mention refining before saving');

    // EN flow
    assert.match(entry.en, /link|memory/i, 'EN intro should mention link or memory');
    assert.match(entry.en, /review|refine|before saving/i, 'EN intro should mention refining before saving');
});

test('2. Concrete value anchors are present in the clarified copy', () => {
    const src = read(I18N_SCOUT);
    for (const { key, needle } of CONCRETE_VALUE_ANCHORS_KO) {
        const entry = extractEntry(src, key);
        assert.ok(entry && entry.ko, `${key} ko value must exist`);
        assert.ok(
            entry.ko.includes(needle),
            `${key} ko should reference concrete value "${needle}"`
        );
    }
    for (const { key, needle } of CONCRETE_VALUE_ANCHORS_EN) {
        const entry = extractEntry(src, key);
        assert.ok(entry && entry.en, `${key} en value must exist`);
        assert.ok(
            entry.en.toLowerCase().includes(needle.toLowerCase()),
            `${key} en should reference concrete value "${needle}"`
        );
    }
});

test('3. Suggestion-applied copy reminds the user to review/edit before saving', () => {
    const src = read(I18N_SCOUT);
    const entry = extractEntry(src, 'scout_suggest_applied');
    assert.ok(entry && entry.ko && entry.en, 'scout_suggest_applied must exist (ko+en)');
    // After applying a suggestion, copy should nudge review/edit, not imply auto-save.
    assert.match(entry.ko, /검토|고쳐/, 'KO suggestion-applied should remind review/edit');
    assert.match(entry.en, /review|edit/i, 'EN suggestion-applied should remind review/edit');
});

test('4. No overpromising automation language in user-facing Scout copy', () => {
    const src = read(I18N_SCOUT);
    for (const term of FORBIDDEN_OVERPROMISE) {
        assert.ok(
            !src.toLowerCase().includes(term.toLowerCase()),
            `Scout i18n must not overpromise with "${term}"`
        );
    }
});

test('5. Scout modal renders the intro helper node (UI wiring)', () => {
    const src = read(SCOUT_UI);
    assert.ok(
        src.includes("scout-draft-intro"),
        'scout-draft-ui.js must render an element with class scout-draft-intro'
    );
    assert.ok(
        src.includes("scout_intro_help"),
        'scout-draft-ui.js must read the scout_intro_help i18n key'
    );
});

test('6. Intro helper has a styled rule so it does not render unstyled (incl. mobile + dark)', () => {
    const src = read(SCOUT_CSS);
    assert.ok(
        /\.scout-draft-intro\s*\{/.test(src),
        'scout-draft.css must define .scout-draft-intro'
    );
    // Mobile breakpoint should not introduce excessive spacing.
    assert.ok(
        /@media\s*\(max-width:\s*600px\)[\s\S]*?\.scout-draft-intro\s*\{/.test(src),
        'scout-draft.css should keep .scout-draft-intro compact under the 600px mobile breakpoint'
    );
    // Dark mode parity so the intro stays legible.
    assert.ok(
        /prefers-color-scheme:\s*dark[\s\S]*?\.scout-draft-intro\s*\{/.test(src),
        'scout-draft.css should keep .scout-draft-intro legible in dark mode'
    );
});
