var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/memories/[id].js
function stripTrailingSlash(value) {
  return String(value || "").replace(/\/$/, "");
}
__name(stripTrailingSlash, "stripTrailingSlash");
function withModalHeader(response) {
  const headers = new Headers(response.headers);
  headers.set("x-lovebud-upstream", "modal");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withModalHeader, "withModalHeader");
async function onRequestGet(context) {
  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: "MODAL_BASE_URL is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  const memoryId = context.params?.id;
  const target = new URL(`/modal/memories/${memoryId}`, modalBaseUrl);
  const response = await fetch(target.toString(), {
    headers: {
      accept: "application/json",
      ...context.request.headers.get("authorization") ? { authorization: context.request.headers.get("authorization") } : {}
    }
  });
  return withModalHeader(response);
}
__name(onRequestGet, "onRequestGet");
async function onRequestPut(context) {
  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: "MODAL_BASE_URL is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  const memoryId = context.params?.id;
  const target = new URL(`/modal/private/memories/${memoryId}`, modalBaseUrl);
  const response = await fetch(target.toString(), {
    method: "PUT",
    headers: {
      accept: "application/json",
      "content-type": context.request.headers.get("content-type") || "application/json",
      ...context.request.headers.get("authorization") ? { authorization: context.request.headers.get("authorization") } : {}
    },
    body: context.request.body
  });
  return withModalHeader(response);
}
__name(onRequestPut, "onRequestPut");
async function onRequestDelete(context) {
  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: "MODAL_BASE_URL is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  const memoryId = context.params?.id;
  const target = new URL(`/modal/private/memories/${memoryId}`, modalBaseUrl);
  const response = await fetch(target.toString(), {
    method: "DELETE",
    headers: {
      accept: "application/json",
      ...context.request.headers.get("authorization") ? { authorization: context.request.headers.get("authorization") } : {}
    }
  });
  return withModalHeader(response);
}
__name(onRequestDelete, "onRequestDelete");

// api/trees/[id].js
function stripTrailingSlash2(value) {
  return String(value || "").replace(/\/$/, "");
}
__name(stripTrailingSlash2, "stripTrailingSlash");
function withModalHeader2(response) {
  const headers = new Headers(response.headers);
  headers.set("x-lovebud-upstream", "modal");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withModalHeader2, "withModalHeader");
async function onRequestGet2(context) {
  const modalBaseUrl = stripTrailingSlash2(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: "MODAL_BASE_URL is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  const treeId = context.params?.id;
  const authHeader = context.request.headers.get("authorization");
  const primaryTarget = new URL(authHeader ? `/modal/private/trees/${treeId}` : `/modal/trees/${treeId}`, modalBaseUrl);
  let response = await fetch(primaryTarget.toString(), {
    headers: {
      accept: "application/json",
      ...authHeader ? { authorization: authHeader } : {}
    }
  });
  if (authHeader && response.status === 404) {
    const publicTarget = new URL(`/modal/trees/${treeId}`, modalBaseUrl);
    response = await fetch(publicTarget.toString(), {
      headers: {
        accept: "application/json"
      }
    });
  }
  return withModalHeader2(response);
}
__name(onRequestGet2, "onRequestGet");
async function onRequestPut2(context) {
  const modalBaseUrl = stripTrailingSlash2(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: "MODAL_BASE_URL is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  const treeId = context.params?.id;
  const target = new URL(`/modal/private/trees/${treeId}`, modalBaseUrl);
  const response = await fetch(target.toString(), {
    method: "PUT",
    headers: {
      accept: "application/json",
      "content-type": context.request.headers.get("content-type") || "application/json",
      ...context.request.headers.get("authorization") ? { authorization: context.request.headers.get("authorization") } : {}
    },
    body: context.request.body
  });
  return withModalHeader2(response);
}
__name(onRequestPut2, "onRequestPut");
async function onRequestDelete2(context) {
  const modalBaseUrl = stripTrailingSlash2(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: "MODAL_BASE_URL is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  const treeId = context.params?.id;
  const target = new URL(`/modal/private/trees/${treeId}`, modalBaseUrl);
  const response = await fetch(target.toString(), {
    method: "DELETE",
    headers: {
      accept: "application/json",
      ...context.request.headers.get("authorization") ? { authorization: context.request.headers.get("authorization") } : {}
    }
  });
  return withModalHeader2(response);
}
__name(onRequestDelete2, "onRequestDelete");

// api/memories.js
function stripTrailingSlash3(value) {
  return String(value || "").replace(/\/$/, "");
}
__name(stripTrailingSlash3, "stripTrailingSlash");
function withModalHeader3(response) {
  const headers = new Headers(response.headers);
  headers.set("x-lovebud-upstream", "modal");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withModalHeader3, "withModalHeader");
async function onRequestGet3(context) {
  const modalBaseUrl = stripTrailingSlash3(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: "MODAL_BASE_URL is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  const sourceUrl = new URL(context.request.url);
  const target = new URL("/modal/private/memories", modalBaseUrl);
  const treeId = sourceUrl.searchParams.get("treeId");
  const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get("limit") || 100) || 100, 1), 200);
  if (treeId) target.searchParams.set("treeId", treeId);
  target.searchParams.set("limit", String(limit));
  const response = await fetch(target.toString(), {
    headers: {
      accept: "application/json",
      ...context.request.headers.get("authorization") ? { authorization: context.request.headers.get("authorization") } : {}
    }
  });
  return withModalHeader3(response);
}
__name(onRequestGet3, "onRequestGet");
async function onRequestPost(context) {
  const modalBaseUrl = stripTrailingSlash3(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: "MODAL_BASE_URL is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  const response = await fetch(new URL("/modal/private/memories", modalBaseUrl).toString(), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": context.request.headers.get("content-type") || "application/json",
      ...context.request.headers.get("authorization") ? { authorization: context.request.headers.get("authorization") } : {}
    },
    body: context.request.body
  });
  return withModalHeader3(response);
}
__name(onRequestPost, "onRequestPost");

// api/trees.js
function stripTrailingSlash4(value) {
  return String(value || "").replace(/\/$/, "");
}
__name(stripTrailingSlash4, "stripTrailingSlash");
function withModalHeader4(response) {
  const headers = new Headers(response.headers);
  headers.set("x-lovebud-upstream", "modal");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withModalHeader4, "withModalHeader");
function buildModalUnavailableResponse() {
  return new Response(JSON.stringify({ error: "Modal service temporarily unavailable" }), {
    status: 503,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-lovebud-upstream": "modal",
      "x-lovebud-degraded": "modal-unavailable"
    }
  });
}
__name(buildModalUnavailableResponse, "buildModalUnavailableResponse");
async function onRequestGet4(context) {
  const modalBaseUrl = stripTrailingSlash4(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: "MODAL_BASE_URL is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  const sourceUrl = new URL(context.request.url);
  const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get("limit") || 100) || 100, 1), 200);
  const target = new URL("/modal/private/trees", modalBaseUrl);
  target.searchParams.set("limit", String(limit));
  let response;
  try {
    response = await fetch(target.toString(), {
      headers: {
        accept: "application/json",
        ...context.request.headers.get("authorization") ? { authorization: context.request.headers.get("authorization") } : {}
      }
    });
  } catch (error) {
    return buildModalUnavailableResponse();
  }
  return withModalHeader4(response);
}
__name(onRequestGet4, "onRequestGet");
async function onRequestPost2(context) {
  const modalBaseUrl = stripTrailingSlash4(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: "MODAL_BASE_URL is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  let response;
  try {
    response = await fetch(new URL("/modal/private/trees", modalBaseUrl).toString(), {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": context.request.headers.get("content-type") || "application/json",
        ...context.request.headers.get("authorization") ? { authorization: context.request.headers.get("authorization") } : {}
      },
      body: context.request.body
    });
  } catch (error) {
    return buildModalUnavailableResponse();
  }
  return withModalHeader4(response);
}
__name(onRequestPost2, "onRequestPost");

// api/[[path]].js
function stripTrailingSlash5(value) {
  return String(value || "").replace(/\/$/, "");
}
__name(stripTrailingSlash5, "stripTrailingSlash");
function generateRequestId() {
  return "req-" + crypto.randomUUID();
}
__name(generateRequestId, "generateRequestId");
function getOrCreateRequestId(request) {
  const existingRequestId = request.headers.get("x-lovebud-request-id");
  if (existingRequestId && typeof existingRequestId === "string" && existingRequestId.length > 0) {
    return existingRequestId;
  }
  return generateRequestId();
}
__name(getOrCreateRequestId, "getOrCreateRequestId");
function isBrowseSummaryRequest(request) {
  if (request.method.toUpperCase() !== "GET") return false;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  return path === "/api/community/trees" && url.searchParams.get("view") === "summary";
}
__name(isBrowseSummaryRequest, "isBrowseSummaryRequest");
function buildBrowseCacheRequest(request) {
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") === "popular" ? "popular" : "latest";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 12) || 12, 1), 60);
  const cacheUrl = new URL(url.origin);
  cacheUrl.pathname = "/__cache/community/trees";
  cacheUrl.searchParams.set("view", "summary");
  cacheUrl.searchParams.set("sort", sort);
  cacheUrl.searchParams.set("limit", String(limit));
  return new Request(cacheUrl.toString(), { method: "GET" });
}
__name(buildBrowseCacheRequest, "buildBrowseCacheRequest");
function normalizeGrowingTreesLimit(rawLimit) {
  return Math.min(Math.max(Number(rawLimit || 6) || 6, 3), 12);
}
__name(normalizeGrowingTreesLimit, "normalizeGrowingTreesLimit");
function buildModalUrl(request, env) {
  const modalBaseUrl = stripTrailingSlash5(env.MODAL_BASE_URL);
  if (!modalBaseUrl) return null;
  const sourceUrl = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = sourceUrl.pathname.replace(/\/+$/, "");
  const target = new URL(modalBaseUrl);
  if (path === "/api/community/trees" && sourceUrl.searchParams.get("view") === "summary") {
    const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get("limit") || 12) || 12, 1), 60);
    const sort = sourceUrl.searchParams.get("sort") === "popular" ? "popular" : "latest";
    target.pathname = "/modal/browse/latest";
    target.searchParams.set("limit", String(limit));
    target.searchParams.set("sort", sort);
    return target;
  }
  if (path === "/api/community/growing-trees") {
    const limit = normalizeGrowingTreesLimit(sourceUrl.searchParams.get("limit"));
    target.pathname = "/modal/browse/growing";
    target.searchParams.set("limit", String(limit));
    return target;
  }
  if (path === "/api/community/memories") {
    target.pathname = "/modal/community/memories";
    const treeId = sourceUrl.searchParams.get("treeId");
    const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get("limit") || 100) || 100, 1), 200);
    if (treeId) target.searchParams.set("treeId", treeId);
    target.searchParams.set("limit", String(limit));
    return target;
  }
  if (path === "/api/trees") {
    target.pathname = "/modal/private/trees";
    if (method === "GET") {
      const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get("limit") || 100) || 100, 1), 200);
      target.searchParams.set("limit", String(limit));
    }
    return target;
  }
  if (path === "/api/memories") {
    target.pathname = "/modal/private/memories";
    if (method === "GET") {
      const treeId = sourceUrl.searchParams.get("treeId");
      const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get("limit") || 100) || 100, 1), 200);
      if (treeId) target.searchParams.set("treeId", treeId);
      target.searchParams.set("limit", String(limit));
    }
    return target;
  }
  const memoryMatch = path.match(/^\/api\/memories\/([^/]+)$/);
  if (memoryMatch) {
    const memoryId = encodeURIComponent(decodeURIComponent(memoryMatch[1]));
    const isWrite = ["PUT", "DELETE"].includes(method);
    target.pathname = isWrite ? `/modal/private/memories/${memoryId}` : `/modal/memories/${memoryId}`;
    return target;
  }
  const treeForkMatch = path.match(/^\/api\/trees\/([^/]+)\/fork$/);
  if (treeForkMatch && method === "POST") {
    const treeId = encodeURIComponent(decodeURIComponent(treeForkMatch[1]));
    target.pathname = `/modal/private/trees/${treeId}/fork`;
    return target;
  }
  const treeMatch = path.match(/^\/api\/trees\/([^/]+)$/);
  if (treeMatch) {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const isWrite = ["PUT", "DELETE"].includes(method);
    target.pathname = isWrite || authHeader ? `/modal/private/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}` : `/modal/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`;
    return target;
  }
  return null;
}
__name(buildModalUrl, "buildModalUrl");
function withUpstreamHeader(response, upstream, requestId = null) {
  const headers = new Headers(response.headers);
  headers.set("x-lovebud-upstream", upstream);
  if (requestId) {
    headers.set("x-lovebud-request-id", requestId);
    const existingExposeHeaders = headers.get("Access-Control-Expose-Headers") || "";
    const exposeHeaders = existingExposeHeaders ? `${existingExposeHeaders}, x-lovebud-request-id` : "x-lovebud-request-id";
    headers.set("Access-Control-Expose-Headers", exposeHeaders);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withUpstreamHeader, "withUpstreamHeader");
function isModalOwnedGetRoute(request, env) {
  if (request.method.toUpperCase() !== "GET") return false;
  const modalUrl = buildModalUrl(request, env || {});
  return modalUrl !== null;
}
__name(isModalOwnedGetRoute, "isModalOwnedGetRoute");
function isModalOwnedWriteRoute(request, env) {
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "DELETE"].includes(method)) return false;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (method === "POST" && path.match(/^\/api\/trees\/[^/]+\/fork$/)) {
    return buildModalUrl(request, env || {}) !== null;
  }
  if (method === "POST" && ["/api/trees", "/api/memories"].includes(path)) {
    return buildModalUrl(request, env || {}) !== null;
  }
  const isDetail = path.match(/^\/api\/(trees|memories)\/[^/]+$/);
  if (["PUT", "DELETE"].includes(method) && isDetail) {
    return buildModalUrl(request, env || {}) !== null;
  }
  return false;
}
__name(isModalOwnedWriteRoute, "isModalOwnedWriteRoute");
function buildNotFoundResponse(requestId = null) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "x-lovebud-upstream": "cloudflare",
    "x-lovebud-route-status": "unhandled"
  };
  if (requestId) {
    headers["x-lovebud-request-id"] = requestId;
  }
  return new Response(
    JSON.stringify({ error: "Route not found" }),
    {
      status: 404,
      headers
    }
  );
}
__name(buildNotFoundResponse, "buildNotFoundResponse");
function buildMethodNotAllowedResponse(allow = "GET", requestId = null) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "x-lovebud-upstream": "cloudflare",
    "x-lovebud-route-status": "method-not-allowed",
    "allow": allow,
    "x-lovebud-request-id": requestId
  };
  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    {
      status: 405,
      headers
    }
  );
}
__name(buildMethodNotAllowedResponse, "buildMethodNotAllowedResponse");
function buildModalUnavailableResponse2(requestId = null) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "x-lovebud-upstream": "modal",
    "x-lovebud-degraded": "modal-unavailable"
  };
  if (requestId) {
    headers["x-lovebud-request-id"] = requestId;
  }
  return new Response(
    JSON.stringify({ error: "Modal backend unavailable" }),
    {
      status: 503,
      headers
    }
  );
}
__name(buildModalUnavailableResponse2, "buildModalUnavailableResponse");
async function tryModalRead(request, env, requestId = null) {
  if (request.method.toUpperCase() !== "GET") return null;
  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return null;
  const headers = {
    accept: "application/json",
    ...request.headers.get("authorization") ? { authorization: request.headers.get("authorization") } : {}
  };
  if (requestId) {
    headers["x-lovebud-request-id"] = requestId;
  }
  const response = await fetch(modalUrl.toString(), { headers });
  const sourceUrl = new URL(request.url);
  const path = sourceUrl.pathname.replace(/\/+$/, "");
  const treeMatch = path.match(/^\/api\/trees\/([^/]+)$/);
  if (treeMatch && response.status === 404 && request.headers.get("authorization")) {
    const publicTarget = new URL(stripTrailingSlash5(env.MODAL_BASE_URL));
    publicTarget.pathname = `/modal/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`;
    const publicResponse = await fetch(publicTarget.toString(), {
      headers: {
        accept: "application/json"
      }
    });
    return withUpstreamHeader(publicResponse, "modal", requestId);
  }
  return withUpstreamHeader(response, "modal", requestId);
}
__name(tryModalRead, "tryModalRead");
async function tryModalWrite(request, env, requestId = null) {
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "DELETE"].includes(method)) return null;
  if (!isModalOwnedWriteRoute(request, env || {})) return null;
  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return null;
  const headers = {
    accept: "application/json",
    "content-type": request.headers.get("content-type") || "application/json",
    ...request.headers.get("authorization") ? { authorization: request.headers.get("authorization") } : {}
  };
  if (requestId) {
    headers["x-lovebud-request-id"] = requestId;
  }
  const response = await fetch(modalUrl.toString(), {
    method,
    headers,
    body: method !== "DELETE" ? request.body : null
  });
  return withUpstreamHeader(response, "modal", requestId);
}
__name(tryModalWrite, "tryModalWrite");
async function onRequest(context) {
  const { request, env } = context;
  const requestId = getOrCreateRequestId(request);
  const isModalOwned = isModalOwnedGetRoute(request, env || {});
  const isModalOwnedWrite = isModalOwnedWriteRoute(request, env || {});
  if (isModalOwnedWrite) {
    try {
      const modalResponse = await tryModalWrite(request, env || {}, requestId);
      if (modalResponse) return modalResponse;
    } catch (error) {
      console.warn("[LoveBudCloudflareProxy] Modal write failed, returning 503", error);
      return buildModalUnavailableResponse2(requestId);
    }
  }
  if (isBrowseSummaryRequest(request)) {
    const cache = caches.default;
    const cacheKey = buildBrowseCacheRequest(request);
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return withUpstreamHeader(cachedResponse, "modal", requestId);
    }
    try {
      const modalResponse = await tryModalRead(request, env || {}, requestId);
      if (modalResponse && modalResponse.ok) {
        const cacheableResponse = new Response(modalResponse.body, {
          status: modalResponse.status,
          statusText: modalResponse.statusText,
          headers: modalResponse.headers
        });
        cacheableResponse.headers.set("Cache-Control", "public, max-age=420, stale-while-revalidate=120");
        await cache.put(cacheKey, cacheableResponse.clone());
        return withUpstreamHeader(cacheableResponse, "modal", requestId);
      }
      if (modalResponse) return withUpstreamHeader(modalResponse, "modal", requestId);
    } catch (error) {
      if (isModalOwned) {
        console.warn("[LoveBudCloudflareProxy] Modal read failed, returning 503", error);
        return buildModalUnavailableResponse2(requestId);
      }
    }
  } else {
    try {
      const modalResponse = await tryModalRead(request, env || {}, requestId);
      if (modalResponse) return withUpstreamHeader(modalResponse, "modal", requestId);
    } catch (error) {
      if (isModalOwned) {
        console.warn("[LoveBudCloudflareProxy] Modal read failed, returning 503", error);
        return buildModalUnavailableResponse2(requestId);
      }
    }
  }
  const modalUrl = buildModalUrl(request, env || {});
  if (modalUrl) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const isForkPath = path.match(/^\/api\/trees\/[^/]+\/fork$/);
    const isCollection = ["/api/trees", "/api/memories"].includes(path);
    const isDetail = path.match(/^\/api\/(trees|memories)\/[^/]+$/);
    const allow = isForkPath ? "POST" : isCollection ? "GET, POST" : isDetail ? "GET, PUT, DELETE" : "GET";
    return buildMethodNotAllowedResponse(allow, requestId);
  }
  return buildNotFoundResponse(requestId);
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-7y7x5k/functionsRoutes-0.7029591149202379.mjs
var routes = [
  {
    routePath: "/api/memories/:id",
    mountPath: "/api/memories",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/memories/:id",
    mountPath: "/api/memories",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/memories/:id",
    mountPath: "/api/memories",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/trees/:id",
    mountPath: "/api/trees",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/trees/:id",
    mountPath: "/api/trees",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/trees/:id",
    mountPath: "/api/trees",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut2]
  },
  {
    routePath: "/api/memories",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/memories",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/trees",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/trees",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/:path*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// C:/Users/limone/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// C:/Users/limone/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
