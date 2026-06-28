PRAGMA foreign_keys = ON;

CREATE TABLE sessions (
  session_id   TEXT PRIMARY KEY,      -- UUIDv4
  session_type TEXT NOT NULL,         -- Medication, Conversation, etc.
  start_ts     INTEGER NOT NULL,      -- epoch ms
  end_ts       INTEGER,               -- nullable
  notes        TEXT,
  patient_id   TEXT                   -- M4: owning patient (FK patients); backfilled to p_default
);
CREATE INDEX idx_sessions_start ON sessions(start_ts);
CREATE INDEX idx_sessions_patient ON sessions(patient_id);

CREATE TABLE audio_chunks (
  chunk_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  duration_sec INTEGER,
  created_ts   INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX idx_chunks_session ON audio_chunks(session_id);


CREATE TABLE transcripts (
  transcript_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL,
  chunk_id      INTEGER,
  text          TEXT NOT NULL,
  language      TEXT,
  word_count    INTEGER,
  created_ts    INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
  FOREIGN KEY(chunk_id)   REFERENCES audio_chunks(chunk_id) ON DELETE CASCADE
);

CREATE TABLE summaries (
  summary_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL UNIQUE,
  summary_text    TEXT NOT NULL,
  repetition_json TEXT,   -- [{"phrase":"…","count":2}, …]
  agitation_score REAL,
  mood_label      TEXT,
  suggestions     TEXT,
  tags            TEXT,   -- JSON array of caregiver/AI tags, e.g. ["medication","calm"]
  created_ts      INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);


CREATE TABLE trend_cache (
  week_start_ts   INTEGER PRIMARY KEY,
  top_phrase      TEXT,
  top_phrase_count INTEGER,
  avg_agitation   REAL,
  med_given       INTEGER
);

-- M3: smart reminders. In-app only (offline app — no push/email). Two kinds:
-- 'medication' (recurring at time_of_day 'HH:MM' local, every interval_days days
-- counted from the due_ts start anchor) and 'appointment' (recurrence 'once' at
-- absolute due_ts epoch ms). Occurrence/overdue status is computed against the
-- live clock on the client, not stored.
-- IF NOT EXISTS so the live migration in database.py is idempotent on old DBs.
CREATE TABLE IF NOT EXISTS reminders (
  reminder_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  kind          TEXT NOT NULL,                 -- 'medication' | 'appointment'
  recurrence    TEXT NOT NULL DEFAULT 'once',  -- 'once' | 'daily' | 'every_other_day' | 'weekly'
  interval_days INTEGER,                       -- recurring: days between doses (1/2/7); NULL for one-off
  due_ts        INTEGER,                       -- one-off: absolute epoch ms; recurring: start anchor (sets weekday)
  time_of_day   TEXT,                          -- recurring: 'HH:MM' local
  notes         TEXT,
  last_done_ts  INTEGER,                       -- epoch ms last marked done
  active        INTEGER NOT NULL DEFAULT 1,
  created_ts    INTEGER NOT NULL,
  patient_id    TEXT                           -- M4: owning patient; backfilled to p_default
);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(active);

-- M4: local multi-profile team collaboration. Caregivers (identity from the
-- frontend's Firebase user, or a local fallback), patients (care recipients),
-- and memberships linking them with a role. The backend is a trusted-local
-- service (no token verification); ownership/roles are modelled here and also
-- gated in the UI. Invitations are by email and bind on the invitee's first
-- sync (status 'pending' -> 'active'). All IF NOT EXISTS for live migration.
CREATE TABLE IF NOT EXISTS caregivers (
  caregiver_id  TEXT PRIMARY KEY,              -- firebase uid, or 'local-caregiver'
  email         TEXT,
  display_name  TEXT,
  created_ts    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  patient_id    TEXT PRIMARY KEY,              -- uuid (or 'p_default' for backfill)
  name          TEXT NOT NULL,
  created_by    TEXT,                          -- caregiver_id
  created_ts    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  membership_id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id    TEXT NOT NULL,
  caregiver_id  TEXT,                          -- null until a pending invite is claimed
  invited_email TEXT,                          -- set for invites; matched on sync
  role          TEXT NOT NULL DEFAULT 'caregiver', -- 'owner' | 'caregiver'
  status        TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'pending'
  created_ts    INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_caregiver ON memberships(patient_id, caregiver_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_invite ON memberships(patient_id, invited_email);
