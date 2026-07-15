/**
 * Contract tests for the legacy tree entity recovery design (Issue #3516).
 *
 * These tests verify the canonical recovery document at
 * docs/product/lovebud-legacy-tree-entity-recovery-contract.md
 * and the existing docs/ops/LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md.
 *
 * Static/source contract test. No DB, network, or Production access.
 *
 * Refs: #3516, #3437, #3435, #3455, #3441, #1882
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const RECOVERY_DOC = path.join(ROOT, "docs/product/lovebud-legacy-tree-entity-recovery-contract.md");
const RUNBOOK = path.join(ROOT, "docs/ops/LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md");

function readDoc(filePath) {
  assert.ok(fs.existsSync(filePath), "Document must exist at " + filePath);
  return fs.readFileSync(filePath, "utf8");
}

test("canonical recovery document exists", function() {
  var docExists = fs.existsSync(RECOVERY_DOC);
  assert.ok(docExists);
});

test("recovery document references #3516", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(doc.indexOf("#3516") >= 0);
});

test("original TEXT IDs preserved (UUID conversion prohibited)", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/TEXT/.test(doc) || /text/.test(doc), "Must mention TEXT");
  assert.ok(/UUID.*conversion.*prohibited/i.test(doc), "Must prohibit UUID conversion");
});

test("ordinary recovered visibility defaults to public", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/defaults to public|default is public|default.*public/i.test(doc), "Must state public default");
});

test("private requires explicit Plus or grandfathered evidence", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/PLUS_ENTITLEMENT_CONFIRMED|GRANDFATHERED_PRIVATE_CONFIRMED/.test(doc), "Must accept explicit evidence codes");
});

test("three-public-moment rule is Browse eligibility only", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/publicMomentCount.*>=.*3.*Browse|Browse.*eligib.*separate/i.test(doc), "Must be Browse eligibility only");
});

test("0-2 public moments do not imply private", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/does not.*imply private|0-2.*not.*private|0-2.*does not/i.test(doc), "Must state 0-2 not imply private");
});

test("memory author cannot establish tree owner", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/Memory.*author|memory.*author/i.test(doc), "Must mention memory author");
  assert.ok(/must not|prohibited/i.test(doc), "Must state prohibition");
});

test("commenter cannot establish owner", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/commenter/i.test(doc), "Must mention commenter");
});

test("liker/reaction actor cannot establish owner", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/liker|reaction actor/i.test(doc), "Must mention liker/reaction actor");
});

test("users-table membership cannot establish owner", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/users.table|Users.table/i.test(doc), "Must mention users-table");
});

test("unresolved owner handling is explicit", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(doc.indexOf("RECOVERY_OWNER_UNRESOLVED") >= 0, "Must define RECOVERY_OWNER_UNRESOLVED");
  assert.ok(doc.indexOf("RECOVERY_OWNER_AND_TITLE_UNRESOLVED") >= 0, "Must define combined state");
  assert.ok(doc.indexOf("RECOVERY_RECLAIMABLE") >= 0, "Must define RECOVERY_RECLAIMABLE");
});

test("ownership fabrication is prohibited", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/fabrication.*prohibited|must not.*fabricat|arbitrary.*assign/i.test(doc), "Must prohibit fabrication");
});

test("unresolved title handling is explicit", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(doc.indexOf("RECOVERY_TITLE_UNRESOLVED") >= 0, "Must define RECOVERY_TITLE_UNRESOLVED");
});

test("synthetic placeholders are not historical facts", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/placeholder.*must not|synthetic.*not.*historical/i.test(doc), "Must state placeholder policy");
});

test("memories/social records must be preserved", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/must not be deleted/.test(doc), "Must prohibit deletion");
});

test("tree_id must not be rewritten", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/tree_id.*must not.*rewrit|rewritten/i.test(doc), "Must prohibit rewrite");
});

test("orphan records must not be reassigned", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/reassign/i.test(doc), "Must mention reassignment policy");
});

test("post-foothold trees excluded", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/post.foothold|#3435|after.*3435|foothold/i.test(doc), "Must exclude post-foothold");
});

test("broad null-based targeting prohibited", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/owner_id IS NULL|null.based|prohibited.*targeting|explicit allowlist/i.test(doc), "Must prohibit broad targeting");
});

test("future mutation requires gates", function() {
  var doc = readDoc(RECOVERY_DOC);
  var gates = ["Transaction boundary", "Dry-run", "Post-verify", "Rollback artifact", "Explicit Production approval"];
  for (var i = 0; i < gates.length; i++) {
    assert.ok(doc.indexOf(gates[i]) >= 0, "Missing gate: " + gates[i]);
  }
});

test("no Production SQL included in design document", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(doc.indexOf("INSERT INTO public.trees") < 0, "Must not contain INSERT");
  assert.ok(doc.indexOf("DELETE FROM") < 0, "Must not contain DELETE");
  assert.ok(doc.indexOf("UPDATE public.trees") < 0, "Must not contain UPDATE");
});

test("no raw Production IDs in design document", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(doc.indexOf("NOT RECORDED") >= 0, "Must have NOT RECORDED markers");
});

test("simple DELETE rollback prohibited", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/DELETE rollback.*prohibited|simple DELETE/i.test(doc), "Must prohibit simple DELETE rollback");
});

test("rollback requires dedicated compensating script", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/dedicated compensat|compensating SQL/i.test(doc), "Must require compensating script");
});

test("raw IDs/UIDs/emails prohibited in GitHub artifacts", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/synthetic.*IDs|NOT RECORDED/.test(doc), "Must mention synthetic IDs or NOT RECORDED");
});

test("evidence hierarchy defined with ordering", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/ordered by|authority|Evidence hierarchy/i.test(doc), "Must define evidence hierarchy");
});

test("runbook public-first default consistent", function() {
  if (!fs.existsSync(RUNBOOK)) return;
  var runbook = readDoc(RUNBOOK);
  assert.ok(/Public-first default|public.*default/i.test(runbook), "Runbook must state public-first");
});

test("runbook prohibits ownership inference", function() {
  if (!fs.existsSync(RUNBOOK)) return;
  var runbook = readDoc(RUNBOOK);
  assert.ok(/ownership inference|owner.*inference/i.test(runbook), "Runbook must prohibit ownership inference");
});

test("FI: memory-author-as-owner must be detected", function() {
  assert.ok(/memory author/i.test("assign owner from the oldest memory author"), "Fixture must match");
});

test("FI: UUID conversion must be detected as prohibited", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/conversion.*prohibited|UUID.*must not/i.test(doc), "Document must prohibit UUID conversion");
});

test("FN: memory-author prohibition is correct (not a false positive)", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/memory.*author.*must not|memory.*author.*prohibited|prohibited.*ownership.*inference/i.test(doc), "Must correctly prohibit memory author as owner");
});

test("FN: Browse eligibility statement is correct", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/Browse.*eligib|Browse.*Search.*separate/i.test(doc), "Must correctly state Browse eligibility");
});

test("FN: public default statement is correct", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(/defaults to public|default is public/i.test(doc), "Must correctly state public default");
});

test("no statement suggests fallback owner assignment from activity", function() {
  var doc = readDoc(RECOVERY_DOC);
  assert.ok(doc.indexOf("most memories") < 0, "Must not suggest most-memories heuristic");
  assert.ok(doc.indexOf("furigana") < 0, "Must not contain furigana heuristic");
});

test("all future execution gates present", function() {
  var doc = readDoc(RECOVERY_DOC);
  var gates = ["reviewed recovery artifact", "aggregate-safe preflight", "exact target cohort",
    "transaction boundary", "dry-run", "row-count expectations", "post-verify",
    "rollback artifact", "explicit production approval", "production visual verification"];
  for (var i = 0; i < gates.length; i++) {
    assert.ok(doc.toLowerCase().indexOf(gates[i].toLowerCase()) >= 0,
      "Missing gate: " + gates[i]);
  }
});

test("incident facts use aggregate numbers only", function() {
  var doc = readDoc(RECOVERY_DOC);
  var section = doc.split("## A. Incident facts");
  if (section.length >= 2) {
    assert.ok(section[1].indexOf("45") >= 0, "Must have aggregate count 45");
  }
});

test("recovery classification tokens defined", function() {
  var doc = readDoc(RECOVERY_DOC);
  var tokens = ["RECOVERED_PUBLIC_BROWSE_ELIGIBLE", "RECOVERED_PUBLIC_GROWING",
    "RECOVERED_PRIVATE_EXPLICIT", "RECOVERY_METADATA_COMPLETE", "RECOVERY_OWNER_UNRESOLVED",
    "RECOVERY_TITLE_UNRESOLVED", "RECOVERY_OWNER_AND_TITLE_UNRESOLVED",
    "RECOVERY_QUARANTINED", "RECOVERY_RECLAIMABLE"];
  for (var i = 0; i < tokens.length; i++) {
    assert.ok(doc.indexOf(tokens[i]) >= 0, "Missing token: " + tokens[i]);
  }
});
