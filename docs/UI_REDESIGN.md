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

## PR #167 후속 다듬기: 업무 브리핑과 전환

> 아래는 2026-09-27의 구현·검증 기록이다. 브리핑과 팁은 이후 요청에 따라 제거했으며 현재 동작은 아래의 ‘2026-09-28 홈 균형 보정’ 절을 따른다. 당시 전후 이미지는 이력으로 보존한다.

기준 구현은 `008e7f4`이며 같은 `feature/worky-calm-future-phase1` 브랜치와 Draft PR을 유지한다. 인증·DB·API·설정 저장 방식·다른 기능 페이지·의존성은 이 후속 작업에서 변경하지 않았다.

### 홈 화면 A안 적용 (2026-09-27)

사용자가 선택한 `작업 흐름` 시안의 구조를 실제 홈에 적용했다. 기존 인사말과 데이터 기반 다음 행동을 유지하면서, 첫 업무는 큰 카드 대신 번호·제목·실제 목적지 링크가 있는 한 줄로 보여준다. 일정과 할 일은 상자 없이 구분선으로 나누고, 최근 도구는 작은 링크로만 표시한다. 전체 도구는 기본 화면에서 접고 `모든 도구 보기`를 누르면 설정의 on/off와 순서대로 펼쳐진다. 최근 도구가 없으면 빈 바로가기 대신 설명과 펼침 버튼을 제공한다. 사이드바에 반복되던 최근 방문 목록과 브리핑의 자주 사용한 기능 목록은 제거했다. 브리핑의 활동·연차·팁은 유지한다.

시안의 임시 문자 아이콘은 실제 화면에 사용하지 않는다. 공통 Tabler 아이콘 크기 20px·stroke 2와 선명한 아이콘 색을 적용했다. 펼침은 높이와 opacity 200ms/160ms, 링크는 색·테두리 140ms와 짧은 눌림 반응을 사용한다. 정밀 포인터에서만 hover를 적용하며 움직임 감소 설정에서 위치 이동과 펼침 전환을 없앤다. 모든 링크는 실제 라우트이고, 맞춤 인사말과 메뉴 설정 저장 방식은 유지한다.

이 변경은 홈 및 공통 메뉴 표시 범위이며, 기능별 내부 화면 개편이나 배포·병합은 포함하지 않는다. 아래의 이전 후속 작업 설명은 해당 커밋의 당시 동작을 기록한 것이고, 위 A안이 현재 홈의 기준이다.

### 확인한 문제와 처리

- 기존 `작업 메모 / Workspace notes`는 실제 메모가 아닌 지표와 팁을 세로로 나열했고, 접으면 어떤 정보가 있는지 알 수 없었다. `업무 브리핑 / Work brief`로 이름을 바꾸고 활동·남은 연차 중 있는 값을 최대 두 개 요약한다. 지표가 없으면 자주 쓴 기능 또는 실제 팁을 요약한다.
- 펼치면 활동·연차, 자주 사용한 기능, 오늘의 팁을 낮은 우선순위의 정보 묶음으로 배치한다. 별도 카드 배경이나 그림자는 추가하지 않는다. 640px 미만은 한 열, 중간 폭은 최대 두 열, 1280px 이상은 정보량에 따라 최대 세 열이다. 팁만 있으면 한 묶음이며, 모든 값이 없으면 영역 자체를 렌더링하지 않는다. 남은 연차 0일은 유효한 값으로 유지한다.
- 모바일 메뉴는 즉시 제거하던 방식을 변경했다. 진입은 transform 200ms / `cubic-bezier(0.32, 0.72, 0, 1)`, 배경은 opacity 140ms, 퇴장은 140ms다. 실제 CSS 전환의 완료를 기다린 후 dialog를 닫고 트리거 포커스를 복원한다. 취소된 열기 프레임과 이전 닫힘 완료 처리는 무효화한다.
- 브리핑 내용은 opacity와 translateY(4px)를 160ms로 전환하고 화살표도 같은 시간에 회전한다. 높이 애니메이션은 없다. 접히는 내용은 즉시 `inert` 처리하고 퇴장 중에만 잠시 유지한다.
- 주요 버튼은 120ms / scale(0.98), 현재 메뉴 배경과 흐름선은 140ms다. 흐름선을 항상 마운트하고 활성 여부만 opacity로 전환한다. 페이지 전환 효과는 추가하지 않았다.
- reduced-motion에서는 이동·스케일 및 화살표 회전 애니메이션을 없애고 색상·opacity만 80ms 유지한다. 새 버튼 hover는 정밀 포인터/hover 가능 장치에만 적용한다.

### 변경 파일

| 파일 | 후속 작업 역할 |
| --- | --- |
| `src/components/WorkBrief.tsx` | 순수 표시용 브리핑, 값 유무 판정, 요약, 키보드 disclosure, aria 연결 |
| `src/app/page.tsx` | 기존 계산 결과와 메뉴 필터를 그대로 브리핑에 전달 |
| `src/components/AppShell.tsx` | 메뉴 진입/퇴장 수명 관리, 중단·재개, Escape 및 포커스 복원 |
| `src/components/Sidebar.tsx` | 현재 메뉴 흐름선의 opacity 전환을 위한 안정된 DOM |
| `src/app/workspace.css` | 기존 색상 토큰을 사용하는 정보 묶음과 범위가 제한된 전환·reduced-motion |
| `src/lib/i18n/translations.ts` | 업무 브리핑 및 요약 ko/en 문구 |
| `src/components/WorkBrief.test.ts` | 전체 빈 값, 일부 값, 팁만, 연차 0일, 잘못된 숫자, 영문 렌더링 검사 |
| `tests/e2e/workspace-ui.spec.ts` | 전후 캡처, 데이터 조합, 반응형·접근성·전환·반복 조작 회귀 검사 추가 |

기존 인사말/시간·요일 모드, 직업군 프리셋, 메뉴 표시·정렬, 설정 저장과 홈 데이터 조회 코드는 보존했다. 기존 E2E 검사는 그대로 두고 fixture 옵션과 새 검사를 추가했다.

### 후속 작업 검증 결과 (2026-09-27)

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run lint` | 오류 0, 기존 경고 8 유지 |
| `npm run build` | 프로덕션 빌드 통과, 해당 빌드로 화면 검증 |
| `npm run test:unit` | 16개 통과 (브리핑 신규 6개 포함) |
| `npx playwright test --workers=1 --reporter=line` | UI·게스트 13개 통과, 50.7초 |
| `npx playwright test --config playwright.crud.config.ts --workers=1 --output playwright-report/crud` | 전용 계정 CRUD 7개 통과, 20.8초 |
| 브리핑 데이터 조합 / 반응형 / 테마 | 전체·일부·팁만 × 320/390/1100/1440px × light/dark 통과; 완전한 빈 상태·0일·영문은 단위 검사 |
| 접근성 / 전환 | axe WCAG A/AA 위반 0, aria 연결, Enter/Space, Tab 순환, Escape, 포커스 복원, 배경 클릭, 반복 중단·재열기, 데스크톱 전환 시 닫힘 통과 |
| reduced-motion / 터치 | transform 제거, 짧은 opacity 유지, 버튼 누름, 현재 메뉴 흐름선, 터치 이후 hover 미잔류 통과 |
| 가로 넘침 / 오류 | 검증한 화면의 넘침, 콘솔 오류, 주요 네트워크 오류 0 |

중간 실행에서 비정상적으로 긴 실행 지연, Supabase DNS `ENOTFOUND`, 게스트 인증 연결 대기 중 시간 초과가 있었다. 최종 동일 코드·동일 제한 시간·동일 assertion으로 전체 UI 13개와 CRUD 7개를 재실행해 통과했다. 테스트 삭제·skip·기대값 완화·시간 제한 증가는 하지 않았다. 이 결과는 외부 인증 서비스의 지속적인 가용성을 보장하지 않는다.

### 전후 화면

실제 개인 정보가 아닌 동일한 고정 데이터(주간 활동 12회, 남은 연차 4일)로 로컬 프로덕션 빌드에서 촬영했다. 홈 내부 스크롤을 브리핑이 보이는 위치에 맞췄다. `before`는 앱 수정 전 기준 구현이다.

| 화면 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 데스크톱, 펼침 | [밝음](images/ui-refinement/before/desktop-light.png) · [어두움](images/ui-refinement/before/desktop-dark.png) | [밝음](images/ui-refinement/after/desktop-light.png) · [어두움](images/ui-refinement/after/desktop-dark.png) |
| 데스크톱, 접힘 | [밝음](images/ui-refinement/before/desktop-light-collapsed.png) · [어두움](images/ui-refinement/before/desktop-dark-collapsed.png) | [밝음](images/ui-refinement/after/desktop-light-collapsed.png) · [어두움](images/ui-refinement/after/desktop-dark-collapsed.png) |
| 모바일 390px | [밝음](images/ui-refinement/before/mobile-light.png) · [어두움](images/ui-refinement/before/mobile-dark.png) | [밝음](images/ui-refinement/after/mobile-light.png) · [어두움](images/ui-refinement/after/mobile-dark.png) |
| 모바일 메뉴 열림 | [밝음](images/ui-refinement/before/mobile-menu-light.png) · [어두움](images/ui-refinement/before/mobile-menu-dark.png) | [밝음](images/ui-refinement/after/mobile-menu-light.png) · [어두움](images/ui-refinement/after/mobile-menu-dark.png) |

일반 E2E 캡처는 `test-results`에 저장한다. 문서용 재촬영은 `WORKY_UI_CAPTURE_PHASE=after` 환경 변수로 `브리핑 전후 화면 기록` 테스트를 실행한다. 기존 before 파일을 재기준화하지 않는다.

### 검증 경계

홈에는 날짜별 팁이 항상 있으므로 실제 홈의 사용자 데이터 없음 상태는 ‘팁만’으로 검증하고, 팁까지 없는 완전한 빈 상태는 컴포넌트 단위 테스트로 검증한다. 화면 검증은 Chromium에서 수행한다. Safari/Firefox 실기기 확인은 별도이며 `@starting-style` 미지원 브라우저는 브리핑 진입 효과 없이 내용이 즉시 나타나는 점진적 대체 동작을 가진다. 테스트의 AI/날씨/홈 데이터 응답은 대역이고 인증은 기존 게스트 인증을 사용한다.

## 2026-09-28 홈 균형 보정

기준: `a12a591`. 같은 브랜치와 Draft PR #167에서 요청한 홈 표시만 수정한다. 새 시안을 만들거나 다른 기능 화면을 개편하지 않는다. 첨부 이미지는 이번 메시지에서 확인할 수 없어 기준 커밋을 직접 실행한 화면을 비교했다. 사용 가능한 연결 브라우저가 없어 기존 Playwright/Chromium으로 확인했다. 설치된 Next 15.3.9에는 지시된 로컬 문서 디렉터리가 없어 [공식 Next 15 CSS 가이드](https://nextjs.org/docs/15/app/getting-started/css)를 참고했고, 최종 CSS는 프로덕션 빌드에서 검증한다.

### 현재 동작과 변경 파일

- `HomeAccountStatus.tsx`: `WorkBrief.tsx`를 대체한다. 접기·펼치기, 반복되는 팁, 제목, 별도 구획선을 없애고 주간 활동과 남은 연차만 한 줄로 표시한다. 정보가 모두 없으면 DOM 자체를 만들지 않는다. 연차 0일은 유효하며 연차 링크는 `/settings`를 유지한다. 좁은 화면이나 긴 영문 값은 자르지 않고 필요하면 자연스럽게 줄바꿈한다.
- `page.tsx`: 홈 전용 일반 팁 배열/상태만 제거했다. 기존 조회·연차 계산은 그대로이며 계정 데이터 로딩 완료 후 상태 줄을 렌더링한다. 인사말 설정, 기본/시간/요일 모드, 메뉴 필터·정렬, 링크 목적지, 알림과 온보딩 로직은 변경하지 않았다.
- `workspace.css`: 홈의 글자 링크에서만 hover 밑줄을 제거한다. 정밀 포인터에서는 기존 토큰의 색상 변화와 화살표 2px 이동(120ms)을 사용한다. tools 펼침 화살표의 방향 표시는 유지한다. reduced-motion에서는 이동 없이 80ms 색상 변화만 남기며 터치에는 hover 이동을 적용하지 않는다. 기존 포커스 링은 유지한다. `transition: all`과 페이지 등장 효과는 추가하지 않았다.
- 인사말은 기존 데스크톱 최대 40px/모바일 28px에서 최대 28px/모바일 22px, 굵기 650, 줄 높이 1.5로 조정했다. 단어 단위 줄바꿈과 긴 단어의 넘침 처리를 유지하고 명시적 개행도 보존한다. ellipsis, line-clamp, 고정 높이, 문구 수정은 없다. 상하 여백을 줄여 실제 업무가 더 일찍 보이도록 했다.
- `translations.ts`: 한국어 `home`/`sidebar_home`은 ‘홈’, 영어는 ‘Home’을 유지한다. 상태 줄의 접근 가능한 이름을 ko/en으로 추가했다. #6D63FF와 기존 Tabler 아이콘 체계는 변경하지 않았다.
- `HomeAccountStatus.test.ts`, `workspace-ui.spec.ts`: 제거하도록 요청된 브리핑 접기/팁 기대값을 새 명세로 교체했다. 데이터 없음·활동만·전체·연차 0일, 잘못된 숫자, 영문, 설정 링크의 키보드 진입, 링크 반응/터치/reduced-motion, 긴 맞춤 인사말/개행을 검사한다. 메뉴·설정 저장 및 업무 기능의 기존 회귀 검사는 유지한다.

인증·DB·API·저장 방식·의존성 변경 없음. 병합, Ready 전환, 리뷰 요청은 하지 않는다.

### 화면 기록

같은 고정 인사말과 업무 데이터로 비교한다. 기본 화면은 주간 활동/연차가 없는 계정 조건이다. before는 기준 커밋의 개발 서버, after는 최종 프로덕션 빌드이며 개발 도구 표시는 제품 UI가 아니다. 각 이미지의 `-footer` 버전은 하단까지 스크롤한 화면, `-status` 버전은 실제 상태 값이 있는 조건이다.

| 너비 | 수정 전 | 수정 후 | 상태 정보 있음 |
| --- | --- | --- | --- |
| 1440px | [밝음](images/home-balance/before/1440-light.png) · [어두움](images/home-balance/before/1440-dark.png) | [밝음](images/home-balance/after/1440-light.png) · [어두움](images/home-balance/after/1440-dark.png) | [밝음](images/home-balance/after/1440-light-status.png) · [어두움](images/home-balance/after/1440-dark-status.png) |
| 390px | [밝음](images/home-balance/before/390-light.png) · [어두움](images/home-balance/before/390-dark.png) | [밝음](images/home-balance/after/390-light.png) · [어두움](images/home-balance/after/390-dark.png) | [밝음](images/home-balance/after/390-light-status.png) · [어두움](images/home-balance/after/390-dark-status.png) |
| 320px | [밝음](images/home-balance/before/320-light.png) · [어두움](images/home-balance/before/320-dark.png) | [밝음](images/home-balance/after/320-light.png) · [어두움](images/home-balance/after/320-dark.png) | [밝음](images/home-balance/after/320-light-status.png) · [어두움](images/home-balance/after/320-dark-status.png) |

문서용 재촬영: `WORKY_HOME_CAPTURE_PHASE=after`로 UI 테스트 실행. 일반 실행은 `test-results`에 저장한다. 과거 `WORKY_UI_CAPTURE_PHASE` 촬영 테스트는 제거된 UI에 대한 이력이므로 더 이상 실행하지 않는다.

### 최종 검증 결과 (2026-09-28)

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run lint` | 오류 0, 기존 경고 8 유지 |
| `npm run build` | 통과, 34개 경로 생성 |
| `npm run test:unit` | 4개 파일, 16개 통과 (계정 상태 6개 포함) |
| `npx playwright test --workers=1 --reporter=line` | 최종 프로덕션 빌드에서 17개 통과, 1.1분 |
| `npx playwright test --config playwright.crud.config.ts --workers=1 --output playwright-report/crud` | 전용 테스트 계정 CRUD 7개 통과, 21.6초 |
| 화면·상태 | 1440/390/320px × 밝음/어두움 촬영·확인, 계정 상태 조합은 1100px도 검사 |
| 접근성·회귀 | axe WCAG A/AA 위반 0, 키보드 초점·링크 이동, reduced-motion, 터치 hover 잔류 없음, 메뉴 반복 개폐·Escape·포커스 복원, 인사말 모드·메뉴 on/off·순서·프리셋 유지 |
| UI 오류 | 검사한 화면의 가로 넘침·콘솔 오류·주요 네트워크 오류 없음 |

첫 프로덕션 E2E에서 두 문제를 구분해 수정했다. 한국어 상단 표기의 기존 `Home` 기대값은 요청된 ‘홈’ 변경에 맞춰 `guest-smoke.spec.ts`의 level 1 제목 검사로 갱신했다. 별도로 CSS 최적화 후 개별 `translate` 초기화가 누락돼 reduced-motion에서 화살표가 이동하는 실제 회귀를 발견했다. 이동을 `transform`으로 통일한 뒤 다시 빌드하고 동일한 움직임 감소 검사를 통과했다. 기능 제거·검사 완화·시간 제한 증가는 하지 않았다.

추가 CRUD 첫 실행은 첫 일정 조회가 HTTP 401로 실패했고 나머지 6개는 통과했다. 실패는 테스트 데이터 생성 전이었다. 인증 코드·테스트·권한을 변경하지 않고 전체 7개를 재실행해 모두 통과했다. 최초 401의 원인은 확정하지 않았으며 외부 인증의 지속적 안정성을 보장하는 결과로 해석하지 않는다.

브라우저 검증은 Chromium 기준이며 Safari/Firefox와 실제 모바일 기기는 미검증이다. UI 테스트는 실제 게스트 인증을 사용하되 홈 계정 데이터·AI·날씨 응답은 격리된 대역을 사용한다. 실제 저장 회귀는 별도 전용 계정 CRUD로 확인했다. 인증·DB·API·설정 저장 코드와 다른 기능 페이지는 수정하지 않았다.

## 남은 범위와 다음 단계

- 기능 페이지(일정 추출의 원문/검토/저장 UI 포함), 설정 페이지 레이아웃, 인증, DB/RLS/API, 업무 계산/저장 로직을 개편하지 않았다.
- 전체 검색, 명령 팔레트, 홈 영역 pin, 문서 단위 최근 편집 이력은 다음 단계. 이번 방문의 최근 도구는 새로고침 시 비워지며 서버에 저장하지 않는다.
- 홈의 기존 DB helper 일부는 조회 오류를 빈 값으로 반환한다. 모든 부분 실패를 홈에서 구분하려면 별도 데이터 오류 계약 정리가 필요하다.
- AI 연결 배지는 기존 연결 요청의 결과이며 지속적인 서비스 가용성 보장이 아니다. E2E의 AI 응답과 날씨는 대역이므로 실제 추론 품질이나 외부 API 가용성을 검증하지 않는다.
- 신규 UI는 공통 토큰을 사용하지만 기존 기능 페이지의 하드코딩 색/스타일은 점진적 전환 대상이다.
- 새 디자인은 검토용 브랜치/PR로 전달한다. 병합·정식 배포·버전 태그는 이 작업에서 실행하지 않는다.
