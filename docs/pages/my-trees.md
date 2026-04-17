# my-trees (내 러브트리)

## 페이지 목적
사용자가 소유한 비공개 트리 목록을 보고 관리하는 페이지. 첫 트리 생성 또는 기존 트리 선택으로 editor로 이동.

## 사용자 목표
1. 내 트리 목록 확인
2. 새 트리 생성
3. 특정 트리 선택 → editor로 이동하여 편집

---

## 현재 구현 상태

### 주요 UI 섹션
- **Shared Header**: 로고, 내비게이션 (홈, 둘러보기, 내 트리, 설정)
- **페이지 헤더**: "내 러브트리" 제목 + 설명 문구
- **Trees Grid**: 트리 카드 그리드 (280px 최소 너비, auto-fill)
- **Empty State**: 트리가 없을 때 CTA 버튼

### 현재 파일 구조
- `pages/my-trees.html` (384줄)
- `js/my-trees.js` (372줄)
- `css/global.css` (공통)

---

## 현재 잘 되는 것

| 항목 | 상태 |
|------|------|
| 트리 카드 렌더링 | ✅ grid layout, hover 효과 |
| 빈 상태 UI | ✅ CTA 버튼 표시 |
| 로딩 skeleton | ✅ shimmer 애니메이션 |
| 캐시 우선 렌더링 | ✅ LoveBudCache 사용 |
| auth 가드 | ✅ 비로그인 시 login redirect |

---

## 현재 문제/리스크

| 문제 | 설명 |
|------|------|
| 캐시 분리 문제 | 초기 버전에서 my-trees와 search가 같은 cache key 공유 → 분리됨 (`459d2e6`) |
| public 트리混入 | API가 public tree를 포함할 경우 my-trees에 표시될 수 있음 → filter 적용 (`visibility === 'private'`) |
| 빈 상태 안내 모호 | "첫 번째 순간을 기록하고..." 문구가 추상적 → 최근 개선됨 (행동 지시 명확화) |
| 새 트리 생성 경로 | 버튼은 있으나 실제 생성 로직은 API 호출 필요 |

---

## 상태별 화면

### 1. 로딩 중
- Skeleton cards (3개)
- Shimmer 애니메이션
- "러브트리 목록을 불러오는 중..." 텍스트

### 2. 트리 있음 (성공)
- 트리 카드 그리드
- 각 카드: 썸네일 area, 제목, 메모리 수, 비공개 배지
- 카드 hover 시 elevation + 테두리 색상 변경

### 3. 빈 상태
- "아직 러브트리가 없어요" 제목
- 새 문구: "새 러브트리를 만들어 첫 추억의 씨앗을 심어보세요. 영상을 추가하고 감정을 기록하면 나무가 자라납니다."
- "새 러브트리 만들기" 버튼

### 4. 에러
- 캐시도 없으면 빈 배열로 render (API 실패 시)
- 토스트 에러 메시지 표시

---

## 필요한 데이터/API

| 데이터 | 소스 | 비고 |
|--------|------|------|
| trees list | `apiClient.getTrees()` | private만 filter |
| tree metadata | API response | title, visibility, created_at |
| memories (카드용) | payload.nodes | thumbnail, memoryCount |

---

## 다음 개선 포인트

1. 새 트리 생성 실제 기능 연결
2. 각 트리에서 memoryCount 정확히 표시
3. 트리 삭제 기능
4. 트리 제목 편집 기능
5. 트리별 썸네일 (첫 memory 기반) - 현재는 gradient 더미