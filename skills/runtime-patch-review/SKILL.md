# Runtime Patch Review

## 이 스킬을 언제 쓰이나?

- **최근 패치 deploy 후**: 문법/논리 점검
- **다른 에이전트 작업 결과를 review할 때**: 변경 내용 확인
- **패치 병합 전**: 최소 검증

## 입력으로 필요한 것

| 항목 | 필수 | 설명 |
|------|------|------|
| 대상 파일 | 필수 | 변경된 *.js, *.html 파일 |
| 직전 커밋 | 선택 | 없으면 HEAD 기준 |

## 출력 결과

| 항목 | 결과 |
|------|------|
| 문법 오류 | `node --check` 통과/실패 |
| 중복 블록 | 발견된 중복 |
| 깨진 링크 | HTML 참조 broken |
| 커밋 메시지 | 확인된 메시지 |

## 작업 흐름

### 1. 대상 확인

```bash
# 직전 커밋 변경 파일
git show --stat HEAD

# 또는 특정 파일
git diff HEAD~3 --name-only
```

### 2. 문법 검증

```bash
# 단일 파일
node --check js/editor.js

# 폴더 전체
for f in js/*.js; do node --check "$f" && echo "$f OK"; done

# Functions 검증
node --check netlify/functions/trees.js
```

### 3. 패턴 검사

```bash
# 중복 addEventListener
rg "addEventListener.*click" -t js -c

# 중복 console.log (debug 잔여)
rg "console\.(log|warn|error)" -t js

# TODO/FIXME
rg "TODO|FIXME|HACK" -t js

# as any (금기)
rg " as any" -t js
```

### 4. HTML 링크 검증

```bash
# 외부 링크 확인
rg 'href="https?://' -t html -o

# 내부 링크 확인
rg 'href="[^*]' -t html | grep -v 'http'

# JS/CSS 참조
rg '\.js\?v=|\.css\?v=' -t html
```

### 5. diff 검토

```bash
# staged 변경
git diff --staged

# unstaged 변경
git diff

# 특정 파일
git diff js/editor.js
```

## 자주 쓰는 검증 패턴

| 검사 | 명령어 |
|------|--------|
| 문법 오류 | `node --check <file>` |
| 정의되지 않은 변수 | `node --check` (선언 needed) |
| 중복 addEventListener | `rg "addEventListener" -c` |
| console 잔여 | `rg "console\.log" -t js` |
| 빈 함수 | `rg "^function.*{}$" -t js -c` |
| Broken HTML | `node -e "require('fs').readdirSync('./pages').forEach(f=>require('fs').readFileSync('./pages/'+f,'utf8').match(/href="[^"]+\.html(?!\?)/)&&console.log(f))"` |

##Templates

### review_summary.md

```
# Patch Review - {날짜}

## 변경 파일
| {파일} | {변경 유형} |
|--------|-------------|

## 검증 결과
- [ ] 문법 통과
- [ ] 중복 없음
- [ ] console 제거
- [ ] 링크 정상

##Comments
{코멘트}
```

##Metadata
created: 2026-04-17
category: review