-- setup.sql – Supabase 표 wx_tasks 만들기 (SQL Editor 에 붙여 넣고 Run)
-- 가상 데이터만 넣는다. 여러 번 실행해도 안전하다.

create table if not exists public.wx_tasks (
  id         bigint generated always as identity primary key,
  title      text not null,
  region     text not null,
  kind       text not null,
  owner      text not null,
  created_at timestamptz not null default now(),

  -- 규칙은 DB 에서도 막는다 (화면을 거치지 않은 요청도 걸러짐)
  constraint wx_tasks_region_chk check (region in ('세종', '대전', '태안', '보령')),
  constraint wx_tasks_kind_chk   check (kind in ('야외', '고소', '실내')),
  constraint wx_tasks_title_chk  check (char_length(btrim(title)) between 1 and 50),
  constraint wx_tasks_owner_chk  check (char_length(btrim(owner)) between 1 and 20)
);

-- 공개용(anon) 키로는 읽기 · 추가만 허용. 수정 · 삭제는 막는다.
alter table public.wx_tasks enable row level security;

revoke update, delete on public.wx_tasks from anon, authenticated;
grant select, insert on public.wx_tasks to anon, authenticated;

drop policy if exists wx_tasks_read   on public.wx_tasks;
drop policy if exists wx_tasks_insert on public.wx_tasks;

create policy wx_tasks_read   on public.wx_tasks for select to anon, authenticated using (true);
create policy wx_tasks_insert on public.wx_tasks for insert to anon, authenticated with check (true);

-- 처음 보이는 가상 일정 6건 (표가 비어 있을 때만)
insert into public.wx_tasks (title, region, kind, owner)
select * from (values
  ('다중이용시설 안전점검', '세종', '야외', '김안전'),
  ('시민 안전체험 행사 운영', '보령', '야외', '이행사'),
  ('옥상 태양광 설비 점검', '태안', '고소', '박설비'),
  ('하천 수위계 확인', '대전', '야외', '최현장'),
  ('청사 외벽 간판 보수', '세종', '고소', '정시설'),
  ('비상연락 훈련', '대전', '실내', '한상황')
) as v(title, region, kind, owner)
where not exists (select 1 from public.wx_tasks);
