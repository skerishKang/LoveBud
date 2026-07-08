import { proxyMemoryRouteRequest } from '../../_shared/memory-route-proxy.js';

function withMemoryId(context) {
  return { memoryId: context.params?.id || null };
}

export async function onRequestGet(context) {
  return proxyMemoryRouteRequest(context, withMemoryId(context));
}

export async function onRequestPut(context) {
  return proxyMemoryRouteRequest(context, withMemoryId(context));
}

export async function onRequestDelete(context) {
  return proxyMemoryRouteRequest(context, withMemoryId(context));
}
