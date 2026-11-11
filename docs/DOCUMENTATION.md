# MediScan Technical & Operational Documentation

---

## 1. Database Schema & Admin RPC Reference

All database migrations are versioned in `d:\mediscan-mobile\supabase\migrations\`:

### Core & Clinical Migrations (`0001` – `0012`)
- `0001_core.sql` — `public.profiles`, encrypted patient tables (`medical_information`, `allergies`, `conditions`, `diagnoses`, `medications`, `emergency_contacts`), `device_keys`, `encrypted_envelopes`, and `on_auth_user_created` trigger.
- `0002_privileged_workflows.sql` — `patient_professional_relationships`, `professional_applications`, `registration_matches`, `notifications`, `scan_events`, `scan_notes`, `verification_records`, and private storage buckets (`avatars`, `professional-applications`).
- `0006_dynamic_emergency_cards.sql` & `0007_emergency_field_history.sql` — Hybrid emergency wallet cards (`MEDISCAN:v4:`) and encrypted critical field audit history.
- `0008_professional_verification_admin.sql` & `0010_professional_application_admin_realtime.sql` — OCR screening columns (`screening_status`, `screening_result`), `professional_application_reviews`, `review_professional_application` RPC, and Realtime publication setup.
- `0009_professional_encounters.sql` & `0011_patient_handoffs.sql` — Clinician encounter reports and encrypted professional-to-professional patient handoffs.

### Web Portal, Release Manager & RBAC Migrations (`0013` – `0016`)
- **`0013_app_releases.sql` & `0014_app_releases_platform.sql`:**
  - Table `public.app_releases`:
    - `id` (`uuid`, PK)
    - `platform` (`text`, `'android' | 'ios'`)
    - `version` (`text`, e.g. `'1.0.0'`)
    - `file_size` (`text`, e.g. `'61.6 MB'` or `'TestFlight'`)
    - `download_url` (`text`, single URL or comma-separated chunk URLs)
    - `release_notes` (`text`, nullable)
    - `is_active` (`boolean`)
    - `uploaded_by` (`uuid`, references `auth.users`)
    - `created_at` (`timestamptz`)
  - Storage Bucket `apk-releases`: Public read access; authenticated admin insert/update/delete policies.
- **`0015_admin_rbac_console.sql` & `0016_admin_verification_rpc_and_storage.sql`:**
  - `public.admin_list_users()`: `SECURITY DEFINER` RPC returning all accounts joining `auth.users` and `public.profiles` (`user_id`, `email`, `full_name`, `phone_number`, `is_professional`, `professional_verified_at`, `is_admin`, `is_active`, `created_at`, `last_sign_in_at`).
  - `public.admin_update_user_roles(p_target_user_id, p_is_professional, p_is_admin, p_is_active)`: Updates `public.profiles` and `auth.users.raw_app_meta_data`, prevents self-demotion from admin, and dispatches a real-time notification when professional status changes.
  - `public.admin_list_professional_applications()`: Returns all PRC verification applications with joined applicant name, email, DOB, OCR screening results, and evidence paths.
  - `public.admin_review_professional_application(p_application_id, p_decision, p_reason)`: Admin-authenticated wrapper around `public.review_professional_application`.

---

## 2. Web Portal API Endpoints (`d:\mediscan-landing`)

### `GET /api/release`
Returns the latest active release metadata for both Android and iOS, plus backward-compatible top-level Android fields.
- **Response (`200 OK`):**
  ```json
  {
    "version": "1.0.0",
    "fileSize": "61.6 MB",
    "downloadUrl": "https://...",
    "releaseNotes": "...",
    "updatedAt": "2026-11-10T...",
    "android": { "version": "1.0.0", "fileSize": "61.6 MB", "downloadUrl": "...", "releaseNotes": "...", "updatedAt": "..." },
    "ios": null
  }
  ```

### `GET /api/download?platform=android|ios`
- Queries `public.app_releases` for the latest active release matching `platform` (defaults to `android`).
- **Single-URL Release:** Returns a `302 Found` redirect directly to the APK or iOS TestFlight / App Store URL.
- **Multi-Part Chunked APK Release:** Performs parallel `HEAD` requests across all chunk URLs to calculate total `Content-Length`, then streams each chunk sequentially via a Web `ReadableStream` with headers:
  - `Content-Type: application/vnd.android.package-archive`
  - `Content-Disposition: attachment; filename="mediscan-v<version>.apk"`
  - `Content-Length: <totalBytes>`

### `POST /api/inspect-url`
- Accepts `{ "url": "https://..." }` and sends a `HEAD` request to inspect the remote `Content-Length` header, returning `{ "bytes": 64605557, "fileSize": "61.6 MB" }` so the `/admin` portal auto-populates file size labels when pasting external links.

---

## 3. Admin Console Operations Guide (`https://mediscan.cloud/admin`)

### Granting the Initial Admin Role
To grant admin access to a user account via Supabase SQL Editor:
```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'your-email@example.com';
```
Once one admin account is active, additional admins can be promoted or invited directly from **Tab 1 (`Users & RBAC Roles`)** in `https://mediscan.cloud/admin`.

### Managing Users & RBAC Roles (Tab 1)
- Use the search bar to find accounts by name, email, or phone number, or filter by `All`, `User`, `Professional`, or `Admin`.
- Click **`+ Make Professional`** / **`✓ Professional`** to grant or revoke Verified Professional status (`profiles.is_professional`).
- Click **`+ Make Admin`** / **`✓ Admin`** to grant or revoke System Admin status (`app_metadata.role = 'admin'`).
- All role toggles take effect immediately on the user's open mobile app via Supabase Realtime.

### Reviewing PRC Applications (Tab 2)
1. Select an application from the **Pending** queue on the left.
2. Compare the applicant's profile name and DOB with the **Google Vision OCR** extracted PRC fields and click any thumbnail to inspect the PRC ID and liveness frames in full-screen lightbox view.
3. Click **`✓ Approve as Verified Professional`** to verify the clinician, or choose a rejection preset from the dropdown and click **`✕ Deny Application`** to send structured retry instructions to their phone.

### Publishing Mobile App Releases (Tab 3)
1. Choose **`Android (APK)`** or **`iOS (TestFlight / Store)`**.
2. For Android:
   - Select your `.apk` file under **Option A** — the version number and file size (`61.6 MB`) are auto-detected.
   - Click **`Upload to Supabase Storage`** (files over 42 MB are automatically uploaded in parts).
   - Click **`Publish Active Android Release`**.
3. For iOS:
   - Paste your Apple TestFlight (`https://testflight.apple.com/join/...`) or App Store link and click **`Publish Active iOS Release`**. The *"iOS Coming Soon"* badge on `mediscan.cloud` automatically converts into a live iOS download button.

---

## 4. Building & Repackaging the Android Release APK (`d:\mediscan-mobile`)

When only TypeScript/JavaScript code or `.env.production` values have changed (no native C++ changes), you can compile a fresh Hermes bytecode bundle and repackage the signed `arm64-v8a` APK in under 2 minutes without running a 25-minute CMake rebuild:

```powershell
# 1. Export production JS bundle with Metro
cd D:\mediscan-mobile
New-Item -ItemType Directory -Force -Path "D:\mediscan-mobile\temp_build\assets" | Out-Null
npx expo export:embed --platform android --dev false --reset-cache `
  --bundle-output "D:\mediscan-mobile\temp_build\index.android.js" `
  --assets-dest "D:\mediscan-mobile\temp_build\assets"

# 2. Compile JS to Hermes bytecode
& "D:\mediscan-mobile\node_modules\hermes-compiler\hermesc\win64-bin\hermesc.exe" `
  -O -emit-binary `
  -out "D:\mediscan-mobile\temp_build\index.android.bundle" `
  "D:\mediscan-mobile\temp_build\index.android.js"

# 3. Align & sign with Android SDK Build-Tools
& "D:\Android Studio Sdk\Sdk\build-tools\36.0.0\zipalign.exe" -p -f 4 `
  "D:\mediscan-mobile\temp_build\app-unaligned.apk" `
  "D:\mediscan-mobile\mediscan-v1.0.0-release.apk"

& "D:\Android Studio Sdk\Sdk\build-tools\36.0.0\apksigner.bat" sign `
  --ks "D:\mediscan-mobile\android\app\debug.keystore" `
  --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android `
  "D:\mediscan-mobile\mediscan-v1.0.0-release.apk"
```

---

## 5. Building & Deploying the Web / iOS PWA (`https://app.mediscan.cloud`) and Unsigned iOS `.ipa`

### Exporting & Deploying the Web / iOS PWA (`https://app.mediscan.cloud`)
1. Export the static web bundle (61 routes + `wa-sqlite.wasm` worker) from `d:\mediscan-mobile`:
   ```powershell
   npm run build:web
   ```
2. Deploy to Vercel (`maddators-projects/mediscan-mobile`):
   ```powershell
   npx vercel --prod --yes
   ```
3. **Required Headers (`vercel.json` & `public/_headers`):**
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: credentialless`
   - `Content-Type: application/wasm` for `/_expo/static/js/web/*.wasm`
4. **Supabase Auth Redirect URLs:**
   - Ensure both `mediscanmobile://auth/callback` and `https://app.mediscan.cloud/auth/callback` are added under **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**.

### Building an Unsigned Native iOS `.ipa` via GitHub Actions
For users who want to sideload a native iOS `.ipa` via **Sideloadly** or **AltStore** without a MacBook or paid Apple Developer account:
1. Open **GitHub → Actions → Build Unsigned iOS IPA** (`.github/workflows/ios-unsigned.yml`).
2. Click **Run workflow** on branch `feat/web-pwa-support` or `main`.
3. Download the generated `MediScan-unsigned-ipa` artifact and install it onto an iPhone using Sideloadly or AltStore with a free Apple ID.
