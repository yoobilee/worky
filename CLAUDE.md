# Worky — AI 업무 보조 도구

## 프로젝트 개요
신입사원(외국인 포함)을 위한 AI 기반 업무 보조 웹 앱.
Groq API(LLaMA 4 Scout)를 활용해 데이터 정리, 문서 작성, Q&A 등 18개 기능을 제공한다.
버전: v1.4.0 / 배포: https://worky-ai.vercel.app

## 기술 스택
- Framework: Next.js 15.3.9 (App Router), React 19
- Language: TypeScript
- Styling: Tailwind CSS 4
- AI: Groq API (meta-llama/llama-4-scout-17b-16e-instruct, 스트리밍 지원)
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

## 작업 규칙
- 작업 완료 후 항상 git add, commit, push까지 자동으로 해줘
- 커밋 메시지는 변경 내용을 한국어로 요약
- 새 버전 배포 시: CHANGELOG.md 갱신 → package.json version 갱신 → git tag vX.Y.Z → git push origin vX.Y.Z
