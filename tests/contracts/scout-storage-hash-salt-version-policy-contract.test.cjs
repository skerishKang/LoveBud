const assert=require('assert');const fs=require('fs');
const doc=fs.readFileSync('docs/product/lovebud-scout-storage-hash-salt-version-policy.md','utf8');
const helper=fs.readFileSync('functions/api/scout/live-rate-limit-storage-hash-helper.js','utf8');
['#2365','version label','server-side','separate namespaces','rollback','No runtime change'].forEach(s=>assert(doc.includes(s)));
['SC