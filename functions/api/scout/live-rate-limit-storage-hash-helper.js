'use strict';
export const SCOUT_LIVE_RATE_LIMIT_STORAGE_HASH_HELPER_VERSION='20260609-1';
export const SCOUT_LIVE_RATE_LIMIT_STORAGE_HASH_HELPER_CODES=Object.freeze({STORAGE_HASH_HELPER_DISABLED:'STORAGE_HASH_HELPER_DISABLED'});
export function createScoutLiveRateLimitStorageHashHelper(){return Object.freeze({disabled:true,hash(){return {ok