"""Pure unit tests for the write-outcome classification authority (#4080).

These tests exercise only the pure classifier — no DB connection, no network
access, no modal imports other than the classifier itself.

Refs #4080.
Refs #3461 — Keep OPEN.
Refs #3457.
Refs #3835.
Refs #1882 — Keep OPEN.
"""

import json
import os
import sys
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

from modal_compute.write_outcome_classification import (
    CONTRACT_VERSION,
    CAPABILITIES,
    OUTCOME_CODES,
    WRITE_OUTCOME_STAGE_ORDER,
    WRITE_OUTCOME_STAGES,
    WRITE_ACKNOWLEDGED_EQUALS_REREAD_CONFIRMED,
    classify_write_outcome,
    is_canonical_result,
    validate_write_outcome_facts,
)


def committed_facts(**overrides):
    facts = {
        "transport": "ok",
        "commit": "committed",
        "returning": "row_returned",
        "reread": "visible",
    }
    facts.update(overrides)
    return facts


class TestAuthorityShape(unittest.TestCase):
    """The authority is frozen, provider-neutral, and zero-capability."""

    def test_contract_version(self) -> None:
        self.assertEqual(CONTRACT_VERSION, "1")

    def test_zero_capabilities(self) -> None:
        self.assertEqual(CAPABILITIES, ())

    def test_five_distinct_ordered_stages(self) -> None:
        self.assertEqual(
            WRITE_OUTCOME_STAGE_ORDER,
            (
                "REQUEST_ACCEPTED",
                "DB_TRANSACTION_COMMITTED",
                "CANONICAL_ROW_RETURNED",
                "FOLLOWUP_REREAD_VISIBLE",
                "CLIENT_VISIBLE_SUCCESS",
            ),
        )
        self.assertEqual(len(set(WRITE_OUTCOME_STAGE_ORDER)), 5)
        self.assertEqual(set(WRITE_OUTCOME_STAGES.values()), set(WRITE_OUTCOME_STAGE_ORDER))

    def test_acknowledged_never_equals_reread_confirmed(self) -> None:
        self.assertFalse(WRITE_ACKNOWLEDGED_EQUALS_REREAD_CONFIRMED)

    def test_vocabulary_is_provider_neutral(self) -> None:
        provider_tokens = ["modal", "cloudflare", "firebase", "neon", "vercel", "netlify"]
        vocabulary = "".join(OUTCOME_CODES.values()).lower() + "".join(
            WRITE_OUTCOME_STAGES.values()
        ).lower()
        for token in provider_tokens:
            self.assertNotIn(token, vocabulary)

    def test_outcome_vocabulary_complete(self) -> None:
        required = [
            "CONFIRMED",
            "TRANSPORT_FAILED",
            "ACKNOWLEDGEMENT_MISSING",
            "ACKNOWLEDGED_REREAD_MISSING",
            "MONITORING_FAILED",
            "INSUFFICIENT_EVIDENCE",
            "WRITE_REJECTED_VALIDATION",
            "WRITE_COMMITTED_ROW_RETURNED",
            "WRITE_COMMITTED_REREAD_MISSING",
            "WRITE_COMMITTED_REREAD_MISMATCH",
            "WRITE_STATUS_UNKNOWN",
        ]
        for code in required:
            self.assertEqual(OUTCOME_CODES[code], code)


class TestValidation(unittest.TestCase):
    """Fail-closed validation of write-boundary facts."""

    def test_rejects_non_mapping(self) -> None:
        for bad in [None, 42, "x", [], (), object()]:
            ok, errors = validate_write_outcome_facts(bad)
            self.assertFalse(ok)
            self.assertEqual(errors, ("INPUT_NOT_OBJECT",))

    def test_rejects_private_keys(self) -> None:
        private_keys = [
            "token",
            "email",
            "owner_id",
            "tree_id",
            "memory_id",
            "title",
            "url",
            "payload",
            "sql",
            "raw_error",
            "provider",
            "database_url",
            "secret",
        ]
        for key in private_keys:
            facts = committed_facts()
            facts[key] = "leak"
            ok, errors = validate_write_outcome_facts(facts)
            self.assertFalse(ok, f"private key rejected: {key}")
            self.assertIn("PRIVATE_FIELD_REJECTED", errors)

    def test_rejects_unknown_field(self) -> None:
        facts = committed_facts(bogus_field=1)
        ok, errors = validate_write_outcome_facts(facts)
        self.assertFalse(ok)
        self.assertIn("UNKNOWN_FIELD", errors)

    def test_rejects_missing_required_field(self) -> None:
        facts = {
            "transport": "ok",
            "commit": "committed",
            "returning": "row_returned",
        }
        ok, errors = validate_write_outcome_facts(facts)
        self.assertFalse(ok)
        self.assertIn("MISSING_REQUIRED_FIELD", errors)

    def test_rejects_unknown_enum(self) -> None:
        facts = committed_facts(commit="maybe_committed")
        ok, errors = validate_write_outcome_facts(facts)
        self.assertFalse(ok)
        self.assertIn("UNKNOWN_ENUM", errors)


class TestClassification(unittest.TestCase):
    """Deterministic decision table."""

    def test_classify_raises_on_invalid(self) -> None:
        with self.assertRaises(TypeError):
            classify_write_outcome(None)
        facts = committed_facts(token="x")
        with self.assertRaises(TypeError):
            classify_write_outcome(facts)

    def test_validation_rejected_before_db(self) -> None:
        result = classify_write_outcome(
            committed_facts(
                validation_rejected=True,
                commit="not_reached",
                returning="not_reached",
                reread="not_attempted",
            )
        )
        self.assertEqual(result["outcome_code"], "WRITE_REJECTED_VALIDATION")
        self.assertEqual(result["stage"], "REQUEST_ACCEPTED")
        self.assertTrue(result["retry_safe"])

    def test_not_dispatched_acknowledgement_missing(self) -> None:
        result = classify_write_outcome(
            committed_facts(
                transport="not_dispatched",
                commit="not_reached",
                returning="not_reached",
                reread="not_attempted",
            )
        )
        self.assertEqual(result["outcome_code"], "ACKNOWLEDGEMENT_MISSING")
        self.assertTrue(result["retry_safe"])

    def test_undecidable_timeout_status_unknown(self) -> None:
        result = classify_write_outcome(
            committed_facts(
                transport="timeout",
                commit="unknown",
                returning="unknown",
                reread="unknown",
            )
        )
        self.assertEqual(result["outcome_code"], "WRITE_STATUS_UNKNOWN")
        self.assertFalse(result["retry_safe"])

    def test_undecidable_network_error_status_unknown(self) -> None:
        result = classify_write_outcome(
            committed_facts(
                transport="network_error",
                commit="unknown",
                returning="unknown",
                reread="unknown",
            )
        )
        self.assertEqual(result["outcome_code"], "WRITE_STATUS_UNKNOWN")
        self.assertFalse(result["retry_safe"])

    def test_commit_unknown_status_unknown(self) -> None:
        result = classify_write_outcome(
            committed_facts(commit="unknown", returning="unknown", reread="unknown")
        )
        self.assertEqual(result["outcome_code"], "WRITE_STATUS_UNKNOWN")
        self.assertFalse(result["retry_safe"])

    def test_decidable_transport_failure(self) -> None:
        result = classify_write_outcome(
            committed_facts(
                transport="network_error",
                commit="rolled_back",
                returning="not_reached",
                reread="not_attempted",
            )
        )
        self.assertEqual(result["outcome_code"], "TRANSPORT_FAILED")
        self.assertTrue(result["retry_safe"])

    def test_confirmed_at_followup_reread_visible(self) -> None:
        result = classify_write_outcome(committed_facts())
        self.assertEqual(result["outcome_code"], "CONFIRMED")
        self.assertEqual(result["stage"], "FOLLOWUP_REREAD_VISIBLE")
        self.assertEqual(result["evidence_completeness"], "complete")

    def test_confirmed_at_client_visible_success(self) -> None:
        result = classify_write_outcome(committed_facts(client_visible=True))
        self.assertEqual(result["outcome_code"], "CONFIRMED")
        self.assertEqual(result["stage"], "CLIENT_VISIBLE_SUCCESS")

    def test_committed_reread_missing(self) -> None:
        result = classify_write_outcome(committed_facts(reread="missing"))
        self.assertEqual(result["outcome_code"], "WRITE_COMMITTED_REREAD_MISSING")
        self.assertEqual(result["stage"], "CANONICAL_ROW_RETURNED")
        self.assertFalse(result["retry_safe"])

    def test_committed_reread_mismatch(self) -> None:
        result = classify_write_outcome(committed_facts(reread="mismatch"))
        self.assertEqual(result["outcome_code"], "WRITE_COMMITTED_REREAD_MISMATCH")
        self.assertFalse(result["retry_safe"])

    def test_committed_row_returned_reread_not_attempted(self) -> None:
        result = classify_write_outcome(committed_facts(reread="not_attempted"))
        self.assertEqual(result["outcome_code"], "WRITE_COMMITTED_ROW_RETURNED")
        self.assertEqual(result["stage"], "CANONICAL_ROW_RETURNED")

    def test_committed_no_row(self) -> None:
        result = classify_write_outcome(committed_facts(returning="no_row", reread="missing"))
        self.assertEqual(result["outcome_code"], "ACKNOWLEDGED_REREAD_MISSING")
        self.assertEqual(result["stage"], "DB_TRANSACTION_COMMITTED")

    def test_committed_without_returning_insufficient(self) -> None:
        result = classify_write_outcome(committed_facts(returning="unknown", reread="unknown"))
        self.assertEqual(result["outcome_code"], "INSUFFICIENT_EVIDENCE")

    def test_rolled_back_4xx_status_alone_never_infers_validation_rejection(self) -> None:
        result = classify_write_outcome(
            committed_facts(
                commit="rolled_back",
                returning="not_reached",
                reread="not_attempted",
                upstream_status_class="client_error_4xx",
            )
        )
        self.assertEqual(result["outcome_code"], "ACKNOWLEDGEMENT_MISSING")
        self.assertTrue(result["retry_safe"])

    def test_write_rejected_validation_only_via_authoritative_fact(self) -> None:
        authoritative = classify_write_outcome(
            committed_facts(
                validation_rejected=True,
                commit="not_reached",
                returning="not_reached",
                reread="not_attempted",
                upstream_status_class="client_error_4xx",
            )
        )
        self.assertEqual(authoritative["outcome_code"], "WRITE_REJECTED_VALIDATION")
        status_only = classify_write_outcome(
            committed_facts(
                commit="not_reached",
                returning="not_reached",
                reread="not_attempted",
                upstream_status_class="client_error_4xx",
            )
        )
        self.assertNotEqual(status_only["outcome_code"], "WRITE_REJECTED_VALIDATION")


class TestCanonicalResult(unittest.TestCase):
    """Canonical result guard."""

    def test_result_is_immutable_and_bounded(self) -> None:
        result = classify_write_outcome(committed_facts())
        self.assertEqual(
            sorted(result.keys()),
            ["evidence_completeness", "outcome_code", "retry_safe", "stage"],
        )
        self.assertTrue(is_canonical_result(result))
        with self.assertRaises(TypeError):
            result["stage"] = "REQUEST_ACCEPTED"  # type: ignore[index]

    def test_rejects_non_canonical(self) -> None:
        self.assertFalse(is_canonical_result({}))
        self.assertFalse(is_canonical_result(None))
        self.assertFalse(
            is_canonical_result(
                {
                    "stage": "REQUEST_ACCEPTED",
                    "outcome_code": "CONFIRMED",
                    "retry_safe": False,
                    "evidence_completeness": "complete",
                }
            ),
            "plain dict is not a canonical MappingProxyType result",
        )

    def test_status_unknown_never_retry_safe(self) -> None:
        result = classify_write_outcome(
            committed_facts(transport="timeout", commit="unknown", returning="unknown", reread="unknown")
        )
        self.assertEqual(result["outcome_code"], "WRITE_STATUS_UNKNOWN")
        self.assertFalse(result["retry_safe"])

    def test_deterministic_and_input_not_mutated(self) -> None:
        facts = committed_facts(reread="missing")
        snapshot = dict(facts)
        a = classify_write_outcome(facts)
        b = classify_write_outcome(facts)
        self.assertEqual(dict(a), dict(b))
        self.assertEqual(facts, snapshot)


class TestParityMatrix(unittest.TestCase):
    """The Python authority must match the shared JS/Python parity matrix."""

    def _load_matrix(self):
        matrix_path = os.path.join(
            REPO_ROOT, "tests", "contracts", "write-outcome-parity-matrix-4080.json"
        )
        with open(matrix_path, "r", encoding="utf-8") as fh:
            return json.load(fh)

    def test_matrix_schema_and_case_count(self) -> None:
        matrix = self._load_matrix()
        self.assertEqual(matrix["schemaVersion"], "1")
        self.assertIsInstance(matrix["cases"], list)
        self.assertGreaterEqual(len(matrix["cases"]), 30)

    def test_python_matches_parity_matrix_exactly(self) -> None:
        matrix = self._load_matrix()
        seen = set()
        for case in matrix["cases"]:
            self.assertNotIn(case["id"], seen, f"duplicate parity case id: {case['id']}")
            seen.add(case["id"])

            if "expected" in case:
                result = classify_write_outcome(case["facts"])
                self.assertEqual(
                    {
                        "stage": result["stage"],
                        "outcome_code": result["outcome_code"],
                        "retry_safe": result["retry_safe"],
                        "evidence_completeness": result["evidence_completeness"],
                    },
                    case["expected"],
                    f"parity case {case['id']} ({case['name']}) mismatch",
                )
            elif "expected_error" in case:
                ok, errors = validate_write_outcome_facts(case["facts"])
                self.assertFalse(ok, f"parity case {case['id']} ({case['name']}) must fail closed")
                self.assertEqual(
                    errors[0],
                    case["expected_error"],
                    f"parity case {case['id']} ({case['name']}) first sorted error",
                )
                with self.assertRaises(TypeError):
                    classify_write_outcome(case["facts"])
            else:
                self.fail(f"parity case {case['id']} has neither expected nor expected_error")


class TestContradictions(unittest.TestCase):
    """Contradictory fact tuples fail closed with CONTRADICTORY_FACTS."""

    def test_contradictory_tuples_rejected(self) -> None:
        contradictory = [
            {"transport": "not_dispatched", "commit": "committed", "returning": "unknown", "reread": "unknown"},
            {"transport": "not_dispatched", "commit": "unknown", "returning": "row_returned", "reread": "unknown"},
            {"transport": "not_dispatched", "commit": "unknown", "returning": "unknown", "reread": "visible"},
            {"transport": "ok", "commit": "not_reached", "returning": "row_returned", "reread": "unknown"},
            {"transport": "ok", "commit": "not_reached", "returning": "no_row", "reread": "unknown"},
            {"transport": "ok", "commit": "not_reached", "returning": "unknown", "reread": "visible"},
            {"transport": "ok", "commit": "rolled_back", "returning": "row_returned", "reread": "visible"},
            {"transport": "ok", "commit": "committed", "returning": "no_row", "reread": "visible"},
            {"transport": "ok", "commit": "committed", "returning": "not_reached", "reread": "visible"},
            {"transport": "ok", "commit": "committed", "returning": "row_returned", "reread": "visible", "validation_rejected": True},
            {"transport": "ok", "commit": "committed", "returning": "row_returned", "reread": "missing", "client_visible": True},
        ]
        for facts in contradictory:
            ok, errors = validate_write_outcome_facts(facts)
            self.assertFalse(ok, f"contradictory tuple must fail: {facts}")
            self.assertIn("CONTRADICTORY_FACTS", errors)
            with self.assertRaises(TypeError):
                classify_write_outcome(facts)

    def test_rollback_on_mismatch_tuples_are_not_contradictory(self) -> None:
        allowed = [
            {"transport": "ok", "commit": "rolled_back", "returning": "row_returned", "reread": "missing"},
            {"transport": "ok", "commit": "rolled_back", "returning": "no_row", "reread": "missing"},
            {"transport": "ok", "commit": "rolled_back", "returning": "row_returned", "reread": "not_attempted"},
        ]
        for facts in allowed:
            ok, errors = validate_write_outcome_facts(facts)
            self.assertTrue(ok, f"allowed tuple must pass: {facts} errors={errors}")
            result = classify_write_outcome(facts)
            self.assertEqual(result["outcome_code"], "ACKNOWLEDGEMENT_MISSING")
            self.assertTrue(result["retry_safe"])


class TestNormalMatrixInvariants(unittest.TestCase):
    """The normal matrix invariants from the issue are preserved."""

    def test_timeout_and_network_error_unknown_are_status_unknown(self) -> None:
        for transport in ("timeout", "network_error"):
            result = classify_write_outcome(
                {
                    "transport": transport,
                    "commit": "unknown",
                    "returning": "unknown",
                    "reread": "unknown",
                }
            )
            self.assertEqual(result["outcome_code"], "WRITE_STATUS_UNKNOWN")
            self.assertFalse(result["retry_safe"])

    def test_ack_never_equals_reread_confirmed(self) -> None:
        self.assertFalse(WRITE_ACKNOWLEDGED_EQUALS_REREAD_CONFIRMED)
        confirmed = classify_write_outcome(committed_facts())
        self.assertEqual(confirmed["outcome_code"], "CONFIRMED")
        self.assertNotEqual(confirmed["stage"], "REQUEST_ACCEPTED")


if __name__ == "__main__":
    unittest.main()
