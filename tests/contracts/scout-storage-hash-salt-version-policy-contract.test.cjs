const assert=require('assert');const fs=require('fs');
const doc=fs.readFileSync('docs/product/lovebud-scout-storage-hash-salt-version-policy.md','utf8');
assert(doc.includes('#2365'));
assert(doc.includes('version label'));
assert(doc.includes('server-side'));
assert(doc.includes('separate namespaces'));
assert(doc.includes('No runtime change'));
