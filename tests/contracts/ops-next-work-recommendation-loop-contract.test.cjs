const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'ops', 'lovebud-next-work-recommendation-loop-contract.md');

// A. design artifact must exist and be readable.
let doc;
describe('LoveBud Next-Work Recommendation Loop Contract', () => {
  it('design artifact must exist (baseline: absent -> fail)', () => {
    assert.ok(fs.existsSync(DOC_PATH), 'docs/ops/lovebud-next-work-recommendation-loop-contract.md must exist');
    doc = fs.readFileSync(DOC_PATH, 'utf-8');
    assert.ok(doc.length > 0, 'design artifact must be non-empty');
  });
});

if (!doc) {
  try { doc = fs.readFileSync(DOC_PATH, 'utf-8'); } catch { doc = null; }
}

// --- helpers: extract fenced ```json blocks from the doc and parse them ---
function extractJsonFences(text) {
  const fences = [];
  const re = /```json\s*([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim();
    let parsed = null;
    let parseError = null;
    try { parsed = JSON.parse(raw); } catch (e) { parseError = e; }
    fences.push({ raw, parsed, parseError });
  }
  return fences;
}

// Schema fence = first json fence (the output schema appears before the examples).
function getSchemaFence() {
  const fences = extractJsonFences(doc);
  assert.ok(fences.length > 0, 'doc must contain at least one json code fence');
  return fences[0];
}

function getExampleFence(decisionValue) {
  const fences = extractJsonFences(doc);
  const hit = fences.find((f) => f.parsed && f.parsed.decision === decisionValue);
  assert.ok(hit, `doc must contain a json example with decision=${decisionValue}`);
  return hit;
}

describe('B. Phase 1 dry-run queue authoritative', () => {
  it('declares the Phase 1 dry-run queue as the single authoritative source', () => {
    assert.ok(doc.includes('Phase 1 dry-run queue'), 'must reference the Phase 1 dry-run queue');
    assert.ok(doc.includes('authoritative'), 'must declare it authoritative');
    assert.ok(
      doc.includes('single authoritative source') || doc.toLowerCase().includes('authoritative source'),
      'must state it is THE authoritative source'
    );
  });
  it('is a read-only consumer, introduces no competing classifier', () => {
    assert.ok(doc.toLowerCase().includes('read-only consumer'), 'must state read-only consumption');
    assert.ok(doc.toLowerCase().includes('no competing classifier'), 'must forbid a competing classifier');
  });
});

describe('C. structured metadata only / raw content forbidden', () => {
  it('allows only structured queue metadata', () => {
    assert.ok(doc.toLowerCase().includes('structured queue metadata'), 'must allow structured queue metadata only');
  });
  it('forbids raw issue body, PR body, comments', () => {
    assert.ok(doc.toLowerCase().includes('raw issue body'), 'must forbid raw issue body');
    assert.ok(doc.toLowerCase().includes('pr body'), 'must forbid PR body');
    assert.ok(doc.toLowerCase().includes('comments'), 'must forbid comments');
  });
});

describe('D. secrets / credentials forbidden', () => {
  it('forbids tokens, secrets, cookies, env, connection strings, raw production data', () => {
    const lower = doc.toLowerCase();
    assert.ok(lower.includes('token'), 'must forbid tokens');
    assert.ok(lower.includes('secret'), 'must forbid secrets');
    assert.ok(lower.includes('cookie'), 'must forbid cookies');
    assert.ok(lower.includes('environment value') || lower.includes('env value'), 'must forbid env values');
    assert.ok(lower.includes('auth data'), 'must forbid auth data');
    assert.ok(lower.includes('connection string'), 'must forbid connection strings');
    assert.ok(lower.includes('raw production data'), 'must forbid raw production data');
  });
});

describe('E. decision enum', () => {
  it('restricts decision to PROPOSE / NO_CANDIDATE only', () => {
    assert.ok(doc.includes('PROPOSE'), 'must define PROPOSE');
    assert.ok(doc.includes('NO_CANDIDATE'), 'must define NO_CANDIDATE');
    assert.ok(/exactly two values|restricted to exactly two|only two values|two values/.test(doc),
      'must state the decision is limited to exactly two values');
  });
});

describe('F. at-most-one candidate', () => {
  it('PROPOSE references exactly one candidate', () => {
    assert.ok(doc.toLowerCase().includes('at most one'), 'must state at-most-one candidate');
  });
});

describe('G. strict JSON Schema (draft 2020-12)', () => {
  it('schema code fence is valid, parseable JSON', () => {
    const f = getSchemaFence();
    assert.ok(f.parsed !== null, `schema code fence must be JSON.parse-able: ${f.parseError && f.parseError.message}`);
  });

  it('schema carries $schema and declares object type with additionalProperties:false', () => {
    const s = getSchemaFence().parsed;
    assert.ok(s !== null);
    assert.strictEqual(typeof s.$schema, 'string', 'must have $schema');
    assert.strictEqual(s.type, 'object', 'type must be object');
    assert.strictEqual(s.additionalProperties, false, 'additionalProperties must be false');
  });

  it('schema required includes exactly the six mandatory keys', () => {
    const s = getSchemaFence().parsed;
    assert.ok(Array.isArray(s.required), 'must have required array');
    const required = ['queueSnapshotId', 'policyVersion', 'decision', 'selectedCandidateId', 'reasonCodes', 'generatedAt'];
    for (const k of required) {
      assert.ok(s.required.includes(k), `required must include ${k}`);
    }
    assert.deepStrictEqual(s.required.slice().sort(), required.slice().sort(),
      'required must contain exactly the six keys');
  });

  it('decision enum is exactly [PROPOSE, NO_CANDIDATE]', () => {
    const s = getSchemaFence().parsed;
    const decision = s.properties && s.properties.decision;
    assert.ok(decision, 'must declare decision property');
    assert.strictEqual(decision.type, 'string', 'decision must be string');
    assert.deepStrictEqual(decision.enum, ['PROPOSE', 'NO_CANDIDATE'], 'decision enum must be exactly the two values');
  });

  it('reasonCodes is array, minItems 1, with closed items.enum', () => {
    const s = getSchemaFence().parsed;
    const rc = s.properties && s.properties.reasonCodes;
    assert.ok(rc, 'must declare reasonCodes property');
    assert.strictEqual(rc.type, 'array', 'reasonCodes must be array');
    assert.strictEqual(rc.minItems, 1, 'reasonCodes must have minItems 1');
    assert.ok(Array.isArray(rc.items && rc.items.enum), 'reasonCodes.items.enum must be a closed array');
    assert.ok(rc.items.enum.length >= 13, 'reasonCodes items enum must be a closed, non-trivial enum');
  });

  it('generatedAt is string with date-time format', () => {
    const s = getSchemaFence().parsed;
    const g = s.properties && s.properties.generatedAt;
    assert.ok(g, 'must declare generatedAt property');
    assert.strictEqual(g.type, 'string', 'generatedAt must be string');
    assert.strictEqual(g.format, 'date-time', 'generatedAt must be format date-time');
  });

  it('selectedCandidateId is constrained by conditional PROPOSE / NO_CANDIDATE schema', () => {
    const s = getSchemaFence().parsed;
    assert.ok(Array.isArray(s.allOf), 'must use allOf for conditional constraint');
    const foundIf = s.allOf.some((c) => c && c.if && c.then);
    assert.ok(foundIf, 'must contain at least one if/then conditional');

    // PROPOSE -> non-empty string
    const proposeRule = s.allOf.find(
      (c) => c && c.if && c.if.properties && c.if.properties.decision &&
        c.if.properties.decision.const === 'PROPOSE'
    );
    assert.ok(proposeRule, 'must constrain PROPOSE branch');
    const proposeThen = proposeRule.then.properties.selectedCandidateId;
    assert.ok(proposeThen, 'PROPOSE then must constrain selectedCandidateId');
    assert.strictEqual(proposeThen.type, 'string', 'PROPOSE selectedCandidateId must be string');
    assert.strictEqual(proposeThen.minLength, 1, 'PROPOSE selectedCandidateId must be non-empty');

    // NO_CANDIDATE -> null
    const noRule = s.allOf.find(
      (c) => c && c.if && c.if.properties && c.if.properties.decision &&
        c.if.properties.decision.const === 'NO_CANDIDATE'
    );
    assert.ok(noRule, 'must constrain NO_CANDIDATE branch');
    const noThen = noRule.then.properties.selectedCandidateId;
    assert.ok(noThen, 'NO_CANDIDATE then must constrain selectedCandidateId');
    assert.ok(
      (Array.isArray(noThen.type) && noThen.type.includes('null')) || noThen.type === 'null' || noThen.const === null,
      'NO_CANDIDATE selectedCandidateId must be null'
    );
  });

  it('examples satisfy the parsed schema invariants (no unknown top-level keys)', () => {
    const propose = getExampleFence('PROPOSE').parsed;
    assert.strictEqual(typeof propose.selectedCandidateId, 'string', 'PROPOSE selectedCandidateId must be string');
    assert.ok(propose.selectedCandidateId.length >= 1, 'PROPOSE selectedCandidateId must be non-empty');
    assert.deepStrictEqual(Object.keys(propose).sort(),
      ['queueSnapshotId', 'policyVersion', 'decision', 'selectedCandidateId', 'reasonCodes', 'generatedAt'].sort(),
      'PROPOSE example must have exactly the six top-level keys');

    const no = getExampleFence('NO_CANDIDATE').parsed;
    assert.strictEqual(no.selectedCandidateId, null, 'NO_CANDIDATE selectedCandidateId must be null');
    assert.deepStrictEqual(Object.keys(no).sort(),
      ['queueSnapshotId', 'policyVersion', 'decision', 'selectedCandidateId', 'reasonCodes', 'generatedAt'].sort(),
      'NO_CANDIDATE example must have exactly the six top-level keys');
  });
});

describe('H. PROPOSE / NO_CANDIDATE examples present', () => {
  it('both examples are present and parseable', () => {
    const p = getExampleFence('PROPOSE');
    const n = getExampleFence('NO_CANDIDATE');
    assert.ok(p.parsed !== null, 'PROPOSE example must be valid JSON');
    assert.ok(n.parsed !== null, 'NO_CANDIDATE example must be valid JSON');
  });
});

describe('I. fail-closed rules', () => {
  it('covers all required fail-closed conditions', () => {
    const lower = doc.toLowerCase();
    assert.ok(lower.includes('stale queue'), 'must cover stale queue');
    assert.ok(lower.includes('unknown pr') || lower.includes('unknown pr/ci'), 'must cover unknown PR/CI status');
    assert.ok(lower.includes('pending/red ci') || (lower.includes('pending') && lower.includes('failure')), 'must cover pending/red CI');
    assert.ok(lower.includes('dependency block') || lower.includes('blocked_by_dependency'), 'must cover dependency block');
    assert.ok(lower.includes('policy mismatch'), 'must cover policy mismatch');
    assert.ok(lower.includes('malformed'), 'must cover malformed output');
    assert.ok(lower.includes('timeout'), 'must cover timeout');
    assert.ok(lower.includes('unavailable capability'), 'must cover unavailable capability');
    assert.ok(lower.includes('provider ambiguity'), 'must cover provider ambiguity');
    assert.ok(lower.includes('fail-closed') || lower.includes('fail closed'), 'must declare fail-closed behavior');
  });
  it('fail-closed forbids PROPOSE in failing conditions', () => {
    assert.ok(/MUST NOT emit .?PROPOSE/.test(doc) || doc.includes('must not emit'),
      'must forbid emitting PROPOSE under failing conditions');
  });
});

describe('J. recommendation vs execution separation', () => {
  it('recommendation is advisory only / separated from execution', () => {
    const lower = doc.toLowerCase();
    assert.ok(lower.includes('advisory'), 'must describe recommendation as advisory');
    assert.ok(lower.includes('separation') || lower.includes('separate') || lower.includes('distinct'),
      'must separate recommendation from execution');
  });
});

describe('K. GitHub mutation / execution prohibitions', () => {
  it('forbids branch, worktree, commit, push, PR, merge, deployment, API, DB, credential use', () => {
    const lower = doc.toLowerCase();
    assert.ok(lower.includes('branch'), 'must forbid branch operations');
    assert.ok(lower.includes('worktree'), 'must forbid worktree operations');
    assert.ok(lower.includes('commit'), 'must forbid commits');
    assert.ok(lower.includes('push'), 'must forbid pushes');
    assert.ok(lower.includes('pull request') || lower.includes('pr '), 'must forbid PR operations');
    assert.ok(lower.includes('merge'), 'must forbid merge');
    assert.ok(lower.includes('deployment'), 'must forbid deployment');
    assert.ok(lower.includes('api call') || lower.includes('api operation'), 'must forbid API calls');
    assert.ok(lower.includes('database operation') || lower.includes('db operation'), 'must forbid DB operations');
    assert.ok(lower.includes('credential use'), 'must forbid credential use');
    assert.ok(lower.includes('issue'), 'must forbid issue mutation');
  });
});

describe('L. config-only enablement forbidden', () => {
  it('config change cannot enable execution', () => {
    const lower = doc.toLowerCase();
    assert.ok(lower.includes('config-only') || lower.includes('config change'), 'must address config-only change');
    assert.ok(lower.includes('cannot') || lower.includes('must not'), 'must state config cannot enable execution');
    assert.ok(lower.includes('model invocation') || lower.includes('execution'),
      'must tie the prohibition to execution activation');
  });
});

describe('M. future provider approval 7 fields', () => {
  it('requires all 7 approval fields before any provider adapter', () => {
    const lower = doc.toLowerCase();
    assert.ok(lower.includes('provider'), 'must require provider');
    assert.ok(lower.includes('execution location'), 'must require execution location');
    assert.ok(lower.includes('data boundary'), 'must require data boundary');
    assert.ok(lower.includes('cost'), 'must require cost');
    assert.ok(lower.includes('timeout'), 'must require timeout');
    assert.ok(lower.includes('observability'), 'must require observability');
    assert.ok(lower.includes('rollback') && lower.includes('disable'), 'must require rollback/disable path');
    assert.ok(lower.includes('seven') || lower.includes('7 '), 'must state the seven required fields');
  });
});

describe('N. Ollama / local-model / cloud-provider non-goal', () => {
  it('marks Ollama, local model, cloud provider as non-goals', () => {
    const lower = doc.toLowerCase();
    assert.ok(lower.includes('ollama'), 'must name Ollama as non-goal');
    assert.ok(lower.includes('local model') || lower.includes('local-model'), 'must name local model as non-goal');
    assert.ok(lower.includes('cloud model') || lower.includes('cloud provider'), 'must name cloud provider as non-goal');
    assert.ok(lower.includes('non-goal') || lower.includes('out of scope'), 'must label them non-goals');
  });
});

describe('O. local failure report is separate from recommendation (no decision field)', () => {
  it('local failure report does not carry a decision field', () => {
    const lower = doc.toLowerCase();
    assert.ok(lower.includes('local failure report'), 'must define local failure report');
    assert.ok(lower.includes('does not') && lower.includes('decision'), 'must state it does not carry a decision field');
    assert.ok(lower.includes('separate') || lower.includes('distinct'), 'must be separate/distinct from recommendation');
  });
});

describe('P. #1882 Refs only', () => {
  it('references #1882 only via Refs, with no closing keyword', () => {
    assert.ok(doc.includes('#1882'), 'must reference #1882');
    assert.ok(doc.includes('Refs #1882'), 'must use Refs #1882');
    assert.ok(!/closes #1882/i.test(doc), 'must NOT use a closing keyword for #1882');
    assert.ok(!/fixes #1882/i.test(doc), 'must NOT use fixes for #1882');
    assert.ok(!/resolved #1882/i.test(doc), 'must NOT use resolved for #1882');
  });
});
