export const STORAGE_HASH_HELPER_DISABLED='STORAGE_HASH_HELPER_DISABLED';
export const STORAGE_HASH_PAYLOAD_PROHIBITED='STORAGE_HASH_PAYLOAD_PROHIBITED';
export function hash(){return {ok:false,disabled:true,code:STORAGE_HASH_HELPER_DISABLED,hash:null,hashPreview:null};}
export function createScoutLiveRateLimitStorageHashHelper(){return Object