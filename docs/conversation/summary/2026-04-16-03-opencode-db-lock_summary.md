# 요약 - opencode-db-lock

**날짜**: 2026-04-16  
**세션 번호**: 03  
**핵심 주제**: opencode 실행 시 sqlite database is locked 오류 원인 분석

---

## 핵심 주제

Windows PowerShell에서 `opencode` 명령 실행 시 발생하는 `database is locked` 오류의 원인을 파악하고, 잠금 주체와 환경 문제를 확인하는 과정. WSL/PowerShell 경로 설정과 together로 발생한 sqlite 잠금 이슈를 다룸.

---

## 확정 판단

- **DB 위치**: `C:\Users\limone\.local\share\opencode\opencode.db`
- **잠금 상태**: `-wal`/`-shm` 파일이 남아 있어 이전 비정상 종료 흔적 확인.
- **현재 프로세스**: WSL에서 `bwrap` 프로세스는 실행 중이지만, opencode 자체 프로세스는 현재 없음.
- **환경 문제**: WSL/PowerShell 혼합 사용 시 sqlite 파일 잠금이 제대로 해제되지 않을 가능성.

---

## 완료 작업

| # | 작업 | 상태 |
|---|------|------|
| 1 | opencode 로그 파일(`2026-04-15T151221.log`) 확인 | ✅ 완료 |
| 2 | sqlite DB 파일 위치 및 Pragmas 확인 시도 | ✅ 완료 |
| 3 | 실행 중인 프로세스(bwrap, node, bun) 목록 조사 | ✅ 완료 |
| 4 | WSL 환경에서의 잠금 파일(`.wal`, `.shm`) 상태 확인 | ✅ 완료 |

---

## 중요 커밋

- **커밋**: 해당 없음 (환경 문제 조사 세션)
- **메시지**: infra: investigate opencode database locked issue

---

## 남은 blocker

1. **sqlite3 명령어 부재**: WSL에 sqlite3가 설치되지 않아 정확한 DB 상태를 즉시 확인하지 못함.
2. **잠금 프로세스 식별 불가**: 현재 실행 중인 프로세스 목록에서 opencode 관련 DB 잠금을 명시적으로 찾지 못함 (비정상 종료 후 잔존 가능성).
3. **재현 경로 불명**: PowerShell → WSL → opencode 실행 경로에서 잠금이 발생하는 구체적 단계 확인 필요.

---

## 다음 액션

1. WSL에 `sqlite3` 설치 후 `PRAGMA journal_mode`, `PRAGMA locking_mode` 직접 확인
2. `/mnt/c/Users/limone/.local/share/opencode/` 디렉토리의 `.wal`/`.shm` 파일 삭제 후 재시도
3. opencode를 WSL이 아닌 Windows 환경에서 직접 실행해보거나, WSL에서의 사용 경로를 통일.
4. 필요시 opencode 설정에서 DB 경로를 로컬 프로젝트 디렉토리로 변경하여 권한 문제 회피.

---

##Metadata

created: 2026-04-16  
session: 03
