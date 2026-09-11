-- Trigger helpers are internal implementation details, not Data API RPCs.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
