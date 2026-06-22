# Worky 프로젝트 컨텍스트

## 프로젝트 개요
- **이름:** Worky — AI 업무 보조 도구
- **대상:** 신입사원 (사무직)
- **배포:** https://worky-ai.vercel.app
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
- **Vercel 환경변수:** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GROQ_API_KEY, KAKAO_REST_API_KEY, NEXT_PUBLIC_KAKAO_MAP_KEY
- **KAKAO_REST_API_KEY:** 서버사이드 전용 (카카오 로컬 API — /api/kakao-places)

## Supabase 테이블
| 테이블 | 설명 |
|--------|------|
| user_settings | 소속/이름/직급, 메뉴 설정, 도움말 버튼 on/off, job_preset, menu_order, custom_greeting(JSONB), join_date, leave_standard, used_leaves, employment_type, granted_leaves, speed_dial_custom(JSONB), custom_field_keys(JSONB) |
| todos | 날짜별 할 일 |
| memos | 업무/회의/개인 메모 |
| calendar_events | 일정 관리 이벤트 (location_url 컬럼 포함 — 카카오맵 장소 URL) |
| clients | 거래처 관리 (company_phone, mask_phone, mask_company_phone, custom_fields, kakao_chat_name, report_template, group_name 컬럼 포함) |
| glossary | 용어집 |
| usage_stats | 기능별 사용 통계 |

## 프로젝트 구조
```
src/
  app/
    api/groq/route.ts         # Groq API Route
    api/gmail/route.ts        # Gmail API Route (이메일 전송)
    api/weather/route.ts      # Open-Meteo 날씨 서버 프록시
    api/kakao-places/route.ts # 카카오맵 장소 검색 (KAKAO_REST_API_KEY 사용)
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
    AppShell.tsx
    ThemeProvider.tsx
    Toast.tsx                 # 전역 토스트 UI
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
    GrassGrid.tsx             # 잔디밭 컴포넌트 (ClientManager에서 분리)
    DatePickerInput.tsx       # 커스텀 날짜 피커 (공용)
    ConfirmModal.tsx
    NotificationBell.tsx
    ReportMessage.tsx
    OnboardingModal.tsx       # 첫 로그인 온보딩 3단계 모달
    SpeedDial.tsx             # AI 바로가기 플로팅 버튼 (page.tsx에서 분리)
  contexts/
    ToastContext.tsx           # 전역 토스트 시스템 (ToastProvider, useToast)
  types/
    client.ts                  # Client, FormState, ReportStatus 등 타입
    supabase.ts                # Supabase CLI 자동 생성 타입
  lib/
    calendarStorage.ts         # CalendarEvent 타입, parseKoreanDate (localStorage 코드 제거됨)
    menuSettings.ts            # 메뉴 설정 로드/저장
    usageStats.ts              # 기능 사용 통계 (localStorage + Supabase 이중 저장)
    leave.ts                   # 연차 계산 유틸
    holidays.ts                # 연도별 한국 공휴일/대체공휴일
    notifications.ts           # 브라우저 알림 시스템
  lib/db/
    settings.ts
    todos.ts
    memos.ts
    calendar.ts
    clients.ts
    glossary.ts
    usage_stats.ts
  lib/supabase/
    client.ts                  # Supabase 클라이언트 (브라우저)
    server.ts                  # Supabase 클라이언트 (서버)
```

## 디자인 원칙
- **카드 위계 시스템 (홈 화면):** 1티어(그라디언트 배경+흰 텍스트, 가장 중요한 카드 1개만) /
  2티어(흰 배경+테두리+shadow-sm, 일반 기능 카드) / 3티어(흰 배경, 테두리·그림자 없음, 부가 정보)
  — 강조색은 1티어에만 집중, 나머지는 의도적으로 차분하게 유지
- **로딩 처리:** dataLoaded/hydrated 상태 + animate-pulse 스켈레톤 (실제 레이아웃과 동일한 wrapper 안에 배치 —
  return null 금지, 레이아웃 시프트 방지가 원칙). 홈/설정/캘린더/거래처/할일 전부 적용됨.
- **로딩 스피너:** IconLoader2 (tabler-icons) 로 통일. 그라디언트 버튼 안 = text-white,
  흰 배경에 단독 배치 = text-[#6C63FF]
- **빈 상태(empty state):** AI 입출력형 결과 영역은 border-2 border-dashed border-slate-200
  dark:border-zinc-700 rounded-2xl + 아이콘 + 안내문구 패턴으로 통일
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
- 요일/시간대별 맞춤 인사말 (커스텀 인사말 설정 시 우선 적용)
- 실시간 시계, 날씨 (Open-Meteo — /api/weather 서버 프록시 경유), 위치 (Nominatim)
- 연차 잔여일/사용일 프로그레스바 (user_settings 연동)
- 할 일 진행률 카드
- 이번 주 기능별 사용 통계 바 차트 (localStorage 즉시 표시 → Supabase 덮어씀)
- 오늘의 팁 (날짜 기반 고정)
- 다가오는 일정 미니 카드 (Supabase calendar_events)
- 빠른 접근 그리드 (활성화된 메뉴만 표시)
- AI 바로가기 플로팅 버튼 (기본 8개 + 커스텀 추가, Supabase speed_dial_custom 저장)
- 첫 로그인 온보딩 모달 (소속/이름/직급 → 직업군 → 입사일, 전부 선택사항, 건너뛰기 가능)
  트리거 조건: sender_info/job_preset/join_date 전부 비어있고 localStorage 'worky_onboarding_dismissed' 미설정 시
- 카드 위계 적용: 할 일 진행률(1티어 강조) / 빠른 접근(2티어) / 이번 주 활동·다가오는 일정·오늘의 팁(3티어)
- 환영 영역은 박스 없이 페이지 배경 위에 텍스트로 표시 (헤더 형태)

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
- 월별 캘린더, 한국 공휴일+대체공휴일 (lib/holidays.ts)
- 일정 장소 카카오맵 검색 연동 (NEXT_PUBLIC_KAKAO_MAP_KEY)
- Supabase calendar_events 연동 (location_url 포함)

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
- D-day 시각적 강조: 만료됨/D-3 이내 → 카드·행 좌측 빨간 띠(border-l-4, #EF4444) + 텍스트 빨강,
  D-7 이내 → 주황 띠(#F97316), formatDday()/ddayAccentColor() 함수 (ClientManager.tsx)
- Supabase clients 연동: mask_phone, mask_company_phone, company_phone, custom_fields(JSONB), user_settings.custom_field_keys(JSONB)

### 15. 공문서 작성 (`/document`)
- 유형: 품의서/공문/지출결의서/업무협조 요청서

### 16. 피드백 정리 (`/feedback`)
- 클라이언트 피드백 → 수정사항 정리

### 17. 설정 (`/settings`)
- 내 정보: 소속/이름/직급 (Supabase user_settings 연동)
- 연차 설정: 입사일, 입사 유형(신입/경력), 기준(입사일기준/회계연도기준), 사용 연차 입력
- 커스텀 인사말: 기본/시간대별/요일별 모드 설정
- 메뉴 설정: 선택 페이지 on/off, 드래그&드롭 순서 변경
- 직업군 프리셋 (마케팅/IT/경영지원/사무직/디자이너/기타)
- 도움말 버튼 on/off
- 알림 설정: 브라우저 권한 요청, 일정 알림/거래처 D-day 알림 on/off

### 18. 알림 시스템 (`lib/notifications.ts`)
- 브라우저 Notification API 기반 (PWA/데스크탑 모두 지원)
- 오늘 일정 알림: 앱 열 때 오늘 일정 있으면 발송
- 거래처 D-day 알림: 계약 만료 7일/3일/당일 단계별 메시지
- 하루 한 번만 발송 (worky_notif_sent_date localStorage 체크)
- 설정: worky_notification_settings localStorage 저장

### 19. PWA 지원
- manifest.json: standalone, 테마 #6C63FF
- 아이콘: icon-192.png, icon-512.png, apple-touch-icon.png (180×180)
- next-pwa: 프로덕션에서만 Service Worker 등록 (개발 환경 비활성)

## 20. GitHub Actions / 릴리스 워크플로우
- **keep-alive.yml:** 매주 월요일 UTC 00:00, Supabase REST API ping (무료 플랜 프로젝트 일시정지 방지)
- **patch-announcement.yml:** `v*` 태그 푸시 시 자동 실행 — CHANGELOG.md에서 해당 버전 섹션을 파싱해서
  Supabase announcements 테이블에 공지 insert. 파싱 시 줄바꿈은 `\n` 리터럴로 변환되어 저장됨
  (NotificationBell.tsx에서 whitespace-pre-line으로 렌더링)
- **CHANGELOG.md 컨벤션:** `## [vX.Y.Z] - YYYY-MM-DD` 형식, 카테고리별 이모지 헤더(✨🎨🔔🐛 등) +
  `- ` 불릿 목록. 새 버전 추가 시 최상단([v1.2.0] 위)에 삽입
- **현재 버전:** v1.3.0 (package.json version 필드와 동기화됨)

## 사이드바
- 접기/펼치기 토글
- 로고 클릭 시 홈으로 이동
- 직업군 프리셋 6가지
- 드래그&드롭으로 메뉴 순서 변경

## 코딩 컨벤션
- 컴포넌트: 함수형, TypeScript interface
- API 호출은 반드시 서버 사이드 (api/groq/route.ts 등)
- 에러 처리: `useToast()`로 toast.error()/toast.success() 사용, 빈 `.catch(() => {})` 금지
- 한국어 UI
- localStorage는 Supabase와 이중 저장 시 캐시 역할만 담당 — Supabase에 저장 가능한 데이터를 localStorage에만 저장하지 말 것, 빈 값으로 덮어쓰기 금지
- Supabase 스키마 변경(컬럼 추가/삭제)은 항상 사용자가 직접 Supabase SQL Editor에서 실행 (Claude가 마이그레이션 자동 실행 금지)
- 페이지/컴포넌트의 초기 로딩 가드는 `if (!hydrated) return null` 대신,
  실제 콘텐츠와 동일한 wrapper + animate-pulse 스켈레톤으로 처리 (레이아웃 시프트 방지)
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
