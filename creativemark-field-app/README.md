# CM Field — CreativeMark Field Operations App

Lightweight Capacitor web-wrapper APK for field employee tracking.

## Features
- **Live Location Tracking** — GPS heartbeat every 2 min, synced to CRM Hub dashboard
- **Shift Management** — Punch in/out with location capture
- **Society Visit Logging** — Form with GPS, photos, auto-match to assignments
- **Today's Assignments** — View manager-assigned societies with priority
- **Photo Evidence** — Selfie + building photo for visit verification

## Tech Stack
- **Vite** — Build tool (zero framework overhead)
- **Vanilla JS** — No React/RN, just plain DOM
- **Supabase** — Auth + Database + Storage
- **Capacitor** — Native Android wrapper
- Total APK JS bundle: ~56 KB gzipped

## Setup

```bash
npm install
npm run dev        # start dev server at http://localhost:5174
npm run build      # production build to dist/
```

## Build APK

```bash
npm run build
npx cap sync
npx cap open android   # opens in Android Studio
```

Then in Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

## Database Setup

Run `supabase-migration.sql` in your Supabase SQL Editor to create all required tables:
- `employees`
- `employee_location_history`
- `employee_shifts`
- `society_data`
- `assigned_societies`
- `field-evidence` storage bucket

## How It Works
1. Employee logs in with email/password (created in CRM Hub)
2. Starts shift → GPS location shared every 2 minutes
3. Visits assigned societies → fills form with GPS + optional photos
4. Data appears in CRM Hub for manager verification
5. Ends shift → duration + visit count recorded
