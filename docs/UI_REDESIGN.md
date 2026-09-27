# Worky OS: Calm Future — 1단계

## 범위와 조사

앱 셸, 사이드바, 홈을 정식 제품의 기준 화면으로 정리한다. 인증, Supabase 스키마, 설정 저장 형식, 프리셋, 업무 처리 함수와 API 계약은 변경하지 않는다.

- 기준 커밋: `bd5d73c`. 시작 작업 트리는 깨끗했으며 `feature/worky-calm-future-phase1`에서 작업한다.
- `AGENTS.md`, `CLAUDE.md`, package.json, 전역 CSS, AppShell/Sidebar/ThemeProvider, 홈, 설정, menuSettings, db/settings, LocaleContext 및 관련 이력을 조사했다.
- 실제 Next.js는 15.3.9. `node_modules/next/dist/docs`가 없는 배포 패키지이므로 [15 버전 레이아웃 문서](https://nextjs.org/docs/15/app/getting-started/layouts-and-pages), [CSS 문서](https://nextjs.org/docs/15/app/getting-started/css)를 확인했다.
- 배포 서비스 게스트 화면을 1440×1000, 390×844에서 직접 캡처하고 설정도 확인했다. 공유 계정의 데이터 변경 요청은 차단했으며 AI 응답은 테스트 대역이었다. 연결 표시의 실제 서비스 상태를 검증한 것은 아니다.
- 기존 이력에는 글래스 효과 롤백, 홈 높이/스크롤 수정, PNG 로고 전환이 있다. PNG 로고와 Tabler 아이콘, 기존 스타일의 점진적 전환을 유지한다.

### 발견한 문제

1. 0건 지표, 연차 미설정, 빈 활동과 팁이 실제 일정과 같은 비중을 차지한다. 하단 카드가 남은 높이를 채운다.
2. 모바일의 날짜/인사말과 업무 요약이 시계/날씨 옆에서 잘린다. 고정 헤더도 중복된다.
3. 메뉴 전체가 같은 위계이고 선택 항목은 그라데이션으로 가득 찬다. 축소 사이드바와 모바일 포커스 처리가 불충분하다.
4. 홈 빠른 실행은 설정한 순서를 따르지 않고, 사용 빈도 칩은 비활성 메뉴도 노출한다. 서버 메뉴 설정은 설정 페이지를 방문해야 로컬에 동기화된다.
5. AI 기능 페이지는 요청 여부와 무관하게 처리 중 배지가 표시된다. 연결 성공 표시에도 무한 애니메이션을 사용한다.
6. 색상/표면/여백이 페이지에 흩어져 있으며 reduced-motion과 공통 키보드 포커스 기준이 없다.

## 디자인 기준

`#6D63FF`를 브랜드 기준으로 유지한다. 작은 텍스트는 대비를 확보한 잉크 색을 사용한다. 차분한 중성 배경과 명확한 타이포그래피, 얇은 구분선으로 업무의 연결을 보여준다.

| 항목 | 기준 |
| --- | --- |
| 깊이 1 | 기본 바탕/작업 레일, light #F5F6F8 · dark #111318 |
| 깊이 2 | 작업 면, light #FFFFFF · dark #1A1D24, 경계선으로 구분 |
| 깊이 3 | 모바일 탐색/상세 편집 등 임시 화면, 불투명 표면과 제한된 그림자 |
| 브랜드 | #6D63FF; 텍스트/포커스 light #5145CD · dark #B1AAFF |
| 텍스트 | 본문 14–16px, 보조 12–13px, 제목 20–32px, 한국어 1.6행간 |
| 글꼴 | 설치된 Pretendard 사용, 시스템 sans-serif 대체, 숫자 tabular-nums |
| 간격 | 4/8/12/16/24/32/48px 토큰 |
| 모서리 | 컨트롤 8px, 작업 면 16px, 상태 칩만 pill |
| 상태 | 정상/주의/오류를 색과 문구로 함께 표시. 로딩과 빈 상태 구분 |
| 움직임 | 색/배경 140ms, drawer 180ms; 장식적 반복 움직임 없음 |
| 접근성 | 본문 대비 4.5:1, 큰 글씨/UI 3:1 목표. 2px 포커스와 간격, skip link, Escape/포커스 복원, reduced-motion |

기존 globals.css의 기능 페이지 호환 규칙을 유지하고 새 셸/홈은 `--wk-*` 의미 토큰으로 구현한다. 신규 디자인에서 임의 색상을 반복하지 않는다. W/체크 흐름선은 현재 탐색 위치와 홈의 업무 연결에만 제한적으로 사용한다.

## 정보 구조와 구현 계획

- 셸: 하나의 반응형 헤더, 모바일 접근 가능한 탐색 drawer, 내용 건너뛰기 링크. AI 배지는 기능 설명이며 처리 상태로 가장하지 않는다.
- 작업 레일: 로고 → 홈 → 기존 고정 업무 → 설정 순서대로 활성 도구 → 실제 이번 세션에 열었던 도구 → AI 연결 확인/설정/테마/계정. 고정/선택 메뉴의 저장 계약은 그대로다.
- 홈: 사용자 인사말 → 실제 데이터에서 선택한 다음 행동 → 일정과 미완료 할 일 → 최근 열었던 도구 → 활성 기능을 설정 순서로 나열. 사용 통계/팁/연차/날씨는 작은 보조 영역으로 보존한다.
- 별도의 홈 패널 고정 설정은 현재 없다. 가짜 pin이나 신규 저장 필드를 만들지 않는다. 고정 업무인 일정/할 일은 간결한 빈 상태와 실제 진입 링크를 제공한다.
- 최근 항목은 세션 중 방문한 도구이며 문서 수정 이력으로 표시하지 않는다. 세션이 비어 있으면 영역을 생략한다.
- 기존 외부 바로가기 및 사용자 추가 링크 저장을 보존한다.
- 전체 검색/명령 팔레트는 다음 단계에서 권한별 검색 소스와 결과 모델을 먼저 정한다. 현재 UI에 가짜 입력창/단축키는 추가하지 않는다.
- 일정 추출 등 AI 작업 화면은 다음 단계에서 원문/근거 → 편집 가능한 결과 → 불확실 값 → 확인 후 저장 순서로 개편한다.

## 설정 호환성

`user_settings.menu_settings/menu_order/job_preset/custom_greeting`와 기존 localStorage 키, `workyMenuSettingsChanged/workyMenuOrderChanged` 이벤트를 유지한다. 설정 UI와 DB upsert 형식은 그대로 사용한다. 앱 진입 시 서버 설정을 기존 로컬 캐시에 반영하며 홈과 레일이 같은 설정을 구독한다. 진행 중 사용자의 메뉴 편집은 초기 비동기 조회로 되돌리지 않는다.

## 검증 기록

- `npm run typecheck`: 통과.
- `npm run build`: 통과. 34개 정적 페이지 생성, API/middleware 빌드 완료. 빌드한 앱을 `npm run start -- --hostname 127.0.0.1 --port 3000`으로 실행하여 UI E2E를 재검증했다.
- `npm run lint`: 오류 0, 경고 8. 기존 PNG/favicon의 img 사용 3개, 기존 DatePickerInput/TodoMemo의 Hook 의존성 4개, IssueOrganizer의 불필요한 disable 1개. 검사 규칙을 낮추지 않았다. 새 검사가 발견한 FeedbackOrganizer의 JSX 따옴표 두 개는 동일한 표시를 유지하는 엔티티로 변경했다.
- `npm run test:unit`: 3파일, 10개 통과. 기존 일정 mutation/마크다운 테스트를 유지하고 메뉴 설정 호환성 3개 추가.
- `npx playwright test tests/e2e/workspace-ui.spec.ts tests/e2e/guest-smoke.spec.ts --reporter=line --workers=1`: 프로덕션 앱에서 6개 통과. 기존 게스트 스모크와 UI 5개(테마/접근성, 설정/프리셋, 메뉴 toggle/정렬, 인사말 basic/time/day/off, 빈 상태/외부 링크). 새 UI E2E는 실제 게스트 로그인 + 브라우저 범위 데이터 대역을 사용하여 공유 계정에 쓰지 않는다. 설정 upsert 요청 내용까지 검사한다.
- `npx playwright test --config playwright.crud.config.ts --workers=1`: 기존 7개 통과. 전용 테스트 계정의 실제 일정·거래처·메모·할 일 저장과 실패 상태를 검증했다. 기존 테스트 변경 없음.
- 1440×1000, 1100×768, 390×844, 320×740 각각 light/dark에서 axe WCAG A/AA 위반 0건. 모바일 drawer도 별도 위반 0건. Tab 순환, Escape/포커스 복원, skip link, 포커스 outline, reduced-motion, 가로 넘침 검사 통과. 검증 시나리오에서 콘솔 오류/pageerror/주요 네트워크 실패 0건.
- 로컬 Docker 엔진이 실행 중이지 않아 격리된 Supabase 보안 스택은 실행할 수 없었다. 본 단계는 DB/RLS/인증을 변경하지 않는다.

### 기존 의존성 보안 점검

`npm audit --omit=dev`는 실행 의존성 15건(critical 1, high 13, moderate 1)을 보고했다. Next.js, next-pwa, pdfjs-dist, xlsx와 전이 의존성이 포함된다. 실제 악용 가능성을 이번 UI 작업에서 판정한 것은 아니며 정식 외부 공개 전 별도 업그레이드/회귀 검증이 필요하다. 기존 lockfile에 있던 패키지의 버전이 바뀌지 않은 것을 비교했다. 강제 audit fix를 실행하지 않았다.

### 변경 파일의 역할

| 파일 | 역할 |
| --- | --- |
| `src/app/workspace.css`, `globals.css` | 의미 기반 토큰, 새 셸/홈 스타일, 로컬 Pretendard, 전역 포커스/reduced-motion |
| `src/app/layout.tsx` | 브랜드 theme-color 정합성 |
| `src/components/AppShell.tsx` | 단일 헤더, 건너뛰기, native dialog 모바일 메뉴, AI 지원 문구 |
| `src/components/Sidebar.tsx` | 작업 레일 위계, 메뉴 순서, 축소/모바일/계정 동작 |
| `src/components/WorkspaceProvider.tsx` | 기존 설정 캐시/이벤트 구독, 초기 서버 설정 반영, 세션 최근 도구 |
| `src/lib/workspaceNavigation.ts` | 홈/레일이 함께 쓰는 고정+선택 메뉴 정렬/필터 |
| `src/components/WorkspaceIcon.tsx`, `WorkyFlow.tsx` | Tabler 경로 아이콘, 제한된 W/체크 흐름선 |
| `src/app/page.tsx` | 우선 업무와 일정·할 일 중심 홈; 기존 데이터 계산/알림/온보딩 보존 |
| `src/components/ExternalShortcuts.tsx` | 기존 외부/사용자 바로가기 저장을 보존한 인라인 펼침과 접근 가능한 편집 |
| `src/lib/dialogFocus.ts` | 모바일 메뉴/바로가기 편집의 공통 포커스 순환 |
| `src/lib/i18n/translations.ts` | 새 ko/en UI 문구 |
| `src/components/FeedbackOrganizer.tsx` | 린트가 발견한 JSX 따옴표 표기만 수정 |
| `package.json`, `package-lock.json`, `eslint.config.mjs` | 타입/린트 명령, Next 15용 ESLint 및 axe 개발 도구 |
| `src/lib/workspaceNavigation.test.ts`, `tests/e2e/workspace-ui.spec.ts` | 새 메뉴 호환성 및 UI/설정/접근성 회귀 검사 |

### 프로덕션 빌드 화면

고정된 검증 데이터이며 실제 개인 업무 기록이 아니다. 모바일은 내부 본문을 세로 스크롤하는 구조여서 첫 화면과 도구 영역을 별도로 캡처했다.

| 화면 | 밝은 테마 | 어두운 테마 |
| --- | --- | --- |
| 데스크톱 1440px | [보기](images/ui-redesign/desktop-light.png) | [보기](images/ui-redesign/desktop-dark.png) |
| 작은 노트북 1100px | [보기](images/ui-redesign/laptop-light.png) | [보기](images/ui-redesign/laptop-dark.png) |
| 모바일 390px | [보기](images/ui-redesign/mobile-light.png) | [보기](images/ui-redesign/mobile-dark.png) |
| 모바일 도구 영역 | [보기](images/ui-redesign/mobile-tools-light.png) | [보기](images/ui-redesign/mobile-tools-dark.png) |
| 작은 모바일 320px | [보기](images/ui-redesign/small-mobile-light.png) | [보기](images/ui-redesign/small-mobile-dark.png) |

[모바일 작업 레일](images/ui-redesign/mobile-navigation-dark.png)

## 남은 범위와 다음 단계

- 기능 페이지(일정 추출의 원문/검토/저장 UI 포함), 설정 페이지 레이아웃, 인증, DB/RLS/API, 업무 계산/저장 로직을 개편하지 않았다.
- 전체 검색, 명령 팔레트, 홈 영역 pin, 문서 단위 최근 편집 이력은 다음 단계. 이번 방문의 최근 도구는 새로고침 시 비워지며 서버에 저장하지 않는다.
- 홈의 기존 DB helper 일부는 조회 오류를 빈 값으로 반환한다. 모든 부분 실패를 홈에서 구분하려면 별도 데이터 오류 계약 정리가 필요하다.
- AI 연결 배지는 기존 연결 요청의 결과이며 지속적인 서비스 가용성 보장이 아니다. E2E의 AI 응답과 날씨는 대역이므로 실제 추론 품질이나 외부 API 가용성을 검증하지 않는다.
- 신규 UI는 공통 토큰을 사용하지만 기존 기능 페이지의 하드코딩 색/스타일은 점진적 전환 대상이다.
- 새 디자인은 검토용 브랜치/PR로 전달한다. 병합·정식 배포·버전 태그는 이 작업에서 실행하지 않는다.
