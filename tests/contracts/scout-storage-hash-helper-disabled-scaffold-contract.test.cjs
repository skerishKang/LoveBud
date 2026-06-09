'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const helper=fs.readFileSync(path.join(root,'functions/api/scout/live-rate-limit-storage-hash-helper.js'),'utf8');
const doc=fs.readFileSync(path.join(root,'docs/product/lovebud-scout-storage-hash-helper-disabled-scaffold.md'),'utf8');
const suggest=fs.readFileSync(path.join(root