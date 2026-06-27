# Carelink Roadmap

Tracks the gap between what the landing page (`frontend/app/page.tsx`) advertises and what the
product actually does, and sequences the build to close it. Audited 2026-06-24.

## ✅ Built (real, end-to-end)

- [x] **Voice capture** — `MediaRecorder` (`frontend/hooks/useAudioRecording.ts`) → WebM→WAV →
      whisper.cpp transcription (`backend/routes/audio.py`).
- [x] **AI summarization** — Ollama `gemma2:2b` produces mood / agitation / suggestions /
      repetition per session (`backend/routes/summarize.py`).
- [x] **Session timeline** — real session list grouped by day (`frontend/components/carelink-app.tsx`).
- [x] **Auth** — Firebase email/password, Google, magic-link (`frontend/app/login`, `/signup`).

## 🚧 Milestones (claimed on the site, not yet built)

### M1 — Export Reports (PDF) ✅ done (2026-06-24)
Downloadable, professional care summary for medical visits.
- [x] `backend/crud.py`: `get_report_sessions()` — sessions + full summary fields over a date range.
- [x] `backend/report.py`: build the PDF with `fpdf2` (header, aggregates, per-session, disclaimer).
- [x] `backend/routes/export.py`: `GET /api/export/report` → `application/pdf`.
- [x] `frontend/lib/api.ts`: `exportReport()` returning a Blob.
- [x] `frontend/components/carelink-app.tsx`: real "Export care report" button + download.

### M2 — Trend analysis ✅ done (2026-06-27)
Aggregate `summaries` (agitation, mood, repetition) over time.
- [x] ~~Populate/read the existing-but-unused `trend_cache` table~~ — **deliberately skipped.**
      Aggregation is computed on the fly in `backend/trends.py`; for a local single-user
      SQLite DB the cost is negligible and live computation can never go stale. `trend_cache`
      remains unused (a future optimization only if data volume ever warrants it).
- [x] Backend aggregation endpoint: `GET /api/trends?from_ts&to_ts` → `TrendsResponse`
      (weekly avg agitation, mood distribution, top repeated phrase, derived calm label).
      `crud.get_trend_sessions()` → `trends.compute_trends()` → `routes/trends.py`.
- [x] Render charts in the home "insights" panel using `recharts` (weekly agitation line +
      mood-mix bars + most-repeated phrase) — `InsightsPanel` in `carelink-app.tsx`.
- [x] Replace the hardcoded "This Week's Highlights" modal with real numbers (this-week
      `getTrends(weekStart)`), and the hardcoded "Overall Calm This Week" badge with the
      derived `calm_label`.

### M3 — Smart reminders
Medication / appointment scheduling + reminders.
- [ ] New data model (reminders/schedules) + CRUD + routes.
- [ ] Reminder UI; surface upcoming items on the home screen.

### M4 — Team collaboration
Multiple caregivers, shared records, role-based access.
- [ ] Real users/patients/roles model (depends on enforcing Firebase auth backend-side).
- [ ] Replace hardcoded `patient_id = "default_patient"` with real ownership.
- [ ] Invitations + per-role permissions.

## 🧹 Cleanup / honesty backlog

- [ ] Save the session reflection note (currently discarded in `handleSaveAndContinue`).
- [ ] Wire session-detail view — `api.getSession()` exists but is never called (cards open nothing).
- [ ] Make "Edit Summary" / "Add Tags" buttons functional (currently no handlers).
- [x] Stop hardcoding home-screen "insights" ("Overall Calm This Week" badge, Highlights modal) — done in M2.
