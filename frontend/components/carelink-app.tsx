"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { api, SessionListItem, RecordAudioResponse, ProcessSessionResponse, TrendsResponse } from "@/lib/api"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts"
import { useAudioRecording } from "@/hooks/useAudioRecording"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Plus,
  Clock,
  Heart,
  Pill,
  Coffee,
  Sunset,
  FileText,
  ArrowLeft,
  RotateCcw,
  Edit3,
  Tag,
  Shield,
  Sun,
  TrendingUp,
  Sparkles,
  X,
  Download,
  type LucideIcon,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type Screen = "home" | "session-type" | "session-confirm" | "processing" | "session-summary"
type SessionType = "medication" | "sundowning" | "freeform" | null
type ProcessingStage = "transcribing" | "analyzing" | "complete"

// Audio Waveform Component
const AudioWaveform = ({ isListening, isRecording }: { isListening: boolean; isRecording: boolean }) => {
  const [audioData, setAudioData] = useState<number[]>(new Array(12).fill(0))
  const animationRef = useRef<number>()

  useEffect(() => {
    if (isListening) {
      const animate = () => {
        // Simulate audio input with gentle, organic movement
        const newData = audioData.map((_, index) => {
          const baseHeight = 0.2 + Math.sin(Date.now() * 0.002 + index * 0.5) * 0.1
          const randomVariation = Math.random() * 0.3
          const recordingBoost = isRecording ? Math.random() * 0.4 : 0
          return Math.max(0.1, Math.min(1, baseHeight + randomVariation + recordingBoost))
        })
        setAudioData(newData)
        animationRef.current = requestAnimationFrame(animate)
      }
      animate()
    } else {
      // Gentle fade to silence
      const fadeOut = () => {
        setAudioData((prev) => prev.map((val) => Math.max(0.05, val * 0.95)))
        if (audioData.some((val) => val > 0.1)) {
          setTimeout(fadeOut, 50)
        }
      }
      fadeOut()
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isListening, isRecording])

  return (
    <div className="flex items-end justify-center gap-1 h-24 w-48">
      {audioData.map((height, index) => (
        <div
          key={index}
          className="transition-all duration-100 ease-out rounded-full"
          style={{
            width: "8px",
            height: `${height * 80}px`,
            backgroundColor: isRecording
              ? `rgba(139, 170, 173, ${0.4 + height * 0.6})`
              : `rgba(139, 170, 173, ${0.2 + height * 0.4})`,
            minHeight: "4px",
          }}
        />
      ))}
    </div>
  )
}

// Map a free-text mood label (LLM output) to a stable accent color.
const moodColor = (mood: string): string => {
  const m = mood.toLowerCase()
  if (/(calm|content|happy|peace|relax|warm|engaged)/.test(m)) return "#8BAAAD"
  if (/(anx|agitat|upset|distress|angry|frustrat|restless)/.test(m)) return "#E2A2A2"
  if (/(sad|low|tear|withdraw|lonely)/.test(m)) return "#A9B7D0"
  return "#C9B8E0"
}

// Badge colors for the at-a-glance weekly calm label.
const calmBadgeStyle = (label: string): { backgroundColor: string; color: string } => {
  switch (label) {
    case "Calm":
      return { backgroundColor: "#E8F5E8", color: "#2D5016" }
    case "Mixed":
      return { backgroundColor: "#FBEFD9", color: "#7A5A1E" }
    case "Elevated":
      return { backgroundColor: "#FBE3E3", color: "#8A2D2D" }
    default:
      return { backgroundColor: "#EEF1F2", color: "#546A7B" }
  }
}

// Right-hand "insights" panel: real weekly agitation trend + mood mix (M2).
// Replaces the former "Space for insights" placeholder.
const InsightsPanel = ({ trends, isLoading }: { trends: TrendsResponse | null; isLoading: boolean }) => {
  if (isLoading) {
    return (
      <div className="p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-gray-100">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300 mx-auto" />
      </div>
    )
  }

  if (!trends || trends.total_sessions === 0) {
    return (
      <div className="p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-gray-100">
        <p className="text-gray-400 text-sm text-center italic">
          Insights appear here once you&apos;ve recorded a few sessions
        </p>
      </div>
    )
  }

  const chartData = trends.weekly
    .filter((w) => w.avg_agitation !== null && w.avg_agitation !== undefined)
    .map((w) => ({
      label: new Date(w.week_start_ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      agitation: w.avg_agitation as number,
      sessions: w.session_count,
    }))

  const totalMood = trends.mood_distribution.reduce((sum, m) => sum + m.count, 0)

  return (
    <div className="space-y-5">
      {/* Average agitation */}
      <div className="p-6 rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-100 shadow-sm">
        <h3 className="text-lg font-light text-gray-800 mb-1" style={{ fontFamily: "Georgia, serif" }}>
          Insights
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          {trends.total_sessions} session{trends.total_sessions === 1 ? "" : "s"} analyzed
        </p>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-light text-gray-700">
            {trends.avg_agitation !== null && trends.avg_agitation !== undefined
              ? trends.avg_agitation.toFixed(1)
              : "—"}
          </span>
          <span className="text-sm text-gray-400">/ 10 avg. agitation</span>
        </div>
        <Badge
          className="mt-2 px-3 py-1 text-xs font-medium border-0"
          style={{ backgroundColor: `${moodColor(trends.calm_label)}22`, color: "#546A7B" }}
        >
          {trends.calm_label}
        </Badge>
      </div>

      {/* Weekly agitation trend */}
      {chartData.length > 0 && (
        <div className="p-6 rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-100 shadow-sm">
          <p className="text-sm font-medium text-gray-600 mb-3">Agitation by week</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEFEF" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} width={32} />
              <RechartsTooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #EEE", fontSize: 12 }}
                formatter={(value: number) => [Number(value).toFixed(1), "Avg agitation"]}
              />
              <Line
                type="monotone"
                dataKey="agitation"
                stroke="#8BAAAD"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#8BAAAD" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Mood distribution */}
      {totalMood > 0 && (
        <div className="p-6 rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-100 shadow-sm">
          <p className="text-sm font-medium text-gray-600 mb-3">Mood mix</p>
          <div className="space-y-2.5">
            {trends.mood_distribution.map((m) => (
              <div key={m.mood_label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm capitalize text-gray-700">{m.mood_label}</span>
                  <span className="text-xs text-gray-400">{m.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(m.count / totalMood) * 100}%`, backgroundColor: moodColor(m.mood_label) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Most-repeated phrase */}
      {trends.top_phrase && (
        <div className="p-5 rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-100 shadow-sm">
          <p className="text-sm font-medium text-gray-600 mb-1">Most repeated phrase</p>
          <p className="text-base text-gray-800 italic">&ldquo;{trends.top_phrase}&rdquo;</p>
          <p className="text-xs text-gray-400 mt-1">heard {trends.top_phrase_count}×</p>
        </div>
      )}
    </div>
  )
}

export default function Component() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home")
  const [selectedSessionType, setSelectedSessionType] = useState<SessionType>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [reflectionText, setReflectionText] = useState("")
  const [showWeeklyHighlights, setShowWeeklyHighlights] = useState(false)
  const [currentAffirmation, setCurrentAffirmation] = useState(0)
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [recordingResult, setRecordingResult] = useState<RecordAudioResponse | null>(null)
  const [analysisResult, setAnalysisResult] = useState<ProcessSessionResponse | null>(null)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("transcribing")
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [customRangeOpen, setCustomRangeOpen] = useState(false)
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [weekTrends, setWeekTrends] = useState<TrendsResponse | null>(null)
  const [allTrends, setAllTrends] = useState<TrendsResponse | null>(null)
  const [isLoadingTrends, setIsLoadingTrends] = useState(true)

  // Use the audio recording hook
  const audioRecording = useAudioRecording()

  // Pending 30s auto-stop timer, and a re-entrancy guard so a double-tap (or the
  // auto-stop firing alongside a manual stop) can't run the stop flow twice and
  // clobber a successful recording with a spurious "No audio data recorded".
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isStoppingRef = useRef(false)

  const affirmations = [
    "You are doing sacred work.",
    "Every act of care matters.",
    "Your presence is a gift.",
    "Compassion flows through you.",
    "You bring light to difficult moments.",
  ]

  // Rotate affirmations every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAffirmation((prev) => (prev + 1) % affirmations.length)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Load sessions from API
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoadingSessions(true)
        const response = await api.getSessions()
        setSessions(response.sessions)
      } catch (error) {
        console.error('Failed to load sessions:', error)
        // Keep empty sessions array on error
      } finally {
        setIsLoadingSessions(false)
      }
    }

    loadSessions()
  }, [])

  // Epoch ms of the local Sunday 00:00 for the current week (matches the
  // backend week buckets and the export presets).
  const getWeekStartMs = () => {
    const week = new Date()
    week.setHours(0, 0, 0, 0)
    week.setDate(week.getDate() - week.getDay())
    return week.getTime()
  }

  // Load trend aggregates: this-week (badge + highlights) and all-time (panel).
  const loadTrends = useCallback(async () => {
    try {
      setIsLoadingTrends(true)
      const [week, all] = await Promise.all([
        api.getTrends(getWeekStartMs()),
        api.getTrends(),
      ])
      setWeekTrends(week)
      setAllTrends(all)
    } catch (error) {
      console.error('Failed to load trends:', error)
    } finally {
      setIsLoadingTrends(false)
    }
  }, [])

  useEffect(() => {
    loadTrends()
  }, [loadTrends])

  // Generate a care-summary PDF for an optional epoch-ms range and download it.
  const handleExportReport = async (fromTs?: number, toTs?: number) => {
    try {
      setExportError(null)
      setIsExporting(true)
      const blob = await api.exportReport(fromTs, toTs)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `carelink-care-report-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not export the report.")
    } finally {
      setIsExporting(false)
    }
  }

  // Quick-pick export ranges, each labelled with the actual dates it covers (end = today).
  const getExportPresets = () => {
    const now = new Date()
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

    const week = new Date(now)
    week.setHours(0, 0, 0, 0)
    week.setDate(week.getDate() - week.getDay()) // back to Sunday
    const month = new Date(now.getFullYear(), now.getMonth(), 1)
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    return [
      { key: "week", title: "This week", fromTs: week.getTime() as number | undefined, range: `${fmt(week)} – ${fmt(now)}` },
      { key: "month", title: "This month", fromTs: month.getTime() as number | undefined, range: `${fmt(month)} – ${fmt(now)}` },
      { key: "days30", title: "Last 30 days", fromTs: days30.getTime() as number | undefined, range: `${fmt(days30)} – ${fmt(now)}` },
      { key: "all", title: "All time", fromTs: undefined as number | undefined, range: "All sessions" },
    ]
  }

  // Export with a user-picked from/to range (yyyy-mm-dd, parsed in local time).
  const handleCustomExport = () => {
    if (!customStart || !customEnd) {
      setExportError("Pick both a start and end date.")
      return
    }
    const toLocalMs = (value: string, endOfDay: boolean) => {
      const [y, m, d] = value.split("-").map(Number)
      return endOfDay
        ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
        : new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
    }
    const fromTs = toLocalMs(customStart, false)
    const toTs = toLocalMs(customEnd, true)
    if (fromTs > toTs) {
      setExportError("The start date must be on or before the end date.")
      return
    }
    setExportError(null)
    setCustomRangeOpen(false)
    handleExportReport(fromTs, toTs)
  }

  // Show weekly highlights after 3 seconds on home screen — but only when there
  // are real sessions this week to highlight (no empty/placeholder modal).
  useEffect(() => {
    if (currentScreen === "home" && weekTrends && weekTrends.total_sessions > 0) {
      const timer = setTimeout(() => {
        setShowWeeklyHighlights(true)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [currentScreen, weekTrends])

  // Process sessions data for display
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const dayBefore = new Date(today)
  dayBefore.setDate(dayBefore.getDate() - 2)

  // Helper functions for session styling (fixed)
  const getSessionIcon = (sessionType: string) => {
    switch (sessionType.toLowerCase()) {
      case 'medication': return '💊'
      case 'sundowning': return '🌅'
      case 'freeform': return '💬'
      default: return '📝'
    }
  }

  const getSessionColor = (sessionType: string) => {
    switch (sessionType.toLowerCase()) {
      case 'medication': return '#F0E6FF' // lavender
      case 'sundowning': return '#FFE8D6' // peach
      case 'freeform': return '#E8F5E8' // sage
      default: return '#E6F3FF' // soft blue
    }
  }

  const getSessionBorderColor = (sessionType: string) => {
    switch (sessionType.toLowerCase()) {
      case 'medication': return '#D4C5F9'
      case 'sundowning': return '#FFD4B3'
      case 'freeform': return '#B8D4B8'
      default: return '#B3D9FF'
    }
  }

  // Group sessions by day
  const groupSessionsByDay = (sessions: SessionListItem[]) => {
    const todaySessions = sessions.filter(session => {
      const sessionDate = new Date(session.start_ts)
      return sessionDate.toDateString() === today.toDateString()
    })

    const yesterdaySessions = sessions.filter(session => {
      const sessionDate = new Date(session.start_ts)
      return sessionDate.toDateString() === yesterday.toDateString()
    })

    const olderSessions = sessions.filter(session => {
      const sessionDate = new Date(session.start_ts)
      return sessionDate.toDateString() !== today.toDateString() && 
             sessionDate.toDateString() !== yesterday.toDateString()
    })

    return [
      {
        date: "Today",
        fullDate: today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        sessions: todaySessions.map(session => ({
          id: session.session_id,
          type: session.session_type,
          time: new Date(session.start_ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          summary: session.summary_text || "No summary available",
          icon: getSessionIcon(session.session_type),
          color: getSessionColor(session.session_type),
          borderColor: getSessionBorderColor(session.session_type),
        }))
      },
      {
        date: "Yesterday", 
        fullDate: yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        sessions: yesterdaySessions.map(session => ({
          id: session.session_id,
          type: session.session_type,
          time: new Date(session.start_ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          summary: session.summary_text || "No summary available",
          icon: getSessionIcon(session.session_type),
          color: getSessionColor(session.session_type),
          borderColor: getSessionBorderColor(session.session_type),
        }))
      },
      // Group older sessions by calendar day (one group per day, not per session),
      // otherwise two sessions on the same date produce duplicate React keys.
      ...Object.values(
        olderSessions.reduce((groups, session) => {
          const sessionDate = new Date(session.start_ts)
          const key = sessionDate.toDateString()
          if (!groups[key]) {
            groups[key] = {
              date: sessionDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
              fullDate: sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
              sessions: [],
            }
          }
          groups[key].sessions.push({
            id: session.session_id,
            type: session.session_type,
            time: sessionDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
            summary: session.summary_text || "No summary available",
            icon: getSessionIcon(session.session_type),
            color: getSessionColor(session.session_type),
            borderColor: getSessionBorderColor(session.session_type),
          })
          return groups
        }, {} as Record<string, { date: string; fullDate: string; sessions: Array<{ id: string; type: string; time: string; summary: string; icon: string; color: string; borderColor: string }> }>)
      )
    ]
  }

  const sessionsByDay = groupSessionsByDay(sessions)

  // Use real sessions data, fallback to empty array if loading or no data
  const displaySessionsByDay = isLoadingSessions ? [] : sessionsByDay

  const sessionTypes = [
    {
      id: "medication",
      label: "Medication",
      emoji: "💊",
      icon: Pill,
      description: "Track medication times and responses",
      color: "#F0E6FF",
      selectedColor: "#D4C5F9",
    },
    {
      id: "sundowning",
      label: "Sundowning",
      emoji: "🌅",
      icon: Sunset,
      description: "Document evening confusion or agitation",
      color: "#FFE8D6",
      selectedColor: "#FFD4B3",
    },
    {
      id: "freeform",
      label: "Freeform",
      emoji: "💬",
      icon: FileText,
      description: "Open conversation or general check-in",
      color: "#E8F5E8",
      selectedColor: "#B8D4B8",
    },
  ]

  // Shape of a timeline entry. `repetition` is optional (badge shown only when
  // an analysis surfaces a repeated topic; not yet populated by the backend).
  type KeyEvent = {
    time: string
    event: string
    icon: LucideIcon
    details: string
    repetition?: number
  }

  // Generate dynamic session data based on recording and analysis results
  const getSessionData = () => {
    const baseData = {
      type: selectedSessionType ? selectedSessionType.charAt(0).toUpperCase() + selectedSessionType.slice(1) : "Session",
      duration: audioRecording.state.recordingDuration ? `${audioRecording.state.recordingDuration} seconds` : "Recording...",
      timestamp: recordingResult?.metadata?.timestamp
        ? new Date(recordingResult.metadata.timestamp).toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
        : `Today at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`,
    }

    if (analysisResult) {
      // Use real AI analysis data
      return {
        ...baseData,
        mood: analysisResult.analysis.mood_label || "Processing...",
        moodColor: "#C9E4DE", // Could map this based on mood
        keyEvents: [
          {
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            event: `${selectedSessionType} session completed with AI analysis`,
            icon: selectedSessionType === 'medication' ? Pill : selectedSessionType === 'sundowning' ? Sunset : FileText,
            details: `Transcript: "${recordingResult?.transcript?.substring(0, 100)}${(recordingResult?.transcript?.length ?? 0) > 100 ? '...' : ''}"`,
          },
        ] as KeyEvent[],
        aiSummary: analysisResult.analysis.summary || "AI analysis completed",
        tags: analysisResult.analysis.tags || ["completed"],
        suggestions: analysisResult.analysis.suggestions || [],
        agitationScore: analysisResult.analysis.agitation_score || 0,
      }
    } else if (recordingResult) {
      // Recording complete, analysis pending
      return {
        ...baseData,
        mood: "Processing...",
        moodColor: "#F0F0F0",
        keyEvents: [
          {
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            event: `${selectedSessionType} session recorded`,
            icon: selectedSessionType === 'medication' ? Pill : selectedSessionType === 'sundowning' ? Sunset : FileText,
            details: `Transcript: "${recordingResult.transcript.substring(0, 100)}${recordingResult.transcript.length > 100 ? '...' : ''}"`,
          },
        ] as KeyEvent[],
        aiSummary: "Recording completed successfully. Running AI analysis...",
        tags: ["recorded", "analyzing"],
      }
    } else {
      // Default/loading state
      return {
        ...baseData,
        mood: "Recording...",
        moodColor: "#F0F0F0",
        keyEvents: [
          {
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            event: audioRecording.state.isRecording ? "Recording in progress..." : "Preparing to record...",
            icon: selectedSessionType === 'medication' ? Pill : selectedSessionType === 'sundowning' ? Sunset : FileText,
            details: audioRecording.state.isRecording ? "Listening to your voice..." : "Session starting...",
          },
        ] as KeyEvent[],
        aiSummary: audioRecording.state.isRecording ? "Recording your session..." : "Preparing to capture this moment...",
        tags: ["recording"],
      }
    }
  }

  const sessionData = getSessionData()

  // Navigation functions
  const startNewSession = () => {
    setCurrentScreen("session-type")
  }

  const handleTypeSelect = (type: string) => {
    setSelectedSessionType(type as SessionType)
    setTimeout(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentScreen("session-confirm")
        setIsAnimating(false)
      }, 300)
    }, 100)
  }

  const handleBack = () => {
    if (currentScreen === "session-confirm") {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentScreen("session-type")
        setSelectedSessionType(null)
        setIsAnimating(false)
        audioRecording.resetRecording()
      }, 300)
    } else if (currentScreen === "session-type") {
      setCurrentScreen("home")
    }
  }

  const handleStartSession = async () => {
    if (!selectedSessionType) return

    try {
      setRecordingError(null)
      isStoppingRef.current = false // allow stopping this fresh recording

      // Start real audio recording
      await audioRecording.startRecording()

      // Auto-stop recording after 30 seconds (configurable). Stored in a ref so a
      // manual stop can cancel it (see handleStopRecording).
      recordingTimeoutRef.current = setTimeout(() => {
        handleStopRecording()
      }, 30000) // 30 second recording

    } catch (error) {
      console.error('Failed to start recording:', error)
      setRecordingError(error instanceof Error ? error.message : 'Failed to start recording')
    }
  }

  const handleStopRecording = async () => {
    try {
      if (!selectedSessionType) return

      // Guard against a second invocation (double-tap or the auto-stop timer
      // racing a manual stop) overwriting the first, successful run.
      if (isStoppingRef.current) return
      isStoppingRef.current = true

      // Cancel the pending 30s auto-stop now that we're stopping.
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
        recordingTimeoutRef.current = null
      }

      // Navigate to processing screen immediately
      setCurrentScreen("processing")
      setProcessingStage("transcribing")

      // Stop recording and get audio blob
      const audioBlob = await audioRecording.stopRecording()

      if (!audioBlob) {
        throw new Error('No audio data recorded')
      }

      // Upload audio and get transcript
      const recordingResponse = await api.recordAudio(audioBlob, selectedSessionType)
      setRecordingResult(recordingResponse)

      // Move to analyzing stage
      setProcessingStage("analyzing")

      // Start AI analysis
      const analysisResponse = await api.processSession({
        transcript: recordingResponse.transcript,
        metadata: recordingResponse.metadata
      })
      setAnalysisResult(analysisResponse)

      // Mark as complete and navigate to summary
      setProcessingStage("complete")
      setTimeout(() => {
        setCurrentScreen("session-summary")
      }, 500) // Brief pause to show completion

    } catch (error) {
      console.error('Failed to process recording:', error)
      setRecordingError(error instanceof Error ? error.message : 'Failed to process recording')
      // Still navigate to summary even on error
      setCurrentScreen("session-summary")
    }
  }

  const handleSaveAndContinue = async () => {
    // Reset all recording state
    audioRecording.resetRecording()
    setRecordingResult(null)
    setAnalysisResult(null)
    setRecordingError(null)
    setProcessingStage("transcribing")
    setCurrentScreen("home")
    setSelectedSessionType(null)
    setReflectionText("")

    // Refresh sessions list
    try {
      const response = await api.getSessions()
      setSessions(response.sessions)
    } catch (error) {
      console.error('Failed to refresh sessions:', error)
    }
    // Refresh trends so the badge/insights reflect the new session.
    loadTrends()
  }

  const handleCancelSession = () => {
    // Reset recording state and go back to home without saving
    audioRecording.resetRecording()
    setRecordingResult(null)
    setAnalysisResult(null)
    setRecordingError(null)
    setProcessingStage("transcribing")
    setCurrentScreen("home")
    setSelectedSessionType(null)
    setReflectionText("")
  }

  const handleRerecord = () => {
    // Reset recording state and go back to session confirmation to re-record
    audioRecording.resetRecording()
    setRecordingResult(null)
    setAnalysisResult(null)
    setRecordingError(null)
    setProcessingStage("transcribing")
    setCurrentScreen("session-confirm")
    setReflectionText("")
  }

  // Clean up recording when leaving confirm/processing/summary screens
  useEffect(() => {
    if (currentScreen !== "session-confirm" && currentScreen !== "processing" && currentScreen !== "session-summary") {
      audioRecording.resetRecording()
      setRecordingResult(null)
      setAnalysisResult(null)
      setRecordingError(null)
      setProcessingStage("transcribing")
    }
  }, [currentScreen])

  return (
    <TooltipProvider>
      <div className="min-h-screen" style={{ backgroundColor: "#FDFCF9" }}>
        {/* Weekly Highlights Modal */}
        {showWeeklyHighlights && currentScreen === "home" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
            <Card className="w-full max-w-md border-0 shadow-2xl" style={{ backgroundColor: "#FFFFFF" }}>
              <CardContent className="p-8 text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-light text-gray-800 mb-2" style={{ fontFamily: "Georgia, serif" }}>
                    This Week's Highlights
                  </h2>
                </div>

                <div className="space-y-4 mb-6 text-left">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-sm">📊</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        You recorded {weekTrends?.total_sessions ?? 0} session
                        {(weekTrends?.total_sessions ?? 0) === 1 ? "" : "s"} this week
                      </p>
                      <p className="text-xs text-gray-600">
                        {weekTrends && weekTrends.mood_distribution.length > 0
                          ? `Most often ${weekTrends.mood_distribution[0].mood_label} · avg agitation ${
                              weekTrends.avg_agitation?.toFixed(1) ?? "—"
                            }/10`
                          : `Average agitation ${weekTrends?.avg_agitation?.toFixed(1) ?? "—"}/10`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-sm">{weekTrends?.top_phrase ? "🔁" : "💝"}</span>
                    </div>
                    <div>
                      {weekTrends?.top_phrase ? (
                        <>
                          <p className="text-sm font-medium text-gray-800">
                            &ldquo;{weekTrends.top_phrase}&rdquo; came up most
                          </p>
                          <p className="text-xs text-gray-600">Heard {weekTrends.top_phrase_count}× this week</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-gray-800">
                            This week felt {(weekTrends?.calm_label ?? "calm").toLowerCase()}
                          </p>
                          <p className="text-xs text-gray-600">Your steady presence makes the difference</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setShowWeeklyHighlights(false)}
                  className="w-full rounded-full bg-[#9CC0C3] text-white font-semibold tracking-wide shadow-md transition-all duration-200 hover:bg-[#8BAAAD] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
                >
                  Continue Your Journey
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowWeeklyHighlights(false)}
                  className="absolute top-4 right-4 p-2 rounded-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Home Screen */}
        {currentScreen === "home" && (
          <div className="min-h-screen pb-32">
            <div className="flex">
              {/* Left Timeline Section - Journal Style */}
              <div className="w-full max-w-4xl pl-8 pr-4 py-12 relative">
                {/* Header */}
                <div className="mb-12 pl-16">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h1
                        className="text-4xl font-light text-gray-800 mb-2 tracking-tight"
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        Carelink
                      </h1>
                      <p className="text-gray-500 text-lg font-light">Your care journey, documented with love</p>
                    </div>
                    <div className="text-right">
                      {weekTrends && weekTrends.total_sessions > 0 && weekTrends.calm_label !== "No data" && (
                        <Badge
                          className="mb-2 px-3 py-1 text-xs font-medium border-0"
                          style={calmBadgeStyle(weekTrends.calm_label)}
                        >
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Overall {weekTrends.calm_label} This Week
                        </Badge>
                      )}
                      <p className="text-sm text-gray-400 font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</p>
                      <p className="text-2xl font-light text-gray-700">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            disabled={isExporting}
                            variant="outline"
                            size="sm"
                            className="mt-3 rounded-full border-[#8BAAAD] text-[#546A7B] transition-colors hover:bg-[#8BAAAD] hover:text-white disabled:opacity-60"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {isExporting ? "Preparing PDF…" : "Export care report"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {getExportPresets().map((p) => (
                            <DropdownMenuItem
                              key={p.key}
                              onClick={() => handleExportReport(p.fromTs, undefined)}
                              className="flex cursor-pointer flex-col items-start gap-0.5 focus:bg-[#8BAAAD]/15 hover:bg-[#8BAAAD]/15"
                            >
                              <span className="text-sm text-gray-800">{p.title}</span>
                              <span className="text-xs text-gray-400">{p.range}</span>
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setExportError(null)
                              setCustomRangeOpen(true)
                            }}
                            className="cursor-pointer focus:bg-[#8BAAAD]/15 hover:bg-[#8BAAAD]/15"
                          >
                            Custom range…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {exportError && (
                        <p className="mt-2 max-w-[16rem] text-xs text-red-500">{exportError}</p>
                      )}

                      <Dialog open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
                        <DialogContent className="sm:max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Custom date range</DialogTitle>
                            <DialogDescription>
                              Choose the period to include in the care report.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-2 text-left">
                            <label className="grid gap-1 text-sm">
                              <span className="font-medium text-gray-600">From</span>
                              <input
                                type="date"
                                value={customStart}
                                max={customEnd || undefined}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#8BAAAD] focus:outline-none"
                              />
                            </label>
                            <label className="grid gap-1 text-sm">
                              <span className="font-medium text-gray-600">To</span>
                              <input
                                type="date"
                                value={customEnd}
                                min={customStart || undefined}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#8BAAAD] focus:outline-none"
                              />
                            </label>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={handleCustomExport}
                              className="rounded-full"
                              style={{ backgroundColor: "#546A7B", color: "white" }}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Export PDF
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>

                {/* Vertical Timeline Line */}
                <div className="absolute left-12 top-32 bottom-0 w-px" style={{ backgroundColor: "#E6E6E6" }} />

                {/* Timeline */}
                <div className="space-y-12 relative">
                  {isLoadingSessions ? (
                    <div className="pl-16 py-8">
                      <div className="text-center text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-4"></div>
                        <p>Loading sessions...</p>
                      </div>
                    </div>
                  ) : displaySessionsByDay.length === 0 ? (
                    <div className="pl-16 py-8">
                      <div className="text-center text-gray-500">
                        <p className="text-lg mb-2">No sessions yet</p>
                        <p className="text-sm">Start your first care session to see it here</p>
                      </div>
                    </div>
                  ) : (
                    displaySessionsByDay.map((day, dayIndex) => (
                    <div key={day.fullDate} className="space-y-6">
                      {/* Day Header */}
                      <div className="sticky top-0 z-10 py-3 pl-16" style={{ backgroundColor: "#FDFCF9" }}>
                        <h2 className="text-2xl font-light text-gray-800 mb-1" style={{ fontFamily: "Georgia, serif" }}>
                          {day.date}
                        </h2>
                        <p className="text-sm font-medium" style={{ color: "#8BAAAD" }}>
                          {day.fullDate}
                        </p>
                      </div>

                      {/* Sessions */}
                      <div className="space-y-6">
                        {day.sessions.length === 0 ? (
                          <div className="pl-16 py-4">
                            <p className="text-gray-400 text-sm italic">
                              No sessions recorded for {day.date.toLowerCase()}
                            </p>
                          </div>
                        ) : (
                          day.sessions.map((session, sessionIndex) => (
                          <div key={session.id} className="relative flex items-start">
                            {/* Timeline Marker */}
                            <div className="absolute left-12 flex items-center justify-center">
                              <div
                                className="w-4 h-4 rounded-full border-2 border-white shadow-sm z-10"
                                style={{ backgroundColor: session.borderColor }}
                              />
                            </div>

                            {/* Session Card - Left Third Layout */}
                            <div className="ml-20 w-full max-w-2xl">
                              <Card
                                className="border-0 cursor-pointer transition-all duration-300 ease-out hover:scale-[1.01] hover:shadow-lg relative overflow-hidden"
                                style={{
                                  backgroundColor: "#FFFFFF",
                                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                                }}
                              >
                                {/* Color-coded side strip */}
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-1"
                                  style={{ backgroundColor: session.borderColor }}
                                />

                                <CardContent className="p-6 pl-8">
                                  <div className="flex items-start gap-4">
                                    {/* Emoji Icon */}
                                    <div className="flex-shrink-0 mt-1">
                                      <div
                                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
                                        style={{ backgroundColor: session.color }}
                                      >
                                        {session.icon}
                                      </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-medium text-gray-800">{session.type}</h3>
                                        <div className="flex items-center gap-1">
                                          <Clock className="w-3.5 h-3.5" style={{ color: "#8BAAAD" }} />
                                          <span className="text-sm font-medium" style={{ color: "#8BAAAD" }}>
                                            {session.time}
                                          </span>
                                        </div>
                                      </div>
                                      <p className="text-gray-600 leading-relaxed font-light text-base">
                                        {session.summary}
                                      </p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                          ))
                        )}
                      </div>
                    </div>
                    ))
                  )}
                </div>

                {/* Gentle encouragement */}
                <div className="text-center py-16 pl-16">
                  <p className="text-gray-400 font-light text-lg mb-2" style={{ fontFamily: "Georgia, serif" }}>
                    Your care moments are safely stored here
                  </p>
                  <p className="text-gray-300 text-sm italic">{affirmations[currentAffirmation]}</p>
                </div>
              </div>

              {/* Right Insights Panel (M2 — real trends) */}
              <div className="hidden lg:block w-1/3 p-8">
                <div className="sticky top-8">
                  <InsightsPanel trends={allTrends} isLoading={isLoadingTrends} />
                </div>
              </div>
            </div>

            {/* Animated Floating Start Session Button */}
            <div className="fixed bottom-8 right-8">
              <Button
                size="lg"
                onClick={startNewSession}
                className="h-16 px-8 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 ease-out hover:scale-105 active:scale-95 animate-pulse"
                style={{
                  backgroundColor: "#8BAAAD",
                  color: "white",
                  boxShadow: "0 8px 32px rgba(139, 170, 173, 0.3)",
                }}
              >
                <Plus className="w-5 h-5 mr-3" />
                <span className="font-medium text-lg">Start a New Memory</span>
              </Button>
            </div>
          </div>
        )}

        {/* Session Type Selection */}
        {currentScreen === "session-type" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div
              className={`w-full max-w-lg transition-all duration-300 ease-out ${
                isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
              }`}
            >
              <Card className="border-0 shadow-2xl" style={{ backgroundColor: "#FFFFFF" }}>
                <CardContent className="p-12 text-center">
                  {/* Back Button */}
                  <div className="flex justify-start mb-8">
                    <Button
                      variant="ghost"
                      onClick={handleBack}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5 text-gray-500" />
                    </Button>
                  </div>

                  {/* Header */}
                  <div className="mb-12">
                    <h1
                      className="text-3xl font-light text-gray-800 mb-4 leading-relaxed"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      What kind of memory shall we capture?
                    </h1>
                    <p className="text-gray-500 text-lg font-light leading-relaxed">
                      Choose the type that feels right for this moment
                    </p>
                  </div>

                  {/* Session Type Options */}
                  <div className="space-y-4 mb-8">
                    {sessionTypes.map((type) => (
                      <Button
                        key={type.id}
                        variant="ghost"
                        className="w-full h-24 p-6 rounded-3xl transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-lg border-2 border-transparent hover:border-opacity-20"
                        style={{
                          backgroundColor: type.color,
                          color: "#4A5568",
                          borderColor: type.selectedColor,
                        }}
                        onClick={() => handleTypeSelect(type.id)}
                      >
                        <div className="flex items-center gap-4 w-full">
                          <div className="flex-shrink-0">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl bg-white/60 shadow-sm">
                              {type.emoji}
                            </div>
                          </div>
                          <div className="flex-1 text-left">
                            <h3 className="text-xl font-medium mb-1">{type.label}</h3>
                            <p className="text-sm text-gray-600 font-light">{type.description}</p>
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Session Confirmation with Live Waveform */}
        {currentScreen === "session-confirm" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div
              className={`w-full max-w-lg transition-all duration-300 ease-out ${
                isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
              }`}
            >
              <Card className="border-0 shadow-2xl" style={{ backgroundColor: "#FFFFFF" }}>
                <CardContent className="p-12 text-center">
                  {/* Back Button */}
                  <div className="flex justify-start mb-8">
                    <Button
                      variant="ghost"
                      onClick={handleBack}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5 text-gray-500" />
                    </Button>
                  </div>

                  {/* Header */}
                  <div className="mb-12">
                    <h1
                      className="text-3xl font-light text-gray-800 mb-4 leading-relaxed"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      Ready to begin?
                    </h1>
                    <p className="text-gray-500 text-lg font-light leading-relaxed">
                      I'll listen gently and help you capture this {selectedSessionType} moment
                    </p>
                  </div>

                  {/* Live Audio Waveform */}
                  <div className="mb-8">
                    <div
                      className="w-64 h-32 mx-auto rounded-3xl flex items-center justify-center transition-all duration-500 ease-out"
                      style={{
                        backgroundColor: "#F8F9FA",
                        boxShadow: (audioRecording.state.isRecording || audioRecording.state.isProcessing)
                          ? "0 0 0 20px rgba(139, 170, 173, 0.05), 0 0 0 40px rgba(139, 170, 173, 0.02)"
                          : "0 8px 25px rgba(0,0,0,0.08)",
                      }}
                    >
                      <AudioWaveform isListening={audioRecording.state.isRecording || audioRecording.state.isProcessing} isRecording={audioRecording.state.isRecording} />
                    </div>
                  </div>

                  {/* Dynamic Microcopy */}
                  <div className="mb-8">
                    <p className="text-gray-400 text-sm leading-relaxed italic">
                      {!audioRecording.state.isRecording && !audioRecording.state.isProcessing && "Ready to listen when you are..."}
                      {audioRecording.state.isRecording && "Recording your words with care..."}
                      {audioRecording.state.isProcessing && "Processing your recording..."}
                      {recordingError && (
                        <span className="text-red-500">Error: {recordingError}</span>
                      )}
                    </p>
                  </div>

                  {/* Selected Type Confirmation */}
                  <div className="mb-8">
                    <div
                      className="inline-flex items-center gap-3 px-6 py-3 rounded-full shadow-sm"
                      style={{
                        backgroundColor: sessionTypes.find((t) => t.id === selectedSessionType)?.selectedColor,
                      }}
                    >
                      <span className="text-2xl">{sessionTypes.find((t) => t.id === selectedSessionType)?.emoji}</span>
                      <span className="text-gray-700 font-medium">
                        {sessionTypes.find((t) => t.id === selectedSessionType)?.label} Memory
                      </span>
                    </div>
                  </div>

                  {/* Start/Stop Button */}
                  <div className="space-y-3">
                    <Button
                      size="lg"
                      onClick={audioRecording.state.isRecording ? handleStopRecording : handleStartSession}
                      disabled={audioRecording.state.isProcessing}
                      className="w-full h-16 text-lg font-medium rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      style={{
                        backgroundColor: audioRecording.state.isRecording ? "#DC2626" : audioRecording.state.isProcessing ? "#8BAAAD" : "#546A7B",
                        color: "white",
                      }}
                    >
                      {audioRecording.state.isProcessing ? "Processing..." :
                       audioRecording.state.isRecording ? "Stop Recording" : "Begin Listening"}
                    </Button>

                    {audioRecording.state.isRecording && (
                      <p className="text-center text-sm text-gray-500">
                        Recording time: {audioRecording.state.recordingDuration}s
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Processing Screen */}
        {currentScreen === "processing" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: "#FDFCF9" }}>
            <div className="w-full max-w-lg">
              <Card className="border-0 shadow-2xl" style={{ backgroundColor: "#FFFFFF" }}>
                <CardContent className="p-12 text-center">
                  {/* Animated Processing Icon */}
                  <div className="mb-8">
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center animate-pulse">
                      <Sparkles className="w-12 h-12 text-purple-600" />
                    </div>
                  </div>

                  {/* Header */}
                  <div className="mb-8">
                    <h1
                      className="text-3xl font-light text-gray-800 mb-4 leading-relaxed"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {processingStage === "transcribing" && "Capturing your words..."}
                      {processingStage === "analyzing" && "Understanding the moment..."}
                      {processingStage === "complete" && "Ready! ✨"}
                    </h1>
                    <p className="text-gray-500 text-lg font-light leading-relaxed">
                      {processingStage === "transcribing" && "Transcribing your recording with care"}
                      {processingStage === "analyzing" && "AI is analyzing the conversation"}
                      {processingStage === "complete" && "Your memory has been processed"}
                    </p>
                  </div>

                  {/* Progress Steps */}
                  <div className="mb-8 space-y-3">
                    {/* Step 1: Transcribing */}
                    <div className="flex items-center gap-3 p-4 rounded-xl transition-all duration-300"
                         style={{
                           backgroundColor: processingStage === "transcribing" ? "#E8F5E8" :
                                          ["analyzing", "complete"].includes(processingStage) ? "#F0F9FF" : "#F8F9FA"
                         }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center relative" style={{
                        backgroundColor: ["analyzing", "complete"].includes(processingStage) ? "#B8D4B8" : "#D4C5F9"
                      }}>
                        {["analyzing", "complete"].includes(processingStage) ? (
                          <span className="text-white font-bold">✓</span>
                        ) : processingStage === "transcribing" ? (
                          <div className="flex gap-0.5">
                            <div className="w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDelay: "0ms" }}></div>
                            <div className="w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDelay: "150ms" }}></div>
                            <div className="w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDelay: "300ms" }}></div>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium text-gray-800">Transcribing Audio</p>
                        <p className="text-xs text-gray-500">Converting speech to text</p>
                      </div>
                    </div>

                    {/* Step 2: Analyzing */}
                    <div className="flex items-center gap-3 p-4 rounded-xl transition-all duration-300"
                         style={{
                           backgroundColor: processingStage === "analyzing" ? "#FFE8D6" :
                                          processingStage === "complete" ? "#F0F9FF" : "#F8F9FA"
                         }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center relative" style={{
                        backgroundColor: processingStage === "complete" ? "#B8D4B8" :
                                       processingStage === "analyzing" ? "#FFD4B3" : "#E5E7EB"
                      }}>
                        {processingStage === "complete" ? (
                          <span className="text-white font-bold">✓</span>
                        ) : processingStage === "analyzing" ? (
                          <div className="relative w-4 h-4">
                            <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                          </div>
                        ) : processingStage === "transcribing" ? (
                          <div className="flex gap-0.5 opacity-40">
                            <div className="w-1 h-1 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: "0ms", animationDuration: "2s" }}></div>
                            <div className="w-1 h-1 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: "400ms", animationDuration: "2s" }}></div>
                            <div className="w-1 h-1 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: "800ms", animationDuration: "2s" }}></div>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-left flex-1">
                        <p className={`text-sm font-medium ${processingStage === "transcribing" ? "text-gray-400" : "text-gray-800"}`}>
                          AI Analysis
                        </p>
                        <p className="text-xs text-gray-500">Understanding context and mood</p>
                      </div>
                    </div>

                    {/* Step 3: Complete */}
                    <div className="flex items-center gap-3 p-4 rounded-xl transition-all duration-300"
                         style={{ backgroundColor: processingStage === "complete" ? "#E8F5E8" : "#F8F9FA" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center relative" style={{
                        backgroundColor: processingStage === "complete" ? "#B8D4B8" : "#E5E7EB"
                      }}>
                        {processingStage === "complete" ? (
                          <span className="text-white font-bold animate-bounce">✓</span>
                        ) : ["transcribing", "analyzing"].includes(processingStage) ? (
                          <div className="flex gap-0.5 opacity-30">
                            <div className="w-1 h-1 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: "0ms", animationDuration: "3s" }}></div>
                            <div className="w-1 h-1 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: "600ms", animationDuration: "3s" }}></div>
                            <div className="w-1 h-1 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: "1200ms", animationDuration: "3s" }}></div>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-left flex-1">
                        <p className={`text-sm font-medium ${["transcribing", "analyzing"].includes(processingStage) ? "text-gray-400" : "text-gray-800"}`}>
                          Ready to View
                        </p>
                        <p className="text-xs text-gray-500">Your memory is prepared</p>
                      </div>
                    </div>
                  </div>

                  {/* Encouraging message */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-200">
                    <p className="text-gray-600 text-sm italic" style={{ fontFamily: "Georgia, serif" }}>
                      Taking time to understand what matters...
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Session Summary */}
        {currentScreen === "session-summary" && (
          <div className="min-h-screen p-8">
            <div className="max-w-3xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-light text-gray-800 mb-2" style={{ fontFamily: "Georgia, serif" }}>
                      Memory captured. Let's look at what matters. ✨
                    </h1>
                    <p className="text-gray-500 font-light">
                      {sessionData.timestamp} • {sessionData.duration}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm font-medium">Saved locally. This moment is yours, and only yours.</span>
                  </div>
                </div>
              </div>

              {/* Summary Card */}
              <Card
                className="mb-8 border shadow-sm"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#E8E6E3",
                }}
              >
                <CardContent className="p-8">
                  {/* Session Type & Mood */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-2xl">
                        💊
                      </div>
                      <div>
                        <h2 className="text-xl font-medium text-gray-800">{sessionData.type} Memory</h2>
                        <p className="text-gray-500 text-sm">Lovingly summarized by AI</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge
                            className="px-3 py-1 text-sm font-medium border-0"
                            style={{
                              backgroundColor: sessionData.moodColor,
                              color: "#2D3748",
                            }}
                          >
                            <Sun className="w-3 h-3 mr-1" />
                            Tone: {sessionData.mood}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>AI detected emotional tone throughout the session</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* AI Summary */}
                  <div className="mb-6">
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border-l-4 border-blue-200">
                      <p className="text-gray-700 leading-relaxed font-light text-lg">{sessionData.aiSummary}</p>
                    </div>
                  </div>

                  {/* Key Events Timeline */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">Beautiful Moments</h3>
                    <div className="space-y-3">
                      {sessionData.keyEvents.map((event, index) => {
                        const IconComponent = event.icon
                        const fullTranscript = recordingResult?.transcript || ""
                        const transcriptPreview = fullTranscript.substring(0, 150)
                        const hasMore = fullTranscript.length > 150

                        return (
                          <div key={index} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50">
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                                <IconComponent className="w-5 h-5 text-gray-600" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-500">{event.time}</span>
                                {event.repetition && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                        {event.repetition}x
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>This topic came up {event.repetition} times</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              <p className="text-gray-800 font-medium mb-1">{event.event}</p>

                              {/* Expandable Transcript */}
                              <div className="text-gray-600 text-sm">
                                <p className="whitespace-pre-wrap">
                                  {isTranscriptExpanded ? `Transcript: "${fullTranscript}"` : `Transcript: "${transcriptPreview}${hasMore ? '...' : ''}"`}
                                </p>
                                {hasMore && (
                                  <button
                                    onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                                    className="mt-2 text-xs font-medium hover:underline transition-colors"
                                    style={{ color: "#8BAAAD" }}
                                  >
                                    {isTranscriptExpanded ? "Show less" : "Show more"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2 mb-4">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <div className="flex gap-2">
                      {sessionData.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs px-3 py-1 bg-blue-50 text-blue-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Edit Options */}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700 px-3 py-1.5 h-auto rounded-full"
                    >
                      <Edit3 className="w-3 h-3 mr-1" />
                      Edit Summary
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700 px-3 py-1.5 h-auto rounded-full"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      Add Tags
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Reflection Prompt */}
              <Card
                className="border shadow-sm"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#E8E6E3",
                }}
              >
                <CardContent className="p-8">
                  <div className="mb-4">
                    <h3 className="text-xl font-light text-gray-800 mb-2" style={{ fontFamily: "Georgia, serif" }}>
                      What helped today?
                    </h3>
                    <p className="text-gray-500 text-sm font-light">Take a breath. What made today feel okay?</p>
                  </div>

                  <div className="relative">
                    <Textarea
                      placeholder="Your thoughts and observations..."
                      value={reflectionText}
                      onChange={(e) => setReflectionText(e.target.value)}
                      className="min-h-32 resize-none border-0 bg-transparent text-gray-700 placeholder:text-gray-400 focus:ring-0 p-0 text-base leading-relaxed"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(transparent, transparent 1.5rem, #E8E6E3 1.5rem, #E8E6E3 calc(1.5rem + 1px))",
                        lineHeight: "1.5rem",
                        // No vertical offset: text line-height matches the rule spacing,
                        // so each line of text sits just above its rule instead of on it.
                        paddingTop: "0",
                      }}
                    />
                  </div>

                  <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-200">
                    <p className="text-gray-600 text-sm italic text-center" style={{ fontFamily: "Georgia, serif" }}>
                      "You just captured something meaningful. Every moment of care creates ripples of love."
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                {/* Cancel Session Button */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleCancelSession}
                  className="px-6 py-3 rounded-full border-2 hover:bg-red-50 hover:border-red-200 transition-all duration-200"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel Session
                </Button>

                {/* Re-record Button */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleRerecord}
                  className="px-6 py-3 rounded-full border-2 hover:bg-blue-50 hover:border-blue-200 transition-all duration-200"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Re-record
                </Button>

                {/* Save Button */}
                <Button
                  size="lg"
                  onClick={handleSaveAndContinue}
                  className="px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
                  style={{
                    backgroundColor: "#546A7B",
                    color: "white",
                  }}
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Continue Your Journey
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
