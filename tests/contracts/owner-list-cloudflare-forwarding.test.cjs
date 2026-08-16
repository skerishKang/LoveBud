// Contract tests for #3944 Cloudflare same-origin forwarding of owner-list
// cursor pagination. These assert the dedicated route builders forward
// `pagination`, `cursor`, `limit`, and (for memories) `treeId` exactly, while
// legacy requests keep their current array-forwarding shape.
//
// Run: node --test tests/contracts/owner-list-cloudflare-forwarding.test.cjs

const { test } = require("node:test");
const assert = require("node:assert/strict");

const MODAL = "https://modal.example";

function paramsOf(urlString) {
  return Object.fromEntries(new URL(urlString).searchParams.entries());
}

test("memory collection forwards pagination/cursor/treeId/limit", async () => {
  const memoryProxy = await import("../../functions/_shared/memory-route-proxy.js");
  const request = new Request(
    "https://example.test/api/memories?treeId=T1&pagination=cursor&cursor=ENC&limit=50"
  );
  const target = memoryProxy.buildMemoryCollectionModalUrl(request, { MODAL_BASE_URL: MODAL });
  assert.ok(target, "target url built");
  const p = paramsOf(target.toString());
  assert.equal(p.treeId, "T1");
  assert.equal(p.pagination, "cursor");
  assert.equal(p.cursor, "ENC");
  assert.equal(p.limit, "50");
});

test("memory collection legacy request does not add pagination/cursor", async () => {
  const memoryProxy = await import("../../functions/_shared/memory-route-proxy.js");
  const request = new Request("https://example.test/api/memories?treeId=T1&limit=100");
  const target = memoryProxy.buildMemoryCollectionModalUrl(request, { MODAL_BASE_URL: MODAL });
  const p = paramsOf(target.toString());
  assert.equal(p.treeId, "T1");
  assert.equal(p.limit, "100");
  assert.equal(p.pagination, undefined);
  assert.equal(p.cursor, undefined);
});

test("trees route forwards pagination/cursor/limit", async () => {
  const treesProxy = await import("../../functions/api/trees.js");
  const request = new Request(
    "https://example.test/api/trees?pagination=cursor&cursor=XYZ&limit=75"
  );
  const target = treesProxy.buildPrivateTreesModalUrl(request, { MODAL_BASE_URL: MODAL });
  assert.ok(target, "target url built");
  const p = paramsOf(target.toString());
  assert.equal(p.pagination, "cursor");
  assert.equal(p.cursor, "XYZ");
  assert.equal(p.limit, "75");
});

test("trees route legacy request does not add pagination/cursor", async () => {
  const treesProxy = await import("../../functions/api/trees.js");
  const request = new Request("https://example.test/api/trees?limit=200");
  const target = treesProxy.buildPrivateTreesModalUrl(request, { MODAL_BASE_URL: MODAL });
  const p = paramsOf(target.toString());
  assert.equal(p.limit, "200");
  assert.equal(p.pagination, undefined);
  assert.equal(p.cursor, undefined);
});

test("builders return null when MODAL_BASE_URL missing", async () => {
  const memoryProxy = await import("../../functions/_shared/memory-route-proxy.js");
  const treesProxy = await import("../../functions/api/trees.js");
  const request = new Request("https://example.test/api/trees?pagination=cursor&cursor=Z");
  assert.equal(treesProxy.buildPrivateTreesModalUrl(request, {}), null);
  assert.equal(memoryProxy.buildMemoryCollectionModalUrl(request, {}), null);
});
