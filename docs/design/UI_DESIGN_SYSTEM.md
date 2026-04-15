# UI_DESIGN_SYSTEM

> **"Digital Scrapbook of Emotions"**  
> 기술적인 도식화(Flowchart)를 철저히 배제하고, 아날로그 다이어리를 꾸미듯 따뜻하고 유기적으로 연결된 감정의 흐름을 시각화한다.

---

## 1. UI Principles & Keywords
Lovetree의 디자인은 차가운 IT 관리 도구의 인상을 지우고, 사용자의 소중한 추억을 담는 **따뜻한 일기장**의 감각을 유지해야 합니다.

*   **Warm (따뜻한)**: 난색 계열의 베이지와 뮤트 로즈 컬러 사용.
*   **Organic (유기적인)**: 곡선과 나뭇가지 형태의 흐름 강조.
*   **Tactile (질감이 느껴지는)**: 종이와 스크랩북 같은 부드러운 텍스처.
*   **Soft (부드러운)**: 은은한 그림자와 큰 라운드값 적용.

## 2. Color System (CSS Variables)
모든 색상은 아래의 변수를 사용하여 강제 통일합니다.

```css
:root {
  /* 배경: 완전한 흰색(#FFF) 절대 금지 */
  --color-bg-base: #FDFBF7;    /* 종이 질감의 베이지 */
  --color-surface: rgba(255, 255, 255, 0.85); /* 카드 배경 */
  
  /* 브랜드: 쨍한 원색 금지 */
  --color-primary: #C27C7E;   /* 뮤트 로즈 (기본 액션) */
  --color-secondary: #A8A39C; /* 웜 그레이 (비활성/보조) */
  
  /* 텍스트: 완전한 블랙(#000) 절대 금지 */
  --color-text-main: #3E342F;  /* 다크 브라운 */
  --color-text-muted: #8C827A; /* 중간 톤 브라운 */
}
```

## 3. Typography System
*   **Fonts**: `Outfit` (Primary), `Noto Sans KR` (Secondary).
*   **Body Text**: 행간(Line-height) 최소 1.4 이상 확보하여 가독성 최우선.
*   **Sentiment**: 제목(Title)은 넉넉한 자간과 Medium 굵기로 감성적인 느낌 전달.

## 4. Layout System
*   **Max-Width**: 리스트 및 상세 페이지의 콘텐츠 폭은 최대 **1200px**로 제한.
*   **Safe Margin**: 모바일 뷰에서 최소 **20px** 이상의 좌우 패딩 유지.
*   **GNB Rules**:
    *   **탐색 페이지(홈, 커뮤니티, 목록)**: 상단 수평 GNB.
    *   **몰입형 로직(에디터)**: 좌측 사이드바 GNB.

## 5. Component Rules
| 요소 | 가이드라인 | CSS 규격 |
| :--- | :--- | :--- |
| **Card** | 둥근 모서리와 은은한 그림자 | `radius: 16px~24px`, `shadow: 0 8px 24px rgba(0,0,0,0.06)` |
| **Button** | 알약 형태의 완전한 곡선 | `radius: 9999px`, `padding: 12px 24px` |
| **Tag** | 부드러운 캡슐 형태 | `height: 28px~32px`, `bg-opacity: 10%` |
| **Thumbnail** | 16:9 비율 고정 | `radius: 8px`, `object-fit: cover` |

## 6. Tree Connection Rules
*   **Bézier curve**: 노드를 잇는 선은 항상 유기적인 곡선으로 표현합니다.
*   **Thickness**: 1.5px ~ 2px의 부드러운 단색 또는 그라데이션 선을 사용합니다.
*   **No Corners**: 직각이나 날카로운 꺾임은 불허합니다.

## 7. 10대 금지사항 (Prohibitions)
1.  **순수 블랙(`#000`)과 화이트(`#FFF`) 배경 사용 금지.**
2.  **날카로운 직각 모서리(`radius: 0`) 사용 금지.**
3.  **플로우차트 스타일의 직선/직각 연결선 금지.**
4.  **빽빽하고 차가운 IT 관리자형 레이아웃 금지.**
5.  **형광색 및 채도가 높은 원색 사용 금지.**
6.  **따뜻한 커스텀 스타일이 입혀지지 않은 기본 브라우저 Input 노출 금지.**
7.  **비어 있는 화면(Empty State)에 차가운 시스템 에러 문구 사용 금지.**
8.  **단순한 텍스트 리스트 나열 금지 (반드시 카드로 감쌀 것).**
9.  **가독성을 해치는 과도하게 두꺼운 폰트 웨이트 남용 금지.**
10. **모바일 뷰에서 요소를 화면 가장자리에 딱 붙이는 행위 금지.**
