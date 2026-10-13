# Supabase backend

The mobile app no longer calls Laravel. It uses Supabase Auth, Data API/RLS, Realtime, Storage, and the `mediscan-privileged` Edge Function.

## Provision

1. Create a fresh Supabase project.
2. Link this repository: `npx supabase link --project-ref <project-ref>`.
3. Apply the schema: `npx supabase db push`.
4. Generate a 32-byte random key and configure the Edge Function secret `HISTORY_MASTER_KEY_B64` (base64-encoded). Keep it outside the app and repository. Back it up securely; losing it makes cloud patient records and emergency field history unreadable. Do not rotate it without a re-encryption migration.
5. Deploy privileged workflows: `npx supabase functions deploy mediscan-privileged`.
6. Enable the Google Cloud Vision API, create a service account limited to Vision use, and configure its credentials as Edge Function secrets (the app continues with manual admin review while these are absent):

   ```powershell
   npx supabase secrets set GOOGLE_CLOUD_PROJECT_ID="..."
   npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
   npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="..."
   ```

   Never use an `EXPO_PUBLIC_` variable for these values. The private key may contain literal `\n` sequences; the function normalizes them before signing the Google OAuth assertion.
7. In Supabase Auth URL configuration, add `mediscanmobile://auth/callback` as an allowed redirect URL.
8. Bootstrap the first admin from the Supabase SQL editor using that person's existing, confirmed account. Replace the email before running it:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where lower(email) = lower('admin@example.com');
   ```

   The first admin must sign out and back in. Further admins can then be promoted or invited from **Account → Professional verification → Invite admin**.
9. Set the app environment values:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   ```

The service-role key is injected by Supabase into the Edge Function environment. Never put it in an `EXPO_PUBLIC_` variable or the mobile bundle.

## Security model

- Patient-owned encrypted tables are directly accessed with the user's JWT and protected by RLS.
- Cross-user reads, professional authorization, device-key lifecycle, registration decisions, scan auditing, and encrypted-envelope relay go through the Edge Function.
- `avatars` and `professional-applications` are private Storage buckets. Object paths begin with the owner's Auth UUID.
- Local SQLite medical fields remain encrypted with a device-held key. Cloud patient payloads are encrypted by the authenticated Edge Function with AES-GCM and a server-held key before they reach PostgreSQL. Cloud pulls decrypt in a bounded batch for the authenticated owner, then re-encrypt into the local SQLite database with that device's key. This enables the same patient account to sync across devices, but is **not end-to-end encryption**: the Edge Function can see plaintext in memory. RLS is an additional authorization boundary, not a replacement for encryption.
- Emergency field-history values use server-side AES-GCM under `HISTORY_MASTER_KEY_B64`; only the Edge Function can read or write those rows. The responder sees at most five patient-entered changes for fields disclosed by the scanned QR or printed card. This is not an audit of clinical truth or a verified identity.
- `mediscan-privileged` has gateway JWT verification disabled so a printed-card bearer token can resolve anonymously. The function itself checks a valid Supabase user JWT for every other action; the card lookup is token-scoped and rate-limited.
- Cloud patient records and emergency history currently use `HISTORY_MASTER_KEY_B64` with separate AES-GCM associated-data domains. That key must be backed up and rotated with a re-encryption procedure before real patient data is used. A missing key makes the cloud ciphertext unreadable.
- Old development cloud rows encrypted with per-device keys are skipped during pull. They are not automatically migrated; re-enter or re-save fictional data on the updated app. This compatibility behavior is only appropriate while development data is disposable.
- The patient sync push queue now sends new/pending rows only. Successful updates are marked synced with an edit-timestamp check so a newer local change stays queued instead of being cleared by an older in-flight upload.
- Migration `0012_unique_profile_phone.sql` rejects new duplicate E.164 profile phone numbers, including concurrent registrations. It leaves pre-existing duplicate numbers untouched; resolve those records separately. The registration screen calls `phone_number_available` before sign-up to show a field-level error. Apply the migration before testing that rule.
- Philippine province and city choices come from the public PSGC Cloud v2 API, with manual entry when the service is unavailable or a location is missing. This lookup sends no patient data; it fetches only geographic reference lists.

## Verification

Run `npx tsc --noEmit`, `npm run lint`, and `npm test -- --runInBand`. Apply the migrations to a disposable project and exercise the RLS test matrix with two patient accounts and one verified professional account before production use.
