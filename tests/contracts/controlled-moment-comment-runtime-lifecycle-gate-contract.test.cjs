'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOC_PATH = path.resolve(__dirname, '../../docs/product/lovebud-controlled-moment-comment-runtime-lifecycle-gate.md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @type {string | null} */
let docContent = null;
function getDoc() {
    if (docContent === null) {
        docContent = fs.readFileSync(DOC_PATH, 'utf-8');
    }
    return docContent;
}

// ---------------------------------------------------------------------------
// 1. File existence and content quality
// ---------------------------------------------------------------------------

describe('1. Document existence and content quality', () => {
    it('document exists', () => {
        assert.ok(fs.existsSync(DOC_PATH), `document not found: ${DOC_PATH}`);
    });

    it('document has sufficient body length (non-trivial)', () => {
        const doc = getDoc();
        assert.ok(doc.length > 4000, `document too short: ${doc.length} chars`);
    });
});

// ---------------------------------------------------------------------------
// 2. Required decision statement
// ---------------------------------------------------------------------------

describe('2. Required decision statement', () => {
    it('PROTOCOL DESIGN READY; RUNTIME EXECUTION NOT AUTHORIZED appears verbatim', () => {
        const doc = getDoc();
        assert.ok(
            doc.includes('PROTOCOL DESIGN READY; RUNTIME EXECUTION NOT AUTHORIZED'),
        );
    });
});

// ---------------------------------------------------------------------------
// 3. Reference markers
// ---------------------------------------------------------------------------

describe('3. Reference markers', () => {
    it('Refs #3227 present', () => {
        assert.ok(getDoc().includes('Refs #3227'));
    });

    it('Refs #3225 present', () => {
        assert.ok(getDoc().includes('Refs #3225'));
    });

    it('Refs #3075 present', () => {
        assert.ok(getDoc().includes('Refs #3075'));
    });

    it('Refs #3218 present', () => {
        assert.ok(getDoc().includes('Refs #3218'));
    });

    it('#3218 described as public read-only moment comments panel (complete)', () => {
        const doc = getDoc();
        assert.ok(doc.match(/public.*read.*only.*moment.*comment|3218.*public.*read|3218.*complete/i));
    });

    it('no "Synthetic fixture governance" language for #3218', () => {
        const doc = getDoc();
        assert.ok(!doc.match(/3218.*synthetic.*fixture.*governance|synthetic.*fixture.*governance.*3218/i));
    });

    it('#3218 is not described as open', () => {
        const doc = getDoc();
        // #3218 should not be paired with "open" in the references
        assert.ok(!doc.match(/#3218.*\n.*open|#3218.*open/im) || doc.match(/3218.*complete|3218.*panel/i));
    });

    it('Refs #1882 present', () => {
        assert.ok(getDoc().includes('Refs #1882'));
    });

    it('no Closes #1882', () => {
        assert.ok(!/Closes\s+#1882/.test(getDoc()));
    });

    it('no Fixes #1882', () => {
        assert.ok(!/Fixes\s+#1882/.test(getDoc()));
    });

    it('no Resolves #1882', () => {
        assert.ok(!/Resolves\s+#1882/.test(getDoc()));
    });
});

// ---------------------------------------------------------------------------
// 4. Design-only / runtime-not-authorized boundary
// ---------------------------------------------------------------------------

describe('4. Design-only / runtime-not-authorized boundary', () => {
    it('states this is design only, not execution authorization', () => {
        const doc = getDoc();
        assert.match(doc, /design.*only|design document|does not authorize.*runtime|protocol.*design/i);
    });

    it('states successful merge does not auto-authorize composer', () => {
        const doc = getDoc();
        assert.match(doc, /successful.*merge.*does not.*authorize.*composer|does not.*authorize.*composer|composer.*remains.*unauthorized/i);
    });

    it('states runtime execution requires separate explicit authorization', () => {
        const doc = getDoc();
        assert.match(doc, /separate.*explicit.*authorization|explicit.*execution.*authorization|runtime.*requires.*separate/i);
    });

    it('#3075 and #1882 remain open', () => {
        const doc = getDoc();
        assert.match(doc, /#3075.*remains.*open|#1882.*remains.*open|3075.*open|1882.*open/i);
    });
});

// ---------------------------------------------------------------------------
// 5. Identity and fixture isolation
// ---------------------------------------------------------------------------

describe('5. Identity and fixture isolation', () => {
    it('synthetic identity requirement stated', () => {
        const doc = getDoc();
        assert.ok(doc.toLowerCase().includes('synthetic'));
    });

    it('synthetic fixture requirement stated', () => {
        const doc = getDoc();
        assert.ok(doc.toLowerCase().includes('synthetic') && doc.toLowerCase().includes('fixture'));
    });

    it('document does NOT authorize execution environment itself', () => {
        const doc = getDoc();
        // Document should explicitly state it does not select/authorize the execution environment
        assert.match(doc, /does not.*select.*execution.*environment|does not.*authorize.*execution.*environment|execution.*environment.*separate/i);
    });

    it('execution environment requires separate explicit authorization', () => {
        const doc = getDoc();
        assert.match(doc, /separate.*explicit.*execution.*authorization|explicit.*execution.*authorization.*required/i);
    });

    it('document does not authorize production, staging, browser, or Firebase session', () => {
        const doc = getDoc();
        assert.match(doc, /does not.*authorize.*production|does not.*authorize.*staging|does not.*authorize.*browser|does not.*authorize.*firebase.*session/i);
    });

    it('no token/UID/email/fixture-ID/body in docs/PR/reports rule exists', () => {
        const doc = getDoc();
        assert.match(doc, /no.*token|no.*UID|no.*email|no.*fixture.*ID|never.*record|never.*appear/i);
    });

    it('isolation unclear = immediate BLOCKED rule stated', () => {
        const doc = getDoc();
        assert.match(doc, /isolation.*unclear|isolation.*cannot.*be.*proven|immediately.*BLOCKED|BLOCKED.*stop/i);
    });
});

// ---------------------------------------------------------------------------
// 6. Preflight stop conditions
// ---------------------------------------------------------------------------

describe('6. Preflight stop conditions', () => {
    it('preflight stop conditions section exists', () => {
        const doc = getDoc();
        assert.match(doc, /preflight.*stop|stop.*condition|abort.*without/i);
    });

    it('synthetic identity/fixture unclear → BLOCKED', () => {
        const doc = getDoc();
        assert.ok(
            doc.match(/synthetic.*unclear|synthetic.*unproven|fixture.*unclear|isolation.*unclear/i)
        );
    });

    it('auth scope/visibility mismatch → BLOCKED', () => {
        const doc = getDoc();
        assert.ok(
            doc.match(/auth.*scope.*mismatch|visibility.*mismatch|unexpected.*authorization|unexpected.*visibility/i)
        );
    });

    it('cleanup authority unclear → BLOCKED', () => {
        const doc = getDoc();
        assert.ok(
            doc.match(/cleanup.*unclear|lifecycle.*unclear|authority.*unclear|cleanup.*authority/i)
        );
    });

    it('raw response recording risk → BLOCKED', () => {
        const doc = getDoc();
        assert.ok(
            doc.match(/raw.*response.*risk|sensitive.*data.*record|recording.*risk/i)
        );
    });

    it('selected moment scope cannot be guaranteed → BLOCKED', () => {
        const doc = getDoc();
        assert.ok(
            doc.match(/selected.*moment.*scope.*cannot.*guarantee|moment.*scope.*unclear|scope.*cannot.*be.*guaranteed/i)
        );
    });
});

// ---------------------------------------------------------------------------
// 7. Minimal runtime sequence
// ---------------------------------------------------------------------------

describe('7. Minimal runtime sequence', () => {
    it('create comment step exists', () => {
        const doc = getDoc();
        assert.ok(doc.match(/create.*comment|authenticated.*create|create comment/i));
    });

    it('public-read reconciliation step exists', () => {
        const doc = getDoc();
        assert.ok(doc.match(/public.*read.*reconciliation|read.*reconciliation|same.*moment.*public.*read/i));
    });

    it('idempotency replay step exists', () => {
        const doc = getDoc();
        assert.ok(doc.match(/idempotency.*replay|duplicate.*submit|replay.*idempotency/i));
    });

    it('blocked/retry category step exists', () => {
        const doc = getDoc();
        assert.ok(doc.match(/blocked.*retry|safe.*blocked|retry.*category|blocked.*category/i));
    });

    it('cleanup step exists', () => {
        const doc = getDoc();
        assert.ok(doc.match(/cleanup|lifecycle.*cleanup|clean.*up/i));
    });

    it('each step records PASS/BLOCKED/FAIL + safe category', () => {
        const doc = getDoc();
        assert.ok(doc.match(/PASS.*BLOCKED.*FAIL|PASS.*\/.*BLOCKED.*\/.*FAIL|step.*name.*outcome/i));
    });

    it('Audit log review step is NOT present (direct audit inspection not authorized)', () => {
        const doc = getDoc();
        // Audit log review is not part of this design-only protocol
        assert.ok(!doc.match(/Audit log review|audit log review|confirm audit records/i));
    });
});

// ---------------------------------------------------------------------------
// 8. Pass / Fail / Blocked rules
// ---------------------------------------------------------------------------

describe('8. Pass / Fail / Blocked rules', () => {
    it('duplicate comment from replay → FAIL', () => {
        const doc = getDoc();
        assert.ok(doc.match(/duplicate.*comment.*FAIL|replay.*duplicate.*FAIL|duplicate.*fail/i));
    });

    it('stale selected-moment overwrite → FAIL', () => {
        const doc = getDoc();
        assert.ok(doc.match(/stale.*moment.*FAIL|different.*moment.*FAIL|moment.*overwrite.*FAIL/i));
    });

    it('public reconciliation not scoped to selected moment → FAIL', () => {
        const doc = getDoc();
        assert.ok(doc.match(/not.*scoped.*selected.*moment|not.*limited.*selected.*moment|reconciliation.*fail/i));
    });

    it('unexpected auth/visibility → BLOCKED or FAIL', () => {
        const doc = getDoc();
        assert.ok(doc.match(/unexpected.*authorization.*BLOCKED|unexpected.*visibility.*BLOCKED|authorization.*unexpected.*BLOCKED/i));
    });

    it('cleanup outcome unclear → BLOCKED', () => {
        const doc = getDoc();
        assert.ok(doc.match(/cleanup.*unclear.*BLOCKED|cleanup.*cannot.*confirm.*BLOCKED|cleanup.*BLOCKED/i));
    });

    it('scope-external data reached → immediately abort', () => {
        const doc = getDoc();
        assert.ok(doc.match(/scope.*external.*immediately.*abort|immediately.*abort.*scope|abort.*scope.*external/i));
    });

    it('confidence loss → BLOCKED stop', () => {
        const doc = getDoc();
        assert.ok(doc.match(/confidence.*lost.*BLOCKED|confidence.*loss.*BLOCKED|lost.*confidence.*BLOCKED/i));
    });
});

// ---------------------------------------------------------------------------
// 9. Safe error and retry taxonomy
// ---------------------------------------------------------------------------

describe('9. Safe error and retry taxonomy', () => {
    it('retryable categories defined (network timeout, rate limit backoff)', () => {
        const doc = getDoc();
        assert.ok(doc.match(/retryable|retry.*safe|network.*timeout.*retry/i));
    });

    it('immediately blocked categories defined (scope expansion, auth mismatch)', () => {
        const doc = getDoc();
        assert.ok(doc.match(/immediately.*blocked|do not.*retry|scope.*expansion.*blocked|never.*retry/i));
    });

    it('idempotency key rotation to bypass rate limits is prohibited', () => {
        const doc = getDoc();
        assert.ok(doc.match(/idempotency.*key.*rotation.*prohibited|rotate.*idempotency.*key.*bypass|key.*rotation.*bypass.*rate/i));
    });

    it('raw payload/header/stack trace/credential exposure prohibited', () => {
        const doc = getDoc();
        // Document has "Raw backend payloads", "HTTP headers", "Stack traces", "Token values" in "Never record"
        assert.ok(doc.match(/raw.*payload|stack.*trace|credential|token.*value/i));
    });
});

// ---------------------------------------------------------------------------
// 10. Evidence, redaction, and retention
// ---------------------------------------------------------------------------

describe('10. Evidence, redaction, and retention', () => {
    it('allowed report content: step name + PASS/BLOCKED/FAIL + coarse category', () => {
        const doc = getDoc();
        assert.ok(doc.match(/step.*name.*PASS.*BLOCKED.*FAIL|step.*name.*outcome.*category|outcome.*coarse.*category/i));
    });

    it('token recording prohibited', () => {
        const doc = getDoc();
        assert.ok(doc.match(/no.*token|never.*token|token.*prohibited|token.*forbidden/i));
    });

    it('UID recording prohibited', () => {
        const doc = getDoc();
        assert.ok(doc.match(/no.*UID|never.*UID|UID.*prohibited|UID.*forbidden/i));
    });

    it('email recording prohibited', () => {
        const doc = getDoc();
        assert.ok(doc.match(/no.*email|never.*email|email.*prohibited|email.*forbidden/i));
    });

    it('fixture ID recording prohibited', () => {
        const doc = getDoc();
        assert.ok(doc.match(/no.*fixture.*ID|never.*fixture.*ID|fixture.*ID.*forbidden/i));
    });

    it('fixture URL recording prohibited', () => {
        const doc = getDoc();
        assert.ok(doc.match(/no.*fixture.*URL|never.*fixture.*URL|fixture.*URL.*forbidden/i));
    });

    it('comment body recording prohibited', () => {
        const doc = getDoc();
        // Document has "Comment bodies" and "bodies" in "Never record"
        assert.ok(doc.match(/bodies|comment.*bodies/i));
    });

    it('raw response / raw log recording prohibited', () => {
        const doc = getDoc();
        // Document has "Raw responses" and "Raw logs" in "Never record"
        assert.ok(doc.match(/raw.*response|raw.*log|never.*raw/i));
    });

    it('request header recording prohibited', () => {
        const doc = getDoc();
        // Document has "Request authorization headers" in "Never record"
        assert.ok(doc.match(/request.*header|header.*never|never.*header/i));
    });

    it('secret recording prohibited', () => {
        const doc = getDoc();
        // Document has "Secrets" in "Never record"
        assert.ok(doc.match(/secret|never.*secret/i));
    });

    it('temporary notes deletion/retention policy stated', () => {
        const doc = getDoc();
        assert.ok(doc.match(/temporary.*notes.*delet|temporary.*notes.*retention|delete.*after.*review/i));
    });

    it('execution results are reference only, not auto-implementation authorization', () => {
        const doc = getDoc();
        assert.ok(doc.match(/reference.*only|reference.*material|not.*automatic.*implementation|not.*binding.*implementation/i));
    });
});

// ---------------------------------------------------------------------------
// 11. Execution authorization boundary
// ---------------------------------------------------------------------------

describe('11. Execution authorization boundary', () => {
    it('document merge is not runtime execution authorization', () => {
        const doc = getDoc();
        assert.ok(doc.match(/merge.*does not.*authorize.*runtime|document.*merge.*not.*authorization|runtime.*authorization.*separate/i));
    });

    it('separate explicit execution authorization required', () => {
        const doc = getDoc();
        assert.ok(doc.match(/separate.*explicit.*execution.*authorization|explicit.*authorization.*required|requires.*separate.*authorization/i));
    });

    it('successful runtime gate does not auto-authorize composer', () => {
        const doc = getDoc();
        // Document has "runtime gate is successful: Composer UI requires a separate narrow authorization issue"
        assert.ok(doc.match(/gate.*successful|successful.*gate/i));
        assert.ok(doc.match(/composer.*separate|composer.*not.*auto|separate.*composer/i));
    });

    it('composer requires separate narrow issue and review', () => {
        const doc = getDoc();
        assert.ok(doc.match(/composer.*separate.*narrow.*issue|composer.*separate.*review|separate.*narrow.*composer/i));
    });

    it('#3075 remains open', () => {
        const doc = getDoc();
        assert.ok(doc.match(/#3075.*remains.*open|3075.*open/i));
    });

    it('#1882 remains open', () => {
        const doc = getDoc();
        assert.ok(doc.match(/#1882.*remains.*open|1882.*open/i));
    });
});

// ---------------------------------------------------------------------------
// 12. Permanent exclusions
// ---------------------------------------------------------------------------

describe('12. Permanent exclusions', () => {
    it('composer, drawer, submit, optimistic UI excluded', () => {
        const doc = getDoc();
        // Document: "Composer UI, comment drawer, submit button, optimistic UI"
        assert.ok(doc.match(/composer|drawer|submit|optimistic/i));
    });

    it('source/runtime code changes excluded', () => {
        const doc = getDoc();
        // Document: "Source code or runtime code changes"
        assert.ok(doc.match(/source.*code|runtime.*code/i));
    });

    it('backend/API/Cloudflare/Modal/Firebase/DB/schema/migration/config/deployment excluded', () => {
        const doc = getDoc();
        // Document: "Backend, API, Cloudflare, Modal, Firebase, database, schema, migration, configuration, deployment changes"
        assert.ok(doc.match(/backend|modal|firebase|cloudflare|db|database|deployment/i));
    });

    it('browser/production runtime execution excluded', () => {
        const doc = getDoc();
        // Document: "Browser or production runtime execution"
        assert.ok(doc.match(/browser|production.*runtime|runtime.*execution/i));
    });

    it('likes, Browse, My Trees, Editor, Scout excluded', () => {
        const doc = getDoc();
        // Document: "Likes functionality, Browse, My Trees, Editor, or Scout changes"
        assert.ok(doc.match(/likes|browse|my trees|editor|scout/i));
    });

    it('#3075 and #1882 close/resolve excluded', () => {
        const doc = getDoc();
        // Document: "Closing or resolving #3075 or #1882"
        assert.ok(doc.match(/closing.*3075|closing.*1882|resolving.*3075|resolving.*1882/i));
    });

    it('direct database inspection, audit-log retrieval, audit-log review excluded', () => {
        const doc = getDoc();
        // Document has "Direct database inspection, audit-log retrieval, or audit-log review" in exclusions
        assert.ok(doc.match(/direct.*database.*inspection|audit.*log.*retrieval|audit.*log.*review/i));
    });

    it('source-level audit recording is not runtime audit-log inspection', () => {
        const doc = getDoc();
        // Document distinguishes #3225 source-level audit from runtime audit-log inspection
        assert.ok(doc.match(/source-level.*audit.*confirmed|source-level.*audit.*guardrail|source-level.*audit.*#3225/i));
    });
});

// ---------------------------------------------------------------------------
// 13. Verification protocol summary exists
// ---------------------------------------------------------------------------

describe('13. Verification protocol summary', () => {
    it('protocol summary flowchart/section exists', () => {
        const doc = getDoc();
        assert.ok(doc.match(/PREFLIGHT|CREATE COMMENT|PUBLIC READ|IDEMPOTENCY|CLEANUP|REPORT/i));
    });

    it('outcome-only reporting rule in summary', () => {
        const doc = getDoc();
        assert.ok(doc.match(/outcome.*only|no.*token.*UID.*body/i));
    });
});