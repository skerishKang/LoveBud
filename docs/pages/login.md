# login (로그인)

## 페이지 목적
사용자가 LoveBud에 로그인하거나 회원가입을 시작하는 인증 진입 페이지.  
로그인 후에는 `redirect` 파라미터에 담긴 원래 목적지로 이동한다.

## 사용자 목표
1. Google 또는 이메일로 인증 시작
2. 새 사용자는 회원가입 모드로 자연스럽게 진입
3. 로그인 후 원래 가려던 페이지로 복귀

---

## 현재 구현 상태

### 파일 구조
- `pages/login.html` (290줄)
- `js/auth.js` (Firebase Auth + 이메일 모달 흐름)
- `js/i18n.js` (문구/배지 일부 번역)

### 주요 UI 섹션
- **Redirect Notice**: 인증이 필요한 페이지에서 들어왔을 때 상단 안내
- **Login Card**: Google 시작 버튼, 이메일 시작 버튼, 배지 그룹
- **Email Auth Modal**: 로그인/회원가입 공용 모달
- **Mode Badge**: 현재 모드가 로그인인지 회원가입인지 표시

### 현재 동작
1. 기본 진입 시 Google 시작 버튼과 이메일 시작 버튼이 보임
2. `?redirect=...`가 있으면 로그인 후 해당 페이지로 이동
3. `?mode=signup`이 있으면 이메일 모달이 자동으로 열리고 회원가입 모드로 시작
4. 이메일 모달에서 로그인/회원가입 모드를 전환할 수 있음
5. 모드 전환 시 제목, 설명, 제출 버튼, 토글 문구, 상단 배지가 함께 바뀜

### 주요 링크 예시
- `login.html?redirect=my-trees.html`
- `login.html?redirect=editor.html?treeId=...`
- `login.html?redirect=my-trees.html&mode=signup`

---

## 현재 잘 되는 것

| 항목 | 상태 |
|------|------|
| redirect notice 표시 | ✅ 보호된 페이지에서 진입 시 상단 안내 표시 |
| Google 로그인 진입 | ✅ 전용 버튼 존재 |
| 이메일 인증 모달 | ✅ 이메일 시작 버튼으로 열림 |
| 회원가입 초기 진입 | ✅ `mode=signup`으로 자동 진입 가능 |
| 모드 배지 표시 | ✅ 로그인/회원가입 상태가 상단 배지로 구분됨 |
| redirect 유지 | ✅ 로그인 후 원래 목적지로 복귀 |

---

## 현재 UX 이슈 / 리스크

| 문제 | 설명 |
|------|------|
| Google 흐름 실사용 검증 필요 | 문서상 구현은 되어 있으나 실제 브라우저 기준 재확인 필요 |
| Guest 시작은 미구현 | divider 아래 notice 성격만 있고 실제 게스트 흐름은 없음 |
| 에러 UX는 기본 alert 중심 | 인증 실패 시 더 부드러운 인라인 에러 UX는 아직 약함 |
| 폼 보조 정보가 적음 | 비밀번호 정책, 계정 생성 이후 흐름 설명은 많지 않음 |

---

## 상태별 화면

### 1. 기본 진입
- Login Card 표시
- Google 시작 / 이메일 시작 버튼 표시
- 하단 배지 그룹 표시

### 2. 보호된 페이지에서 진입
- redirect notice 표시
- 로그인 후 자동 이동 안내

### 3. `mode=signup` 진입
- 이메일 모달 자동 오픈
- 상단 배지가 `회원가입` 상태로 표시
- 이메일/비밀번호 입력 후 계정 생성 흐름 시작

### 4. 에러
- 인증 실패 시 alert 기반 메시지 표시
- raw error 대신 사용자 친화 메시지로 변환

---

## 필요한 데이터/API

| 데이터 | 소스 | 비고 |
|--------|------|------|
| Firebase auth | `firebase-auth.js` | Google OAuth + 이메일 인증 |
| redirect URL | URL 파라미터 | `?redirect=...` |
| initial auth mode | URL 파라미터 + `window.__initialAuthMode` | `signup`이면 회원가입 모드로 시작 |
| auth state | `firebase.auth()` | 로그인 상태 감지 및 후속 이동 |

---

## 다음 개선 포인트

1. Google 로그인 실사용 검증
2. 인증 실패 시 인라인 에러 UX 개선
3. 비회원(Guest) 진입 정책 확정
4. 비밀번호 정책/폼 안내 강화
