# Worky — AI 업무 보조 도구

## 프로젝트 개요
신입사원(외국인 포함)을 위한 AI 기반 업무 보조 웹 앱.
Groq API(gpt-oss-120b)를 활용해 데이터 정리, 문서 작성, Q&A 등 18개 기능을 제공한다.
버전: v1.5.0 / 배포: https://worky-ai.vercel.app

## 기초 원칙 (모든 작업의 최우선 기준)
아래 6가지는 순서와 무관하게 항상 함께 고려하며, 서로 충돌할 경우 안정성 > 보안성을 우선한다.
- **시인성**: 상태/정보가 화면에서 명확히 눈에 띄어야 함 (대비, 배지, 여백, 색상 활용)
- **가독성**: 코드와 UI 텍스트 모두 한눈에 이해되도록 작성
- **일관성**: 기존 컴포넌트/패턴/네이밍을 재사용, 새 스타일 도입 시 기존 톤에 맞출 것
- **확장성**: 기능이 늘어나도 재사용 가능한 구조로 설계 (공통 컴포넌트/유틸리티 우선)
- **안정성**: 기존 기능의 회귀를 막는 것이 최우선, 변경 범위는 항상 최소화
- **보안성**: 인증/권한 체크 누락 여부를 항상 검증, 민감정보(API 키 등) 노출 금지

## 기술 스택
- Framework: Next.js 15.3.9 (App Router), React 19
- Language: TypeScript
- Styling: Tailwind CSS 4
- AI: Groq API (openai/gpt-oss-120b, 스트리밍 지원)
- DB/Auth: Supabase (Google OAuth, PKCE)
- 배포: Vercel

## 환경 변수
- GROQ_API_KEY, KAKAO_REST_API_KEY: 서버 전용, 절대 클라이언트 노출 금지
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_KAKAO_MAP_KEY

## 인증
- src/middleware.ts에서 서버 사이드 인증 가드 (/login, /auth/callback, /api/** 제외 전부 보호)
- /api/groq, /api/kakao-places는 라우트 내부에서도 supabase.auth.getUser()로 재확인

## 프로젝트 구조
src/
  app/            # 대부분 컴포넌트를 감싸는 얕은 wrapper (예: data/page.tsx → <DataCleaner />)
                  # page.tsx(홈), settings/page.tsx, login/page.tsx는 로직 직접 포함
  components/     # 실제 페이지 로직 대부분 위치 (DataCleaner, TemplateGen, QnA, ClientManager 등 29개)
  lib/
    i18n/         # LocaleContext.tsx, translations.ts (ko/en) — useLocale() 훅으로 사용
    db/           # Supabase 테이블별 CRUD 함수
    menuSettings.ts, notifications.ts, holidays.ts, leave.ts 등
  middleware.ts

## 디자인 원칙 (2026 리뉴얼 반영)
- AI 네이티브 미니멀리즘 — 정보 나열보다 AI 요약 + 다음 행동 제안 우선
- 포인트 컬러: 배경/버튼 #6C63FF, 텍스트는 라이트 #4D44CC / 다크 #8B85FF
- AI 입력 폼: 라벨 대신 placeholder, 옵션 선택은 pill 칩, 입력+옵션+버튼 통합 카드로 구성
- 탭: 화면 전환용은 밑줄(border-b-2) 스타일, 짧은 세그먼트 전환(할일/메모 등)은 배경 채우기 유지
- 마이크로 애니메이션: card-hover, animate-result-in, tab-underline, btn-press (globals.css 유틸리티)
- 다크모드 지원, Tabler Icons만 사용 (인라인 SVG 지양 — 좌표 오류로 아이콘 깨진 전례 있음)
- 글래스모피즘은 시도 후 롤백됨 (Worky 단색 배경과 안 어울림) — 재도입 지양

## 다국어 지원
- 한국어(기본)/영어, useLocale() 훅의 t('키')/tFormat(t('키'), {변수}) 사용
- 새 UI 텍스트 작성 시 하드코딩 금지, translations.ts에 ko/en 키 추가 후 사용
- user_settings.language 컬럼에 저장

## 코딩 컨벤션
- 컴포넌트: 함수형, TypeScript interface로 props 정의
- API 호출은 반드시 서버 사이드(api/groq/route.ts 등)를 통할 것, 인증 체크 포함
- 에러 처리 필수 (로딩 상태, 에러 메시지 UI + role="alert" 포함)
- 모달/오버레이는 createPortal로 document.body에 직접 렌더링 (스크롤 컨테이너 안에 두면
  position: fixed 기준점이 어긋나는 문제 있었음)
- Supabase 스키마 변경은 항상 사용자가 SQL Editor에서 직접 실행 (자동 마이그레이션 금지)
- 한국어 UI 기본, 새 텍스트는 다국어 키로 작성
- auth.users(id)를 참조하는 외래키는 기본적으로 ON DELETE CASCADE 사용 (저장소 전체 컨벤션, 계정 삭제 시 관련 데이터도 함께 정리). 단, 감사 로그·청구 기록처럼 계정 삭제 후에도 보존이 필요한 테이블은 예외로 두고 설계 시 별도 판단할 것
- API 키/PAT 등 민감정보는 저장은 하되, 조회 API 응답·서버 로그·에러 메시지 어디에도 원문을 포함하지 말 것 - "연결됨/안 됨" 같은 상태(boolean)만 반환하는 쓰기 전용(write-only) 원칙을 전 구간에 적용

## 작업 규칙
- 작업 완료 후: 새 브랜치(feature/설명 또는 fix/설명)를 만들어 commit+push, 
  PR을 오픈한다 (master에 직접 push 금지)
- PR이 열리면 빌드 체크(GitHub Actions)와 Codex(chatgpt-codex-connector) 리뷰가 자동 실행됨
- PR 생성 직후에는 항상 `gh pr comment <PR번호> --body "@codex review"`로
  Codex 리뷰를 명시적으로 트리거한다. Automatic review는 draft→ready 전환이나
  PR 최초 open 시점에만 걸리고, 이미 ready 상태로 바로 생성된 PR에는 안 걸릴
  수 있음(PR #51에서 실측 확인됨) - 자동 트리거에 의존하지 않는다
- Codex 리뷰 후 Claude Code 에이전트(GitHub Actions)가 자동 처리:
  안전하게 고칠 수 있으면 자동 수정 후 빌드 통과 시 merge, 판단이 필요하면 
  merge 보류하고 Slack(#worky-검증-특이사항)으로 알림
- 하나의 PR에서 Codex 재리뷰가 2~3회를 넘어가며 계속 새로운 지적사항이
  나오면(특히 매번 다른 종류가 아니라 직전 수정과 상호작용해서 생기는
  후속 버그인 경우), 그 PR을 무한정 키우지 말고 일단 현재까지의 안전한
  개선 상태로 merge하고, 남은 지적사항은 별도 Issue로 남겨 다음 PR에서
  처음부터 차분히 다루는 방향으로 전환한다. 계속 같은 파일에서 파생되는
  버그가 나올 때는 근본적인 재설계가 필요하다는 신호일 수 있으므로, 그
  경우 재설계 자체를 별도 작업으로 분리한다
- 리뷰 봇이 "리뷰를 실행하지 않았다/스킵했다"는 취지의 안내만 남긴 경우는
  절대 "지적사항 없음"으로 해석하지 않고 항상 사람 확인 필요로 처리 (실제
  코드 검증 없이 자동 merge된 사고가 있었음 - claude-review-response.yml의
  is_review_skipped 감지 로직 및 review-timeout-watchdog.yml 참고)
- .github/workflows/ 파일에 대한 Codex 지적은 자동 수정 대상에서 
  제외, 항상 Slack(#worky-검증-특이사항)으로 사람 판단 요청
- CLAUDE.md를 수정하는 PR에서는 claude-code-action의 프롬프트 인젝션
  방지 기능이 CLAUDE.md를 origin/master 버전으로 되돌려쓰면서 git
  status가 dirty로 잡혀 "자기 보고와 실제 git 상태 불일치" 알림이
  발생할 수 있음 - 알려진 오탐(fail-closed가 의도대로 작동한 것이므로
  안전하지만, 원인이 코드 문제가 아님을 인지하고 확인만 하면 됨)
- 자동화 스크립트(GitHub Actions 등)의 조건 판단은 fail-closed 원칙 적용 - 
  값이 비어있거나 예상과 다르거나 처리 자체가 실패하면 항상 안전한 쪽 
  (사람 확인 필요)으로 처리, jq의 `// 기본값`처럼 실패해도 조용히 
  통과되는 fail-open 패턴 금지
- Slack 알림 전송 자체가 실패한 경우에도 자동 merge를 진행하지 않고 
  fail-closed로 처리 (알림 실패를 "문제없음"으로 오인하지 말 것)
- merge가 일어나면 항상 #worky-activity에 요약 알림, 발견된 결함은 
  #worky-issues에 기록
- 커밋 메시지는 변경 내용을 한국어로 요약
- 새 버전 배포 시: CHANGELOG.md 갱신 → PATCH_NOTES.md 갱신 (사용자 체감
  변경사항만, CHANGELOG와 별도) → package.json version 갱신 → 
  git tag vX.Y.Z → git push origin vX.Y.Z (master에 merge된 이후 진행)
