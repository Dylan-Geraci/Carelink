# 🧠 Carelink

**Offline-first, privacy-first AI companion for caregivers supporting people with dementia and Alzheimer's.**

Record short caregiving sessions; audio is transcribed locally (whisper.cpp) and summarized by a
local LLM (Ollama) into mood, agitation, and suggestions, then stored in SQLite and shown on a
timeline. Nothing leaves your device.

## Features

- **Voice capture & transcription** — record interactions; whisper.cpp converts speech to text locally.
- **AI session analysis** — a local LLM summarizes each session into mood, an agitation score, and suggestions.
- **Session timeline** — browse past sessions grouped by day.
- **PDF care reports** — export a summary over any date range for medical visits.
- **Session types** — tailored prompts for Medication, Sundowning, and Freeform sessions.

## Tech stack

- **Backend:** FastAPI · SQLite · Python 3.8+
- **Transcription:** whisper.cpp (`base.en`)
- **AI summarization:** Ollama (`gemma2:2b` by default), local
- **Audio:** FFmpeg (WebM→WAV)
- **Frontend:** Next.js 15 (App Router) · React 18 · TypeScript · Tailwind CSS · shadcn/ui

## Architecture

```
record audio → WebM→WAV (FFmpeg) → whisper.cpp → Ollama summarize → SQLite → timeline (/api/sessions)
```

- `backend/` — FastAPI app: `routes/` (HTTP), `crud.py` (all SQL), `database.py`, `models.py`,
  `prompts/` (per-type JSON templates), `report.py` (PDF export).
- `frontend/` — Next.js: `app/` routes, `components/carelink-app.tsx` (main app),
  `lib/api.ts` (typed API client).
- `db/schema.sql` — source of truth for tables.

Backend serves on `http://localhost:8000`; frontend dev on `http://localhost:3100`.

## Prerequisites

Python 3.8+, Node 18+, FFmpeg, CMake, Ollama, and whisper.cpp built with the `base.en` model.

## Quick start

**1. whisper.cpp** (one-time)
```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp && cmake -B build && cmake --build build -j --config Release
./models/download-ggml-model.sh base.en && cd ..
```

**2. Ollama** (one-time, then keep running)
```bash
ollama pull gemma2:2b
ollama serve
```

**3. Backend**
```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd backend && python main.py      # http://localhost:8000
```

**4. Frontend** (new terminal)
```bash
cd frontend
npm install
npm run dev                       # http://localhost:3100
```

Optional env: `OLLAMA_MODEL` (default `gemma2:2b`), `OLLAMA_URL` (default
`http://localhost:11434/api/generate`).

## API

REST API at `http://localhost:8000`, with interactive Swagger docs auto-generated at
`http://localhost:8000/docs`. See **[docs/API.md](docs/API.md)** for an endpoint reference.

## Development

```bash
# Backend
pip install ruff
ruff check backend
cd backend && pytest        # some tests need whisper.cpp/Ollama (local-only)

# Frontend
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

Conventions: timestamps are epoch **milliseconds** everywhere; all SQL lives in `backend/crud.py`
(parameterized); Pydantic models in `backend/models.py` mirror the TypeScript interfaces in
`frontend/lib/api.ts` — keep the two in sync.

## Disclaimer

Carelink assists caregivers and does not replace professional medical advice, diagnosis, or
treatment. Always consult qualified healthcare providers.

## License

MIT.
