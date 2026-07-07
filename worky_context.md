# Worky 프로젝트 컨텍스트

## 프로젝트 개요
- **이름:** Worky — AI 업무 보조 도구
- **대상:** 신입사원 (사무직, 외국인 신입사원 포함 — 한국어/영어 다국어 지원)
- **배포:** https://worky-ai.vercel.app
- **GitHub:** https://github.com/yoobilee/worky
- **버전:** v1.4.0 (2026-07-04)
- **기술 스택:** Next.js 15.3.9 (App Router), React 19, TypeScript, Tailwind CSS 4, Groq API, Vercel

## AI 모델
- **모델:** `meta-llama/llama-4-scout-17b-16e-instruct` (Groq)
- **변경 이유:** 기존 llama-3.3-70b-versatile이 한국어 번역 시 한자/일본어/러시아어 혼용 문제 발생
- **스트리밍:** `/api/groq`에 `stream: true` 옵션 지원. 단순 텍스트 결과(템플릿, 번역, 요약, 이메일 등)는
  청크 단위로 실시간 렌더링. JSON 파싱이 필요한 결과(데이터 분석, 이메일 답장 초안, Q&A 1차 판단)는
  스트리밍 완료 후 한 번에 파싱. Q&A 실제 답변은 청크마다 메시지 content를 갱신해 타이핑 효과 구현.

## 인증 / DB
- **로그인:** Supabase Google OAuth (PKCE)
- **Supabase URL:** https://cyoydddqgehiplkglypc.supabase.co
- **Google Cloud 프로젝트:** worky
- **Client ID:** 539952140347-u6aktledd76ekb7asuqglv20pia3mdjb.apps.googleusercontent.com
- **Gmail API:** 활성화됨 (gmail.send 스코프)
- **Vercel 환경변수:** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GROQ_API_KEY, KAKAO_REST_API_KEY, NEXT_PUBLIC_KAKAO_MAP_KEY
- **KAKAO_REST_API_KEY:** 서버사이드 전용 (카카오 로컬 API — /api/kakao-places)
- **미들웨어 인증 (신규):** `src/middleware.ts`에서 서버 사이드로 인증 체크. `/login`, `/auth/callback`,
  `/api/**`, 정적 이미지 확장자를 제외한 모든 경로에서 비로그인 시 `/login`으로 강제 리다이렉트.
- **API 라우트 인증 (신규):** `/api/groq`, `/api/kakao-places` 모두 `supabase.auth.getUser()`로 로그인
  여부 확인 후 미인증 시 401 반환.

## Supabase 테이블
| 테이블 | 설명 |
|--------|------|
| user_settings | 소속/이름/직급, 메뉴 설정, 도움말 버튼 on/off, job_preset, menu_order, custom_greeting(JSONB), join_date, leave_standard, used_leaves, employment_type, granted_leaves, speed_dial_custom(JSONB), custom_field_keys(JSONB), **language**(ko/en, 신규) |
| todos | 날짜별 할 일 |
| memos | 업무/회의/개인 메모 |
| calendar_events | 일정 관리 이벤트 (location_url 컬럼 포함 — 카카오맵 장소 URL, 반복 일정 지원) |
| clients | 거래처 관리 (company_phone, mask_phone, mask_company_phone, custom_fields, kakao_chat_name, report_template, group_name 컬럼 포함) |
| members | 구성원 관리 (연락처, 생일, 카카오톡 ID 등) — **신규 테이블** |
| seating_desks | 구성원 자리 배치도 (x, y, rotation, member_id) — **신규 테이블** |
| glossary | 용어집 |
| usage_stats | 기능별 사용 통계 (홈 화면 "이번 주 활동" 및 "자주 쓰는 기능" 추천에 사용) |
| data_cleaner_history | 데이터 정리 히스토리 (최근 50개 제한) — **신규 테이블** |
| qa_histories | Q&A 대화 히스토리 (스트리밍 완료 시점에만 1회 저장 — 과거 중복 저장 버그 있었음, 수정됨) — **신규 테이블** |
| user_notifications | 사용자별 개인 알림 (일정 D-day, 거래처 계약 만료 등) — Edge Function으로 매일 자동 생성 — **신규 테이블** |
| announcements | 전역 공지사항 (버전 업데이트 등 모든 사용자 공통 노출, GitHub Actions로 자동 생성) |
| announcement_reads | 공지 읽음 여부 |

⚠️ `src/types/supabase.ts` 자동생성 타입이 stale해질 수 있음 — 스키마 변경(특히 seating_desks,
data_cleaner_history, user_settings.language 등 신규 컬럼/테이블) 후에는 타입 재생성 필요.

## 프로젝트 구조
```
src/
  app/
    api/groq/route.ts         # Groq API Route (스트리밍 지원, 인증 체크)
    api/gmail/route.ts        # Gmail API Route (이메일 전송)
    api/weather/route.ts      # Open-Meteo 날씨 서버 프록시
    api/kakao-places/route.ts # 카카오맵 장소 검색 (KAKAO_REST_API_KEY 사용, 인증 체크)
    page.tsx                  # Home 대시보드 (AI 네이티브 리뉴얼됨, 로직 다수 포함)
    settings/page.tsx         # 설정 페이지 (좌우 분할 레이아웃으로 재구성됨, ~1100줄)
    login/page.tsx            # 로그인
    error.tsx / not-found.tsx / global-error.tsx   # 앱 레벨 에러 페이지 (신규)
    (아래는 전부 컴포넌트를 감싸는 얕은 wrapper, 예: data/page.tsx → <DataCleaner />)
    data/page.tsx todo/page.tsx template/page.tsx qa/page.tsx email/page.tsx
    summary/page.tsx schedule/page.tsx translate/page.tsx insight/page.tsx
    glossary/page.tsx calendar/page.tsx clients/page.tsx content/page.tsx
    document/page.tsx feedback/page.tsx members/page.tsx report/page.tsx
    auth/callback/page.tsx    # OAuth 콜백
  components/
    Sidebar.tsx
    AppShell.tsx
    ThemeProvider.tsx
    Toast.tsx                 # 전역 토스트 UI
    DataCleaner.tsx
    TodoMemo.tsx
    TemplateGen.tsx
    QnA.tsx                   # 대화 시작 전 랜딩 화면 추가됨 (신규)
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
    DatePickerInput.tsx       # 커스텀 날짜 피커 (공용, 다국어 대응)
    ConfirmModal.tsx          # createPortal로 body 직접 렌더링 (신규 수정)
    NotificationBell.tsx      # 다국어/모바일 노출 위치 수정됨
    ReportMessage.tsx
    OnboardingModal.tsx       # 첫 로그인 온보딩 3단계 모달, createPortal 적용
    SpeedDial.tsx             # AI 바로가기 플로팅 버튼 (page.tsx에서 분리)
    MemberManager.tsx         # 구성원 관리 — **신규**
    SeatingPlanner.tsx        # 자리 배치도 — **신규**
  contexts/
    ToastContext.tsx           # 전역 토스트 시스템 (ToastProvider, useToast)
  types/
    client.ts                  # Client, FormState, ReportStatus 등 타입
    supabase.ts                # Supabase CLI 자동 생성 타입 (stale 가능성 있음, 위 참고)
  lib/
    calendarStorage.ts         # CalendarEvent 타입, parseKoreanDate
    menuSettings.ts            # 메뉴 설정 로드/저장, MENU_LOCALE_MAP(다국어 매핑, 신규)
    usageStats.ts              # 기능 사용 통계 (localStorage + Supabase 이중 저장)
    leave.ts                   # 연차 계산 유틸
    holidays.ts                # 연도별 한국 공휴일/대체공휴일
    notifications.ts           # 브라우저 알림 시스템, D-day 계산 헬퍼(addBusinessDays, calcDday) export
    i18n/                      # **신규**
      LocaleContext.tsx         # LocaleProvider, useLocale() 훅
      translations.ts           # ko/en 번역 딕셔너리, tFormat() 헬퍼
    supabase/
      client.ts server.ts middleware.ts
    db/
      settings.ts todos.ts memos.ts calendar.ts clients.ts glossary.ts usage_stats.ts
      announcements.ts members.ts dataCleanerHistory.ts qa_histories.ts qna-context.ts
      seating.ts user_notifications.ts  # 신규 파일들
  middleware.ts                 # 서버 사이드 인증 가드 (신규)
```

## 디자인 원칙
### 기존 원칙 (v1.3.0까지)
- **카드 위계 시스템 (홈 화면 구버전):** 1티어(그라디언트 배경+흰 텍스트, 가장 중요한 카드 1개만) /
  2티어(흰 배경+테두리+shadow-sm, 일반 기능 카드) / 3티어(흰 배경, 테두리·그림자 없음, 부가 정보)
  — 강조색은 1티어에만 집중, 나머지는 의도적으로 차분하게 유지
  ⚠️ v1.4.0에서 홈 화면 자체가 벤토 그리드 → AI 네이티브 구조로 리뉴얼되면서 이 카드 위계 시스템은
  홈 화면 기준으로는 대체됨 (아래 "2026 리뉴얼" 참고). 다만 다른 페이지(거래처, 구성원 등)의
  카드 스타일 원칙으로는 여전히 유효.
- **로딩 처리:** dataLoaded/hydrated 상태 + animate-pulse 스켈레톤 (실제 레이아웃과 동일한 wrapper 안에
  배치 — return null 금지, 레이아웃 시프트 방지가 원칙). 홈/설정/캘린더/거래처/할일 전부 적용됨.
- **로딩 스피너:** IconLoader2 (tabler-icons) 로 통일. 그라디언트 버튼 안 = text-white,
  흰 배경에 단독 배치 = text-[#6C63FF]
- **빈 상태(empty state):** AI 입출력형 결과 영역은 border-2 border-dashed border-slate-200
  dark:border-zinc-700 rounded-2xl + 아이콘 + 안내문구 패턴으로 통일
- **포인트 컬러:** #6C63FF (인디고 바이올렛) — 배경/버튼용. 텍스트용은 v1.4.0에서 라이트 `#4D44CC`,
  다크 `#8B85FF`로 분리(대비 개선, 아래 참고)
- **다크모드:** 지원 (Tailwind dark: 클래스 + globals.css의 `.dark .bg-white` 전역 오버라이드 규칙 —
  단, 항상 흰 배경이어야 하는 특수 케이스는 `bg-white` 클래스 대신 인라인 style로 예외 처리 필요,
  실제로 겪은 버그: 홈 화면 "할 일 추가하러 가기" 버튼)
- **아이콘:** Tabler Icons만 사용 (이모지 없음). 인라인 SVG 직접 작성은 지양 —
  과거 EmailReply.tsx에서 좌표 오류로 복사 아이콘이 깨진 사례 있음.
- **마크다운 렌더링:** AI 생성 결과 전체 페이지 적용 (parseInline/renderMarkdown 패턴,
  QnA.tsx에는 처음에 누락되어 있었다가 추가됨)
- **자동 스크롤:** AI 결과 생성 시 결과 영역으로 자동 스크롤

### 2026 리뉴얼 (v1.4.0 신규)
- **컨셉:** AI 네이티브 미니멀리즘 — "정보 나열"이 아니라 "AI가 요약 + 다음 행동 제안"
- **홈 화면:** 벤토 그리드(2023~2024 스타일) 폐기 → 오늘 요약 헤더 + 규칙 기반 AI 제안 카드
  + 핵심 지표 3개(남은 할 일/오늘 일정/잔여 연차) + 사용 기록 기반 "자주 쓰는 기능" 칩
- **AI 입력 폼 (10개 페이지 전체):** 라벨 텍스트 제거(placeholder로 대체), 카드형 옵션 선택 → pill 칩으로
  압축, 입력+옵션+버튼을 하나의 통합 카드로.
- **탭 스타일:** 화면 전환용 탭(이메일 작성/콘텐츠 생성/구성원 관리 등)은 배경 채우기 대신
  **밑줄(border-b-2) 방식**으로 통일. 단, 세그먼트 컨트롤 성격의 짧은 전환(할 일/메모의
  업무·회의·개인 탭 등)은 배경 채우기 pill 스타일 그대로 유지 — 성격이 다른 UI라 의도적으로 구분.
- **마이크로 애니메이션:** `card-hover`(호버 시 -2px 부상+그림자), `animate-result-in`(AI 결과 fade-up
  등장), `tab-underline`(밑줄 슬라이드), `btn-press`(클릭 시 0.97 스케일) — globals.css에 전역
  유틸리티로 정의.
- **Q&A 페이지:** 대화 시작 전에는 중앙 정렬 랜딩 화면(로고+환영 문구+큰 추천 질문 카드), 대화 시작 후
  기존 채팅 UI로 전환. 로고는 파비콘과 동일한 SVG(보라 배경+흰색 지그재그 W)로 통일.
- **색상 대비 개선:** `text-slate-400` → `text-slate-500`, `dark:text-zinc-500` → `dark:text-zinc-400`로
  전면 교체 (Lighthouse 접근성 감사에서 WCAG 대비 기준 미달 발견). 보라 텍스트도
  `text-[#6C63FF]` 단일값 → 라이트 `#4D44CC` / 다크 `#8B85FF`로 분리.
- **글래스모피즘 시도 및 롤백:** 모달/패널에 반투명+블러 효과를 적용했으나, Worky의 차분한 단색 배경과
  안 어울려 회색으로 뭉쳐 보이는 문제로 전부 롤백함 — 향후 재시도 시 배경에 그라디언트/이미지 등
  복잡한 시각 요소가 있을 때만 고려할 것 (WORKY mini 데스크탑 앱은 배경 자체가 그라디언트 블롭이라
  글래스모피즘이 유지되고 있음, 웹과 다른 케이스).

## 다국어 지원 (i18n) — v1.4.0 신규
- **지원 언어:** 한국어(기본), 영어
- **구조:** `useLocale()` 훅으로 `t('키')` 또는 `tFormat(t('키'), {변수})` 형태로 사용
- **저장 위치:** `user_settings.language` 컬럼, 설정 페이지의 "언어 설정" 섹션에서 변경 가능
- **적용 범위:** 사이드바, 홈 화면, 설정 전체, 거래처/구성원 관리, 캘린더, 알림 벨, AI 페이지 10개
  (UI 텍스트만 — AI가 생성하는 결과물 자체 언어는 아직 미적용, 향후 과제)
- **날짜/요일 포맷:** locale 분기 처리 (한국어 "7월 5일 (일)" / 영어 "Jul 5 (Sun)" 등),
  Calendar.tsx·TodoMemo.tsx·DatePickerInput.tsx·NotificationBell.tsx에 각각 구현
- **공지/알림 콘텐츠:** 다국어 미적용 (한국어 고정) — CHANGELOG 기반 자동 생성이라 번역 별도 작업 필요

## 접근성 — v1.4.0 신규
- 에러 메시지 전반에 `role="alert"` 적용
- 아이콘 전용 버튼에 `aria-label` 적용
- 탭 UI에 `role="tab"`, `aria-selected` 적용
- 아코디언에 `aria-expanded` 적용

## 사이드바 페이지 분류

### 공통 페이지 (항상 노출)
홈, 할 일/메모, Q&A, 이메일 작성, 일정 추출, 일정 관리, 설정

### 선택 페이지 (설정에서 on/off 가능)
템플릿 생성, 번역·다듬기, 문서 요약, 데이터 정리, 데이터 분석, 용어집, 거래처 관리, 구성원 관리(신규),
메시지 작성, 공문서 작성, 피드백 정리

## 기능 목록 및 상태

### 1. Home 대시보드 (`/`) — v1.4.0에서 대규모 리뉴얼
- **오늘 요약 헤더:** "오늘 할 일 n개 남았어요" + 가장 가까운 일정까지 남은 시간
  (기존 요일/시간대별 인사말은 이 요약 문구와 함께 유지)
- **AI 제안 카드(신규, 규칙 기반):** 조건 만족 시 하나만 노출 — 거래처 계약 만료 임박 > 일정 임박 >
  할 일 과다 순으로 우선순위 판단. Groq 호출 없이 기존 데이터로 규칙 계산(빠르고 비용 없음).
- **핵심 지표 3카드(신규):** 남은 할 일 / 오늘 일정 / 잔여 연차 (모바일 1열, sm 이상 3열 — 처음엔
  모바일에서도 3열 고정이라 글자가 짤렸던 반응형 버그 있었음, 수정됨)
- **자주 쓰는 기능 칩(신규):** `usage_stats` 기반 사용 횟수 상위 5개 자동 추천 (getTopFeatures 함수),
  신규 사용자는 기존 QUICK_LINKS 폴백
- 실시간 시계, 날씨(Open-Meteo, /api/weather 경유), 위치(Nominatim)
- 이번 주 기능별 사용 통계 바 차트, 다가오는 일정, 오늘의 팁, SpeedDial 바로가기
- 첫 로그인 온보딩 모달 (소속/이름/직급 → 직업군 → 입사일, 전부 선택사항, 건너뛰기 가능)
  트리거 조건: sender_info/job_preset/join_date 전부 비어있고 localStorage
  'worky_onboarding_dismissed' 미설정 시
- ⚠️ 모바일에서 하단 섹션(이번 주 활동/다가오는 일정/오늘의 팁)이 `flex-1 min-h-0`로 과압축되어
  내용이 잘리던 버그 있었음 — `sm:flex-1 sm:min-h-0`로 수정(모바일에서는 자연스러운 높이,
  데스크탑에서만 압축 레이아웃)

### 2. 할 일 / 메모 (`/todo`)
- 날짜별 할 일 관리, 미완료 할 일 자동 이월
- 메모 탭 3개: 업무/회의/개인 (세그먼트 컨트롤 스타일 — 밑줄 탭과 다른 패턴으로 의도적 유지)
- Supabase todos, memos 테이블 연동
- ⚠️ 할 일 리스트가 `max-h-72` 고정값 때문에 카드 전체 높이를 못 쓰던 버그 있었음 →
  `flex-1 min-h-0`로 수정해 남는 공간을 리스트가 다 채우도록 변경

### 3. Q&A (`/qa`)
- **대화 시작 전(신규):** 중앙 랜딩 화면(로고+환영 문구+추천 질문 카드 3개)
- **대화 시작 후:** 기존 채팅 UI, AI 답변 마크다운 렌더링(신규 추가), 스트리밍 타이핑 효과
- 히스토리 자동 저장 — 스트리밍 완료 시점에만 1회 저장하도록 수정됨
  (과거: useEffect가 스트리밍 청크마다 반응해 중복 INSERT되는 경쟁 조건 버그 있었음)

### 4. 이메일 작성 (`/email`)
- **탭 1: 새 이메일 작성** — 받는 사람/제목/내용 입력, AI가 다듬어서 생성, Gmail 전송
- **탭 2: 답장 작성** — 받은 이메일 붙여넣기, 톤 선택 5개(pill 칩), 초안 3개 생성, Gmail 전송
  — 프롬프트 강화 + 1회 자동 재시도 로직으로 "초안 1개만 생성되는" 문제 개선
- 발신자 정보(소속/이름/직급) 자동 적용
- 복사 버튼은 IconCopy/IconCheck 사용 (과거 인라인 SVG 좌표 오류로 아이콘이 깨졌던 버그 수정됨)

### 5. 메시지 작성 (`/content`)
- **탭 1: 보고 메시지** — 작업 내용 입력, 톤 3가지(pill 칩), 내 말투 샘플 등록
- **탭 2: 인스타 게시글** — 거래처 키워드 연동, 톤 3가지(pill 칩)

### 6. 템플릿 생성 (`/template`)
- 유형: 업무보고서/회의록/기획안/공문서 (pill 칩 선택)
- 마크다운 렌더링

### 7. 번역·다듬기 (`/translate`)
- 모드 탭(밑줄 스타일): 번역 / 톤 다듬기
- 출발/도착 언어, 톤 선택 모두 pill 칩으로 압축, 통합 카드

### 8. 문서 요약 (`/summary`)
- 텍스트 입력, 요약 방식 3가지(pill 칩), 마크다운 렌더링
- PDF worker는 CDN 대신 로컬 번들 사용 (`new URL(..., import.meta.url)` 패턴, 신규 수정)

### 9. 데이터 정리 (`/data`)
- 텍스트 입력만 지원 (파일 업로드 탭 제거됨)
- Groq API로 표 변환
- HTML 복사, CSV 다운로드 (파일명: worky_정리데이터.csv)
- 히스토리 최근 50개까지 표시(신규 제한)

### 10. 일정 추출 (`/schedule`)
- 이메일/공지/메시지 붙여넣기, Groq API로 일정 추출
- "일정 관리에 저장" 버튼

### 11. 일정 관리 (`/calendar`)
- 월별 캘린더, 한국 공휴일+대체공휴일 (lib/holidays.ts)
- 월별 조회로 전환(getEventsInRange, 신규) — 이전엔 전체 일정을 매번 다 불러오던 성능 이슈 있었음
- 일정 장소 카카오맵 검색 연동 (NEXT_PUBLIC_KAKAO_MAP_KEY)
- 선택 시 `place_url`(장소 고유 링크) 저장 — 과거 검색 조합 URL 방식이라 클릭해도 엉뚱한 결과로
  가던 문제 수정됨
- 장소 검색 결과 호버 시 건물명 툴팁 표시(신규)
- Supabase calendar_events 연동 (location_url 포함), 반복 일정 지원, 커스텀 시간 피커

### 12. 데이터 분석 (`/insight`)
- 텍스트 입력, Groq API 분석
- "보고서로 생성" 버튼

### 13. 용어집 (`/glossary`)
- 용어 추가/수정/삭제, AI 용어 설명 (별도 입력창 방식)
- Supabase glossary 연동
- 비로그인 시에도 기본 예시 용어 노출(신규 — 이전엔 빈 화면이었음)

### 14. 거래처 관리 (`/clients`)
- 박스형/목록형 두 가지 뷰 지원
- 상태 4단계: 대기 중/진행 중/완료/중단
- 계약 기간 단위 선택 (일/주/월/년), 영업일 기준 D-day 자동 계산
- 박스형 카드: 거래처 연락처 → 담당자 → 계약정보(한 줄) → 링크 → 메모 → 보고톤 → 잔디밭 → 커스텀 속성 순
- 목록형: 컬럼 표시/숨김 (표시 항목 버튼, localStorage 저장), 편집 버튼으로 수정/일괄 삭제, 진행현황 패널
- 목록형 전체 선택 체크박스(신규), 줄무늬 제거 — 선택 안 한 행은 흰색 통일, 선택 시에만 강조 배경(신규)
- 커스텀 속성: key/value + 숨김 처리, 박스형 토글 방식 / 목록형 팝오버
- 연락처 숨김: 담당자/거래처 연락처 각각 숨김 설정, 눈 아이콘 클릭으로 임시 확인 (꾹 누르기 방식)
- 검색: 거래처명/담당자/연락처/태그/메모/보고톤/링크/커스텀 속성 전체 검색
- 정렬: 상태순/만료임박순/계약시작일↑↓/거래처명↑↓/담당자↑↓
- 진행 현황 잔디밭: 계약 기간 내 일별 완료/실패 기록, 주 단위 네비게이션
- D-day 시각적 강조: 만료됨/D-3 이내 → 카드·행 좌측 빨간 띠(border-l-4, #EF4444) + 텍스트 빨강,
  D-7 이내 → 주황 띠(#F97316), formatDday()/ddayAccentColor() 함수 (ClientManager.tsx)
- 엑셀 가져오기/내보내기(SheetJS)
- Supabase clients 연동: mask_phone, mask_company_phone, company_phone, custom_fields(JSONB),
  user_settings.custom_field_keys(JSONB)
- ⚠️ 모바일에서 헤더 버튼(뷰토글/진행현황/가져오기/내보내기/추가)이 한 줄에 밀집돼 넘치던 버그 →
  flex-wrap 추가로 수정

### 15. 구성원 관리 (`/members`) — v1.4.0 신규 페이지
- 목록/자리배치도 탭 (밑줄 스타일)
- 이메일 도메인 커스텀 입력, 생일 등 프로필 관리, 카카오톡 ID
- 검색(이름/소속/직급), 소속별 그룹 보기 토글
- 자리 배치도(SeatingPlanner): 드래그&드롭 배치, 90도 회전, 구성원 배정/해제

### 16. 공문서 작성 (`/document`)
- 유형: 품의서/공문/지출결의서/업무협조 요청서 (pill 칩 선택)

### 17. 피드백 정리 (`/feedback`)
- 클라이언트 피드백 → 필수/선택/구체화 자동 분류, 편집 가능한 결과
- 사용 통계가 "qa"로 잘못 집계되던 버그 수정 → "feedback" 카테고리 신설

### 18. 설정 (`/settings`) — v1.4.0에서 레이아웃 전면 개편
- **좌우 분할 레이아웃(신규)** — 좌측 섹션 목록 + 우측 상세, 모바일은 목록↔상세 전환
  (기존 세로 아코디언 방식에서 변경)
- 섹션: 내 정보, 연차 설정, 커스텀 인사말, 직업군 설정, 메뉴 설정, **언어 설정(신규)**, 알림 설정
- 내 정보: 소속/이름/직급 (Supabase user_settings 연동)
- 연차 설정: 입사일, 입사 유형(신입/경력), 기준(입사일기준/회계연도기준), 사용 연차 입력
- 커스텀 인사말: 기본/시간대별/요일별 모드 설정
- 메뉴 설정: 선택 페이지 on/off, 드래그&드롭 순서 변경
- 직업군 프리셋 (마케팅/IT/경영지원/사무직/디자이너/기타)
- 언어 설정(신규): 한국어/English 토글, Supabase user_settings.language 저장
- 알림 설정: 브라우저 권한 요청, 일정 알림/거래처 D-day 알림 on/off
- 도움말 7단계로 현재 섹션 구성과 정확히 일치하도록 갱신됨(신규 — 예전엔 3단계로 화면과 안 맞았음)

### 19. 알림 시스템 (`lib/notifications.ts` + Supabase 이중화)
- 브라우저 Notification API 기반 (PWA/데스크탑 모두 지원)
- 오늘 일정 알림: 앱 열 때 오늘 일정 있으면 발송
- 거래처 D-day 알림: 계약 만료 7일/3일/당일 단계별 메시지
- 하루 한 번만 발송 (worky_notif_sent_date localStorage 체크)
- 설정: worky_notification_settings localStorage 저장
- **user_notifications 테이블(신규):** 개인별 알림을 서버에 저장, daily-notifications Edge Function이
  pg_cron으로 매일 자동 생성 (한때 pg_net 확장 비활성화로 조용히 실패하고 있었음 — 활성화로 복구됨)
- **알림 벨(NotificationBell) 통합:** 전역 공지(announcements) + 개인 알림(user_notifications) 병합 표시,
  모바일에서는 상단 헤더에만 노출(Topbar 중복 노출 버그 수정됨), 다크모드/영어 로케일 지원

### 20. PWA 지원
- manifest.json: standalone, 테마 #6C63FF
- 아이콘: icon-192.png, icon-512.png, apple-touch-icon.png (180×180)
- next-pwa: 프로덕션에서만 Service Worker 등록 (개발 환경 비활성)

## 21. GitHub Actions / 릴리스 워크플로우
- **keep-alive.yml:** 매주 월요일 UTC 00:00, Supabase REST API ping (무료 플랜 프로젝트 일시정지 방지)
- **patch-announcement.yml:** `v*` 태그 푸시 시 자동 실행.
  1) CHANGELOG.md에서 해당 버전 섹션을 파싱해 **jq로 JSON 이스케이프 처리(신규 수정)** 후
     Supabase announcements 테이블에 insert. 줄바꿈은 그대로 유지되어 저장(신규 수정 —
     예전엔 `tr '\n' ' '`로 한 줄로 뭉개져서 알림이 지저분하게 보였음).
     HTTP 상태 코드 체크해서 4xx/5xx면 워크플로우 자체를 실패 처리(신규 — 예전엔 curl 에러가
     조용히 묻혀서 "success"로 잘못 표시되던 문제 있었음).
  2) **GitHub Release 자동 생성(신규 스텝)** — 동일 섹션 내용으로 `gh release create` 호출,
     `permissions: contents: write` 필요.
  - NotificationBell.tsx에서 `whitespace-pre-line`으로 줄바꿈 렌더링
- **CHANGELOG.md 컨벤션:** `## [vX.Y.Z] - YYYY-MM-DD` 형식, 카테고리별 이모지 헤더(✨🎨🔔🐛 등) +
  `- ` 불릿 목록. 새 버전 추가 시 최상단(가장 최근 버전 위)에 삽입.
  ⚠️ 내용에 큰따옴표(`"`)가 포함되면 과거엔 JSON이 깨졌으나 jq 적용 후 안전해짐 —
  role="alert" 같은 표현도 그대로 써도 됨.
- **버전 관리 순서:** CHANGELOG.md 갱신 → package.json version 갱신 → 커밋 → `git tag vX.Y.Z` →
  `git push origin vX.Y.Z`. 태그를 다시 만들어야 할 경우(워크플로우 재트리거 등)
  `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z` 후 재생성.
- **GitHub Release의 "Latest" 표시:** 태그 생성 시각이 아니라 릴리스 *생성* 시각 기준이라,
  과거 버전을 나중에 릴리스하면 최신 표시가 뒤바뀔 수 있음 — `gh release edit vX.Y.Z --latest`로 수정.
- **현재 버전:** v1.4.0 (package.json version 필드와 동기화됨)

## 사이드바
- 접기/펼치기 토글
- 로고 클릭 시 홈으로 이동
- 직업군 프리셋 6가지
- 드래그&드롭으로 메뉴 순서 변경
- 다국어 지원(MENU_LOCALE_MAP으로 href → 번역 키 매핑, 신규)

## 코딩 컨벤션
- 컴포넌트: 함수형, TypeScript interface
- API 호출은 반드시 서버 사이드 (api/groq/route.ts 등), **로그인 인증 체크 필수(신규 원칙)**
- 에러 처리: `useToast()`로 toast.error()/toast.success() 사용, 빈 `.catch(() => {})` 금지,
  에러 메시지에는 `role="alert"` 포함(신규)
- 한국어 UI가 기본이지만 **하드코딩 금지 — 다국어 텍스트는 `t()`/`tFormat()` 사용(신규 원칙)**
- localStorage는 Supabase와 이중 저장 시 캐시 역할만 담당 — Supabase에 저장 가능한 데이터를
  localStorage에만 저장하지 말 것, 빈 값으로 덮어쓰기 금지
- Supabase 스키마 변경(컬럼 추가/삭제)은 항상 사용자가 직접 Supabase SQL Editor에서 실행
  (Claude가 마이그레이션 자동 실행 금지)
- 페이지/컴포넌트의 초기 로딩 가드는 `if (!hydrated) return null` 대신,
  실제 콘텐츠와 동일한 wrapper + animate-pulse 스켈레톤으로 처리 (레이아웃 시프트 방지)
- **모달/오버레이는 `createPortal`로 `document.body`에 직접 렌더링(신규 원칙)** — 스크롤 가능한
  컨테이너 안에 두면 `position: fixed` 기준점이 어긋나 화면 일부만 덮이는 버그가 있었음
- **인라인 SVG 아이콘 직접 작성 지양(신규 원칙)** — Tabler Icons 컴포넌트 사용 우선,
  과거 좌표 오류로 아이콘이 깨진 사례 있음
- 작업 완료 후 항상 git add, commit, push
- 새 버전 배포 시 CHANGELOG.md 갱신 → package.json version 갱신 → 태그 push 순서 준수(신규)

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
  — 참고: Worky 웹에서는 2026년 리뉴얼 중 동일한 글래스모피즘을 모달에 시도했다가 롤백함
  (웹은 단색 배경이라 안 어울렸음). 데스크탑 앱은 배경 자체가 그라디언트 블롭이라 계속 유지 가능.
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
