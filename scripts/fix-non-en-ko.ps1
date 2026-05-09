# fix-non-en-ko.ps1
# 허용: ASCII + 한글. 그 외 유니코드 → ASCII 치환

$patterns = @{}
$patterns[[char]0x2192] = '->'   # →
$patterns[[char]0x2190] = '<-'   # ←
$patterns[[char]0x2014] = '-'    # —
$patterns[[char]0x2013] = '-'    # –
$patterns[[char]0x2018] = "'"    # ‘
$patterns[[char]0x2019] = "'"    # '
$patterns[[char]0x201C] = '"'    # “
$patterns[[char]0x201D] = '"'    # ”
$patterns[[char]0x2026] = '...'  # …
$patterns[[char]0x251C] = '+'    # ├
$patterns[[char]0x2502] = '|'    # │
$patterns[[char]0x2500] = '-'    # ─
$patterns[[char]0x2514] = '+'    # └
$patterns[[char]0x250C] = '+'    # ┌
$patterns[[char]0x2510] = '+'    # ┐
$patterns[[char]0x2518] = '+'    # ┘
$patterns[[char]0x2534] = '+'    # ┴
$patterns[[char]0x252C] = '+'    # ┬
$patterns[[char]0x253C] = '+'    # ┼
$patterns[[char]0x2524] = '+'    # ┤

$utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
$changed = 0

Get-ChildItem -Path 'docs' -Recurse -File -Include *.md,*.txt | ForEach-Object {
    $path = $_.FullName
    try {
        $content = Get-Content -Path $path -Raw -Encoding UTF8
        $original = $content
        foreach ($key in $patterns.Keys) {
            $search = [string]$key
            if ($content.Contains($search)) {
                $content = $content.Replace($search, $patterns[$key])
            }
        }
        if ($content -ne $original) {
            [System.IO.File]::WriteAllText($path, $content, $utf8NoBOM)
            Write-Host "수정됨: $path"
            $changed++
        }
    } catch {
        Write-Warning " 스킵: $path ($($_.Exception.Message))"
    }
}

Write-Host "`n완료. 총 $changed 개 파일 수정."
