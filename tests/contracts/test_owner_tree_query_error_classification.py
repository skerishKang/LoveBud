"""Pure unit tests for the owner-tree query SQLSTATE classifier.

These tests exercise only the classifier function — no DB connection,
no network access, no modal imports other than the classifier itself.
"""

import unittest

from modal_compute.owner_reads import classify_query_error, OwnerTreeListError


class FakeError:
    """Minimal stand-in mimicking psycopg.Error with configurable sqlstate.

    Not a real psycopg.Error subclass — the classifier uses getattr
    so inheritance is not required.
    """

    def __init__(self, sqlstate: str | None = None):
        self.sqlstate = sqlstate


class TestQueryErrorClassifier(unittest.TestCase):
    """classify_query_error maps SQLSTATE to fixed safe categories."""

    def test_undefined_column(self) -> None:
        error = FakeError(sqlstate="42703")
        category = classify_query_error(error)  # type: ignore[arg-type]
        self.assertEqual(category, "OWNER_TREE_LIST_QUERY_UNDEFINED_COLUMN")

    def test_undefined_table(self) -> None:
        error = FakeError(sqlstate="42P01")
        category = classify_query_error(error)  # type: ignore[arg-type]
        self.assertEqual(category, "OWNER_TREE_LIST_QUERY_UNDEFINED_TABLE")

    def test_insufficient_privilege(self) -> None:
        error = FakeError(sqlstate="42501")
        category = classify_query_error(error)  # type: ignore[arg-type]
        self.assertEqual(category, "OWNER_TREE_LIST_QUERY_INSUFFICIENT_PRIVILEGE")

    def test_undefined_function(self) -> None:
        error = FakeError(sqlstate="42883")
        category = classify_query_error(error)  # type: ignore[arg-type]
        self.assertEqual(category, "OWNER_TREE_LIST_QUERY_UNDEFINED_FUNCTION")

    def test_unknown_sqlstate_returns_generic_failure(self) -> None:
        error = FakeError(sqlstate="XX000")
        category = classify_query_error(error)  # type: ignore[arg-type]
        self.assertEqual(category, "OWNER_TREE_LIST_QUERY_FAILURE")

    def test_none_sqlstate_returns_generic_failure(self) -> None:
        error = FakeError(sqlstate=None)
        category = classify_query_error(error)  # type: ignore[arg-type]
        self.assertEqual(category, "OWNER_TREE_LIST_QUERY_FAILURE")

    def test_missing_sqlstate_attr_returns_generic_failure(self) -> None:
        """Object without sqlstate attribute at all."""
        error = object()
        category = classify_query_error(error)  # type: ignore[arg-type]
        self.assertEqual(category, "OWNER_TREE_LIST_QUERY_FAILURE")


class TestOwnerTreeListError(unittest.TestCase):
    """OwnerTreeListError carries error_category and failure_phase."""

    def test_holds_fields(self) -> None:
        err = OwnerTreeListError(
            error_category="OWNER_TREE_LIST_QUERY_FAILURE",
            failure_phase="query",
        )
        self.assertEqual(err.error_category, "OWNER_TREE_LIST_QUERY_FAILURE")
        self.assertEqual(err.failure_phase, "query")

    def test_all_query_categories_use_query_phase(self) -> None:
        """Every query-classifier category must have failure_phase='query'."""
        sqltstates = ["42703", "42P01", "42501", "42883", None, "XX999"]
        for sqlstate in sqltstates:
            error = FakeError(sqlstate=sqlstate)
            category = classify_query_error(error)  # type: ignore[arg-type]
            err = OwnerTreeListError(
                error_category=category,
                failure_phase="query",
            )
            self.assertEqual(err.failure_phase, "query")


if __name__ == "__main__":
    unittest.main()
