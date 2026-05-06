import { onRequestDelete as __api_memories__id__js_onRequestDelete } from "G:\\Ddrive\\BatangD\\task\\workdiary\\LoveBud\\functions\\api\\memories\\[id].js"
import { onRequestGet as __api_memories__id__js_onRequestGet } from "G:\\Ddrive\\BatangD\\task\\workdiary\\LoveBud\\functions\\api\\memories\\[id].js"
import { onRequestPut as __api_memories__id__js_onRequestPut } from "G:\\Ddrive\\BatangD\\task\\workdiary\\LoveBud\\functions\\api\\memories\\[id].js"
import { onRequestDelete as __api_trees__id__js_onRequestDelete } from "G:\\Ddrive\\BatangD\\task\\workdiary\\LoveBud\\functions\\api\\trees\\[id].js"
import { onRequestGet as __api_trees__id__js_onRequestGet } from "G:\\Ddrive\\BatangD\\task\\workdiary\\LoveBud\\functions\\api\\trees\\[id].js"
import { onRequestPut as __api_trees__id__js_onRequestPut } from "G:\\Ddrive\\BatangD\\task\\workdiary\\LoveBud\\functions\\api\\trees\\[id].js"
import { onRequestGet as __api_memories_js_onRequestGet } from "G:\\Ddrive\\BatangD\\task\\workdiary\\LoveBud\\functions\\api\\memories.js"
import { onRequestPost as __api_memories_js_onRequestPost } from "G:\\Ddrive\\BatangD\\task\\workdiary\\LoveBud\\functions\\api\\memories.js"
import { onRequestGet as __api_trees_js_onRequestGet } from "G:\\Ddrive\\BatangD\\task\\workdiary\\LoveBud\\functions\\api\\trees.js"
import { onRequestPost as __api_trees_js_onRequestPost } from "G:\\Ddrive\\BatangD\\task\\workdiary\\LoveBud\\functions\\api\\trees.js"
import { onRequest as __api___path___js_onRequest } from "G:\\Ddrive\\BatangD\\task\\workdiary\\LoveBud\\functions\\api\\[[path]].js"

export const routes = [
    {
      routePath: "/api/memories/:id",
      mountPath: "/api/memories",
      method: "DELETE",
      middlewares: [],
      modules: [__api_memories__id__js_onRequestDelete],
    },
  {
      routePath: "/api/memories/:id",
      mountPath: "/api/memories",
      method: "GET",
      middlewares: [],
      modules: [__api_memories__id__js_onRequestGet],
    },
  {
      routePath: "/api/memories/:id",
      mountPath: "/api/memories",
      method: "PUT",
      middlewares: [],
      modules: [__api_memories__id__js_onRequestPut],
    },
  {
      routePath: "/api/trees/:id",
      mountPath: "/api/trees",
      method: "DELETE",
      middlewares: [],
      modules: [__api_trees__id__js_onRequestDelete],
    },
  {
      routePath: "/api/trees/:id",
      mountPath: "/api/trees",
      method: "GET",
      middlewares: [],
      modules: [__api_trees__id__js_onRequestGet],
    },
  {
      routePath: "/api/trees/:id",
      mountPath: "/api/trees",
      method: "PUT",
      middlewares: [],
      modules: [__api_trees__id__js_onRequestPut],
    },
  {
      routePath: "/api/memories",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_memories_js_onRequestGet],
    },
  {
      routePath: "/api/memories",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_memories_js_onRequestPost],
    },
  {
      routePath: "/api/trees",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_trees_js_onRequestGet],
    },
  {
      routePath: "/api/trees",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_trees_js_onRequestPost],
    },
  {
      routePath: "/api/:path*",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api___path___js_onRequest],
    },
  ]