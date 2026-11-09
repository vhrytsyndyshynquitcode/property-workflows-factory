-- Зріз 3: вендор (AC-VENDOR-01…10). Підрядник отримує задачі запуску, бачить лише свої запуски й задачі
-- і позначає лише власні задачі. Нових таблиць і grants немає.

-- ── 1. Ролі: порядок — зняти check → default → новий check ──
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles alter column role set default 'manager';
alter table public.profiles
  add constraint profiles_role_check check (role in ('manager', 'admin', 'vendor'));

-- ── 2. Запуск: виконавцем може бути і вендор; запускає лише manager/admin (вендор → NOT_ALLOWED) ──
create or replace function private.launch_run(p_template_id uuid, p_case_name text, p_assignments jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text := (select private.current_app_role());
  v_case text := regexp_replace(coalesce(p_case_name, ''), '^[\s ﻿]+|[\s ﻿]+$', '', 'g');
  v_template_name text;
  v_version_id uuid;
  v_run_id uuid;
begin
  if v_uid is null or v_role is null or v_role not in ('manager', 'admin') then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if length(v_case) = 0 then
    raise exception 'CASE_NAME_EMPTY' using errcode = '22023';
  end if;
  if length(v_case) > 100 then
    raise exception 'CASE_NAME_TOO_LONG' using errcode = '22023';
  end if;

  select t.name, t.current_version_id into v_template_name, v_version_id
  from public.templates as t where t.id = p_template_id;
  if v_template_name is null or v_version_id is null then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each_text(coalesce(p_assignments, '{}'::jsonb)) as a(task_id, assignee_id)
    left join public.profiles as p on p.id = a.assignee_id::uuid
    where p.id is null or p.role not in ('manager', 'admin', 'vendor')
  ) then
    raise exception 'INVALID_ASSIGNEE' using errcode = '22023';
  end if;

  insert into public.runs (template_id, template_version_id, template_name, case_name, run_manager_id)
  values (p_template_id, v_version_id, v_template_name, v_case, v_uid)
  returning id into v_run_id;

  insert into public.run_tasks (run_id, section_name, name, is_required, position, assignee_id)
  select v_run_id, s.name, vt.name, vt.is_required,
         row_number() over (order by s.position, vt.position, vt.id),
         coalesce((p_assignments ->> vt.id::text)::uuid, v_uid)
  from public.version_tasks as vt
  join public.version_sections as s on s.id = vt.section_id
  where vt.version_id = v_version_id;

  return v_run_id;
end;
$$;
revoke execute on function private.launch_run(uuid, text, jsonb) from public, anon;
grant execute on function private.launch_run(uuid, text, jsonb) to authenticated;

-- ── 3. Вибір виконавця: manager, admin і vendor (лише id, email; для викликача manager/admin) ──
create or replace function private.list_assignable_users()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email
  from public.profiles as p
  where (select private.current_app_role()) in ('manager', 'admin')
    and p.role in ('manager', 'admin', 'vendor')
  order by p.email;
$$;
revoke execute on function private.list_assignable_users() from public, anon;
grant execute on function private.list_assignable_users() to authenticated;

-- ── 4. Видимість: вендор бачить лише власні задачі й їхні запуски; шаблонів і версій не бачить ──
drop policy run_tasks_select_visible on public.run_tasks;
create policy run_tasks_select_visible on public.run_tasks for select to authenticated
  using (
    case when (select private.current_app_role()) = 'vendor'
      then assignee_id = (select auth.uid())
      else private.can_see_run(run_id)
    end
  );

drop policy templates_select_admin_or_published on public.templates;
create policy templates_select_admin_or_published on public.templates for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or ((select private.current_app_role()) = 'manager' and current_version_id is not null)
  );

drop policy template_versions_select on public.template_versions;
create policy template_versions_select on public.template_versions for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or ((select private.current_app_role()) = 'manager'
        and (private.is_current_version(id) or private.is_version_of_visible_run(id)))
  );
drop policy version_sections_select on public.version_sections;
create policy version_sections_select on public.version_sections for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or ((select private.current_app_role()) = 'manager'
        and (private.is_current_version(version_id) or private.is_version_of_visible_run(version_id)))
  );
drop policy version_tasks_select on public.version_tasks;
create policy version_tasks_select on public.version_tasks for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or ((select private.current_app_role()) = 'manager'
        and (private.is_current_version(version_id) or private.is_version_of_visible_run(version_id)))
  );

-- mark_task_done не змінюємо: виконавець (у т.ч. вендор) позначає лише власну задачу; вендор ніколи не менеджер запуску.

-- ── 5. Остання обов'язкова задача запуску: рішення в базі, бо вендор бачить лише свої задачі ──
create or replace function private.is_last_required_task(p_task_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text := (select private.current_app_role());
  v_task public.run_tasks%rowtype;
  v_manager uuid;
begin
  select * into v_task from public.run_tasks where id = p_task_id;
  if v_task.id is null or v_uid is null then
    return false;
  end if;
  select run_manager_id into v_manager from public.runs where id = v_task.run_id;
  if not (v_role = 'admin' or v_task.assignee_id = v_uid or v_manager = v_uid) then
    return false;
  end if;
  if not v_task.is_required or v_task.status = 'done' then
    return false;
  end if;
  return not exists (
    select 1 from public.run_tasks
    where run_id = v_task.run_id and is_required and status <> 'done' and id <> p_task_id
  );
end;
$$;
revoke execute on function private.is_last_required_task(uuid) from public, anon;
grant execute on function private.is_last_required_task(uuid) to authenticated;

create or replace function public.is_last_required_task(p_task_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_last_required_task(p_task_id);
$$;
revoke execute on function public.is_last_required_task(uuid) from public, anon;
grant execute on function public.is_last_required_task(uuid) to authenticated;
