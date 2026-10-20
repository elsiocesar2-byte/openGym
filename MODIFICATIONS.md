# Changes in this fork

This repository is a modified fork of [openGym](https://github.com/DuarteSantos8/openGym)
by Duarte Santos, based on upstream v1.4.1 (commit `e348fc1`). It is not the official
project and is not endorsed by the upstream author.

Modification date: 2026-10-20.

The upstream code and these modifications are licensed under the **GNU Affero General
Public License v3.0**; see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). If you run a
modified version of this software as a network service, section 13 of the license requires
you to offer its users the corresponding source. The source of this fork is this repository;
keep it publicly reachable (or provide an equivalent written offer) when you deploy it.

## What changed

### 1. Paste a whole training plan, in the user's own words

- New Coach task `import` (server and phone BYOK): `POST /api/coach/import`,
  `api/coach/prompts/import.md`, `IMPORT_SCHEMA`, `validateImport`.
- The model is a **transcriptionist**, not a planner: it must preserve every exercise name,
  order, sets, reps, weight and note. It may not substitute, merge, split or invent
  exercises.
- The client (`frontend/src/lib/plan-import.js`) resolves each transcribed name against the
  English catalogue and the Chinese name pack. A confident match becomes a library exercise;
  anything uncertain becomes a **custom exercise that keeps the original name**. Names are
  never silently replaced.
- A 20,000-character paste is accepted as one job; it is not cut to the 1,000-character chat
  limit. Server route: `api/coach/routes.js`; phone pipeline: `frontend/src/lib/coach-local.js`.
- New Plan UI: Plan → options (⋯) → **Import a plan from text**. The preview shows every
  `original → matched` row or “new exercise, kept as written”, with a per-row override.

### 2. Stretches and alternatives

- Stretch/mobility blocks are appended to their training day instead of becoming extra
  training days.
- Alternatives are stored as real exercise ids (`ex.alt`), not only as prose in the note.
  Routine edit shows clickable alternative chips; swapping keeps the old movement as the
  alternative.
- Each alternative carries its own optional prescription (`altCfg`: sets, reps, weight,
  time, note). The import prompt reads a weight written next to an alternative (for example
  “5–7.5kg”) and stores it there; the pencil on the alternative chip edits it.
- Range reps (`8–12`) display as a range rather than `undefined`.

### 3. Self-hosted LAN/password mode

- New `PASSKEY_LOGIN=0` server flag, exposed as `passkey_login:false` in `/api/config`.
- The login screen hides passkeys outside a secure context and defaults to name + password.
  This makes `http://192.168.x.x:8080` usable on a LAN, where WebAuthn has no valid RP ID.
- `frontend/android/build.gradle` adds Aliyun Maven mirrors before Google/Maven Central, for
  networks where `dl.google.com` is unreachable. Remove those four lines if you build
  against the official repositories.

## Build

```sh
# web / API
npm install
npm run build          # frontend/dist
node api/server.js     # API on :3000

# Android (JDK 21, Android SDK)
cd frontend
npm install
VITE_MOBILE=1 npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

The Android release build expects `frontend/android/keystore.properties` with
`storeFile`, `storePassword`, `keyAlias`, `keyPassword` (not committed).

## Tests added

- `api/test/validate-import.test.js`
- `frontend/src/lib/plan-import.test.js`
- additions to `frontend/src/lib/coach.test.js`, `plan-share.test.js`,
  `RoutineEdit.replace.test.jsx`
