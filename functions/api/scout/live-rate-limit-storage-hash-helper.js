export const VERSION='20260609-2';
export const DISABLED='STORAGE_HASH_HELPER_DISABLED';
export const ALLOWED_INPUTS=['userKeyHash'];
export const PROHIBITED_INPUTS=['token','authorization','email','apiKey','prompt'];
export function sanitizeHashPayload(p){const s=p&&typeof p==='object'?p:{};return s.userKeyHash===undefined