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

// Trend analysis (M2) — must stay in sync with backend/models.py
export interface TrendPoint {
  week_start_ts: number
  session_count: number
  avg_agitation?: number | null
}

export interface MoodSlice {
  mood_label: string
  count: number
}

export interface TrendsResponse {
  from_ts?: number | null
  to_ts?: number | null
  total_sessions: number
  avg_agitation?: number | null
  calm_label: string
  mood_distribution: MoodSlice[]
  top_phrase?: string | null
  top_phrase_count: number
  weekly: TrendPoint[]
}

// Smart reminders (M3) — must stay in sync with backend/models.py
export type ReminderKind = "medication" | "appointment"
export type ReminderRecurrence = "once" | "daily"

export interface Reminder {
  reminder_id: number
  title: string
  kind: ReminderKind
  recurrence: ReminderRecurrence
  due_ts?: number | null
  time_of_day?: string | null
  notes?: string | null
  last_done_ts?: number | null
  active: number
  created_ts: number
}

export interface ReminderCreate {
  title: string
  kind: ReminderKind
  recurrence: ReminderRecurrence
  due_ts?: number | null
  time_of_day?: string | null
  notes?: string | null
}

export interface ReminderListResponse {
  reminders: Reminder[]
}

// Local multi-profile (M4) — must stay in sync with backend/models.py
export type Role = "owner" | "caregiver"

export interface Caregiver {
  caregiver_id: string
  email?: string | null
  display_name?: string | null
  created_ts: number
}

export interface PatientWithRole {
  patient_id: string
  name: string
  role: Role
}

export interface CaregiverSyncResponse {
  caregiver: Caregiver
  patients: PatientWithRole[]
}

export interface PatientListResponse {
  patients: PatientWithRole[]
}

export interface Member {
  membership_id: number
  caregiver_id?: string | null
  email?: string | null
  display_name?: string | null
  role: Role
  status: "active" | "pending"
}

export interface MemberListResponse {
  members: Member[]
}

// API client functions
export class CarelinkAPI {
  private baseUrl: string
  private caregiverId?: string
  private activePatientId?: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  // M4: identity for the trusted-local backend. Set once on login and whenever
  // the active patient changes; injected as headers on every request so reads
  // and writes are scoped to the right caregiver + patient.
  setCaregiverId(caregiverId?: string) {
    this.caregiverId = caregiverId
  }

  setActivePatient(patientId?: string) {
    this.activePatientId = patientId
  }

  private authHeaders(): Record<string, string> {
    const h: Record<string, string> = {}
    if (this.caregiverId) h["X-Caregiver-Id"] = this.caregiverId
    if (this.activePatientId) h["X-Patient-Id"] = this.activePatientId
    return h
  }

  // Single fetch entry point so identity headers ride along on every call.
  private request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`
    return fetch(url, {
      ...init,
      headers: { ...this.authHeaders(), ...(init.headers || {}) },
    })
  }

  // Session management
  async startSession(request: StartSessionRequest): Promise<StartSessionResponse> {
    const response = await this.request(`/start-session`, {
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
    const response = await this.request(`/sessions?limit=${limit}&offset=${offset}`)
    
    if (!response.ok) {
      throw new Error(`Failed to get sessions: ${await errorDetail(response)}`)
    }

    return response.json()
  }

  async getSession(sessionId: string): Promise<SessionDetail> {
    const response = await this.request(`/session/${sessionId}`)
    
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

    const response = await this.request(`/record-audio`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Failed to record audio: ${await errorDetail(response)}`)
    }

    return response.json()
  }

  async processSession(request: ProcessSessionRequest): Promise<ProcessSessionResponse> {
    const response = await this.request(`/process-session`, {
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
    const response = await this.request(`/transcribe`, {
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

  // Export a care-summary PDF over an optional epoch-ms range. Returns the
  // raw PDF as a Blob; the caller triggers the browser download.
  async exportReport(fromTs?: number, toTs?: number): Promise<Blob> {
    const qs = new URLSearchParams()
    if (fromTs) qs.set('from_ts', String(fromTs))
    if (toTs) qs.set('to_ts', String(toTs))
    const query = qs.toString()
    const response = await this.request(`/export/report${query ? `?${query}` : ''}`)

    if (!response.ok) {
      throw new Error(`Failed to export report: ${await errorDetail(response)}`)
    }

    return response.blob()
  }

  // Aggregated mood/agitation/repetition trends over an optional epoch-ms range.
  async getTrends(fromTs?: number, toTs?: number): Promise<TrendsResponse> {
    const qs = new URLSearchParams()
    if (fromTs) qs.set('from_ts', String(fromTs))
    if (toTs) qs.set('to_ts', String(toTs))
    const query = qs.toString()
    const response = await this.request(`/trends${query ? `?${query}` : ''}`)

    if (!response.ok) {
      throw new Error(`Failed to get trends: ${await errorDetail(response)}`)
    }

    return response.json()
  }

  // ── Reminders (M3) ──────────────────────────────────────────────────────
  async getReminders(includeInactive = false): Promise<ReminderListResponse> {
    const qs = includeInactive ? "?include_inactive=true" : ""
    const response = await this.request(`/reminders${qs}`)
    if (!response.ok) throw new Error(`Failed to load reminders: ${await errorDetail(response)}`)
    return response.json()
  }

  async createReminder(reminder: ReminderCreate): Promise<Reminder> {
    const response = await this.request(`/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reminder),
    })
    if (!response.ok) throw new Error(`Failed to create reminder: ${await errorDetail(response)}`)
    return response.json()
  }

  async completeReminder(reminderId: number): Promise<Reminder> {
    const response = await this.request(`/reminders/${reminderId}/done`, { method: "POST" })
    if (!response.ok) throw new Error(`Failed to update reminder: ${await errorDetail(response)}`)
    return response.json()
  }

  async deleteReminder(reminderId: number): Promise<void> {
    const response = await this.request(`/reminders/${reminderId}`, { method: "DELETE" })
    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete reminder: ${await errorDetail(response)}`)
    }
  }

  // ── Caregivers / patients / members (M4) ─────────────────────────────────
  async syncCaregiver(caregiverId: string, email?: string | null, displayName?: string | null): Promise<CaregiverSyncResponse> {
    const response = await this.request(`/caregivers/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caregiver_id: caregiverId, email: email ?? null, display_name: displayName ?? null }),
    })
    if (!response.ok) throw new Error(`Failed to sync caregiver: ${await errorDetail(response)}`)
    return response.json()
  }

  async getPatients(): Promise<PatientListResponse> {
    const response = await this.request(`/patients`)
    if (!response.ok) throw new Error(`Failed to load patients: ${await errorDetail(response)}`)
    return response.json()
  }

  async createPatient(name: string): Promise<PatientWithRole> {
    const response = await this.request(`/patients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) throw new Error(`Failed to create patient: ${await errorDetail(response)}`)
    return response.json()
  }

  async getMembers(patientId: string): Promise<MemberListResponse> {
    const response = await this.request(`/patients/${patientId}/members`)
    if (!response.ok) throw new Error(`Failed to load care circle: ${await errorDetail(response)}`)
    return response.json()
  }

  async inviteMember(patientId: string, email: string, role: Role = "caregiver"): Promise<Member> {
    const response = await this.request(`/patients/${patientId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    })
    if (!response.ok) throw new Error(`${await errorDetail(response)}`)
    return response.json()
  }

  async removeMember(patientId: string, membershipId: number): Promise<void> {
    const response = await this.request(`/patients/${patientId}/members/${membershipId}`, { method: "DELETE" })
    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to remove member: ${await errorDetail(response)}`)
    }
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
