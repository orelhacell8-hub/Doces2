
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email) values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 1),
  active boolean not null default true,
  pdf_path text,
  pdf_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "active products public" on public.products for select to anon, authenticated using (active = true);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null references public.products(id),
  product_name text not null,
  amount numeric(10,2) not null,
  buyer_name text,
  buyer_email text,
  buyer_document text,
  status text not null default 'pending',
  delivered boolean not null default false,
  delivered_at timestamptz,
  paid_at timestamptz,
  nx_transaction_id text unique,
  idempotency_key uuid not null default gen_random_uuid(),
  payment_code text,
  payment_qr text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders(user_id);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "own orders read" on public.orders for select to authenticated using (auth.uid() = user_id);

create table public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;

insert into public.products (name, description, price, active) values
('Curso Doces que Vendem', 'Aprenda receitas de brigadeiros gourmet, bolos no pote, cupcakes e sobremesas que encantam e vendem. Apostila completa em PDF com passo a passo, lista de ingredientes, custos e dicas de precificação.', 47.00, true);
