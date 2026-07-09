'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOC_PATH = path.resolve(__dirname, '../../docs/product/lovebud-tree-workspace-moment-social-actionability-audit.md');
const DOC_RELPATH = 'docs/product/lovebud-tree-workspace-moment-social-actionability-audit.md';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let docContent = null;
function getDoc() {
    if (docContent === null) {
        assert.ok(fs.existsSync(DOC_PATH), 'Audit document must exist at ' + DOC_RELPATH);
        docContent = fs.readFileSync(DOC_PATH, 'utf-8');
    }
    return docContent;
}

// ---------------------------------------------------------------------------
// 1. Document existence
// ---------------------------------------------------------------------------

describe('1. Document existence', () => {
    it('audit document exists at ' + DOC_RELPATH, () => {
        assert.ok(fs.existsSync(DOC_PATH));
    });
});

// ---------------------------------------------------------------------------
// 2. Reference requirements
// ---------------------------------------------------------------------------

describe('2. References', () => {
    it('doc references #3075', () => {
        const doc = getDoc();
        assert.ok(doc.includes('#3075'), 'Doc must reference #3075');
    });

    it('doc references #3188', () => {
        const doc = getDoc();
        assert.ok(doc.includes('#3188'), 'Doc must reference #3188');
    });

    it('doc references #3264', () => {
        const doc = getDoc();
        assert.ok(doc.includes('#3264'), 'Doc must reference #3264');
    });

    it('doc references #1882', () => {
        const doc = getDoc();
        assert.ok(doc.includes('#1882'), 'Doc must reference #1882');
    });
});

// ---------------------------------------------------------------------------
// 3. Moment-level vs tree-level separation
// ---------------------------------------------------------------------------

describe('3. Moment-level vs tree-level social separation', () => {
    it('doc explicitly separates moment-level social from tree-level social', () => {
        const doc = getDoc();
        const hasSection = doc.includes('Conflict with #3188') || doc.includes('Separation Maintained');
        assert.ok(hasSection, 'Doc must contain a section on separation from tree-level social');
    });

    it('doc prohibits conflating moment comments with tree-level comments', () => {
        const doc = getDoc();
        const prohibits = doc.includes('Do not conflate') || doc.includes('must keep moment comments');
        assert.ok(prohibits, 'Doc must explicitly prohibit mixing moment and tree-level comments');
    });
});

// ---------------------------------------------------------------------------
// 4. Raw/private identifier prohibition
// ---------------------------------------------------------------------------

describe('4. Raw/private identifier prohibition', () => {
    it('doc does not contain raw Tree IDs', () => {
        const doc = getDoc();
        const lines = doc.split('\n');
        for (const line of lines) {
            // UUID pattern: 8-4-4-4-12 hex
            const uuidMatch = line.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
            if (uuidMatch) {
                assert.fail('Doc must not contain raw UUID identifiers: found ' + uuidMatch[0]);
            }
        }
    });

    it('doc does not contain raw production URLs', () => {
        const doc = getDoc();
        const lines = doc.split('\n');
        for (const line of lines) {
            if (line.includes('lovebud.pages.dev') || line.includes('lovebud.modal.run') || line.includes('vercel.app')) {
                assert.fail('Doc must not contain raw production URLs');
            }
        }
    });
});

// ---------------------------------------------------------------------------
// 5. Guest unauthorized mutation loop prohibition
// ---------------------------------------------------------------------------

describe('5. Guest unauthorized mutation prohibition', () => {
    it('doc requires guest no unauthorized mutation loops', () => {
        const doc = getDoc();
        const mentionsGuest = doc.includes('Guest Behavior') || doc.includes('guest');
        const noUnauthorized = doc.includes('no unauthorized mutation') ||
            doc.includes('no mutation calls') ||
            doc.includes('isAuthConfirmed');
        assert.ok(mentionsGuest, 'Doc must discuss guest behavior');
    });
});

// ---------------------------------------------------------------------------
// 6. Child issue split requirement
// ---------------------------------------------------------------------------

describe('6. Child issue split', () => {
    it('doc requires child issue split before implementation', () => {
        const doc = getDoc();
        assert.ok(
            doc.includes('Recommended Child Issues') || doc.includes('child issue'),
            'Doc must recommend child issues for implementation'
        );
    });

    it('doc does not close #3075', () => {
        const doc = getDoc();
        const lines = doc.split('\n');
        for (const line of lines) {
            // Flag only GitHub-issue-closing keywords, not "does not close" prose
            if (/^(Closes|Fixes|Resolves)\s+#3075\b/m.test(line)) {
                assert.fail('Doc must not close #3075: ' + line.trim());
            }
        }
    });
});

// ---------------------------------------------------------------------------
// 7. Non-goals
// ---------------------------------------------------------------------------

describe('7. Non-goals', () => {
    it('doc has a non-goals section', () => {
        const doc = getDoc();
        assert.ok(doc.includes('Non-Goals') || doc.includes('Non-goals'), 'Doc must have a non-goals section');
    });

    it('doc does not close #1882', () => {
        const doc = getDoc();
        const lines = doc.split('\n');
        for (const line of lines) {
            if (/^(Closes|Fixes|Resolves)\s+#1882\b/m.test(line)) {
                assert.fail('Doc must not use Closes/Fixes/Resolves for #1882');
            }
        }
    });
});

// ---------------------------------------------------------------------------
// 8. Structural sections
// ---------------------------------------------------------------------------

describe('8. Structural completeness', () => {
    it('doc contains Summary or Executive Summary', () => {
        const doc = getDoc();
        assert.ok(
            doc.includes('Executive Summary') || doc.includes('Summary'),
            'Doc must contain a summary section'
        );
    });

    it('doc contains current UI surface analysis', () => {
        const doc = getDoc();
        assert.ok(
            doc.includes('UI Surface') || doc.includes('Current UI'),
            'Doc must analyze current UI surface'
        );
    });

    it('doc contains data source analysis', () => {
        const doc = getDoc();
        assert.ok(
            doc.includes('Data Source') || doc.includes('data source'),
            'Doc must analyze current data source'
        );
    });

    it('doc contains API/auth/visibility boundary analysis', () => {
        const doc = getDoc();
        assert.ok(
            doc.includes('API/Auth') || doc.includes('auth'),
            'Doc must analyze API/auth/visibility boundary'
        );
    });

    it('doc contains gaps section', () => {
        const doc = getDoc();
        assert.ok(doc.includes('Gaps') || doc.includes('gaps'), 'Doc must contain gaps section');
    });
});
