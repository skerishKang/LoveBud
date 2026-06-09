export const DISABLED='STORAGE_HASH_HELPER_DISABLED';
export function createScoutLiveRateLimitStorageHashHelper(){return{disabled:true,hash:()=>({ok:false,disabled:true,code:DISABLED,hash:null})};}
