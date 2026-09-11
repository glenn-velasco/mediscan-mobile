# Supabase backend

The mobile app no longer calls Laravel. It uses Supabase Auth, Data API/RLS, Realtime, Storage, and the `mediscan-privileged` Edge Function.

## Provision

1. Create a fresh Supabase project.
2. Link this repository: `npx supabase link --project-ref <project-ref>`.
3. Apply the schema: `npx supabase db push`.
4. Deploy privileged workflows: `npx supabase functions deploy mediscan-privileged`.
5. In Supabase Auth URL configuration, add `mediscanmobile://auth/callback` as an allowed redirect URL.
6. Set the app environment values:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   ```

The service-role key is injected by Supabase into the Edge Function environment. Never put it in an `EXPO_PUBLIC_` variable or the mobile bundle.

## Security model

- Patient-owned encrypted tables are directly accessed with the user's JWT and protected by RLS.
- Cross-user reads, professional authorization, device-key lifecycle, registration decisions, scan auditing, and encrypted-envelope relay go through the Edge Function.
- `avatars` and `professional-applications` are private Storage buckets. Object paths begin with the owner's Auth UUID.
- Medical payloads remain encrypted by the app before upload. RLS is an additional authorization boundary, not a replacement for encryption.

## Verification

Run `npx tsc --noEmit`, `npm run lint`, and `npm test -- --runInBand`. Apply the migrations to a disposable project and exercise the RLS test matrix with two patient accounts and one verified professional account before production use.
