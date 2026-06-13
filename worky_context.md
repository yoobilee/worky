# Worky 프로젝트 컨텍스트

## 프로젝트 개요
- **이름:** Worky — AI 업무 보조 도구
- **대상:** 신입사원 (사무직)
- **배포:** https://worky-alpha.vercel.app
- **GitHub:** https://github.com/yoobilee/worky
- **기술 스택:** Next.js 15.3.9 (App Router), TypeScript, Tailwind CSS, Groq API, Vercel

## AI 모델
- **모델:** `meta-llama/llama-4-scout-17b-16e-instruct` (Groq)
- **변경 이유:** 기존 llama-3.3-70b-versatile이 한국어 번역 시 한자/일본어/러시아어 혼용 문제 발생

## 인증 / DB
- **로그인:** Supabase Google OAuth (PKCE)
- **Supabase URL:** https://cyoydddqgehiplkglypc.supabase.co
- **Google Cloud 프로젝트:** worky
- **Client ID:** 539952140347-u6aktledd76ekb7asuqglv20pia3mdjb.apps.googleusercontent.com
- **Gmail API:** 활성화됨 (gmail.send 스코프)
- **Vercel 환경변수:** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

## Supabase 테이블
| 테이블 | 설명 |
|--------|------|
| user_settings | 소속/이름/직급, 메뉴 설정, 도움말 버튼 on/off |
| todos | 날짜별 할 일 |
| memos | 업무/회의/개인 메모 |
| calendar_events | 일정 관리 이벤트 |
| clients | 거래처 관리 (company_phone, mask_phone, mask_company_phone, custom_fields, kakao_chat_name, report_template, group_name 컬럼 포함) |
| glossary | 용어집 |
| usage_stats | 기능별 사용 통계 |

## 프로젝트 구조
```
src/
  app/
    api/groq/route.ts         # Groq API Route
    api/gmail/route.ts        # Gmail API Route (이메일 전송)
    page.tsx                  # Home 대시보드
    settings/page.tsx         # 설정 페이지
    data/page.tsx             # 데이터 정리
    todo/page.tsx             # 할 일/메모
    template/page.tsx         # 템플릿 생성
    qa/page.tsx               # Q&A
    email/page.tsx            # 이메일 작성
    summary/page.tsx          # 문서 요약
    schedule/page.tsx         # 일정 추출
    translate/page.tsx        # 번역·다듬기
    insight/page.tsx          # 데이터 분석
    glossary/page.tsx         # 용어집
    calendar/page.tsx         # 일정 관리
    clients/page.tsx          # 거래처 관리
    content/page.tsx          # 메시지 작성
    document/page.tsx         # 공문서 작성
    feedback/page.tsx         # 피드백 정리
    auth/callback/page.tsx    # OAuth 콜백
  components/
    Sidebar.tsx
    DataCleaner.tsx
    TodoMemo.tsx
    TemplateGen.tsx
    QnA.tsx
    EmailReply.tsx
    DocSummary.tsx
    ScheduleExtractor.tsx
    Translator.tsx
    DataInsight.tsx
    Glossary.tsx
    Calendar.tsx
    ClientManager.tsx
    ContentCreator.tsx
    DocumentWriter.tsx
    FeedbackOrganizer.tsx
    EditableResult.tsx
    HelpButton.tsx
  lib/db/
    settings.ts
    todos.ts
    memos.ts
    calendar.ts
    clients.ts
    glossary.ts
    usage_stats.ts
```

## 디자인 원칙
- **트렌드:** 2026 Bento Grid + Calm UI
- **포인트 컬러:** #6C63FF (인디고 바이올렛)
- **다크모드:** 지원 (Tailwind dark: 클래스)
- **아이콘:** Tabler Icons만 사용 (이모지 없음)
- **마크다운 렌더링:** AI 생성 결과 전체 페이지 적용
- **자동 스크롤:** AI 결과 생성 시 결과 영역으로 자동 스크롤

## 사이드바 페이지 분류

### 공통 페이지 (항상 노출)
홈, 할 일/메모, Q&A, 이메일 작성, 일정 추출, 일정 관리, 설정

### 선택 페이지 (설정에서 on/off 가능)
템플릿 생성, 번역·다듬기, 문서 요약, 데이터 정리, 데이터 분석, 용어집, 거래처 관리, 메시지 작성, 공문서 작성, 피드백 정리

## 기능 목록 및 상태

### 1. Home 대시보드 (`/`)
- 요일/시간대별 맞춤 인사말
- 실시간 시계, 날씨 (Open-Meteo API), 위치 (Nominatim)
- 할 일 진행률 카드
- 이번 주 기능별 사용 통계 바 차트
- 오늘의 팁 (12개 랜덤)
- 다가오는 일정 미니 카드
- 빠른 접근 4x3 그리드
- AI 바로가기 버튼, 플로팅 도움말 버튼

### 2. 할 일 / 메모 (`/todo`)
- 날짜별 할 일 관리, 미완료 할 일 자동 이월
- 메모 탭 3개: 업무/회의/개인
- Supabase todos, memos 테이블 연동

### 3. Q&A (`/qa`)
- 채팅 형식, Groq API 연동

### 4. 이메일 작성 (`/email`)
- **탭 1: 새 이메일 작성** — 받는 사람/제목/내용 입력, AI가 다듬어서 생성, Gmail 전송
- **탭 2: 답장 작성** — 받은 이메일 붙여넣기, 톤 선택 5개, 초안 3개 생성, Gmail 전송
- 발신자 정보(소속/이름/직급) 자동 적용

### 5. 메시지 작성 (`/content`)
- **탭 1: 보고 메시지** — 작업 내용 입력, 톤 3가지, 내 말투 샘플 등록
- **탭 2: 인스타 게시글** — 거래처 키워드 연동

### 6. 템플릿 생성 (`/template`)
- 유형: 업무보고서/회의록/기획안/공문서
- 마크다운 렌더링

### 7. 번역·다듬기 (`/translate`)
- 출발/도착 언어 선택, 톤 다듬기

### 8. 문서 요약 (`/summary`)
- 텍스트 입력, 요약 방식 3가지, 마크다운 렌더링

### 9. 데이터 정리 (`/data`)
- 텍스트 입력만 지원 (파일 업로드 탭 제거됨)
- Groq API로 표 변환
- HTML 복사, CSV 다운로드 (파일명: worky_정리데이터.csv)

### 10. 일정 추출 (`/schedule`)
- 이메일/공지/메시지 붙여넣기, Groq API로 일정 추출
- "일정 관리에 저장" 버튼

### 11. 일정 관리 (`/calendar`)
- 월별 캘린더, 한국 공휴일+대체공휴일
- Supabase calendar_events 연동

### 12. 데이터 분석 (`/insight`)
- 텍스트 입력, Groq API 분석
- "보고서로 생성" 버튼

### 13. 용어집 (`/glossary`)
- 용어 추가/수정/삭제, AI 용어 설명
- Supabase glossary 연동

### 14. 거래처 관리 (`/clients`)
- 박스형/목록형 두 가지 뷰 지원
- 상태 4단계: 대기 중/진행 중/완료/중단
- 계약 기간 단위 선택 (일/주/월/년), 영업일 기준 D-day 자동 계산
- 박스형 카드: 거래처 연락처 → 담당자 → 계약정보(한 줄) → 링크 → 메모 → 보고톤 → 잔디밭 → 커스텀 속성 순
- 목록형: 컬럼 표시/숨김 (표시 항목 버튼, localStorage 저장), 편집 버튼으로 수정/일괄 삭제, 진행현황 패널
- 커스텀 속성: key/value + 숨김 처리, 박스형 토글 방식 / 목록형 팝오버
- 연락처 숨김: 담당자/거래처 연락처 각각 숨김 설정, 눈 아이콘 클릭으로 임시 확인 (꾹 누르기 방식)
- 검색: 거래처명/담당자/연락처/태그/메모/보고톤/링크/커스텀 속성 전체 검색
- 정렬: 상태순/만료임박순/계약시작일↑↓/거래처명↑↓/담당자↑↓
- 진행 현황 잔디밭: 계약 기간 내 일별 완료/실패 기록, 주 단위 네비게이션
- Supabase clients 연동: mask_phone, mask_company_phone, company_phone, custom_fields(JSONB), user_settings.custom_field_keys(JSONB)

### 15. 공문서 작성 (`/document`)
- 유형: 품의서/공문/지출결의서/업무협조 요청서

### 16. 피드백 정리 (`/feedback`)
- 클라이언트 피드백 → 수정사항 정리

### 17. 설정 (`/settings`)
- 내 정보: 소속/이름/직급 (Supabase user_settings 연동)
- 메뉴 설정: 선택 페이지 on/off
- 사이드바 커스터마이징 (직업군 프리셋, 드래그&드롭 순서 변경)
- 도움말 버튼 on/off

## 사이드바
- 접기/펼치기 토글
- 로고 클릭 시 홈으로 이동
- 직업군 프리셋 6가지
- 드래그&드롭으로 메뉴 순서 변경

## 코딩 컨벤션
- 컴포넌트: 함수형, TypeScript interface
- API 호출은 반드시 서버 사이드 (api/groq/route.ts)
- 에러 처리 필수
- 한국어 UI
- 작업 완료 후 항상 git add, commit, push

---

# WORKY mini 프로젝트 컨텍스트

## 프로젝트 개요
- **이름:** WORKY mini — 거래처 관리 데스크탑 런처
- **GitHub:** https://github.com/yoobilee/worky-desktop
- **경로:** C:\Users\yblrr\Documents\.vscode\Workspace\worky-desktop
- **기술 스택:** Electron + React + TypeScript + Vite + Supabase
- **Worky 웹과 Supabase 공유** (동일한 clients 테이블 사용)

## 특징
- 세로형 컴팩트 런처 (380×700)
- 항상 화면 한켠에 띄워두고 사용하는 형태
- 글라스모피즘 디자인 (배경 그라디언트 블롭 + backdrop-filter blur)
- 라이트/다크/시스템 테마 지원

## 프로젝트 구조
```
src/
  main/
    index.ts          # Electron 메인 프로세스
    kakao.ts          # 카카오톡 창 제어 (PowerShell)
  preload/
    index.ts          # IPC 브릿지
  renderer/
    App.tsx
    pages/
      ClientsPage.tsx
      LoginPage.tsx
      SettingsPage.tsx
    lib/
      clients.ts
      supabase.ts
    hooks/
      useDark.ts
    types/
      index.ts
      electron.d.ts
```

## 기능 목록

### 거래처 목록
- Supabase clients 테이블 연동 (Worky 웹과 공유)
- Supabase Realtime 구독 (웹 변경사항 앱 실시간 반영)
- 리스트 아이템 형태 (접기/펼치기 애니메이션)
- 왼쪽 상태 컬러 라인 (5px)
- 상태 뱃지 (표시만, 클릭 기능 없음)
- 검색, 정렬 드롭다운 (진행중우선/대기중우선/만료임박순/거래처명 ㄱ→ㅎ/거래처명 ㅎ→ㄱ)
- 프로그레스바 (h-[2px], 그라디언트)

### 카카오톡 채팅방 열기
- 채팅방 열려있을 때: PowerShell EnumWindows로 창 찾아서 SetForegroundWindow
- 한글 chatName: toPSUnicode()로 [char]0xXXXX 변환 후 ps1 파일 삽입
- 이모지 surrogate pair 처리 포함
- WinActivate/WinList 클래스 중복 방지 가드 추가
- 채팅방 닫혀있을 때: 안내 메시지 (카카오톡 웹뷰 기반이라 UI Automation 불가)
- 지원: 1:1/단체/오픈채팅방 / 미지원: 카카오톡 채널

### 보고 메시지 클립보드 복사
- 거래처별 보고 템플릿 등록/수정/삭제
- 복사 버튼 클릭 시 클립보드 자동 복사
- 토스트 팝업 (상단 중앙, createPortal로 body 마운트)

### 거래처 그룹핑
- 설정에서 on/off
- 거래처별 그룹명 입력
- 그룹별 섹션으로 목록 표시
- Supabase clients 테이블 group_name 컬럼

### 최근 열기 목록
- 설정에서 on/off
- 개수 설정 (5~20개, 기본 5개, +/- 버튼)
- 카톡 버튼 클릭 성공 시 localStorage 기록
- 가로 스크롤 (마우스 휠로 좌우 이동)
- 5자 이상 말줄임표

### 기타 기능
- Google OAuth 로그인 (worky:// 딥링크)
- 카카오톡 자동 실행 (앱 시작 시 카톡 미실행이면 자동 실행)
- 최상단 고정 핀 (타이틀바 최소화 버튼 왼쪽)
- 창 가장자리 자석 기능 (핀 상태에서 20px 이내 접근 시 자동 부착)
- 다크/라이트/시스템 테마
- 로그아웃

## 디자인
- 포인트 컬러: #6C63FF
- 다크: #080810 배경, 보라+파랑 블롭
- 라이트: #efefff 배경, 연보라 블롭
- 카드: glassmorphism (backdrop-filter blur + 반투명)
- Tabler Icons만 사용

## Supabase 설정
- URL: https://cyoydddqgehiplkglypc.supabase.co
- clients 추가 컬럼: kakao_chat_name, report_template, group_name
- Realtime: supabase_realtime publication에 clients 테이블 등록
- Redirect URL: worky://auth/callback

## 코딩 컨벤션
- 완료 후 항상 git add, commit, push
