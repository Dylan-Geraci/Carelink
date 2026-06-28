PRAGMA foreign_keys = ON;

CREATE TABLE sessions (
  session_id   TEXT PRIMARY KEY,      -- UUIDv4
  session_type TEXT NOT NULL,         -- Medication, Conversation, etc.
  start_ts     INTEGER NOT NULL,      -- epoch ms
  end_ts       INTEGER,               -- nullable
  notes        TEXT
);
CREATE INDEX idx_sessions_start ON sessions(start_ts);

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
-- 'medication' (recurrence 'daily' at time_of_day 'HH:MM' local) and
-- 'appointment' (recurrence 'once' at absolute due_ts epoch ms). Occurrence/
-- overdue status is computed against the live clock on the client, not stored.
-- IF NOT EXISTS so the live migration in database.py is idempotent on old DBs.
CREATE TABLE IF NOT EXISTS reminders (
  reminder_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  kind          TEXT NOT NULL,                 -- 'medication' | 'appointment'
  recurrence    TEXT NOT NULL DEFAULT 'once',  -- 'once' | 'daily'
  due_ts        INTEGER,                       -- one-off: absolute epoch ms
  time_of_day   TEXT,                          -- daily: 'HH:MM' local
  notes         TEXT,
  last_done_ts  INTEGER,                       -- epoch ms last marked done
  active        INTEGER NOT NULL DEFAULT 1,
  created_ts    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(active);
