"""Executable Modal HTTP limit-parity authority for Issue #4000 / PR #4356.

The parity authority for the Tree Comment LIST read `limit` query parameter is
the observable MODAL HTTP BOUNDARY, not the internal coercion inside
`modal_compute/tree_comments.py::fetch_tree_comments`.  `modal_compute/app.py`
declares:

    limit: int = Query(default=20, ge=1, le=50)

so FastAPI/Pydantic validates and coerces the query string BEFORE
`fetch_tree_comments()` is entered.  Out-of-range and unparseable values are
rejected as 422 RequestValidationError, and the internal `int()`/clamp is
unreachable over HTTP.

This test drives the REAL `modal_compute.app.web_app` route
`GET /modal/private/trees/{tree_id}/comments` through `fastapi.testclient.
TestClient` with the `fetch_tree_comments` seam patched, so no DB, no network,
no Production Modal endpoint, and no real secret is touched.  It records, for
every representative input:

  * HTTP status
  * whether `fetch_tree_comments` was entered
  * the `limit` value the seam received (accepted cases)
  * the verbatim validation body (rejected cases)

`tests/contracts/tree-comment-read-direct-neon.test.cjs` (B7/B7b/B7c) mirrors
these exact expectations on the Cloudflare direct-Neon candidate side.

Run: python tests/contracts/tree_comment_read_limit_http_parity_4356.py
"""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from modal_compute.app import web_app

TREE_ID = str(uuid.uuid4())
PATH = f"/modal/private/trees/{TREE_ID}/comments"
client = TestClient(web_app, raise_server_exceptions=False)
SENTINEL = {"comments": [], "nextCursor": None}

INT_PARSING_MSG = "Input should be a valid integer, unable to parse string as an integer"

# (label, raw query value, expected status, expected seam-entered,
#  expected limit argument passed to fetch_tree_comments)
ACCEPTED_CASES = [
    ("missing", None, 200, True, 20),
    ("20", "20", 200, True, 20),
    ("1", "1", 200, True, 1),
    ("50", "50", 200, True, 50),
    ("+5", "+5", 200, True, 5),
    ("leading zeros", "007", 200, True, 7),
    ("surrounding whitespace", " 5 ", 200, True, 5),
    ("tab/newline whitespace", "\t5\n", 200, True, 5),
    ("integral decimal", "2.0", 200, True, 2),
    ("integral decimal zeros", "5.00", 200, True, 5),
    ("underscore grouping", "1_0", 200, True, 10),
    ("underscore with decimal", "1_0.0", 200, True, 10),
    ("repeated last wins", ["5", "7"], 200, True, 7),
    ("repeated last valid wins", ["abc", "20"], 200, True, 20),
]

# (label, raw query value, expected error type, expected ctx, expected echoed input)
REJECTED_CASES = [
    ("below ge", "0", "greater_than_equal", {"ge": 1}, "0"),
    ("negative", "-1", "greater_than_equal", {"ge": 1}, "-1"),
    ("signed zero", "-0", "greater_than_equal", {"ge": 1}, "-0"),
    ("integral decimal below", "-2.0", "greater_than_equal", {"ge": 1}, "-2.0"),
    ("zero decimal", "0.000", "greater_than_equal", {"ge": 1}, "0.000"),
    ("above le", "51", "less_than_equal", {"le": 50}, "51"),
    ("far above le", "999", "less_than_equal", {"le": 50}, "999"),
    ("grouped above le", "1_000", "less_than_equal", {"le": 50}, "1_000"),
    ("non-integral decimal", "1.9", "int_parsing", None, "1.9"),
    ("non-integral decimal 2", "2.5", "int_parsing", None, "2.5"),
    ("exponent", "1e2", "int_parsing", None, "1e2"),
    ("exponent upper", "1E2", "int_parsing", None, "1E2"),
    ("non-numeric", "abc", "int_parsing", None, "abc"),
    ("empty", "", "int_parsing", None, ""),
    ("whitespace only", "   ", "int_parsing", None, "   "),
    ("radix hex", "0x1f", "int_parsing", None, "0x1f"),
    ("trailing dot", "5.", "int_parsing", None, "5."),
    ("leading dot", ".5", "int_parsing", None, ".5"),
    ("space grouping", "1 000", "int_parsing", None, "1 000"),
    ("double underscore", "1__0", "int_parsing", None, "1__0"),
    ("repeated last invalid", ["20", "abc"], "int_parsing", None, "abc"),
]


def _request(value):
    params = {} if value is None else (
        [("limit", v) for v in value] if isinstance(value, list) else {"limit": value}
    )
    with patch("modal_compute.app.fetch_tree_comments") as seam:
        seam.return_value = SENTINEL
        response = client.get(PATH, params=params)
    return response, seam


@pytest.mark.parametrize("label,value,status,entered,limit_arg", ACCEPTED_CASES)
def test_accepted_limit_reaches_route_body(label, value, status, entered, limit_arg):
    response, seam = _request(value)
    assert response.status_code == status, label
    assert seam.called is entered, label
    assert seam.call_args.kwargs["limit"] == limit_arg, label
    assert seam.call_args.kwargs["limit"] >= 1, label
    assert seam.call_args.kwargs["limit"] <= 50, label


@pytest.mark.parametrize("label,value,error_type,ctx,raw_input", REJECTED_CASES)
def test_rejected_limit_never_enters_route_body(label, value, error_type, ctx, raw_input):
    response, seam = _request(value)
    assert response.status_code == 422, label
    assert seam.called is False, f"{label}: fetch_tree_comments must NOT be entered"

    body = response.json()
    assert set(body) == {"detail"}, label
    assert len(body["detail"]) == 1, label
    detail = body["detail"][0]
    assert detail["type"] == error_type, label
    assert detail["loc"] == ["query", "limit"], label
    assert detail["input"] == raw_input, label
    if ctx is None:
        assert "ctx" not in detail, label
        assert detail["msg"] == INT_PARSING_MSG, label
    else:
        assert detail["ctx"] == ctx, label


def test_exact_422_body_is_json_field_ordered():
    """The verbatim body the Cloudflare Modal proxy forwards to clients today."""
    response, _ = _request("0")
    assert response.status_code == 422
    assert response.headers["content-type"] == "application/json"
    assert response.text == (
        '{"detail":[{"type":"greater_than_equal","loc":["query","limit"],'
        '"msg":"Input should be greater than or equal to 1","input":"0",'
        '"ctx":{"ge":1}}]}'
    )


def test_query_validation_precedes_tree_id_handling():
    """A malformed tree_id plus a bad limit is a 422, proving FastAPI validation
    runs before the route body (which is where tree_id is validated)."""
    with patch("modal_compute.app.fetch_tree_comments") as seam:
        seam.return_value = SENTINEL
        response = client.get("/modal/private/trees/not-a-uuid/comments", params={"limit": "0"})
    assert response.status_code == 422
    assert seam.called is False


def test_no_clamp_is_reachable_over_http():
    """The internal `max(1, min(safe_limit, 50))` clamp can never be observed
    through HTTP: every out-of-range value is rejected before it runs."""
    for value in ["-999999", "0", "51", "99999999999999999999"]:
        response, seam = _request(value)
        assert response.status_code == 422, value
        assert seam.called is False, value


if __name__ == "__main__":
    import sys

    sys.exit(pytest.main([__file__, "-v"]))
