-- Vincos & Agulha — V1.2 Operação Real
-- Administração completa: criar utilizadores, repor senhas, ativar/inativar.

create extension if not exists pgcrypto;

alter table app_users drop constraint if exists app_users_role_check;

alter table app_users
add constraint app_users_role_check
check (role in ('gerente','funcionario','cliente','motorista'));

alter table app_users
add column if not exists last_login_at timestamptz;

create or replace function login_user(p_code text, p_password text)
returns table (
  id uuid,
  name text,
  access_code text,
  role text,
  active boolean,
  must_change_password boolean,
  client_id uuid
)
language plpgsql
security definer
as $$
begin
  update app_users
  set last_login_at = now()
  where upper(access_code) = upper(p_code)
    and password_hash = crypt(p_password, password_hash)
    and active = true;

  return query
  select u.id, u.name, u.access_code, u.role, u.active, u.must_change_password, u.client_id
  from app_users u
  where upper(u.access_code) = upper(p_code)
    and u.password_hash = crypt(p_password, u.password_hash)
    and u.active = true;
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
  select role into manager_role
  from app_users
  where id = p_manager_id
    and active = true;

  if manager_role <> 'gerente' then
    raise exception 'Apenas gerente pode criar utilizadores';
  end if;

  if p_role not in ('gerente','funcionario','motorista') then
    raise exception 'Perfil inválido para esta função';
  end if;

  if length(p_temp_password) < 4 then
    raise exception 'A senha temporária deve ter pelo menos 4 caracteres';
  end if;

  insert into app_users (
    name,
    access_code,
    password_hash,
    role,
    active,
    must_change_password
  )
  values (
    p_name,
    upper(p_code),
    crypt(p_temp_password, gen_salt('bf')),
    p_role,
    true,
    true
  )
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
  select role into manager_role
  from app_users
  where id = p_manager_id
    and active = true;

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
  select role into manager_role
  from app_users
  where id = p_manager_id
    and active = true;

  if manager_role <> 'gerente' then
    raise exception 'Apenas gerente pode ativar/inativar utilizadores';
  end if;

  update app_users
  set active = not active
  where id = p_user_id
    and access_code <> 'GER001';

  return true;
end;
$$;

create or replace function update_user_role(
  p_manager_id uuid,
  p_user_id uuid,
  p_role text
)
returns boolean
language plpgsql
security definer
as $$
declare
  manager_role text;
begin
  select role into manager_role
  from app_users
  where id = p_manager_id
    and active = true;

  if manager_role <> 'gerente' then
    raise exception 'Apenas gerente pode alterar perfis';
  end if;

  if p_role not in ('gerente','funcionario','motorista') then
    raise exception 'Perfil inválido';
  end if;

  update app_users
  set role = p_role
  where id = p_user_id
    and access_code <> 'GER001';

  return true;
end;
$$;