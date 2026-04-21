# Requires NETLIFY_DATABASE_URL or DATABASE_URL to be set in the shell.

# Get verification data
$queryAll = "SELECT COUNT(*) as total FROM trees;"
$queryPublic = "SELECT COUNT(*) as public_count FROM trees WHERE is_public = true;"
$queryDemo = "SELECT COUNT(*) as demo_count FROM trees WHERE owner_id = '6xJoZMw64gWZcSIIS92kmBcSGVn1';"

$queryRecent = @"
SELECT id, name, is_public, owner_id, node_count, created_at::date as created_date, updated_at::date as updated_date
FROM trees 
WHERE is_public = true 
ORDER BY created_at DESC 
LIMIT 5;
"@

$querySampleNodes = @"
SELECT t.id as tree_id, t.name as tree_title, 
       (t.payload->>'nodes')::jsonb as nodes
FROM trees t
WHERE t.is_public = true
ORDER BY t.created_at DESC
LIMIT 3;
"@

Write-Host "`n=== LoveBud DB Verification ===`n" -ForegroundColor Cyan

# Count queries
$allResult = & node -e "const {Pool} = require('pg'); (async () => { const p = new Pool({connectionString: process.env.NETLIFY_DATABASE_URL, ssl: {rejectUnauthorized: false}}); const r = await p.query('$queryAll'); console.log(JSON.stringify(r.rows[0])); await p.end(); })();"
$pubResult = & node -e "const {Pool} = require('pg'); (async () => { const p = new Pool({connectionString: process.env.NETLIFY_DATABASE_URL, ssl: {rejectUnauthorized: false}}); const r = await p.query('$queryPublic'); console.log(JSON.stringify(r.rows[0])); await p.end(); })();"
$demoResult = & node -e "const {Pool} = require('pg'); (async () => { const p = new Pool({connectionString: process.env.NETLIFY_DATABASE_URL, ssl: {rejectUnauthorized: false}}); const r = await p.query('$queryDemo'); console.log(JSON.stringify(r.rows[0])); await p.end(); })();"

Write-Host "📊 전체 Trees: $allResult" -ForegroundColor Yellow
Write-Host "📊 Public Trees: $pubResult" -ForegroundColor Yellow
Write-Host "📊 Demo Owner Trees: $demoResult" -ForegroundColor Yellow

Write-Host "`n📋 최근 삽입된 Public Trees (상위 5개):`n" -ForegroundColor Cyan
node -e "const {Pool} = require('pg'); (async () => { const p = new Pool({connectionString: process.env.NETLIFY_DATABASE_URL, ssl: {rejectUnauthorized: false}}); const r = await p.query(`$queryRecent`); r.rows.forEach((row, i) => { console.log((i+1) + '. ' + row.id + ' | ' + row.name + ' | ' + row.node_count + ' nodes | created: ' + row.created_date); }); await p.end(); })();"

Write-Host "`n📋 샘플 노드 데이터 확인 (상위 3개 트리):`n" -ForegroundColor Cyan
node -e "const {Pool} = require('pg'); (async () => { const p = new Pool({connectionString: process.env.NETLIFY_DATABASE_URL, ssl: {rejectUnauthorized: false}}); const r = await p.query(`$querySampleNodes`); r.rows.forEach((row, i) => { const nodes = JSON.parse(row.nodes || '[]'); console.log((i+1) + '. ' + row.tree_title + ' -> ' + nodes.length + ' nodes'); if (nodes.length > 0) { console.log('   첫 번째 노드: ' + nodes[0].title); console.log('   thumbnail: ' + nodes[0].thumbnail.substring(0, 60) + '...'); } }); await p.end(); })();"

Write-Host "`n✅ 검증 완료`n" -ForegroundColor Green