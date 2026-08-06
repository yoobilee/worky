-- ============================================================
-- Worky — 게스트 체험 계정용 더미 데이터 시딩
-- 2026-08-06
-- 대상 계정: guest@worky-demo.com (auth.users.id = 681b2859-d377-460b-831d-f8fde5e34b72)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = '681b2859-d377-460b-831d-f8fde5e34b72'
  ) THEN
    RAISE EXCEPTION '게스트 계정(681b2859-d377-460b-831d-f8fde5e34b72)이 auth.users에 없습니다. 먼저 Supabase Auth에서 guest@worky-demo.com 계정을 생성하세요.';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 1. todos — 오늘 날짜, 완료 2개 + 미완료 2개
-- ──────────────────────────────────────────────────────────
INSERT INTO public.todos (user_id, date, todos)
VALUES (
  '681b2859-d377-460b-831d-f8fde5e34b72',
  CURRENT_DATE,
  jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text, 'text', '주간 업무 보고서 초안 작성',
      'completed', true, 'createdAt', floor(extract(epoch from now()) * 1000)
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text, 'text', '신규 거래처 미팅 자료 준비',
      'completed', true, 'createdAt', floor(extract(epoch from now()) * 1000)
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text, 'text', '팀장님께 결재 요청 드리기',
      'completed', false, 'createdAt', floor(extract(epoch from now()) * 1000)
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text, 'text', '오늘 회의록 정리해서 공유 드라이브에 업로드',
      'completed', false, 'createdAt', floor(extract(epoch from now()) * 1000)
    )
  )
)
ON CONFLICT (user_id, date) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 2. memos
-- ──────────────────────────────────────────────────────────
INSERT INTO public.memos (user_id, work_memo, meeting_memo, personal_memo)
VALUES (
  '681b2859-d377-460b-831d-f8fde5e34b72',
  '오전에 신규 거래처 계약서 검토 완료. 오후에는 주간 보고서 작성 예정. 김대리님께 결재 라인 확인 요청 드림.',
  '10:00 주간 팀 미팅 — 이번 분기 목표 진행 상황 공유, 다음 스프린트 우선순위 논의. 다음 회의는 다음주 월요일 같은 시간.',
  '점심시간에 사내 동호회 신청서 제출하기. 퇴근 전에 법인카드 영수증 정리해서 제출.'
)
ON CONFLICT (user_id) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 3. clients — 3개 거래처
-- ──────────────────────────────────────────────────────────
INSERT INTO public.clients (
  user_id, name, contact_person, phone, link, tags,
  contract_start, contract_period, memo, status,
  history, progress, show_grass_grid, custom_fields
)
SELECT
  '681b2859-d377-460b-831d-f8fde5e34b72',
  '(주)브라이트마케팅',
  '이수진 팀장',
  '010-1234-5678',
  'https://brightmarketing.example.com',
  '["마케팅", "월간계약"]'::jsonb,
  (CURRENT_DATE - INTERVAL '2 months')::date,
  '6개월',
  '월 1회 정기 리포트 발송, 담당자 응답 빠른 편',
  'inprogress',
  jsonb_build_array(
    jsonb_build_object('date', to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM-DD'), 'status', 'pending'),
    jsonb_build_object('date', to_char(CURRENT_DATE, 'YYYY-MM-DD'), 'status', 'inprogress')
  ),
  jsonb_build_object(
    to_char(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD'), 'done',
    to_char(CURRENT_DATE, 'YYYY-MM-DD'), 'done'
  ),
  true,
  jsonb_build_array(
    jsonb_build_object('key', '담당 부서', 'value', '마케팅1팀', 'masked', false)
  )
WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72');

INSERT INTO public.clients (
  user_id, name, contact_person, phone, link, tags,
  contract_start, contract_period, memo, status,
  history, progress, show_grass_grid, custom_fields
)
SELECT
  '681b2859-d377-460b-831d-f8fde5e34b72',
  '한빛물류(주)',
  '박정훈 대리',
  '010-9876-5432',
  '',
  '["물류", "신규문의"]'::jsonb,
  NULL,
  NULL,
  '견적 요청 후 검토 중, 다음주 초 회신 예정',
  'pending',
  jsonb_build_array(
    jsonb_build_object('date', to_char(CURRENT_DATE, 'YYYY-MM-DD'), 'status', 'pending')
  ),
  '{}'::jsonb,
  false,
  '[]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.clients WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72' AND name = '한빛물류(주)'
);

INSERT INTO public.clients (
  user_id, name, contact_person, phone, link, tags,
  contract_start, contract_period, memo, status,
  history, progress, show_grass_grid, custom_fields
)
SELECT
  '681b2859-d377-460b-831d-f8fde5e34b72',
  '스타에듀 교육센터',
  '최영은 실장',
  '010-2468-1357',
  'https://staredu.example.com',
  '["교육", "장기계약"]'::jsonb,
  (CURRENT_DATE - INTERVAL '8 months')::date,
  '12개월',
  '계약 종료, 재계약 여부는 다음 분기 논의 예정',
  'complete',
  jsonb_build_array(
    jsonb_build_object('date', to_char(CURRENT_DATE - INTERVAL '8 months', 'YYYY-MM-DD'), 'status', 'inprogress'),
    jsonb_build_object('date', to_char(CURRENT_DATE - INTERVAL '1 week', 'YYYY-MM-DD'), 'status', 'complete')
  ),
  '{}'::jsonb,
  false,
  jsonb_build_array(
    jsonb_build_object('key', '결제 방식', 'value', '분기 선결제', 'masked', false)
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.clients WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72' AND name = '스타에듀 교육센터'
);

-- ──────────────────────────────────────────────────────────
-- 4. calendar_events — 이번주~다음주 3개
-- ──────────────────────────────────────────────────────────
INSERT INTO public.calendar_events (user_id, title, date, time, location, description, location_url)
SELECT '681b2859-d377-460b-831d-f8fde5e34b72', '신입사원 OJT 마무리 미팅', CURRENT_DATE + 2, '14:00', '본사 3층 회의실', '온보딩 과정 마무리 및 피드백 공유', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.calendar_events WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72' AND title = '신입사원 OJT 마무리 미팅'
);

INSERT INTO public.calendar_events (user_id, title, date, time, location, description, location_url)
SELECT '681b2859-d377-460b-831d-f8fde5e34b72', '거래처 정기 미팅 — 브라이트마케팅', CURRENT_DATE + 5, '10:30', '온라인 (Zoom)', '월간 리포트 공유 및 다음달 캠페인 논의', 'https://zoom.us/j/example'
WHERE NOT EXISTS (
  SELECT 1 FROM public.calendar_events WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72' AND title = '거래처 정기 미팅 — 브라이트마케팅'
);

INSERT INTO public.calendar_events (user_id, title, date, time, location, description, location_url)
SELECT '681b2859-d377-460b-831d-f8fde5e34b72', '팀 워크숍', CURRENT_DATE + 9, '09:00', '세미나실 A', '분기 목표 설정 워크숍', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.calendar_events WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72' AND title = '팀 워크숍'
);

-- ──────────────────────────────────────────────────────────
-- 5. glossary — 업무 용어 4개
-- ──────────────────────────────────────────────────────────
INSERT INTO public.glossary (user_id, term, definition, category)
SELECT '681b2859-d377-460b-831d-f8fde5e34b72', '기안', '결재를 요청하기 위해 작성하는 문서', '사내문서'
WHERE NOT EXISTS (SELECT 1 FROM public.glossary WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72' AND term = '기안');

INSERT INTO public.glossary (user_id, term, definition, category)
SELECT '681b2859-d377-460b-831d-f8fde5e34b72', 'OJT', 'On-the-Job Training, 실무를 통해 배우는 현장 교육', '인사'
WHERE NOT EXISTS (SELECT 1 FROM public.glossary WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72' AND term = 'OJT');

INSERT INTO public.glossary (user_id, term, definition, category)
SELECT '681b2859-d377-460b-831d-f8fde5e34b72', 'RFP', 'Request for Proposal, 제안요청서', '영업'
WHERE NOT EXISTS (SELECT 1 FROM public.glossary WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72' AND term = 'RFP');

INSERT INTO public.glossary (user_id, term, definition, category)
SELECT '681b2859-d377-460b-831d-f8fde5e34b72', '캐리오버', '전날 완료하지 못한 할 일을 다음 날로 이월하는 것', '업무도구'
WHERE NOT EXISTS (SELECT 1 FROM public.glossary WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72' AND term = '캐리오버');

-- ──────────────────────────────────────────────────────────
-- 6. usage_stats — 이번 주 FeatureKey 사용 횟수
-- ──────────────────────────────────────────────────────────
INSERT INTO public.usage_stats (user_id, week_start, stats)
VALUES (
  '681b2859-d377-460b-831d-f8fde5e34b72',
  date_trunc('week', CURRENT_DATE)::date,
  '{"data": 6, "email": 4, "qa": 3, "template": 2, "schedule": 1}'::jsonb
)
ON CONFLICT (user_id, week_start) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 7. qa_histories — 신입사원이 물어볼 법한 Q&A 2개
-- ──────────────────────────────────────────────────────────
INSERT INTO public.qa_histories (user_id, title, messages)
SELECT
  '681b2859-d377-460b-831d-f8fde5e34b72',
  '연차 사용 관련 질문',
  jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid()::text, 'role', 'user', 'content', '연차는 입사 며칠차부터 사용할 수 있나요?'),
    jsonb_build_object('id', gen_random_uuid()::text, 'role', 'assistant', 'content', '회사 규정에 따라 다르지만 일반적으로 입사 후 1년 미만인 경우 매월 개근 시 1일씩 연차가 발생합니다. 정확한 기준은 사내 인사 규정이나 설정 페이지의 연차 설정을 확인해 주세요.')
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.qa_histories WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72' AND title = '연차 사용 관련 질문'
);

INSERT INTO public.qa_histories (user_id, title, messages)
SELECT
  '681b2859-d377-460b-831d-f8fde5e34b72',
  '보고서 작성법 문의',
  jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid()::text, 'role', 'user', 'content', '거래처 주간 보고서는 어떤 형식으로 작성하는 게 좋을까요?'),
    jsonb_build_object('id', gen_random_uuid()::text, 'role', 'assistant', 'content', '보통 진행 상황 요약, 이번 주 주요 이슈, 다음 주 계획 3단락으로 구성하면 담당자가 빠르게 파악하기 좋습니다. Worky의 데이터 정리/문서 작성 기능을 활용하면 초안을 자동으로 생성할 수 있어요.')
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.qa_histories WHERE user_id = '681b2859-d377-460b-831d-f8fde5e34b72' AND title = '보고서 작성법 문의'
);
