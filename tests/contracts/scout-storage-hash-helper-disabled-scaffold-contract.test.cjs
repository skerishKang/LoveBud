const fs=require('fs');const h=fs.readFileSync('functions/api/scout/live-rate-limit-storage-hash-helper.js','utf8');if(!h.includes('STORAGE_HASH_HELPER_DISABLED'))process.exit(1);
