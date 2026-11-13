-- Starter taxonomy (safe to re-run). No sample articles.
insert into public.categories (slug, name_en, name_bn, sort_order) values
  ('national', 'National', 'জাতীয়', 1),
  ('politics', 'Politics', 'রাজনীতি', 2),
  ('dhaka', 'Dhaka', 'ঢাকা', 3),
  ('business', 'Business', 'বাণিজ্য', 4),
  ('sports', 'Sports', 'খেলা', 5),
  ('entertainment', 'Entertainment', 'বিনোদন', 6),
  ('international', 'International', 'আন্তর্জাতিক', 7)
on conflict (slug) do nothing;
