# 다른 AI 모델용 프롬프트: 상위 20개 아이돌 그룹 JSON 데이터 생성

## 🎯 목적

LoveBud 테스트 시나리오에서 사용할 상위 20개 아이돌 그룹의 테스트 데이터를 JSON 파일로 생성

---

## 📁 작업 위치

```
G:\Ddrive\BatangD\task\workdiary\LoveBud\docs\test-scenarios\data\
```

이 폴더에 JSON 파일 20개를 생성하세요.

---

## 📝 JSON 파일 형식

각 파일은 다음 구조를 따릅니다:

```json
{
  "groupName": "영문 그룹명 (공백 없이)",
  "groupNameKorean": "한글 그룹명",
  "fanPersona": "{한글 그룹명} 팬으로서 감정을 기록하고 싶다",
  "testUrls": [
    {
      "id": 1,
      "url": "https://www.youtube.com/watch?v=실제_유튜브_비디오ID",
      "title": "영상 제목 (한글)",
      "description": "팬의 감정을 담은 짧은 설명 (한글, 20자 내외)"
    },
    ...
    (총 6개)
  ],
  "treeName": "{한글 그룹명} 콘텐츠 정리용 트리"
}
```

---

## 🎤 생성해야 할 20개 그룹 목록

### 1세대 (초기 아이돌 - 팬덤 역사 긴 그룹)
1. **소녀시대** (GirlsGeneration) - 실제 그룹명은 Girls' Generation이나 파일명은 소문자
2. **슈퍼주니어** (SuperJunior)
3. **빅뱅** (BigBang)
4. **원더걸스** (WonderGirls)
5. **2NE1** (투애니원)

### 2세대 (K-POP 세계화 주역)
6. **엑소** (EXO)
7. **방탄소년단** (BTS) - ⚠️ 이미 있음 (참고만)
8. **블랙핑크** (Blackpink)
9. **트와이스** (Twice)
10. **레드벨벳** (RedVelvet)

### 3세대/4세대 (현재 활발히 활동 중)
11. **세븐틴** (Seventeen) - ⚠️ 이미 있음 (참고만)
12. **스트레이키즈** (StrayKids)
13. **엔하이픈** (Enhypen)
14. **투모로우바이투게더** (TXT)
15. **에스파** (Aespa)
16. **아이브** (IVE) - ⚠️ 이미 있음 (참고만)
17. **르세라핌** (LeSserafim)
18. **뉴진스** (NewJeans) - ⚠️ 이미 있음 (참고만)
19. **엔믹스** (NMIXX)
20. **(여자)아이들** (Gidle)

### 추가 후보 (위 20개 중 일부 제외 시 사용)
- **하츠투하츠** (Hearts2Hearts) - ⚠️ 이미 있음 (참고만)
- **더보이즈** (TheBoyz)
- **에이티즈** (Ateez)
- **몬스타엑스** (MonstaX)
- **트레저** (Treasure)

---

## ✅ 생성 규칙

### 유튜브 URL 규칙
- 실제 존재하는 유튜브 비디오 ID 사용
- 공식 MV, 무대 영상, 직캠, 예능 클립 중 선택
- 포맷: `https://www.youtube.com/watch?v={11자리ID}`

### 설명(description) 예시
- "처음 입덕하게 된 곡이에요"
- "이 노래 너무 중독돼요"
- "콘서트에서 너무 신났어요"
- "이 멤버 표정이 대단해요"
- "친구들이랑 따라했어요"

### 파일명 규칙
```
{소문자그룹명}-data.json

예시:
- blackpink-data.json
- twice-data.json
- straykids-data.json
```

---

## 📋 참고: 이미 생성된 파일

현재 data/ 폴더에 있는 파일들 (참고용, 다시 만들지 마세요):
- `ive-data.json`
- `bts-data.json`
- `hearts2hearts-data.json`
- `seventeen-data.json`

---

## 🚀 작업 순서

1. 위 20개 그룹 중 ⚠️ 표시 없는 16개 그룹 선택
2. 각 그룹별 JSON 파일 생성
3. 파일명: `{그룹명소문자}-data.json`
4. `data/` 폴더에 저장

---

## 💡 팁

- 각 그룹별 대표곡 1-2개 + 직캠/예능 2-3개 + 기타 2개 = 총 6개
- 설명은 팬 입장에서 자연스럽게
- 한글 그룹명은 공식 명칭 사용

---

## 📤 완료 후

생성된 파일 목록을 다음 형식으로 보고:

```
생성 완료:
1. blackpink-data.json
2. twice-data.json
3. straykids-data.json
...
(총 16개)
```

---

*이 프롬프트는 LoveBud 테스트 시나리오 시스템 확장을 위한 것입니다.*
