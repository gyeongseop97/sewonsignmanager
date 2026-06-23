create extension if not exists pgcrypto;

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  employee_no text not null unique,
  name text not null,
  department text not null,
  phone_number text not null,
  shift_type text not null default '주간 정취',
  employment_status text not null default '재직',
  hire_date date,
  resign_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists educations (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  education_type text not null,
  year text not null,
  period text not null,
  period_detail text not null,
  summary text,
  consent_text text,
  status text not null default '진행',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists education_sessions (
  id uuid primary key default gen_random_uuid(),
  education_id uuid not null references educations(id) on delete cascade,
  session_no text not null,
  session_name text,
  education_date date not null,
  start_time time,
  end_time time,
  location text,
  target_shift text default '선택대상',
  status text not null default '서명가능',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (education_id, session_no)
);

create table if not exists education_targets (
  id uuid primary key default gen_random_uuid(),
  education_id uuid not null references educations(id) on delete cascade,
  session_id uuid not null references education_sessions(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  target_status text not null default '대상',
  created_at timestamptz not null default now(),
  unique (session_id, employee_id)
);

create table if not exists education_signatures (
  id uuid primary key default gen_random_uuid(),
  education_id uuid not null references educations(id) on delete cascade,
  session_id uuid not null references education_sessions(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  consent_checked boolean not null default true,
  signature_file_key text not null,
  signature_image_url text,
  signed_at timestamptz not null default now(),
  ip_address text,
  device_info text,
  created_at timestamptz not null default now(),
  unique (education_id, employee_id)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  actor_type text,
  actor_id text,
  target_table text,
  target_id text,
  detail jsonb,
  ip_address text,
  device_info text,
  created_at timestamptz not null default now()
);

create index if not exists idx_employees_employee_no on employees(employee_no);
create index if not exists idx_employees_name on employees(name);
create index if not exists idx_sessions_education_id on education_sessions(education_id);
create index if not exists idx_targets_session_id on education_targets(session_id);
create index if not exists idx_targets_employee_id on education_targets(employee_id);
create index if not exists idx_signatures_education_id on education_signatures(education_id);
create index if not exists idx_signatures_session_id on education_signatures(session_id);
create index if not exists idx_signatures_employee_id on education_signatures(employee_id);



create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null unique,
  name text,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_users_auth_user_id on admin_users(auth_user_id);
create index if not exists idx_admin_users_email on admin_users(email);

