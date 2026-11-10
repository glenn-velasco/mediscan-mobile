# MediScan System Architecture

This document describes the end-to-end architecture connecting the **MediScan Web Portal & Admin Console (`d:\mediscan-landing`)**, the **MediScan Mobile Application (`d:\mediscan-mobile`)**, and the **Supabase Cloud Backend**.

---

## 1. High-Level Multi-Platform Architecture

MediScan operates across two client surfaces sharing a single **Supabase** backend (`vlcxcmctphwptumwolfw`):
1. **`mediscan.cloud` (Next.js 15 on Vercel):** Public landing page, mobile installer distribution (`/api/download`), and the 3-tab Admin & RBAC Console (`/admin`).
2. **MediScan Mobile App (Expo SDK 57 / React Native):** Offline-first patient emergency pass (`SQLite` + AES-GCM cloud sync) and verified clinician/responder scanner.

```mermaid
flowchart TB
  subgraph Web["mediscan.cloud (Vercel / Next.js 15)"]
    LP["Public Landing Page (/)"]
    AD["3-Tab Admin Console (/admin)"]
    API_REL["GET /api/release"]
    API_DL["GET /api/download"]
    API_INS["POST /api/inspect-url"]
  end

  subgraph Mobile["MediScan Mobile App (Expo / React Native)"]
    SQLITE[("Encrypted Local SQLite")]
    PAT_UI["Patient Emergency QR & Wallet Card"]
    PRO_UI["Verified Professional Scanner & Encounters"]
    RT_CLIENT["BroadcastProvider (Realtime WebSocket)"]
  end

  subgraph Supabase["Supabase Backend (vlcxcmctphwptumwolfw)"]
    AUTH["Supabase Auth (JWT + app_metadata.role)"]
    PG[("PostgreSQL + RLS + SECURITY DEFINER RPCs")]
    RT["Supabase Realtime (postgres_changes)"]
    EDGE["Edge Function: mediscan-privileged"]
    S_APK[("Storage: apk-releases (Public)")]
    S_PRC[("Storage: professional-applications (Private)")]
  end

  LP --> API_REL
  LP --> API_DL
  API_REL --> PG
  API_DL --> PG
  API_DL --> S_APK

  AD --> AUTH
  AD --> PG
  AD --> EDGE
  AD --> S_APK
  AD --> S_PRC
  AD <--> RT

  PAT_UI <--> SQLITE
  SQLITE <--> EDGE
  PRO_UI <--> EDGE
  EDGE --> PG
  EDGE --> S_PRC
  RT <--> RT_CLIENT
```

---

## 2. Role-Based Access Control (RBAC) Architecture

MediScan enforces a 3-tier role hierarchy across PostgreSQL Row-Level Security (RLS), `SECURITY DEFINER` RPCs, and the `mediscan-privileged` Edge Function:

| Role Tier | Source of Truth in Database | Capabilities |
| :--- | :--- | :--- |
| **1. Standard User (`user`)** | `auth.users` + `public.profiles` (`is_professional = false`) | Manage personal medical profile, allergies, medications, conditions, emergency contacts; generate phone QR (`MEDISCAN:v2:`) and hybrid wallet card (`MEDISCAN:v4:`); submit PRC professional verification application. |
| **2. Verified Professional (`professional`)** | `public.profiles.is_professional = true` & `professional_verified_at IS NOT NULL` | All User capabilities **plus**: scan and audit patient emergency QR passes, record encrypted clinical encounters & vital signs, verify patient records, and create encrypted patient handoffs. |
| **3. System Administrator (`admin`)** | `auth.users.raw_app_meta_data->>'role' = 'admin'` | Full access to `https://mediscan.cloud/admin`: manage all users' RBAC roles, invite new admins, inspect PRC ID & liveness evidence, approve/deny professional applications, and publish Android/iOS app releases. |

---

## 3. Bidirectional Real-Time Role & Verification Sync

When an administrator updates a user's role or reviews a PRC application on `https://mediscan.cloud/admin`, the user's open mobile app updates **live without restarting the app**:

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Admin (mediscan.cloud/admin)
  participant PG as Supabase PostgreSQL
  participant RT as Supabase Realtime
  participant App as Mobile App (BroadcastProvider)
  participant Auth as Supabase Auth

  Admin->>PG: Call RPC admin_update_user_roles() or admin_review_professional_application()
  PG->>PG: Verify caller JWT has app_metadata.role = 'admin'
  PG->>PG: Update public.profiles (is_professional, updated_at) & auth.users (raw_app_meta_data)
  PG->>PG: Insert status notification into public.notifications
  PG-->>RT: Emit postgres_changes event on public.profiles & public.professional_applications
  RT-->>App: Push WebSocket event to channel user:{userId}
  App->>Auth: refreshUser() -> apiRefreshToken() (mints new JWT with updated role)
  App->>PG: apiMe() (reads updated profile & permissions)
  App->>App: Update React AuthContext state & UI badges immediately
```

Similarly, the web Admin Console subscribes to `postgres_changes` on `public.profiles`, `public.professional_applications`, and `public.app_releases` via the `web-admin-live` channel so new mobile signups and PRC applications appear automatically in the browser.

---

## 4. PRC Professional Verification Pipeline

```mermaid
flowchart LR
  A["Mobile User Captures PRC ID + Blink/Flash Liveness"] --> B["Edge Function: mediscan-privileged"]
  B --> C["Upload Photos to Private Bucket (professional-applications)"]
  B --> D["Google Cloud Vision OCR (extractPrcFields)"]
  D -->|Readable PRC ID| E["Status: pending_review (screening_status: passed)"]
  D -->|Unreadable / Non-PRC| F["Status: auto_rejected"]
  E --> G["Web Admin Console (mediscan.cloud/admin Tab 2)"]
  G -->|Approve| H["profiles.is_professional = true + Realtime Notification"]
  G -->|Deny with Preset| I["Send 9-Preset Retry Instructions + Realtime Notification"]
```

---

## 5. Multi-Part Chunked APK Storage & Streaming Architecture

Supabase Free Tier limits individual storage objects to **50 MB**, while the signed `arm64-v8a` Android release APK is **~61.6 MB**. To allow 1-click browser uploads in `/admin` without external hosting:

1. **Browser Chunk Slicing (`/admin`):**
   - Any `.apk` file larger than **42 MB** is automatically sliced in the browser using `File.slice()` into sequential parts (`part0` = 42.0 MB, `part1` = 19.6 MB).
   - Each part is uploaded to the `apk-releases` Supabase Storage bucket and stored as a comma-separated manifest in `public.app_releases.download_url`.
2. **Zero-Buffering Edge Stream Reassembly (`/api/download`):**
   - When a user clicks **Download for Android (.APK)** on `mediscan.cloud`, `GET /api/download` sends parallel `HEAD` requests to sum the exact `Content-Length` (`64,605,557` bytes).
   - It then streams `part0` followed immediately by `part1` through a Web Standard `ReadableStream` with `Content-Type: application/vnd.android.package-archive`, giving Android a single `.apk` file with an accurate download progress bar.
