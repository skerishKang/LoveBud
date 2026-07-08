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

// Reload doc for the assertions below so a missing file surfaces the baseline failure.
if (!doc) {
  try {
    doc = fs.readFileSync(DOC_PATH, 'utf-8');
  } catch (err) {
    doc = null;
  }
}

function describeContract(name, fn) {
  describe(name, fn);
}

describeContract('B. Phase 1 dry-run queue authoritative', () => {
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
    assert.ok(
      !doc.includes('competing classifier rejected') || doc.includes('no competing classifier'),
      'should not introduce a competing classifier'
    );
    assert.ok(doc.toLowerCase().includes('no competing classifier'), 'must forbid a competing classifier');
  });
});

describeContract('C. structured metadata only / raw content forbidden', () => {
  it('allows only structured queue metadata', () => {
    assert.ok(doc.toLowerCase().includes('structured queue metadata'), 'must allow structured queue metadata only');
  });
  it('forbids raw issue body, PR body, comments', () => {
    assert.ok(doc.toLowerCase().includes('raw issue body'), 'must forbid raw issue body');
    assert.ok(doc.toLowerCase().includes('pr body'), 'must forbid PR body');
    assert.ok(doc.toLowerCase().includes('comments'), 'must forbid comments');
  });
});

describeContract('D. secrets / credentials forbidden', () => {
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

describeContract('E. decision enum', () => {
  it('restricts decision to PROPOSE / NO_CANDIDATE only', () => {
    assert.ok(doc.includes('PROPOSE'), 'must define PROPOSE');
    assert.ok(doc.includes('NO_CANDIDATE'), 'must define NO_CANDIDATE');
    // No third decision value permitted.
    assert.ok(
      /exactly two values|restricted to exactly two|only two values|two values/.test(doc),
      'must state the decision is limited to exactly two values'
    );
  });
});

describeContract('F. at-most-one candidate', () => {
  it('PROPOSE references exactly one candidate', () => {
    assert.ok(doc.toLowerCase().includes('at most one'), 'must state at-most-one candidate');
    assert.ok(
      doc.toLowerCase().includes('exactly one') || doc.toLowerCase().includes('at most one'),
      'must restrict selection to a single candidate'
    );
  });
});

describeContract('G. strict JSON schema', () => {
  it('defines the strict schema with all required keys', () => {
    assert.ok(doc.includes('queueSnapshotId'), 'must include queueSnapshotId');
    assert.ok(doc.includes('policyVersion'), 'must include policyVersion');
    assert.ok(doc.includes('decision'), 'must include decision');
    assert.ok(doc.includes('selectedCandidateId'), 'must include selectedCandidateId');
    assert.ok(doc.includes('reasonCodes'), 'must include reasonCodes');
    assert.ok(doc.includes('generatedAt'), 'must include generatedAt');
  });
  it('sets additionalProperties: false', () => {
    assert.ok(doc.includes('additionalProperties: false'), 'must set additionalProperties: false');
  });
  it('selectedCandidateId is null unless PROPOSE', () => {
    assert.ok(
      doc.toLowerCase().includes('null') && doc.toLowerCase().includes('propose'),
      'must tie selectedCandidateId null/non-null to PROPOSE'
    );
  });
});

describeContract('H. PROPOSE / NO_CANDIDATE examples', () => {
  it('has a valid PROPOSE example with decision=PROPOSE and a non-null id', () => {
    const proposeIdx = doc.indexOf('"decision": "PROPOSE"');
    assert.ok(proposeIdx !== -1, 'must contain a PROPOSE example');
    const nextDecisionIdx = doc.indexOf('"decision": "NO_CANDIDATE"', proposeIdx + 1);
    const end = nextDecisionIdx === -1 ? proposeIdx + 400 : nextDecisionIdx;
    const slice = doc.slice(proposeIdx, end);
    assert.ok(slice.includes('"selectedCandidateId":') && !slice.includes('"selectedCandidateId": null'),
      'PROPOSE example must have a non-null selectedCandidateId');
  });
  it('has a valid NO_CANDIDATE example with selectedCandidateId null', () => {
    const noIdx = doc.indexOf('"decision": "NO_CANDIDATE"');
    assert.ok(noIdx !== -1, 'must contain a NO_CANDIDATE example');
    const slice = doc.slice(noIdx, noIdx + 400);
    assert.ok(slice.includes('"selectedCandidateId": null'), 'NO_CANDIDATE example must have null selectedCandidateId');
  });
});

describeContract('I. fail-closed rules', () => {
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
    assert.ok(/MUST NOT emit .?PROPOSE/.test(doc) || doc.includes('MUST NOT emit `PROPOSE`') || doc.includes('must not emit'),
      'must forbid emitting PROPOSE under failing conditions');
  });
});

describeContract('J. recommendation vs execution separation', () => {
  it('recommendation is advisory only / separated from execution', () => {
    const lower = doc.toLowerCase();
    assert.ok(lower.includes('advisory'), 'must describe recommendation as advisory');
    assert.ok(lower.includes('separation') || lower.includes('separate') || lower.includes('distinct'),
      'must separate recommendation from execution');
  });
});

describeContract('K. GitHub mutation / execution prohibitions', () => {
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

describeContract('L. config-only enablement forbidden', () => {
  it('config change cannot enable execution', () => {
    const lower = doc.toLowerCase();
    assert.ok(lower.includes('config-only') || lower.includes('config change'), 'must address config-only change');
    assert.ok(lower.includes('cannot') || lower.includes('must not'), 'must state config cannot enable execution');
    assert.ok(lower.includes('model invocation') || lower.includes('execution'),
      'must tie the prohibition to execution activation');
  });
});

describeContract('M. future provider approval 7 fields', () => {
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

describeContract('N. Ollama / local-model / cloud-provider non-goal', () => {
  it('marks Ollama, local model, cloud provider as non-goals', () => {
    const lower = doc.toLowerCase();
    assert.ok(lower.includes('ollama'), 'must name Ollama as non-goal');
    assert.ok(lower.includes('local model') || lower.includes('local-model'), 'must name local model as non-goal');
    assert.ok(lower.includes('cloud model') || lower.includes('cloud provider'), 'must name cloud provider as non-goal');
    assert.ok(lower.includes('non-goal') || lower.includes('out of scope'), 'must label them non-goals');
  });
});

describeContract('O. #1882 Refs only', () => {
  it('references #1882 only via Refs, with no closing keyword', () => {
    assert.ok(doc.includes('#1882'), 'must reference #1882');
    assert.ok(doc.includes('Refs #1882'), 'must use Refs #1882');
    assert.ok(!/closes #1882/i.test(doc), 'must NOT use a closing keyword for #1882');
    assert.ok(!/fixes #1882/i.test(doc), 'must NOT use fixes for #1882');
    assert.ok(!/resolved #1882/i.test(doc), 'must NOT use resolved for #1882');
  });
});
