-- Realtime should publish the public mirror table that the frontend subscribes
-- to (StatusContext.tsx watches public.client_apartment_listings), not the
-- private source. The original migration history left private.apartment_listings
-- in the publication after the table was moved to the private schema.

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'private'
      and tablename = 'apartment_listings'
  ) then
    alter publication supabase_realtime drop table private.apartment_listings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'client_apartment_listings'
  ) then
    alter publication supabase_realtime add table public.client_apartment_listings;
  end if;
end $$;
