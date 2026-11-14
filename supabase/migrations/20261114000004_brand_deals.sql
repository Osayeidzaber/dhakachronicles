-- Brand deals: sponsorship pipeline for the commercial team.
-- Staff-only (editors and admins). Fees and contacts are never public.

create type public.brand_deal_stage as enum ('lead', 'negotiating', 'contracted', 'in_production', 'published', 'cancelled');

create table public.brand_deals (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null check (char_length(btrim(brand_name)) between 1 and 200),
  contact_name text check (contact_name is null or char_length(contact_name) <= 200),
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  stage public.brand_deal_stage not null default 'lead',
  deliverables text check (deliverables is null or char_length(deliverables) <= 2000),
  fee_amount numeric(12, 2) check (fee_amount is null or fee_amount >= 0),
  currency text not null default 'BDT' check (currency ~ '^[A-Z]{3}$'),
  due_date date,
  owner_id uuid references public.profiles (id) on delete set null,
  article_id uuid references public.articles (id) on delete set null,
  brief_approved boolean not null default false,
  brand_signoff boolean not null default false,
  invoice_sent boolean not null default false,
  paid boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 5000),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A deal can only be marked paid once it has been invoiced.
  constraint brand_deals_paid_needs_invoice check (not paid or invoice_sent)
);

create index brand_deals_stage_idx on public.brand_deals (stage, due_date);

create trigger brand_deals_updated_at before update on public.brand_deals
  for each row execute function public.set_updated_at();

alter table public.brand_deals enable row level security;

create policy brand_deals_read on public.brand_deals for select to authenticated
  using (public.is_editor());
create policy brand_deals_insert on public.brand_deals for insert to authenticated
  with check (public.is_editor());
create policy brand_deals_update on public.brand_deals for update to authenticated
  using (public.is_editor()) with check (public.is_editor());
create policy brand_deals_delete on public.brand_deals for delete to authenticated
  using (public.is_admin());

revoke all on public.brand_deals from anon;
