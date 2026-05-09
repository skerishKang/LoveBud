# LoveBud Conversation Handoff

작성일: 2026-04-16
기준 작업 사본: 컴2 / Codex / WSL
- Windows: `G:\다른 컴퓨터\내 컴퓨터\LoveBud`
- WSL: `/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud`

## 1. 경로/작업 환경 규칙
- 컴2 작업 사본:
  - `G:\다른 컴퓨터\내 컴퓨터\LoveBud`
  - `/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud`
- 컴1 작업 사본:
  - `G:\Ddrive\BatangD\task\workdiary\LoveBud`
- Codex만 WSL 경로를 사용한다.
- Windsurf는 컴1 작업 사본을 사용한다.
- opencode 계열 에이전트는 컴2 작업 사본을 사용할 수 있다.
- 다른 작업 사본의 TODO/QA/완료 보고는 현재 작업 사본의 실제 파일 상태와 다를 수 있다.
- AGENTS.md에 위 규칙과 커밋 규칙을 이미 반영했다.

## 2. 커밋/푸시 운영 규칙
- 구현 에이전트는 가능하면 로컬 커밋까지 만든다.
- 푸시는 다른 전용 에이전트가 따로 해도 된다.
- 이후 검토/인계는 커밋 해시 기준으로 한다.
- `git add -A` 기본 사용 금지.
- 관련 파일만 명시적으로 staging 한다.
- `.tmp.driveupload/**/*` 및 관련 없는 변경은 절대 커밋하지 않는다.
- 응답에는 가능하면 아래를 포함한다:
  - 최종 커밋 해시
  - 커밋 메시지
  - 검증한 항목

## 3. 현재까지 확정된 핵심 판단

### 3.1 헤더 / active 상태
- `shared-header.js`는 보수적 page detection이 맞다.
- `isEditorPage()`는 `getCurrentPage() === 'editor.html'`가 맞다.
- `treeId` 쿼리만으로 editor 판정하는 것은 과수정으로 판단했다.
- 컴1/Windsurf 쪽에서 `3209356` 커밋은 이 회귀를 되돌리는 좋은 수정으로 판단했다.

### 3.2 i18n
- 이전 `i18n.js` 전면 재작성형 커밋은 위험하다고 판단했다.
- 컴1/Windsurf 쪽 `f7406571213b3ec66ce2f214f5e943f5e73da346` 커밋은
  - `94줄 추가, 1줄 삭제`
  - 전면 재작성은 아니고 누락 key/alias 추가 가능성이 높다.
- 다만 바로 채택하지 않고, 실제 사용 key 대조 후 누락분만 추가하는 방식이 맞다고 정리했다.
- 이 커밋은 `실사용 key 검증 후 채택` 상태다.

### 3.3 my-trees / editor 핵심 버그
- cached auth 진입 후 Firebase 준비 전 API 호출 문제는 `editor.js`에서 완화되었다.
- 첫 메모리 추가 시 `Invalid parentId format` 문제는 root 선택 시 `parentId: null`로 보내는 방향이 맞다고 정리했다.
- 첫 노드가 화면 위로 벗어나는 문제는 최소 수정으로 `ROOT_Y` 조정이 맞다고 정리했다.
- 미리보기 버튼은 아직 실제 기능이 아니라면 `준비중` 상태를 명확히 보여주는 수준이 맞다고 판단했다.

### 3.4 cache-utils / 캐시 전략
- `js/cache-utils.js`는 실제로 생성되었고, `my-trees/search/detail/editor`에 일부 적용되었다.
- 초기에 `my-trees`와 `search`가 같은 trees cache key를 공유하는 문제가 있었고,
  이를 분리한 커밋이 컴2 작업 사본에 존재한다:
  - `459d2e6`
  - 메시지: `fix: split trees cache into my-trees and public trees to prevent cache pollution`
- 이 커밋은 채택 가능으로 판단했다.
- 현재 분리된 캐시 구조:
  - `lovebud_my_trees_cache`
  - `lovebud_public_trees_cache`
  - tree별 memories cache
- 로그아웃 시 private cache만 비우도록 `auth.js` 연동도 들어갔다.

### 3.5 TODO_SUMMARY.md
- `TODO_SUMMARY.md`는 완료 보고서로 신뢰 불가 판정을 내렸다.
- 이유:
  - 실제 파일/커밋/DB 실행 결과보다 과장된 완료 주장 다수
  - 계획/희망/진행 중 항목을 완료처럼 서술
- 이후 원칙:
  - 실제 파일/기능/검증 상태 기준으로만 다시 써야 함
  - 수치형 완료 주장은 실제 DB/검증 근거가 있을 때만 사용

## 4. DB / public browse 데이터 관련

### 4.1 133-relovetree와 LoveBud DB 관계
- `133-relovetree`와 `LoveBud`는 같은 Neon DB를 보고 있는 것으로 확인했다.
- 현재 그 DB에는 public tree가 거의 없다.
- 확인 당시 상태:
  - trees 총 2개
  - public 1개
  - private 1개
- 즉 둘러보기가 빈약한 이유는 “다른 DB를 못 보는 것”이 아니라 “공개 데이터가 부족한 것”이다.

### 4.2 public 시드 / 보안 정리
Codex가 직접 반영한 것:
- `scripts/insert-memories.js`
  - 하드코딩된 Neon connection string 제거
  - `NETLIFY_DATABASE_URL || DATABASE_URL` 사용
- `.env.example` 추가
- `scripts/seed-public-trees.js` 추가
  - `demo-owner-lovebud`
  - `SEED_STAGE=phase1|phase2|all`
  - `DRY_RUN=true` 지원
  - 현재 스키마에 맞춰 `trees.payload.nodes` 방식으로 upsert
- 두 스크립트는 `node --check` 통과
- 실제 phase1/phase2 시드는 아직 직접 실행/검증하지 않았다.

### 4.3 테스트 계정 전략
- public browse용으로 테스트 계정 10개 생성은 우선순위가 아니라고 정리했다.
- 더 현실적인 전략:
  - `demo-owner-lovebud` 같은 synthetic owner로 public 트리 시드
  - browse/search는 실제로 필요한 건 로그인 계정보다 public 데이터다.

## 5. UI/UX 쪽에서 사용자가 원한 것과 현재 상태
사용자 요구 핵심:
1. 헤더 아이콘 깜빡임/정렬
2. my-trees가 느리고 허전함
3. 트리 하나뿐이라도 사용자가 다음 행동을 알 수 있어야 함
4. editor 왼쪽 `보기 모드 / 트리 편집 / 미리보기`가 실제 동작과 맞아야 함
5. 미리보기 버튼이 죽어 있으면 안 됨
6. 첫 메모리 추가 성공/실패를 사용자가 분명히 인지해야 함
7. 둘러보기가 단순 목록이 아니라 감상 공간처럼 보여야 함

정리된 방향:
- `my-trees + editor` UX 개선 프롬프트 1개
- `둘러보기(search)` 감상 경험 개편 프롬프트 1개
를 별도로 작성했다.
- 다만 `f336135` 커밋은 UX 아이디어는 좋지만 `shared-header.js` 회귀 + `i18n.js` 과도한 수정이 섞여 있어서 그대로 채택하면 안 된다고 판정했다.

## 6. 컴2 작업 사본의 최근 중요 커밋
- `459d2e6` fix: split trees cache into my-trees and public trees to prevent cache pollution
- `6a353e5` fix: intro.html 누락된 i18n 키 추가
- `6993ace` fix: editor.js Firebase 준비 전 API 호출 방지
- `2dfe216` fix: auth dropdown settings 비활성화 및 FOUC 범위 축소

## 7. 컴1/Windsurf 쪽에서 공유받은 커밋 판정
직접 경로 접근은 못 했고, 사용자가 제공한 `git show` 결과 기준 판정:

### 7.1 `3209356`
- 메시지: `fix: isEditorPage() 회귀 수정 - treeId 쿼리만으로 editor 판정하지 않도록 보수화`
- 변경:
  - `isEditorPage() { return getCurrentPage() === 'editor.html'; }`
- 판정: 채택 가능

### 7.2 `f7406571213b3ec66ce2f214f5e943f5e73da346`
- 메시지: `fix: i18n.js 누락 key 보충 및 호환 alias 추가`
- stat:
  - `js/i18n.js | 94 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++-`
- 판정:
  - 전면 재작성은 아닌 것으로 보임
  - 실사용 key 대조 후 채택이 맞음
  - 바로 폐기할 커밋은 아님

## 8. Kilo / Bun 관련
- `kilo`는 Bun 위에서 돌아가며, 실제로 다음 크래시가 있었다:
  - `panic(main thread): Segmentation fault`
  - `This indicates a bug in Bun, not your code.`
- 판단:
  - LoveBud 앱 버그라기보다 `Bun/kilo` 런타임 문제 가능성이 큼
- 대응 정리:
  1. 큰 출력/긴 diff/대량 파일 상태 출력은 피한다
  2. 프롬프트를 더 작게 쪼갠다
  3. 자연어 긴 보고보다 `커밋 해시 + 짧은 요약`으로 인계한다
  4. 필요시 Bun/kilo 업데이트 또는 bun report 링크로 이슈 제기

## 9. 남은 우선순위
1. `shared-header.js` 회귀 정리 완료 상태를 기준으로 최신 작업 사본 반영 확인
2. `i18n.js`는 실사용 key 추출 기반으로만 정리
3. `public browse` phase1 시드 실제 실행/검증
4. `my-trees + editor` UX 커밋은 회귀 없는 범위로만 다시 정리
5. `search/browse` 감상 경험 개편은 별도 작업으로 진행

## 10. 다음 대화에서 바로 써먹을 문장
- “기준 작업 사본은 컴2 `/mnt/g/다른 컴퓨터/내 컴퓨터/LoveBud` 입니다.”
- “커밋 해시 기준으로 검토해주세요.”
- “`TODO_SUMMARY.md`는 완료 보고서로 신뢰하지 말고 실제 파일 상태로 보세요.”
- “`shared-header.js`는 보수적 page detection이 맞고, `treeId` 쿼리만으로 editor 판정하면 안 됩니다.”
- “`i18n.js`는 실사용 key 대조 후 누락분만 추가하는 방식으로 가야 합니다.”
- “browse가 빈약한 이유는 DB 연결 문제가 아니라 public 트리 데이터 부족입니다.”
