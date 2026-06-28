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
- [x] Render charts in the home "insights" panel using `recharts` — `InsightsPanel`
      (`components/insights-panel.tsx`): "emotional weather" gradient area chart, a mood ribbon,
      and the most-repeated phrase as a serif quote, all cohesive with the journal aesthetic.
- [x] Fix `routes/audio.py` to persist `repetition_json` on summary insert (it was dropped),
      so the "Heard often" insight actually populates for new sessions.
- [x] Replace the hardcoded "This Week's Highlights" modal with real numbers (this-week
      `getTrends(weekStart)`), and the hardcoded "Overall Calm This Week" badge with the
      derived `calm_label`.

### M3 — Smart reminders ✅ done (2026-06-27)
Medication / appointment scheduling + reminders. **In-app only** (offline app — no push/email).
- [x] Data model: `reminders` table (`db/schema.sql` + idempotent live migration in
      `database.py` `_run_migrations`, so existing DBs pick it up). Two kinds: `medication`
      (recurrence `daily` at `time_of_day` 'HH:MM') and `appointment` (`once` at `due_ts`).
- [x] CRUD + routes: `crud.py` reminder fns; `routes/reminders.py`
      (`GET/POST /api/reminders`, `PATCH`/`DELETE /api/reminders/{id}`,
      `POST /api/reminders/{id}/done`) with readable 400 validation.
- [x] Reminder UI on the home screen: `components/reminders-panel.tsx` (right column, above
      insights) — surfaces overdue/today/upcoming, mark-done, an Add dialog (med/appointment
      toggle) and a Manage-all dialog. Occurrence/overdue status is derived against a live
      clock on the client (re-ticks each minute), not stored.

### M4 — Team collaboration ✅ done (2026-06-28)
Local multi-profile: multiple caregivers, shared records, Owner/Caregiver roles. **In-app /
trusted-local** — the backend stays unauthenticated (a local single-machine service); ownership
and roles are modelled in data and gated in the UI. No cloud sync (true to the offline ethos).
- [x] Data model: `caregivers`, `patients`, `memberships` tables + `patient_id` on
      `sessions`/`reminders` (idempotent migration in `database.py` backfills all pre-M4 data to a
      `p_default` "My patient").
- [x] Replaced the hardcoded `default_patient`: every read/write (`sessions`, `trends`,
      `reminders`, `export`) is scoped by the active patient via the `X-Patient-Id` header
      (`deps.py`); session creation tags the active patient.
- [x] Identity: caregiver from the Firebase user, or a `local-caregiver` fallback when Firebase
      isn't configured. `POST /api/caregivers/sync` upserts + reconciles email invites; the first
      caregiver to sync claims the default patient.
- [x] Invitations + per-role permissions: `routes/patients.py` (list/create patients,
      list/invite-by-email/remove members) with owner-only enforcement and a last-owner guard.
      Frontend: `PatientProvider`, a patient switcher + "Care circle" dialog (`care-circle.tsx`),
      role-gated.
- **Known limitation:** switching from the offline `local-caregiver` to a Firebase account later
  won't auto-transfer ownership of the default patient (first-claimer keeps it).

## 🧹 Cleanup / honesty backlog

- [x] Save the session reflection note (2026-06-28) — `handleSaveAndContinue` now persists it via
      `PATCH /api/session/{id}/note` before navigating.
- [x] Wire session-detail view (2026-06-28) — timeline cards open `SessionDetailDialog`
      (`components/session-detail.tsx`), a journal-entry view of the session
      (mood/agitation, summary, repeated phrases, suggestions, transcript, reflection).
      Fixed the `SessionDetail` front/back contract drift (frontend type was flat; backend is nested).
- [x] Make "Edit Summary" / "Add Tags" functional (2026-06-28) — inline editing in the detail
      view, persisted via `PATCH /api/session/{id}/summary` (`summary_text` + a new `tags` column);
      the summary-screen buttons open the same editor.
- [x] Stop hardcoding home-screen "insights" ("Overall Calm This Week" badge, Highlights modal) — done in M2.

**All roadmap items complete.** Note: the recording → transcribe → summarize pipeline (whisper.cpp +
Ollama) is the one path verified only manually/locally, not in CI.
