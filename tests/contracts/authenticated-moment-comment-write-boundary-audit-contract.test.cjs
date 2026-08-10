'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOC_PATH = path.resolve(__dirname, '../../docs/product/lovebud-authenticated-moment-comment-write-boundary-audit.md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a source file and cache it. */
const srcCache = new Map();
function readSrc(relativePath) {
    if (!srcCache.has(relativePath)) {
        const fullPath = path.resolve(__dirname, '../../', relativePath);
        srcCache.set(relativePath, fs.readFileSync(fullPath, 'utf-8'));
    }
    return srcCache.get(relativePath);
}

/** @type {string | null} */
let docContent = null;
function getDoc() {
    if (docContent === null) {
        docContent = fs.readFileSync(DOC_PATH, 'utf-8');
    }
    return docContent;
}

// ---------------------------------------------------------------------------
// 1. Required decision statement
// ---------------------------------------------------------------------------

describe('1. Required decision statement', () => {
    it('SOURCE-LEVEL READY; COMPOSER UI NOT YET AUTHORIZED appears verbatim', () => {
        const doc = getDoc();
        assert.ok(
            doc.includes('SOURCE-LEVEL READY; COMPOSER UI NOT YET AUTHORIZED'),
        );
    });
});

// ---------------------------------------------------------------------------
// 2. Six audit layers (verified against actual source)
// ---------------------------------------------------------------------------

describe('2. Six audit layers', () => {

    // ---- Layer 1: Browser adapter -------------------------------------------
    describe('Layer 1 — Browser adapter', () => {
        it('createComment accepts idempotencyKey', () => {
            const src = readSrc('js/postgres-client.js');
            assert.match(src, /createComment.*idempotencyKey/);
        });

        it('addIdempotencyKey helper exists', () => {
            const src = readSrc('js/postgres-client.js');
            assert.match(src, /function addIdempotencyKey|const addIdempotencyKey/);
        });

        it('fetchPublicMomentComments uses { publicRead: true }', () => {
            const src = readSrc('js/postgres-client.js');
            assert.match(src, /fetchPublicMomentComments.*publicRead\s*:\s*true/);
        });
    });

    // ---- Layer 2: Cloudflare private proxy ---------------------------------
    describe('Layer 2 — Cloudflare private proxy', () => {
        it('POST validates Idempotency-Key header', () => {
            const src = readSrc('functions/api/memories/[id]/comments.js');
            assert.match(src, /Idempotency-Key/);
            assert.match(src, /KEY_PATTERN|validation|required/i);
        });

        it('bounded request body (128KB / 131072)', () => {
            const src = readSrc('functions/api/memories/[id]/comments.js');
            assert.match(src, /128\s*KB|131072|MAX_BODY|SIZE/i);
        });

        it('Authorization is required at the edge and forwarded after the guard', () => {
            const src = readSrc('functions/api/memories/[id]/comments.js');
            assert.match(
                src,
                /const authorization = getAuthorization\(request\);[\s\S]*?if \(!authorization\) return buildMissingAuthorizationResponse\(\);/,
            );
            assert.match(
                src,
                /headers:\s*\{[\s\S]*?'Idempotency-Key': idempotencyKey,[\s\S]*?authorization[\s\S]*?\}/,
            );
        });

        it('routes to Modal private comments endpoint', () => {
            const src = readSrc('functions/api/memories/[id]/comments.js');
            assert.match(src, /modal.*private.*comment|private.*modal.*comment/i);
        });
    });

    // ---- Layer 3: Modal private write route --------------------------------
    describe('Layer 3 — Modal private write route', () => {
        it('POST /modal/private/memories/{memory_id}/comments documented', () => {
            const doc = getDoc();
            assert.match(doc, /POST\s+\/modal\/private\/memories.*comments/);
        });

        it('require_firebase_user called before create_comment', () => {
            const src = readSrc('modal_compute/app.py');
            // Route is @web_app.post("/modal/private/memories/{memory_id}/comments")
            const routeIdx = src.indexOf('/modal/private/memories/{memory_id}/comments');
            assert.ok(routeIdx > 0, 'private comments POST route found');
            // From route to ~600 chars after to capture full handler including create_comment call
            const routeSection = src.substring(routeIdx - 10, routeIdx + 600);
            assert.match(routeSection, /require_firebase_user/);
            assert.match(routeSection, /create_comment/);
        });

        it('public comments GET uses require_public_memory_membership', () => {
            const src = readSrc('modal_compute/app.py');
            assert.match(src, /require_public_memory_membership/);
        });
    });

    // ---- Layer 4: Core write protection ------------------------------------
    describe('Layer 4 — Core write protection', () => {
        it('body validation: max 5000 characters', () => {
            const src = readSrc('modal_compute/comments.py');
            assert.match(src, /5000.*character|max.*5000|body.*5000/i);
        });

        it('visible-or-owner authorization guard', () => {
            const src = readSrc('modal_compute/comments.py');
            assert.match(src, /require_memory_visible_or_owner/);
        });

        it('idempotency reserve/replay', () => {
            const src = readSrc('modal_compute/comments.py');
            assert.match(src, /reserve_and_verify_idempotency|idempotency.*reserve/i);
        });

        it('comment rate limiting', () => {
            const src = readSrc('modal_compute/comments.py');
            assert.match(src, /check_comment_rate_limits|rate.?limit.*comment/i);
        });

        it('audit recording', () => {
            const src = readSrc('modal_compute/comments.py');
            assert.match(src, /record_audit|audit.*record/i);
        });

        it('transaction commit/rollback', () => {
            const src = readSrc('modal_compute/comments.py');
            assert.match(src, /\.(commit|rollback)\(\)/);
        });

        it('hidden/deleted replay returns 410', () => {
            const src = readSrc('modal_compute/comments.py');
            assert.match(src, /410|IDEMPOTENCY_RESULT_UNAVAILABLE|hidden.*deleted|deleted.*hidden/i);
        });
    });

    // ---- Layer 5: Public display boundary ----------------------------------
    describe('Layer 5 — Public display boundary', () => {
        it('public comments route targets /trees/{treeId}/memories/{memoryId}/comments', () => {
            const src = readSrc('functions/api/trees/[tree_id]/memories/[memory_id]/comments.js');
            assert.match(src, /\/trees.*memories.*comment|public.*comment/i);
        });

        it('public comments route targets Modal public endpoint', () => {
            const src = readSrc('functions/api/trees/[tree_id]/memories/[memory_id]/comments.js');
            // Should target /modal/public/trees/.../comments
            assert.match(src, /\/modal\/public\/trees.*memories.*comments/);
        });

        it('normalize_public_comment_row returns only id, body, createdAt', () => {
            const src = readSrc('modal_compute/comments.py');
            const match = src.match(/def normalize_public_comment_row[\s\S]{1,200}/);
            assert.ok(match, 'normalize_public_comment_row found');
            const fnBody = match[0];
            // Should have id, body, createdAt — should NOT have ownerId, memoryId, updatedAt
            assert.match(fnBody, /"id"/);
            assert.match(fnBody, /"body"/);
            assert.match(fnBody, /"createdAt"/);
            assert.ok(!/"ownerId"/.test(fnBody), 'should not include ownerId');
            assert.ok(!/"memoryId"/.test(fnBody), 'should not include memoryId');
            assert.ok(!/"updatedAt"/.test(fnBody), 'should not include updatedAt');
        });
    });

    // ---- Layer 6: Existing evidence ----------------------------------------
    describe('Layer 6 — Existing evidence', () => {
        it('references moment-social-write-readiness-contract.md', () => {
            const doc = getDoc();
            assert.ok(doc.includes('lovebud-moment-social-write-readiness-contract.md'));
        });

        it('references moment-social-write-hardening-contract.test.cjs', () => {
            const doc = getDoc();
            assert.ok(doc.includes('moment-social-write-hardening-contract.test.cjs'));
        });

        it('explains what existing tests prove', () => {
            const doc = getDoc();
            assert.match(doc, /prove|cover|scope/i);
        });

        it('explains what existing tests cannot prove', () => {
            const doc = getDoc();
            assert.match(doc, /cannot prove|not prove|does not prove/i);
        });
    });
});

// ---------------------------------------------------------------------------
// 3. Required conclusion
// ---------------------------------------------------------------------------

describe('3. Required conclusion', () => {
    it('static source-level boundary is ready', () => {
        const doc = getDoc();
        assert.match(doc, /source-level.*ready|static.*ready|boundary.*ready/i);
    });

    it('existing contracts coverage stated', () => {
        const doc = getDoc();
        assert.match(doc, /auth|visibility|idempotency|rate.?limit|audit/i);
    });

    it('composer UI not authorized', () => {
        const doc = getDoc();
        assert.match(doc, /composer.*not.*authorized|not.*authorized.*composer/i);
    });

    it('controlled runtime lifecycle gate is unmet precondition', () => {
        const doc = getDoc();
        assert.ok(
            doc.includes('controlled runtime') ||
            doc.includes('runtime lifecycle gate') ||
            doc.includes('separately approved'),
        );
    });

    it('all seven composer preconditions listed', () => {
        const doc = getDoc();
        assert.ok(doc.toLowerCase().includes('synthetic'));
        assert.ok(doc.toLowerCase().includes('authenticated create comment'));
        assert.ok(doc.toLowerCase().includes('public-read reconciliation'));
        assert.ok(doc.toLowerCase().includes('idempotency'));
        assert.ok(doc.toLowerCase().includes('retry'));
        assert.ok(doc.toLowerCase().includes('controlled cleanup'));
        assert.ok(doc.toLowerCase().includes('no tokens'));
    });
});

// ---------------------------------------------------------------------------
// 4. Reference markers
// ---------------------------------------------------------------------------

describe('4. Reference markers', () => {
    it('Refs #3225 present', () => {
        const doc = getDoc();
        assert.ok(doc.includes('Refs #3225'));
    });

    it('Refs #3075 present', () => {
        const doc = getDoc();
        assert.ok(doc.includes('Refs #3075'));
    });

    it('Refs #1882 present (not close/fix/resolve)', () => {
        const doc = getDoc();
        assert.ok(doc.includes('Refs #1882'));
        assert.ok(!/Closes\s+#1882|Fixes\s+#1882|Resolves\s+#1882/.test(doc));
    });

    it('Refs #3218 present', () => {
        const doc = getDoc();
        assert.ok(doc.includes('Refs #3218'));
    });
});

// ---------------------------------------------------------------------------
// 5. Forbidden close verbs
// ---------------------------------------------------------------------------

describe('5. Forbidden close verbs', () => {
    it('no Closes #1882', () => { assert.ok(!/Closes\s+#1882/.test(getDoc())); });
    it('no Fixes #1882', () => { assert.ok(!/Fixes\s+#1882/.test(getDoc())); });
    it('no Resolves #1882', () => { assert.ok(!/Resolves\s+#1882/.test(getDoc())); });
});

// ---------------------------------------------------------------------------
// 6. No runtime claims
// ---------------------------------------------------------------------------

describe('6. No runtime claims', () => {
    it('does not claim production mutation tested', () => {
        const doc = getDoc();
        assert.ok(
            doc.match(/not.*tested|not.*performed|has not|not yet|not authorized/i),
        );
    });
});

// ---------------------------------------------------------------------------
// 7. Public viewer display uses public reader only
// ---------------------------------------------------------------------------

describe('7. Public viewer display boundary', () => {
    it('public-viewer-read-only-social-summary.js uses fetchPublicMomentComments', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        assert.match(src, /fetchPublicMomentComments/);
        // fetchComments should be bound to fetchPublicMomentComments
        const lines = src.split('\n');
        const displayFetchComments = lines.find(l =>
            l.match(/var\s+fetchComments.*=.*fetchPublicMomentComments/) ||
            l.match(/let\s+fetchComments.*=.*fetchPublicMomentComments/)
        );
        assert.ok(displayFetchComments, 'fetchComments bound to fetchPublicMomentComments');
    });

    it('public-viewer-canvas-entry.js uses fetchPublicMomentComments', () => {
        const src = readSrc('js/viewer/public-viewer-canvas-entry.js');
        assert.match(src, /fetchPublicMomentComments/);
    });

    it('public-canvas-init.js uses fetchPublicMomentComments', () => {
        const src = readSrc('js/viewer/public-canvas-init.js');
        assert.match(src, /fetchPublicMomentComments/);
    });
});

// ---------------------------------------------------------------------------
// 8. Document audit statement matches actual source topology
// ---------------------------------------------------------------------------

describe('8. Document reflects actual source topology', () => {
    it('document describes correct public DTO fields', () => {
        const doc = getDoc();
        // Document should mention id, body, createdAt as public DTO fields
        assert.match(doc, /public.*dto|id.*body.*createdAt|normalize_public_comment/i);
        // Document should state that public DTO is limited to id, body, createdAt
        // (not ownerId or memoryId) - case insensitive
        assert.match(doc, /limited to.*id.*body.*createdAt|only.*id.*body.*createdAt/i);
    });

    it('document describes idempotency key format validation', () => {
        const doc = getDoc();
        assert.match(doc, /idempotency.*key.*format|8.*128|KEY_PATTERN/i);
    });

    it('document describes 128KB body bound', () => {
        const doc = getDoc();
        assert.match(doc, /128.*KB|131072|128KB/i);
    });
});
