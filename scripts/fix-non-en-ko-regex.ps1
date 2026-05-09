# fix-non-en-ko-regex.ps1
# 정규식 \uXXXX 패턴으로 비-EN/KO 문자 치환 (ASCII only source)

$patterns = @(
    @{ Pattern = '\u2190'; Replacement = '<-' }   # ← leftwards arrow
    @{ Pattern = '\u2192'; Replacement = '->' }   # → rightwards arrow
    @{ Pattern = '\u2014'; Replacement = '-' }    # — em dash
    @{ Pattern = '\u2013'; Replacement = '-' }    # – en dash
    @{ Pattern = '\u251C'; Replacement = '+' }    # ├ box light vertical and right
    @{ Pattern = '\u2502'; Replacement = '|' }    # │ box light vertical
    @{ Pattern = '\u2500'; Replacement = '-' }    # ─ box light horizontal
    @{ Pattern = '\u2514'; Replacement = '+' }    # └ box light up and right
    @{ Pattern = '\u250C'; Replacement = '+' }    # ┌ box light down and right
    @{ Pattern = '\u2510'; Replacement = '+' }    # ┐ box light down and left
    @{ Pattern = '\u2518'; Replacement = '+' }    # ┘ box light up and left
    @{ Pattern = '\u2534'; Replacement = '+' }    # ┴ box light up and horizontal
    @{ Pattern = '\u252C'; Replacement = '+' }    # ┬ box light down and horizontal
    @{ Pattern = '\u253C'; Replacement = '+' }    # ┼ box light vertical and horizontal
    @{ Pattern = '\u2524'; Replacement = '+' }    # ┤ box light vertical and left
)

$utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
$changed = 0

Get-ChildItem -Path 'docs' -Recurse -File -Include *.md,*.txt | ForEach-Object {
    $path = $_.FullName
    try {
        $content = Get-Content -Path $path -Raw -Encoding UTF8
        $original = $content
        foreach ($rep in $patterns) {
            $content = [regex]::Replace($content, $rep.Pattern, $rep.Replacement)
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
