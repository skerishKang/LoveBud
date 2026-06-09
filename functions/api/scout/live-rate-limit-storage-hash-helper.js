export const VERSION='20260609-1';
export const DISABLED='STORAGE_HASH_HELPER_DISABLED';
export const ALLOWED_INPUTS=['userKeyHash'];
export const PROHIBITED_INPUTS=['token'];
export function createScoutLiveRateLimitStorageHashHelper(){return{disabled:true,version:VERSION,hash:()=>({ok:false,disabled:true,code:DISABLED,hash:null,hashPreview:null})};}
