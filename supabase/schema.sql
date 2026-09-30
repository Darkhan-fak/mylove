-- Схема для сайта mylove. Выполнить один раз в Supabase: SQL Editor → New query → Run.
-- Смысл: писать и читать может только тот, кто есть в таблице members. Остальные —
-- даже если узнают адрес сайта и публичный ключ — не получат ни строчки.

-- ---------- Кто свой ----------
create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  who     text not null check (who in ('he', 'she'))
);

-- Проверка «свой ли это» — используется во всех правилах доступа ниже.
create or replace function public.is_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

-- ---------- Таблицы ----------
create table if not exists public.wishes (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text       text not null,
  link       text,
  photo      text,                         -- путь к файлу в хранилище
  done       boolean not null default false
);

create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null,
  descr      text,
  due        date,
  done       boolean not null default false
);

create table if not exists public.dates (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  title      text not null,
  time       text,
  place      text,
  note       text
);

create index if not exists dates_day_idx on public.dates (day);

-- ---------- Права ----------
alter table public.members enable row level security;
alter table public.wishes  enable row level security;
alter table public.goals   enable row level security;
alter table public.dates   enable row level security;

-- Свои видят друг друга: нужно, чтобы подписать запись именем автора.
drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (public.is_member());

do $$
declare t text;
begin
  foreach t in array array['wishes', 'goals', 'dates'] loop
    execute format('drop policy if exists %1$s_read   on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);

    execute format('create policy %1$s_read   on public.%1$s for select using (public.is_member())', t);
    -- автора подставить за другого нельзя
    execute format('create policy %1$s_insert on public.%1$s for insert with check (public.is_member() and author = auth.uid())', t);
    -- менять и удалять можно записи обоих: это общий сайт
    execute format('create policy %1$s_update on public.%1$s for update using (public.is_member()) with check (public.is_member())', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (public.is_member())', t);
  end loop;
end $$;

-- ---------- Фотографии ----------
-- Закрытое хранилище: файлы отдаются только по временной ссылке, которую выдаёт сайт вошедшему.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists photos_read   on storage.objects;
drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_delete on storage.objects;

create policy photos_read   on storage.objects for select
  using (bucket_id = 'photos' and public.is_member());
create policy photos_insert on storage.objects for insert
  with check (bucket_id = 'photos' and public.is_member());
create policy photos_delete on storage.objects for delete
  using (bucket_id = 'photos' and public.is_member());

-- ---------- Последний шаг ----------
-- Выполнить ПОСЛЕ того, как оба хотя бы раз вошли на сайт по ссылке из письма.
-- Подставь настоящие адреса почты и запусти:
--
--   insert into public.members (user_id, who)
--   select id, case when email = 'почта-дархана@example.com' then 'he' else 'she' end
--   from auth.users
--   on conflict (user_id) do update set who = excluded.who;
--
-- Проверить, что получилось:  select * from public.members;
