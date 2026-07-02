# LoveBud RESCene Tree Creation & QA Scenario
v20260702-rescene-qa-scenario-1

## Overview

**Target**: Create a LoveTree for RESCENE (리센느) using test account, then run full QA scenario to verify all closed issues work correctly in production.

**Test Account**: `user.test@lovetree.dev`
**Tree Concept**: "Re:Scene — 리센느의 향기로운 장면들"
**Moments**: 5 key milestones explaining RESCENE's rise to popularity

---

## Phase 1: Preparation (Steps 1-4)

### Step 1: Account Verification
- [ ] Login to lovebud.pages.dev with test account
- [ ] Verify my-trees page loads correctly (empty state)
- [ ] Verify header navigation works

### Step 2: Research Analysis
RESCENE (더뮤즈엔터테인먼트, 데뷔 2024.03.26)
- 5-member multi-national girl group
- Members: 원이(KR, 리더), 리브(KR), 미나미(JP), 메이(KR), 제나(KR)
- Signature: 'Proust Effect' concept — scent + scene
- Key achievements: Geoje ambassadors, Rising Star award, underdog success

### Step 3: Moment Content
| # | Moment | Description | Type |
|---|--------|-------------|------|
| Root | 리센느 탄생 | 2024.03.26 데뷔 | Info |
| M1 | 원이의 리더십 | 개인 유튜브 채널 운영 | Video |
| M2 | 미나미의 거제 야호 | 밈→거제시 홍보대사 | Video |
| M3 | 7시간 라이브 | 팬소통 기록 | Video |
| M4 | 라이징스타상 | 2024 Asian Model Awards | Info |
| M5 | 언더독 성공신화 | 중소 기획사의 기적 | Info |

### Step 4: Tree Structure Design
```
Root: "Re:Scene — 리센느"
│
├─ M1: 원이의 리더십 ──── M2: 미나미 거제 야호
│                              │
│                              └─ M3: 7시간 라이브
│
└─ M4: 라이징스타상 ──── M5: 언더독 성공신화
```

---

## Phase 2: Tree Creation (Steps 5-10)

### Step 5: Create Tree
- [ ] Navigate to My Trees
- [ ] Click "새 러브트리 만들기"
- [ ] Title: "Re:Scene — 리센느"
- [ ] Visibility: Public
- [ ] Verify tree appears in My Trees list

### Step 6: Create Root Moment
- [ ] Title: "Re:Scene, 첫 장면"
- [ ] Memo: "2024년 3월 26일, 더뮤즈엔터테인먼트의 5인조 걸그룹 RESCENE(리센느)이 데뷔했습니다. 그룹명은 '향기(Scent)'와 '장면(Scene)'의 합성어로, 대중의 마음속에 생생한 장면과 향기를 남기겠다는 포부를 담고 있습니다."
- [ ] Tags: "RESCENE", "리센느", "데뷔"

### Step 7: Create Moment M1
- [ ] Title: "원이 — 리더의 시작"
- [ ] Memo: "리더 원이는 2004년생으로 팀에서 가장 연장자이자 유일한 고졸 멤버입니다. '안녕하세요원이입니다잘부탁드립니다' 개인 유튜브 채널을 운영하며 팬들과 소통하고 있습니다."
- [ ] Connect: Root → M1

### Step 8: Create Moment M2
- [ ] Title: "미나미 — 거제, 야-호!"
- [ ] Memo: "일본 출신 멤버 미나미가 콘텐츠 중 선보인 '거제, 야-호~!'가 SNS에서 폭발적 인기를 끌며, 팀 전원이 거제시 홍보대사로 위촉되는 성과를 거두었습니다."
- [ ] Connect: M1 → M2

### Step 9: Create Moments M3-M5
- [ ] M3: "7시간 라이브 — 기록의 아이콘" (Connect: M2 → M3)
- [ ] M4: "라이징스타상 — 첫 수상" (Connect: M1 → M4)
- [ ] M5: "언더독의 반란 — 중소의 기적" (Connect: M4 → M5)

### Step 10: Appreciation Order
- [ ] Set order: Root → M1 → M2 → M3 → M4 → M5
- [ ] Save order
- [ ] Verify order persists after refresh

---

## Phase 3: Feature Verification (Steps 11-18)

### Step 11: Viewer — Deterministic Fallback (#3060)
- [ ] Open tree in viewer mode
- [ ] Verify tree renders correctly
- [ ] Test: Load tree with invalid snapshot → should show fallback

### Step 12: Viewer — Appreciation Order Guide (#3061)
- [ ] Click through moments in order
- [ ] Verify "next-in-order" highlight appears on correct node
- [ ] Verify aria-label="다음 순서" is set

### Step 13: Editor — Save Status States (#3059)
- [ ] Edit a moment title
- [ ] Verify "임시 저장" indicator appears
- [ ] Click save → verify "저장 완료" indicator
- [ ] Refresh page → verify changes persisted

### Step 14: Editor — Hub Layout Persistence (#3056)
- [ ] Drag moments to new positions
- [ ] Refresh page → verify positions restored

### Step 15: API — Correlation ID (#2989)
- [ ] Open browser devtools (Network tab)
- [ ] Trigger an API call
- [ ] Verify response headers include `x-lovebud-request-id`

### Step 16: Browse — Public Tree Visibility
- [ ] Log out
- [ ] Navigate to Browse page
- [ ] Verify RESCENE tree appears (if publicMomentCount >= 3)
- [ ] Click tree card → verify viewer loads correctly

### Step 17: Mobile Viewport
- [ ] Resize browser to mobile width (375px)
- [ ] Verify tree renders in structured mode
- [ ] Verify moment cards are readable

### Step 18: Cross-browser Consistency
- [ ] Verify tree loads on fresh browser session
- [ ] Verify no localStorage leakage from other trees

---

## Phase 4: Regression Testing (Steps 19-22)

### Step 19: Auth Flow (#2973)
- [ ] Log out → verify redirect to login
- [ ] Log in again → verify redirect back to previous page
- [ ] Verify session persists across page navigation

### Step 20: Password Reset (#2959)
- [ ] Click "비밀번호 재설정"
- [ ] Verify privacy-safe message (no "user not found" leak)

### Step 21: Scout Staging (#3134/#2660)
- [ ] N/A — staging-only, cannot verify in production

### Step 22: Architecture Bridges (#3120)
- [ ] Open browser console
- [ ] Check for `window.LoveBud*` undefined errors
- [ ] Verify no console errors during normal flow

---

## Phase 5: Cleanup & Documentation (Steps 23-25)

### Step 23: Test Cleanup
- [ ] Remove test tree (or leave as demo content)
- [ ] Clear browser session data

### Step 24: Scenario Document
- [ ] Compile this document with all test results
- [ ] Mark PASS/FAIL for each step
- [ ] Add screenshots where applicable

### Step 25: Final Report
- [ ] Create summary report
- [ ] Update scenario document to `docs/qa/rescene-qa-scenario-2026-07-02.md`

---

## Expected Results Matrix

| Step | Feature | Issue | Expected Result |
|------|---------|-------|-----------------|
| 11 | Viewer Fallback | #3060 | Deterministic fallback when snapshot missing |
| 12 | Appreciation Order | #3061 | next-in-order highlight + aria-label |
| 13 | Save Status | #3059 | Draft/Saving/Saved states distinct |
| 14 | Layout Persistence | #3056 | Positions survive refresh |
| 15 | Correlation ID | #2989 | x-lovebud-request-id in response header |
| 16 | Browse Visibility | — | Public tree with 3+ moments appears in browse |
| 17 | Mobile View | — | Structured mode forced on mobile |
| 19 | Auth Redirect | #2973 | Redirect preserved after login |
| 20 | Password Reset | #2959 | Privacy-safe error messages |
