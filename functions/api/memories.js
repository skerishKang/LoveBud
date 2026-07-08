import { proxyMemoryRouteRequest } from '../_shared/memory-route-proxy.js';

export async function onRequestGet(context) {
  return proxyMemoryRouteRequest(context);
}

export async function onRequestPost(context) {
  return proxyMemoryRouteRequest(context);
}
