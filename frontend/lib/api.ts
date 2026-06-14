// API client for Carelink backend
const API_BASE_URL = 'http://localhost:8000/api'

// Extract a useful message from a failed response. FastAPI returns
// { detail: "..." } on errors; fall back to status text if absent.
async function errorDetail(response: Response): Promise<string> {
  try {
    const body = await response.clone().json()
    if (body?.detail) return String(body.detail)
  } catch {
    // response body was not JSON
  }
  return response.statusText || `HTTP ${response.status}`
}

// Types matching backend models
export interface StartSessionRequest {
  session_type: string
  timestamp: number
}

export interface StartSessionResponse {
  session_id: string
}

export interface TranscribeRequest {
  session_id: string
  audio_path: string
}

export interface TranscribeResponse {
  transcript: string
}

export interface RecordAudioResponse {
  transcript: string
  metadata: {
    session_id: string
    timestamp: string
    patient_id: string
    session_type: string
    audio_file: string
  }
}

export interface ProcessSessionRequest {
  transcript: string
  metadata: {
    session_id: string
    timestamp: string
    patient_id: string
    session_type: string
    audio_file: string
  }
}

export interface ProcessSessionResponse {
  session_id: string
  analysis: {
    summary: string
    tags: string[]
    mood_label: string
    agitation_score: number
    suggestions: string[]
  }
  status: string
}

export interface SessionListItem {
  session_id: string
  session_type: string
  start_ts: number
  end_ts?: number
  summary_text?: string
  mood_label?: string
  agitation_score?: number
}

export interface SessionListResponse {
  sessions: SessionListItem[]
}

export interface SessionDetail {
  session_id: string
  session_type: string
  start_ts: number
  end_ts?: number
  notes?: string
  summary_text?: string
  mood_label?: string
  agitation_score?: number
  suggestions?: string
}

// API client functions
export class CarelinkAPI {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  // Session management
  async startSession(request: StartSessionRequest): Promise<StartSessionResponse> {
    const response = await fetch(`${this.baseUrl}/start-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`Failed to start session: ${await errorDetail(response)}`)
    }

    return response.json()
  }

  async getSessions(limit: number = 100, offset: number = 0): Promise<SessionListResponse> {
    const response = await fetch(`${this.baseUrl}/sessions?limit=${limit}&offset=${offset}`)
    
    if (!response.ok) {
      throw new Error(`Failed to get sessions: ${await errorDetail(response)}`)
    }

    return response.json()
  }

  async getSession(sessionId: string): Promise<SessionDetail> {
    const response = await fetch(`${this.baseUrl}/session/${sessionId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to get session: ${await errorDetail(response)}`)
    }

    return response.json()
  }

  // Audio recording and processing
  async recordAudio(audioBlob: Blob, sessionType: string, patientId: string = "default_patient"): Promise<RecordAudioResponse> {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.wav')
    formData.append('session_type', sessionType)
    formData.append('patient_id', patientId)

    const response = await fetch(`${this.baseUrl}/record-audio`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Failed to record audio: ${await errorDetail(response)}`)
    }

    return response.json()
  }

  async processSession(request: ProcessSessionRequest): Promise<ProcessSessionResponse> {
    const response = await fetch(`${this.baseUrl}/process-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`Failed to process session: ${await errorDetail(response)}`)
    }

    return response.json()
  }

  // Transcription (legacy method)
  async transcribeAudio(request: TranscribeRequest): Promise<TranscribeResponse> {
    const response = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`Failed to transcribe audio: ${await errorDetail(response)}`)
    }

    return response.json()
  }

  // Health check
  async healthCheck(): Promise<{ status: string; database: string }> {
    const response = await fetch('http://localhost:8000/health')
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${await errorDetail(response)}`)
    }

    return response.json()
  }
}

// Export a default instance
export const api = new CarelinkAPI()
