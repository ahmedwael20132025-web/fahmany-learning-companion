-- ============= فهمني — المخطط الكامل للمرحلة الأولى =============

-- 1) أدوار المستخدمين (جدول منفصل لأسباب أمنية)
create type public.app_role as enum ('admin', 'student');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- 2) الملفات الشخصية
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  display_name text,
  grade_id uuid,
  points integer not null default 0,
  profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) الصفوف الدراسية
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (stage in ('ابتدائي','إعدادي','ثانوي')),
  level integer not null unique,
  name text not null,
  emoji text not null default '📘',
  sort_order integer not null
);

-- 4) المواد
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grades(id) on delete cascade,
  name text not null,
  emoji text not null default '📗',
  color_key text not null default 'primary',
  sort_order integer not null default 0,
  unique (grade_id, name)
);

-- 5) الوحدات والدروس
create table public.units (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  title text not null,
  summary text,
  content text,
  video_url text,
  is_sample boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 6) مصادر التعلم
create table public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  type text not null check (type in ('ملخص','كراسة','فيديو','نشاط')),
  title text not null,
  url text,
  content text,
  sort_order integer not null default 0
);

-- 7) بنك الأسئلة
create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  type text not null check (type in ('اختيار من متعدد','صح وخطأ','أكمل')),
  question text not null,
  options jsonb,
  correct_answer text not null,
  explanation text,
  difficulty integer not null default 1 check (difficulty between 1 and 3),
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

-- 8) محاولات الاختبار
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  score integer not null,
  total integer not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- 9) تقدم الطالب
create table public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  status text not null default 'لم يبدأ' check (status in ('لم يبدأ','قيد الدراسة','أكمله')),
  last_activity_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

-- 10) خطط المذاكرة
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  plan_data jsonb not null default '{}'::jsonb,
  week_start date,
  created_at timestamptz not null default now()
);

-- 11) الإنجازات
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  title text not null,
  description text not null,
  emoji text not null default '🏆',
  condition_key text not null
);

create table public.student_achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (student_id, achievement_id)
);

-- 12) محادثات المدرس الذكي
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null default 'محادثة جديدة',
  created_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('student','teacher')),
  content text not null,
  created_at timestamptz not null default now()
);

-- 13) الإشعارات
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 14) سجل التدقيق (للمسؤول فقط)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- 15) أكواد التحقق (الخادم فقط — بلا أي صلاحية للعملاء)
create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_otp_codes_phone on public.otp_codes(phone, created_at desc);
create index idx_otp_codes_expiry on public.otp_codes(expires_at);

-- ============= الصلاحيات (GRANT) =============
grant select, update on public.profiles to authenticated;
grant all on public.user_roles to service_role;
grant select on public.user_roles to authenticated;
grant select on public.grades to anon, authenticated;
grant select on public.subjects to anon, authenticated;
grant select on public.units to anon, authenticated;
grant select on public.lessons to anon, authenticated;
grant select on public.learning_resources to anon, authenticated;
grant select on public.question_bank to anon, authenticated;
grant select, insert on public.quiz_attempts to authenticated;
grant select, insert, update on public.student_progress to authenticated;
grant select, insert on public.study_plans to authenticated;
grant select on public.achievements to anon, authenticated;
grant select, insert on public.student_achievements to authenticated;
grant select, insert on public.ai_conversations to authenticated;
grant select, insert on public.ai_messages to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.audit_logs to authenticated;
grant all on public.otp_codes to service_role;

-- ============= حماية الصفوف (RLS) =============
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.grades enable row level security;
alter table public.subjects enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.learning_resources enable row level security;
alter table public.question_bank enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.student_progress enable row level security;
alter table public.study_plans enable row level security;
alter table public.achievements enable row level security;
alter table public.student_achievements enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.otp_codes enable row level security;

-- الملف الشخصي: المستخدم يقرأ ويعدّل ملفه فقط
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid());

-- الأدوار: المستخدم يرى أدواره فقط
create policy "user_roles_select_own" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- المحتوى العام (الصفوف والمواد والدروس): قراءة للجميع
create policy "grades_read_all" on public.grades for select to anon, authenticated using (true);
create policy "subjects_read_all" on public.subjects for select to anon, authenticated using (true);
create policy "units_read_all" on public.units for select to anon, authenticated using (true);
create policy "lessons_read_all" on public.lessons for select to anon, authenticated using (true);
create policy "resources_read_all" on public.learning_resources for select to anon, authenticated using (true);
create policy "questions_read_all" on public.question_bank for select to anon, authenticated using (true);
create policy "achievements_read_all" on public.achievements for select to anon, authenticated using (true);

-- بيانات الطالب: صاحبها فقط
create policy "quiz_attempts_own" on public.quiz_attempts for select to authenticated using (student_id = auth.uid());
create policy "quiz_attempts_insert_own" on public.quiz_attempts for insert to authenticated with check (student_id = auth.uid());
create policy "progress_own" on public.student_progress for select to authenticated using (student_id = auth.uid());
create policy "progress_insert_own" on public.student_progress for insert to authenticated with check (student_id = auth.uid());
create policy "progress_update_own" on public.student_progress for update to authenticated using (student_id = auth.uid());
create policy "study_plans_own" on public.study_plans for select to authenticated using (student_id = auth.uid());
create policy "study_plans_insert_own" on public.study_plans for insert to authenticated with check (student_id = auth.uid());
create policy "student_ach_own" on public.student_achievements for select to authenticated using (student_id = auth.uid());
create policy "student_ach_insert_own" on public.student_achievements for insert to authenticated with check (student_id = auth.uid());
create policy "conversations_own" on public.ai_conversations for select to authenticated using (student_id = auth.uid());
create policy "conversations_insert_own" on public.ai_conversations for insert to authenticated with check (student_id = auth.uid());
create policy "messages_own_select" on public.ai_messages for select to authenticated using (
  exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.student_id = auth.uid())
);
create policy "messages_own_insert" on public.ai_messages for insert to authenticated with check (
  exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.student_id = auth.uid())
);
create policy "notifications_own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update to authenticated using (user_id = auth.uid());

-- سجل التدقيق: للمسؤول فقط
create policy "audit_admin_read" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ============= إنشاء الملف الشخصي تلقائيًا عند أول تسجيل =============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, coalesce(new.phone, ''))
  on conflict (id) do nothing;

  -- أول تسجيل برقم مسؤول النظام يصبح admin
  if new.phone = '+201070130082' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============= بيانات تجريبية واضحة العلامة =============
insert into public.grades (stage, level, name, emoji, sort_order) values
('ابتدائي', 1, 'الصف الأول الابتدائي', '🌱', 1),
('ابتدائي', 2, 'الصف الثاني الابتدائي', '🌿', 2),
('ابتدائي', 3, 'الصف الثالث الابتدائي', '📗', 3),
('ابتدائي', 4, 'الصف الرابع الابتدائي', '📘', 4),
('ابتدائي', 5, 'الصف الخامس الابتدائي', '📙', 5),
('ابتدائي', 6, 'الصف السادس الابتدائي', '🎓', 6),
('إعدادي', 7, 'الصف الأول الإعدادي', '🚀', 7),
('إعدادي', 8, 'الصف الثاني الإعدادي', '⚡', 8),
('إعدادي', 9, 'الصف الثالث الإعدادي', '🌟', 9),
('ثانوي', 10, 'الصف الأول الثانوي', '🏔️', 10),
('ثانوي', 11, 'الصف الثاني الثانوي', '🏔️', 11),
('ثانوي', 12, 'الصف الثالث الثانوي', '🏁', 12);

insert into public.subjects (grade_id, name, emoji, color_key, sort_order)
select g.id, s.name, s.emoji, s.color_key, s.sort_order
from public.grades g
cross join (values
  ('اللغة العربية', '📕', 'primary', 1),
  ('الرياضيات', '➗', 'sun', 2),
  ('العلوم', '🔬', 'mint', 3),
  ('اللغة الإنجليزية', '🔤', 'grape', 4),
  ('الدراسات الاجتماعية', '🗺️', 'primary', 5),
  ('التربية الإسلامية', '🕌', 'mint', 6)
) as s(name, emoji, color_key, sort_order)
where g.level in (4, 6);

insert into public.units (subject_id, name, description, sort_order)
select sub.id, 'وحدة القياس', 'وحدة تجريبية عن القياس والأدوات', 1
from public.subjects sub
where sub.name = 'العلوم' and sub.grade_id = (select id from public.grades where level = 4)
union all
select sub.id, 'وحدة الكسور', 'وحدة تجريبية عن الكسور وطرحها', 1
from public.subjects sub
where sub.name = 'الرياضيات' and sub.grade_id = (select id from public.grades where level = 4);

insert into public.lessons (unit_id, title, summary, content, is_sample, sort_order)
select u.id, 'أدوات القياس',
'درس تجريبي: نتعرف على أدوات قياس الطول والكتلة والزمن.',
'في هذا الدرس التجريبي نتعرف على أدوات القياس: المسطرة لقياس الطول، والميزان لقياس الكتلة، وساعة الإيقاف لقياس الزمن. الوحدات الأساسية للطول هي المتر، وللكتلة الكيلوجرام، وللزمن الثانية.',
true, 1
from public.units u where u.name = 'وحدة القياس'
union all
select u.id, 'ما هي الكسور؟',
'درس تجريبي: الكسور هي أجزاء من وحدة كاملة.',
'في هذا الدرس التجريبي نتعرف على الكسور: الكسر عبارة عن جزء من وحدة كاملة. النصف يعني جزء من اثنين، والربع يعني جزء من أربعة. جمع الكسور المتشابهة نجمع البسط ونبقي المقام.',
true, 1
from public.units u where u.name = 'وحدة الكسور';

insert into public.question_bank (lesson_id, type, question, options, correct_answer, explanation, difficulty, is_sample)
select l.id, 'اختيار من متعدد', 'بأي أداة نقيس طول الطاولة؟ (بيانات تجريبية)',
'["المسطرة","الميزان","ساعة الإيقاف","الكوب"]'::jsonb, 'المسطرة',
'المسطرة أداة لقياس الطول بوحدة المتر أو السنتيمتر.', 1, true
from public.lessons l where l.title = 'أدوات القياس'
union all
select l.id, 'صح وخطأ', 'الكيلوجرام وحدة لقياس الكتلة. (بيانات تجريبية)',
null, 'صح', 'نعم، الكيلوجرام وحدة قياس الكتلة.', 1, true
from public.lessons l where l.title = 'أدوات القياس'
union all
select l.id, 'اختيار من متعدد', 'نصف البرتقالة تعني جزء من...؟ (بيانات تجريبية)',
'["اثنين","ثلاثة","أربعة","خمسة"]'::jsonb, 'اثنين',
'النصف يعني جزء واحد من اثنين.', 1, true
from public.lessons l where l.title = 'ما هي الكسور؟';

insert into public.learning_resources (lesson_id, type, title, content, sort_order)
select l.id, 'ملخص', 'ملخص الدرس التجريبي (أدوات القياس)',
'• المسطرة تقيس الطول\n• الميزان يقيس الكتلة\n• ساعة الإيقاف تقيس الزمن', 1
from public.lessons l where l.title = 'أدوات القياس'
union all
select l.id, 'ملخص', 'ملخص الدرس التجريبي (الكسور)',
'• الكسر جزء من وحدة كاملة\n• النصف = جزء من 2\n• الربع = جزء من 4', 1
from public.lessons l where l.title = 'ما هي الكسور؟';

insert into public.achievements (key, title, description, emoji, condition_key) values
('first_login', 'بداية موفقة', 'أول تسجيل دخول ناجح', '🎉', 'first_login'),
('first_quiz', 'أول اختبار', 'أكملت أول اختبار', '✏️', 'first_quiz'),
('quiz_star', 'نجم الاختبارات', 'أكملت 5 اختبارات', '🌟', 'quiz_count_5'),
('perfect_score', 'الدرج النهائي', 'حصلت على درجة كاملة في اختبار', '💯', 'perfect_score');

comment on table public.lessons is 'الدروس — الدروس المعلّمة بـ is_sample=true هي بيانات تجريبية وليست محتوى وزاريًا رسميًا';