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

### M2 — Trend analysis
Aggregate `summaries` (agitation, mood, repetition) over time.
- [ ] Populate/read the existing-but-unused `trend_cache` table (`db/schema.sql`).
- [ ] Backend aggregation endpoint (mood/agitation/repetition by week).
- [ ] Render charts in the empty home "insights" panel using `recharts` (already a dependency).
- [ ] Replace the hardcoded "This Week's Highlights" modal with real numbers.

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
- [ ] Stop hardcoding home-screen "insights" ("Overall Calm This Week" badge, Highlights modal).
