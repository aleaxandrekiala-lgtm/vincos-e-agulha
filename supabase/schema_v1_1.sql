-- Vincos & Agulha — V1.1 Interface Profissional
-- Execute no Supabase SQL Editor. Seguro para correr mesmo que já existam campos/tabelas.

create extension if not exists pgcrypto;

alter table clients add column if not exists client_number text unique;
alter table clients add column if not exists phone text;
alter table clients add column if not exists address text;
alter table clients add column if not exists city text;
alter table clients add column if not exists zone text;
alter table clients add column if not exists pickup_day text;
alter table clients add column if not exists delivery_day text;
alter table clients add column if not exists active boolean default true;
alter table clients add column if not exists driver_id uuid references app_users(id);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  tracking_code text unique not null,
  qr_code text not null,
  client_id uuid references clients(id),
  client_number text,
  client_name text not null,
  driver_id uuid references app_users(id),
  driver_name text,
  staff_id uuid references app_users(id),
  staff_name text,
  pieces integer default 0,
  status text not null default 'recebido_cliente',
  notes text,
  label_printed boolean not null default false,
  label_printed_at timestamptz,
  picked_up_at timestamptz,
  in_production_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  user_id uuid references app_users(id),
  user_name text,
  event_type text not null,
  old_status text,
  new_status text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists communication_logs (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid references app_users(id),
  channel text not null default 'whatsapp',
  message_type text,
  week_day text,
  target_type text,
  total_clients integer default 0,
  message text,
  created_at timestamptz not null default now()
);

alter table orders enable row level security;
alter table order_events enable row level security;
alter table communication_logs enable row level security;

drop policy if exists "read orders" on orders;
drop policy if exists "insert orders" on orders;
drop policy if exists "update orders" on orders;
drop policy if exists "read order events" on order_events;
drop policy if exists "insert order events" on order_events;
drop policy if exists "read communication logs" on communication_logs;
drop policy if exists "insert communication logs" on communication_logs;

create policy "read orders" on orders for select using (true);
create policy "insert orders" on orders for insert with check (true);
create policy "update orders" on orders for update using (true);
create policy "read order events" on order_events for select using (true);
create policy "insert order events" on order_events for insert with check (true);
create policy "read communication logs" on communication_logs for select using (true);
create policy "insert communication logs" on communication_logs for insert with check (true);

create or replace function next_order_number()
returns text
language plpgsql
security definer
as $$
declare
  current_year text := to_char(now(), 'YYYY');
  seq_number integer;
  new_number text;
begin
  select coalesce(max(cast(split_part(order_number, '-', 3) as integer)), 0) + 1
  into seq_number
  from orders
  where order_number like 'VA-' || current_year || '-%';

  new_number := 'VA-' || current_year || '-' || lpad(seq_number::text, 6, '0');
  return new_number;
end;
$$;

create or replace function create_order(
  p_user_id uuid,
  p_client_id uuid,
  p_pieces integer,
  p_notes text
)
returns uuid
language plpgsql
security definer
as $$
declare
  user_name_v text;
  client_name_v text;
  client_number_v text;
  order_number_v text;
  new_id uuid;
begin
  select name into user_name_v from app_users where id = p_user_id;
  select name, client_number into client_name_v, client_number_v from clients where id = p_client_id;

  order_number_v := next_order_number();

  insert into orders (
    order_number, tracking_code, qr_code, client_id, client_number, client_name,
    staff_id, staff_name, pieces, status, notes, in_production_at
  )
  values (
    order_number_v, order_number_v, order_number_v, p_client_id, client_number_v, client_name_v,
    p_user_id, user_name_v, p_pieces, 'em_producao', p_notes, now()
  )
  returning id into new_id;

  insert into order_events(order_id, user_id, user_name, event_type, old_status, new_status, notes)
  values(new_id, p_user_id, user_name_v, 'criar_encomenda', null, 'em_producao', p_notes);

  return new_id;
end;
$$;

create or replace function update_order_status(
  p_user_id uuid,
  p_order_id uuid,
  p_new_status text,
  p_notes text default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  old_status_v text;
  user_name_v text;
begin
  select status into old_status_v from orders where id = p_order_id;
  select name into user_name_v from app_users where id = p_user_id;

  update orders
  set status = p_new_status,
      updated_at = now(),
      picked_up_at = case when p_new_status = 'recebido_cliente' then coalesce(picked_up_at, now()) else picked_up_at end,
      in_production_at = case when p_new_status = 'em_producao' then coalesce(in_production_at, now()) else in_production_at end,
      ready_at = case when p_new_status = 'pronto_entrega' then coalesce(ready_at, now()) else ready_at end,
      delivered_at = case when p_new_status = 'entregue_cliente' then coalesce(delivered_at, now()) else delivered_at end
  where id = p_order_id;

  insert into order_events(order_id, user_id, user_name, event_type, old_status, new_status, notes)
  values(p_order_id, p_user_id, user_name_v, 'alterar_estado', old_status_v, p_new_status, p_notes);

  return true;
end;
$$;

create or replace function mark_label_printed(p_order_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  update orders set label_printed = true, label_printed_at = now() where id = p_order_id;
  return true;
end;
$$;