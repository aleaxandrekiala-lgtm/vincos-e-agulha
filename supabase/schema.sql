create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  access_code text unique not null,
  password_hash text not null,
  role text not null check (role in ('gerente','funcionario')),
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists production_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  client_name text not null,
  user_id uuid references app_users(id),
  user_name text not null,
  user_code text not null,
  pieces integer not null check (pieces > 0),
  notes text,
  created_at timestamptz not null default now()
);

insert into app_users (name, access_code, password_hash, role, active, must_change_password)
values ('Gerente Principal', 'GER001', crypt('123456', gen_salt('bf')), 'gerente', true, false)
on conflict (access_code) do nothing;

insert into clients (name, active)
values ('Cliente Exemplo', true)
on conflict do nothing;

create or replace function login_user(p_code text, p_password text)
returns table (
  id uuid,
  name text,
  access_code text,
  role text,
  active boolean,
  must_change_password boolean
)
language sql
security definer
as $$
  select u.id, u.name, u.access_code, u.role, u.active, u.must_change_password
  from app_users u
  where upper(u.access_code) = upper(p_code)
    and u.password_hash = crypt(p_password, u.password_hash)
    and u.active = true;
$$;

create or replace function change_password(p_user_id uuid, p_new_password text)
returns boolean
language plpgsql
security definer
as $$
begin
  if length(p_new_password) < 4 then
    raise exception 'A senha deve ter pelo menos 4 caracteres';
  end if;

  update app_users
  set password_hash = crypt(p_new_password, gen_salt('bf')),
      must_change_password = false
  where id = p_user_id;

  return true;
end;
$$;

create or replace function create_app_user(
  p_manager_id uuid,
  p_name text,
  p_code text,
  p_temp_password text,
  p_role text
)
returns uuid
language plpgsql
security definer
as $$
declare
  manager_role text;
  new_id uuid;
begin
  select role into manager_role from app_users where id = p_manager_id and active = true;

  if manager_role <> 'gerente' then
    raise exception 'Apenas gerente pode criar funcionários';
  end if;

  if length(p_temp_password) < 4 then
    raise exception 'A senha inicial deve ter pelo menos 4 caracteres';
  end if;

  insert into app_users (name, access_code, password_hash, role, active, must_change_password)
  values (p_name, upper(p_code), crypt(p_temp_password, gen_salt('bf')), p_role, true, true)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function reset_user_password(
  p_manager_id uuid,
  p_user_id uuid,
  p_temp_password text
)
returns boolean
language plpgsql
security definer
as $$
declare
  manager_role text;
begin
  select role into manager_role from app_users where id = p_manager_id and active = true;

  if manager_role <> 'gerente' then
    raise exception 'Apenas gerente pode repor senhas';
  end if;

  if length(p_temp_password) < 4 then
    raise exception 'A senha deve ter pelo menos 4 caracteres';
  end if;

  update app_users
  set password_hash = crypt(p_temp_password, gen_salt('bf')),
      must_change_password = true
  where id = p_user_id;

  return true;
end;
$$;

create or replace function toggle_user_active(
  p_manager_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  manager_role text;
begin
  select role into manager_role from app_users where id = p_manager_id and active = true;

  if manager_role <> 'gerente' then
    raise exception 'Apenas gerente pode alterar utilizadores';
  end if;

  update app_users
  set active = not active
  where id = p_user_id
    and access_code <> 'GER001';

  return true;
end;
$$;

create or replace function toggle_client_active(p_client_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  update clients
  set active = not active
  where id = p_client_id;

  return true;
end;
$$;

alter table app_users enable row level security;
alter table clients enable row level security;
alter table production_records enable row level security;

drop policy if exists "read users" on app_users;
drop policy if exists "read clients" on clients;
drop policy if exists "insert clients" on clients;
drop policy if exists "update clients" on clients;
drop policy if exists "read records" on production_records;
drop policy if exists "insert records" on production_records;

create policy "read users" on app_users for select using (true);
create policy "read clients" on clients for select using (true);
create policy "insert clients" on clients for insert with check (true);
create policy "update clients" on clients for update using (true);
create policy "read records" on production_records for select using (true);
create policy "insert records" on production_records for insert with check (true);