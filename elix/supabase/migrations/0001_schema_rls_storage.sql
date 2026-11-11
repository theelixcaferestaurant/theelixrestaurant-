-- =====================================================================
-- THE ELIX: Supabase schema, Row Level Security and storage
-- Run this whole file once in:  Supabase Dashboard > SQL Editor > New query
-- Then run supabase/migrations/0002_seed_content.sql, then create your admin (see README-BACKEND.md).
-- Safe to re-run: every statement is idempotent.
-- =====================================================================

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- administrators ----------
-- Only users listed here can change anything. Rows are added by you in the SQL editor (never by the website).
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- restaurant information (exactly one row) ----------
create table if not exists public.restaurant_info (
  id         smallint primary key default 1 check (id = 1),
  name       text not null default 'The Elix',
  tagline    text not null default '',
  address    text not null default '',
  phone      text not null default '',
  email      text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- opening hours ----------
create table if not exists public.opening_hours (
  id         bigint generated always as identity primary key,
  days       text not null,
  hours      text not null,
  sort_order int  not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- social media links ----------
create table if not exists public.social_links (
  platform   text primary key check (platform in ('instagram','facebook','youtube','maps')),
  url        text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- website content and settings (key / value) ----------
create table if not exists public.site_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- the four food categories ----------
create table if not exists public.categories (
  key           text primary key check (key in ('chai','tiffins','bakery','food')),
  label         text not null,
  heading       text not null default '',
  intro         text not null default '',
  short_text    text not null default '',
  subcategories text[] not null default '{}',
  sort_order    int  not null default 0,
  updated_at    timestamptz not null default now()
);

-- ---------- menu items ----------
create table if not exists public.menu_items (
  id           text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_key text not null references public.categories (key) on update cascade,
  sub          text not null default '',
  name         text not null check (length(trim(name)) > 0),
  price        numeric(8,2) not null default 0 check (price >= 0),
  veg          boolean,                       -- true = veg, false = non-veg, null = no marker
  description  text not null default '',
  featured     boolean not null default false,
  hot          boolean not null default false, -- shows the steam effect
  available    boolean not null default true,  -- false hides it from the public site
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists menu_items_category_idx on public.menu_items (category_key, sort_order);

-- ---------- gallery entries ----------
create table if not exists public.gallery_items (
  id         text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title      text not null,
  grp        text not null check (grp in ('Interiors','Food','Bakery','Beverages','Tiffins')),
  ratio      text not null default '4 / 3' check (ratio in ('4 / 3','1 / 1','4 / 5','3 / 4')),
  item_id    text references public.menu_items (id) on update cascade on delete set null,
  visible    boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- photographs and videos (menu items, gallery entries and site images) ----------
-- owner_type 'menu_item' -> owner_id is the menu item id
-- owner_type 'gallery'   -> owner_id is the gallery entry id
-- owner_type 'site'      -> owner_id is a site image key (hero-main, ambience, category-chai, hero-video ...)
create table if not exists public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  owner_type   text not null check (owner_type in ('menu_item','gallery','site')),
  owner_id     text not null,
  kind         text not null check (kind in ('image','video')),
  storage_path text not null,
  url          text not null,
  mime         text not null default '',
  size_bytes   bigint,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (owner_type, owner_id, kind)
);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['restaurant_info','opening_hours','social_links','site_settings','categories','menu_items','gallery_items','media_assets']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- Row Level Security ----------
-- Visitors: read-only access to public website content. Administrators: full access. Everyone else: nothing.
do $$
declare t text;
begin
  foreach t in array array['restaurant_info','opening_hours','social_links','site_settings','categories','media_assets']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

alter table public.menu_items enable row level security;
drop policy if exists "public read available" on public.menu_items;
create policy "public read available" on public.menu_items for select to anon, authenticated
  using (available or public.is_admin());
drop policy if exists "admin write" on public.menu_items;
create policy "admin write" on public.menu_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.gallery_items enable row level security;
drop policy if exists "public read visible" on public.gallery_items;
create policy "public read visible" on public.gallery_items for select to anon, authenticated
  using (visible or public.is_admin());
drop policy if exists "admin write" on public.gallery_items;
create policy "admin write" on public.gallery_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.admins enable row level security;
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins for select to authenticated using (user_id = auth.uid());
-- (no insert / update / delete policies: admins are managed only from the SQL editor)

-- ---------- storage bucket for photographs and videos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('elix-media', 'elix-media', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'])
on conflict (id) do update
  set public = true, file_size_limit = 52428800,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'];

drop policy if exists "elix media public read" on storage.objects;
create policy "elix media public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'elix-media');
drop policy if exists "elix media admin insert" on storage.objects;
create policy "elix media admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'elix-media' and public.is_admin());
drop policy if exists "elix media admin update" on storage.objects;
create policy "elix media admin update" on storage.objects for update to authenticated
  using (bucket_id = 'elix-media' and public.is_admin()) with check (bucket_id = 'elix-media' and public.is_admin());
drop policy if exists "elix media admin delete" on storage.objects;
create policy "elix media admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'elix-media' and public.is_admin());

-- ---------- realtime: open pages refresh when content changes ----------
do $$
declare t text;
begin
  foreach t in array array['restaurant_info','opening_hours','social_links','site_settings','categories','menu_items','gallery_items','media_assets']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
