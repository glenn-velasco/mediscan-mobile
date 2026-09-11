-- This project intentionally starts with a fresh data set. Remove the imported
-- Laravel schema and its records before creating the Supabase-native schema.
do $$
declare
  table_record record;
begin
  for table_record in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('drop table public.%I cascade', table_record.tablename);
  end loop;
end $$;
