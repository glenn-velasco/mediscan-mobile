-- Add platform ('android' | 'ios') to public.app_releases so Admin can manage both Android APK and iOS TestFlight / App Store releases independently
alter table public.app_releases
  add column if not exists platform text not null default 'android'
  check (platform in ('android', 'ios'));

drop index if exists app_releases_active_created_idx;
create index if not exists app_releases_platform_active_created_idx
  on public.app_releases(platform, is_active, created_at desc);
