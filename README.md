# 🧠 Carelink

<div align="center">

**An offline-first AI-powered memory companion for caregivers supporting individuals with dementia and Alzheimer's**

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue?style=flat&logo=python)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

Carelink is a privacy-first, offline-capable application designed to assist caregivers in tracking and analyzing interactions with dementia and Alzheimer's patients. By leveraging local speech-to-text processing and AI analysis, Carelink helps caregivers maintain detailed records, identify patterns, and receive insights without compromising patient privacy.

### Why Carelink?

- **🔒 Privacy-First**: All processing happens locally - no data leaves your device
- **📴 Offline-Capable**: Works without internet connectivity
- **🤖 AI-Powered**: Intelligent analysis of conversations and behavioral patterns
- **📊 Pattern Recognition**: Identifies trends in mood, agitation, and cognitive state
- **⏱️ Real-Time Transcription**: Instant audio-to-text conversion
- **📝 Comprehensive Logging**: Detailed session records for healthcare provider review

---

## ✨ Features

### Core Functionality
- **Audio Recording & Transcription**: Record caregiver-patient interactions with real-time speech-to-text conversion using whisper.cpp
- **Session Management**: Track different session types (Medication, Conversation, Meals, Activities, Sundowning)
- **AI-Powered Analysis**: Automatic summarization and sentiment analysis using local LLM (Gemma 3n via Ollama)
- **Timeline View**: Visual timeline of all sessions with filtering and search capabilities
- **Mood & Agitation Tracking**: Monitor emotional states and behavioral patterns over time

### Session Types
- **Medication**: Track medication administration and patient responses
- **Conversation**: Record general conversations and cognitive engagement
- **Meals**: Monitor eating habits and mealtime behaviors
- **Activities**: Document daily activities and participation levels
- **Sundowning**: Track late-day confusion and behavioral changes

### Technical Features
- **Offline-First Architecture**: Full functionality without internet connection
- **Local Data Storage**: Encrypted SQLite database for secure data persistence
- **WebM to WAV Conversion**: Automatic audio format conversion using FFmpeg
- **Real-Time Audio Visualization**: Visual feedback during recording
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark Mode Support**: Eye-friendly interface for extended use

---

## 🛠️ Tech Stack

### Backend
- **[FastAPI](https://fastapi.tiangolo.com/)**: Modern Python web framework for building APIs
- **[SQLite](https://www.sqlite.org/)**: Lightweight, serverless database
- **[whisper.cpp](https://github.com/ggerganov/whisper.cpp)**: High-performance speech recognition
- **[FFmpeg](https://ffmpeg.org/)**: Audio/video processing
- **[Ollama](https://ollama.ai/)**: Local LLM server for AI analysis
- **Python 3.8+**: Core backend language

### Frontend
- **[Next.js 15.2](https://nextjs.org/)**: React framework with App Router
- **[React 19](https://react.dev/)**: UI library
- **[TypeScript 5](https://www.typescriptlang.org/)**: Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com/)**: Accessible component library
- **[Recharts](https://recharts.org/)**: Data visualization
- **[Lucide React](https://lucide.dev/)**: Icon library

### AI & ML
- **whisper.cpp (base.en model)**: Offline speech-to-text transcription
- **DeepSeek v3.1 (671b-cloud)**: Local language model for text analysis and summarization
- **Ollama Runtime**: Manages local AI model execution with DeepSeek

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│    (Next.js 15 + React 19 + TypeScript + Tailwind CSS)         │
│  - Audio Recording Interface                                     │
│  - Real-time Transcription Display                              │
│  - Session Timeline & Analytics                                 │
│  - Landing Page & Marketing Site                                │
└──────────────────┬───────────────────────────────────────────────┘
                   │ REST API (HTTP)
┌──────────────────▼───────────────────────────────────────────────┐
│                        API Gateway                                │
│                   (FastAPI + CORS Middleware)                     │
│  - Request Routing                                                │
│  - Global Exception Handling                                      │
│  - Health Check Endpoints                                         │
└───────┬────────────────┬───────────────────┬──────────────────────┘
        │                │                   │
        ▼                ▼                   ▼
┌───────────────┐ ┌──────────────┐ ┌─────────────────────────────┐
│   Session     │ │  Transcribe  │ │   Session-Specific Chains   │
│   Routes      │ │   Routes     │ │  (/api/freeform/*,          │
│  - Create     │ │  - Audio     │ │   /api/medication/*,        │
│  - Update     │ │    Upload    │ │   /api/sundowning/*)        │
│  - Delete     │ │  - Process   │ │                             │
│  - List       │ │              │ │  Each chain has 3 stages:   │
└───────┬───────┘ └──────┬───────┘ │  1. Extract                 │
        │                │         │  2. Analyze                 │
        │                │         │  3. Summarize               │
        └────────────────┼─────────┴──────────┬──────────────────┘
                         │                    │
        ┌────────────────▼────────────────────▼──────────────────┐
        │               Processing Layer                          │
        │                                                         │
        │  ┌──────────────┐      ┌──────────────────────────┐   │
        │  │   FFmpeg     │      │     whisper.cpp          │   │
        │  │  (WebM→WAV)  │─────▶│  (WAV→Text Transcription)│   │
        │  └──────────────┘      └──────────────────────────┘   │
        │                                                         │
        │  ┌──────────────────────────────────────────────────┐ │
        │  │      3-Stage AI Prompt Chain Architecture        │ │
        │  │                                                  │ │
        │  │  Transcript → EXTRACT → ANALYZE → SUMMARIZE     │ │
        │  │                 ↓          ↓          ↓         │ │
        │  │              JSON       JSON       JSON +       │ │
        │  │              Data       Insights   Store DB     │ │
        │  │                                                  │ │
        │  │  ┌────────────────────────────────────────────┐│ │
        │  │  │   Ollama (DeepSeek v3.1:671b-cloud)        ││ │
        │  │  │   - Loads prompts from /backend/prompts/   ││ │
        │  │  │   - {type}_extract.json                    ││ │
        │  │  │   - {type}_analyze.json                    ││ │
        │  │  │   - {type}_summary.json                    ││ │
        │  │  └────────────────────────────────────────────┘│ │
        │  └──────────────────────────────────────────────────┘ │
        └─────────────────┬────────────────────────────────────┘
                          │
        ┌─────────────────▼──────────────────────────────┐
        │              Data Layer                         │
        │                                                 │
        │  ┌───────────────────────────────────────────┐ │
        │  │         SQLite Database                   │ │
        │  │  - sessions (session metadata)            │ │
        │  │  - transcripts (speech-to-text output)    │ │
        │  │  - summaries (AI analysis results)        │ │
        │  │  - audio_chunks (recording segments)      │ │
        │  └───────────────────────────────────────────┘ │
        │                                                 │
        │  ┌───────────────────────────────────────────┐ │
        │  │       File Storage (Local)                │ │
        │  │  - /backend/recordings/*.wav              │ │
        │  │  - /backend/prompts/*.json (templates)    │ │
        │  └───────────────────────────────────────────┘ │
        └─────────────────────────────────────────────────┘

### Prompt Chain Flow

Each session type (freeform, medication, sundowning) follows a 3-stage chain:

1. **EXTRACT Stage**: Pulls structured data from raw transcript
   - Input: Raw transcript text
   - Processing: Ollama + extract prompt template
   - Output: JSON with conversation themes, cognitive signs, repeated questions

2. **ANALYZE Stage**: Interprets extracted data for patterns
   - Input: Extracted JSON data
   - Processing: Ollama + analyze prompt template
   - Output: JSON with tone, agitation score, cognitive function analysis

3. **SUMMARIZE Stage**: Generates final summary and stores in database
   - Input: Both extracted and analyzed data
   - Processing: Ollama + summary prompt template
   - Output: Comprehensive summary + database storage
```

---

## 📋 Prerequisites

Before installing Carelink, ensure you have the following installed:

### Required
- **Python 3.8+**: [Download](https://www.python.org/downloads/)
- **Node.js 18+**: [Download](https://nodejs.org/)
- **pnpm**: Package manager (`npm install -g pnpm`)
- **CMake**: For building whisper.cpp ([Download](https://cmake.org/download/))
- **FFmpeg**: Audio processing ([Download](https://ffmpeg.org/download.html))
- **Ollama**: Local LLM runtime ([Download](https://ollama.ai/download))

### Platform-Specific
- **macOS**: Install Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: Install build essentials (`sudo apt-get install build-essential`)
- **Windows**: Install Visual Studio Build Tools

---

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/Carelink.git
cd Carelink
```

### 2. Setup whisper.cpp
```bash
# Clone whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# Build whisper.cpp
cmake -B build
cmake --build build -j --config Release

# Download the English model (360MB)
./models/download-ggml-model.sh base.en

cd ..
```

### 3. Setup Backend
```bash
# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Initialize database
cd backend
python -c "import database; database.init_database()"
cd ..
```

### 4. Setup Ollama & AI Models
```bash
# Install Ollama from https://ollama.ai/download

# Pull the DeepSeek model
ollama pull deepseek-v3.1:671b-cloud

# Start Ollama service (keep running in separate terminal)
ollama serve
```

### 5. Setup Frontend
```bash
cd frontend

# Install dependencies
pnpm install

cd ..
```

### 6. Configure Environment (Optional)
Create `.env` files if needed:

**Backend `.env`:**
```env
DATABASE_PATH=../db/carelink.db
WHISPER_MODEL_PATH=../whisper.cpp/models/ggml-base.en.bin
WHISPER_BINARY_PATH=../whisper.cpp/build/bin/main
OLLAMA_API_URL=http://localhost:11434
RECORDINGS_PATH=./recordings
```

**Frontend `.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🎮 Usage

### Starting the Application

#### 1. Start Backend Server
```bash
# From project root
python start_carelink.py

# Or manually
cd backend
source ../venv/bin/activate  # On Windows: ..\venv\Scripts\activate
python main.py
```

The backend API will be available at `http://localhost:8000`

#### 2. Start Frontend Development Server
```bash
# In a new terminal
cd frontend
pnpm run dev
```

The frontend will be available at `http://localhost:3000`

#### 3. Ensure Ollama is Running
```bash
# In a separate terminal
ollama serve
```

### Using the Application

1. **Start a New Session**
   - Click "New Session" on the home page
   - Select session type (Medication, Conversation, etc.)
   - Enter session notes if desired

2. **Record Audio**
   - Click the microphone button to start recording
   - Speak clearly during the interaction
   - Click stop when finished

3. **View Transcription**
   - Audio is automatically transcribed using whisper.cpp
   - Transcript appears in real-time

4. **AI Analysis**
   - System automatically analyzes the session
   - View mood, agitation scores, and AI-generated summary
   - Review key events and patterns

5. **Session Timeline**
   - View all past sessions in chronological order
   - Filter by session type
   - Search by keywords
   - Export session data

---

## 📁 Project Structure

```
Carelink/
├── backend/                    # Python FastAPI backend
│   ├── routes/                 # API route handlers
│   │   ├── session.py         # Session management
│   │   ├── transcribe.py      # Audio transcription
│   │   ├── summarize.py       # AI analysis
│   │   ├── audio.py           # Audio file handling
│   │   └── *_chain.py         # Session-specific prompt chains
│   ├── prompts/               # AI prompt templates
│   ├── recordings/            # Audio file storage
│   ├── main.py                # FastAPI application entry
│   ├── database.py            # Database connection & setup
│   ├── models.py              # Pydantic data models
│   └── crud.py                # Database operations
│
├── frontend/                  # Next.js React frontend
│   ├── app/                   # Next.js 15 App Router
│   │   ├── page.tsx          # Home page
│   │   └── layout.tsx        # Root layout
│   ├── components/            # React components
│   │   └── ui/               # shadcn/ui components
│   ├── hooks/                # Custom React hooks
│   │   └── useAudioRecorder.ts
│   ├── lib/                  # Utility functions
│   ├── carelink-app.tsx      # Main application component
│   └── package.json          # Frontend dependencies
│
├── db/                       # Database storage
│   ├── carelink.db          # SQLite database
│   └── schema.sql           # Database schema
│
├── whisper.cpp/             # Speech recognition (external)
│   ├── models/              # Whisper AI models
│   └── build/               # Compiled binaries
│
├── requirements.txt         # Python dependencies
├── start_carelink.py       # Application launcher
├── SETUP.md                # Detailed setup guide
├── FUTURE_EXPANSION_ROADMAP.md  # Development roadmap
└── README.md               # This file
```

---

## 🔌 API Documentation

### Base URL
```
http://localhost:8000
```

### Core Endpoints

#### Health Check
```http
GET /health
```
Returns API and database health status.

#### Sessions

**Create Session**
```http
POST /api/sessions
Content-Type: application/json

{
  "session_type": "Medication",
  "notes": "Morning medication administration"
}
```

**List Sessions**
```http
GET /api/sessions?limit=50&offset=0
```

**Get Session by ID**
```http
GET /api/sessions/{session_id}
```

**Update Session**
```http
PUT /api/sessions/{session_id}
Content-Type: application/json

{
  "notes": "Updated session notes",
  "end_ts": "2024-10-12T15:30:00"
}
```

**Delete Session**
```http
DELETE /api/sessions/{session_id}
```

#### Audio & Transcription

**Upload Audio**
```http
POST /api/record-audio
Content-Type: multipart/form-data

{
  "audio": <audio_file.webm>,
  "session_id": "uuid",
  "session_type": "Medication"
}
```

**Transcribe Audio**
```http
POST /api/transcribe
Content-Type: multipart/form-data

{
  "audio": <audio_file.wav>,
  "session_id": "uuid"
}
```

#### AI Analysis

**Generate Summary**
```http
POST /api/summarize
Content-Type: application/json

{
  "session_id": "uuid",
  "transcript_text": "Full transcript text here"
}
```

**Medication Analysis**
```http
POST /api/medication-chain
Content-Type: application/json

{
  "transcript_text": "Transcript of medication session"
}
```

### Response Format

**Success Response (200)**
```json
{
  "status": "success",
  "data": { ... }
}
```

**Error Response (4xx/5xx)**
```json
{
  "detail": "Error description",
  "traceback": "Full error trace (development only)"
}
```

---

## 💻 Development

### Running Tests

**Backend Tests**
```bash
cd backend
pytest
```

**Frontend Tests**
```bash
cd frontend
pnpm test
```

### Development Workflow

1. **Backend Development**
   ```bash
   cd backend
   source ../venv/bin/activate
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Frontend Development**
   ```bash
   cd frontend
   pnpm run dev
   ```

3. **Type Checking**
   ```bash
   # Frontend TypeScript
   cd frontend
   pnpm run build  # Checks types during build
   ```

### Code Style

**Python (Backend)**
- Follow PEP 8 guidelines
- Use type hints where possible
- Document functions with docstrings

**TypeScript (Frontend)**
- Use ESLint and Prettier configurations
- Follow React best practices
- Use TypeScript strict mode

### Database Management

**View Database**
```bash
sqlite3 db/carelink.db
.tables
.schema sessions
SELECT * FROM sessions LIMIT 10;
```

**Reset Database**
```bash
cd backend
python -c "import database; database.init_database()"
```

---

## 🗺️ Roadmap

### Current Version: 1.0 (MVP)
- ✅ Offline audio recording
- ✅ Local speech-to-text transcription
- ✅ AI-powered session analysis
- ✅ Session timeline and history
- ✅ Multiple session types

### Phase 1: Foundation (Q1 2025)
- [ ] User authentication (Google OAuth, Email/Password)
- [ ] Multi-tenant architecture
- [ ] Progressive Web App (PWA) capabilities
- [ ] Offline sync and data persistence
- [ ] Enhanced security and encryption

### Phase 2: Intelligence & Mobile (Q2-Q3 2025)
- [ ] Real-time transcription with WebSockets
- [ ] Advanced sentiment and emotion analysis
- [ ] React Native mobile apps (iOS/Android)
- [ ] Push notifications for caregivers
- [ ] Healthcare provider dashboard

### Phase 3: Integration (Q4 2025 - Q1 2026)
- [ ] FHIR compliance
- [ ] EHR system integration (Epic, Cerner)
- [ ] Microservices architecture
- [ ] Cloud deployment options
- [ ] Advanced analytics platform

### Phase 4: Enterprise (2026+)
- [ ] Predictive analytics and ML models
- [ ] HIPAA compliance certification
- [ ] Enterprise reporting and dashboards
- [ ] IoT device integration
- [ ] Multi-language support

See [FUTURE_EXPANSION_ROADMAP.md](FUTURE_EXPANSION_ROADMAP.md) for detailed technical roadmap.

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the Repository**
   ```bash
   git fork https://github.com/yourusername/Carelink.git
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**
   - Write clean, documented code
   - Add tests for new features
   - Follow existing code style

4. **Commit Your Changes**
   ```bash
   git commit -m "feat: add your feature description"
   ```

5. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**
   - Provide clear description of changes
   - Reference any related issues
   - Ensure CI checks pass

### Development Guidelines
- Write clear commit messages (follow [Conventional Commits](https://www.conventionalcommits.org/))
- Add tests for new features
- Update documentation as needed
- Ensure code passes linting and type checks

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **whisper.cpp**: High-performance speech recognition by [Georgi Gerganov](https://github.com/ggerganov)
- **Ollama**: Local LLM runtime for privacy-focused AI
- **shadcn/ui**: Beautiful and accessible component library
- **FastAPI**: Modern Python web framework
- **Next.js**: React framework for production

---

## 📞 Support

For questions, issues, or feedback:

- **Issues**: [GitHub Issues](https://github.com/yourusername/Carelink/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/Carelink/discussions)
- **Email**: support@carelink.app

---

## ⚠️ Disclaimer

Carelink is a tool designed to assist caregivers and should not replace professional medical advice, diagnosis, or treatment. Always seek the advice of qualified healthcare providers with any questions regarding medical conditions.

---

<div align="center">

**Built with ❤️ for caregivers supporting individuals with dementia and Alzheimer's**

[⬆ Back to Top](#-carelink)

</div>
