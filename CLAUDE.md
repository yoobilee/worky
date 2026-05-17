# Worky — AI 업무 보조 도구

## 프로젝트 개요
신입사원을 위한 AI 기반 업무 보조 웹 앱.
Groq API(LLaMA 모델)를 활용해 데이터 정리, 템플릿 생성, Q&A 기능을 제공한다.

## 기술 스택
- Framework: Next.js 14+ (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- AI: Groq API (llama-3.3-70b-versatile 모델)
- 배포: Vercel

## 환경 변수
- GROQ_API_KEY: Groq API 키 (.env.local에 저장, 절대 클라이언트에 노출 금지)

## 프로젝트 구조
src/
  app/
    api/
      groq/route.ts       # Groq API Route (서버 전용)
    page.tsx              # 메인 페이지
    layout.tsx
  components/
    Sidebar.tsx
    DataCleaner.tsx       # 데이터 정리 탭
    TodoMemo.tsx          # 할 일/메모 탭
    TemplateGen.tsx       # 템플릿 생성 탭
    QnA.tsx               # Q&A 탭

## 디자인 원칙
- 2026 트렌드: Bento Grid 레이아웃, Calm UI
- 포인트 컬러: 인디고 바이올렛 (#6C63FF)
- 가독성과 시인성 최우선
- 다크모드 지원

## 기능 명세

### 1. 데이터 정리
- 사용자가 지저분한 텍스트/데이터를 붙여넣음
- Groq API가 분석해서 HTML 표로 변환
- CSV 다운로드, 클립보드 복사 지원

### 2. 할 일 / 메모
- 할 일 추가/완료/삭제
- 진행률 표시 (Bento 통계 카드)
- 메모 자유 입력 (localStorage 저장)

### 3. 템플릿 생성
- 유형 선택: 업무보고서 / 이메일 / 회의록 / 기획안
- 세부 내용 입력 후 Groq API가 완성된 문서 생성
- 결과 복사/다운로드

### 4. Q&A
- 채팅 형식 UI
- Groq API가 신입사원 업무 맥락으로 답변
- 대화 히스토리 유지

## 코딩 컨벤션
- 컴포넌트: 함수형, TypeScript interface로 props 정의
- API 호출은 반드시 서버 사이드(api/groq/route.ts)를 통할 것
- 에러 처리 필수 (로딩 상태, 에러 메시지 UI 포함)
- 한국어 UI 텍스트 사용
