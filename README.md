# Worky — AI 업무 보조 도구

신입 사무직 직장인을 위한 AI 기반 업무 보조 웹 앱입니다.  
반복적인 업무 문서 작성, 일정 정리, 거래처 관리 등을 AI가 빠르게 처리해 드립니다.

**배포 URL**: [https://worky-ai.vercel.app](https://worky-ai.vercel.app)

---

## 기술 스택

**Frontend**  
![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

**AI**  
![Groq](https://img.shields.io/badge/Groq_API-F55036?style=flat-square&logo=groq&logoColor=white)
![LLaMA](https://img.shields.io/badge/LLaMA_4_Scout-7C3AED?style=flat-square&logoColor=white)

**인증 / DB**  
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google_OAuth-4285F4?style=flat-square&logo=google&logoColor=white)
![Gmail API](https://img.shields.io/badge/Gmail_API-EA4335?style=flat-square&logo=gmail&logoColor=white)

**배포**  
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

---

## 주요 기능

### 홈
오늘의 업무 현황을 한눈에 확인합니다. 실시간 날씨, 사용 통계, 할 일 요약을 제공합니다.  
플로팅 바로가기 버튼으로 자주 쓰는 외부 사이트에 빠르게 접근할 수 있습니다.  
기본 제공 링크(Claude, ChatGPT, Gemini, 구글, 노션, Gmail, 네이버, Google Drive) 외에 커스텀 바로가기를 직접 추가할 수 있으며, 유명 사이트는 브랜드 아이콘이 자동으로 적용됩니다.

### 할 일 / 메모
날짜별 할 일 관리와 자유 메모를 지원합니다. 미완료 항목은 다음 날로 자동 이월됩니다.

### Q&A
업무 관련 질문을 AI에게 자유롭게 물어볼 수 있습니다.

### 이메일 작성
- **새 이메일 작성**: 핵심 내용만 입력하면 AI가 맞춤법·표현을 다듬어 완성도 높은 이메일을 생성합니다.
- **답장 작성**: 받은 이메일을 붙여넣으면 AI가 톤에 맞는 답장 초안을 생성합니다.
- Gmail API 연동으로 앱에서 직접 이메일 전송이 가능합니다.

### 메시지 작성
완료한 작업 내용을 입력하면 AI가 보고 메시지 또는 인스타그램 게시글을 생성합니다.

### 템플릿 생성
업무보고서, 회의록, 기획안, 공문서 등 업무 문서를 AI가 즉시 작성합니다.

### 번역·다듬기
텍스트를 원하는 언어로 번역하거나 비즈니스 톤으로 다듬어 드립니다.

### 문서 요약
텍스트를 붙여넣으면 AI가 핵심 내용을 요약합니다.

### 데이터 정리
지저분한 텍스트 데이터를 AI가 분석해 정형화된 표로 변환합니다. CSV 다운로드를 지원합니다.

### 일정 추출
이메일·공지·메시지에서 일정 정보를 자동으로 추출해 정리합니다.  
"다음주 화요일", "다음달 첫째 주 월요일" 같은 상대적 날짜도 실제 날짜로 변환합니다.

### 일정 관리
월별 캘린더로 일정을 등록하고 관리합니다. 한국 공휴일 및 대체공휴일이 표시됩니다.

### 데이터 분석
숫자 데이터를 붙여넣으면 AI가 핵심 수치와 트렌드를 분석합니다.

### 용어집
사내 용어를 등록하고 AI로 뜻을 설명받을 수 있습니다.

### 거래처 관리
거래처별 보고 현황, 담당자 정보, 계약 기간을 관리합니다.  
진행 중인 거래처는 GitHub 스타일 잔디밭 그리드로 일별 진행 현황을 시각화합니다.

### 공문서 작성
품의서, 공문, 지출결의서, 업무협조 요청서를 AI가 즉시 작성합니다.

### 피드백 정리
클라이언트 피드백을 붙여넣으면 AI가 수정사항으로 정리합니다.

### 설정
내 정보, 다크모드, 사이드바 메뉴 표시 항목, 직업군별 프리셋 등 앱 환경을 설정합니다.

---

## 로컬 실행 방법

```bash
# 1. 저장소 클론
git clone https://github.com/yoobilee/worky.git
cd worky

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cp .env.example .env.local
# .env.local에 필요한 값 입력

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

---

## 환경변수

`.env.local` 파일에 아래 변수를 설정하세요.

```env
GROQ_API_KEY=your_groq_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

- Groq API 키: [https://console.groq.com](https://console.groq.com)
- Supabase: [https://supabase.com](https://supabase.com)

> API 키는 서버 사이드(`/api/groq`)에서만 사용되며 클라이언트에 노출되지 않습니다.

---

## 라이선스

Copyright © 2026 yoobilee. All Rights Reserved.