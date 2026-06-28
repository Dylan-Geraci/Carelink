"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, ChevronDown, Pencil, Plus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { api, type SessionDetail } from "@/lib/api"
import { moodColor } from "@/components/insights-panel"

// ─────────────────────────────────────────────────────────────────────────────
// A captured care moment, opened like a page from the journal: the AI's read on
// mood/agitation, its summary, what came up, gentle suggestions, the raw
// transcript, and the caregiver's own reflection — each refinable in place.
// Cohesive with InsightsPanel / Care circle (cream, Georgia serif, teal).
// ─────────────────────────────────────────────────────────────────────────────

const INK = "#546A7B"
const TEAL = "#8BAAAD"
const HAIRLINE = "#ECEAE4"

const EMOJI: Record<string, string> = { medication: "💊", sundowning: "🌅", freeform: "💬" }
const emojiFor = (t: string) => EMOJI[t.toLowerCase()] ?? "📝"

// Agitation (0–10) → a worded reading, matching the trends thresholds.
const agitationWord = (score: number) => (score < 3.5 ? "Calm" : score < 6.5 ? "Mixed" : "Elevated")
const agitationTone = (score: number) => (score < 3.5 ? INK : score < 6.5 ? "#9A7B3A" : "#9E5151")

function parseArray(raw?: string | null): unknown[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v)) return v
    if (typeof v === "string" && v.trim()) return [v]
  } catch {
    if (raw.trim()) return [raw.trim()]
  }
  return []
}

const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

// Quiet hairline-separated section with a tracked-out label.
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-5" style={{ borderColor: HAIRLINE }}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
      {children}
    </div>
  )
}

export function SessionDetailDialog({
  sessionId,
  open,
  onOpenChange,
  onSaved,
}: {
  sessionId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: () => void
}) {
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState("")
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")
  const [addingTag, setAddingTag] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  const load = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      setDetail(await api.getSession(sessionId))
    } catch (e) {
      console.error("Failed to load session:", e)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (open && sessionId) {
      setEditingSummary(false)
      setEditingNote(false)
      setAddingTag(false)
      setTagInput("")
      setTranscriptOpen(false)
      load()
    }
  }, [open, sessionId, load])

  const summary = detail?.summary ?? null
  const tags = parseArray(summary?.tags) as string[]
  const suggestions = parseArray(summary?.suggestions) as string[]
  const repetitions = parseArray(summary?.repetition_json) as Array<{ phrase?: string; count?: number }>
  const transcript = (detail?.transcripts ?? []).map((t) => t.text).join("\n").trim()

  const persistSummary = async (fields: { summary_text?: string; tags?: string[] }) => {
    if (!sessionId) return
    setSaving(true)
    try {
      setDetail(await api.updateSessionSummary(sessionId, fields))
      onSaved?.()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const saveNote = async () => {
    if (!sessionId) return
    setSaving(true)
    try {
      setDetail(await api.updateSessionNote(sessionId, noteDraft.trim()))
      setEditingNote(false)
      onSaved?.()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const addTag = async () => {
    const t = tagInput.trim().toLowerCase()
    if (!t || tags.includes(t)) {
      setTagInput("")
      setAddingTag(false)
      return
    }
    await persistSummary({ tags: [...tags, t] })
    setTagInput("")
    setAddingTag(false)
  }

  const removeTag = (t: string) => persistSummary({ tags: tags.filter((x) => x !== t) })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-2xl">
        {loading || !detail ? (
          <div className="space-y-4 py-2">
            <div className="h-6 w-40 animate-pulse rounded bg-gray-100" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-gray-100" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-sm"
                  style={{ backgroundColor: "#F4F1EC" }}
                >
                  {emojiFor(detail.session_type)}
                </div>
                <div>
                  <DialogTitle className="text-left text-xl font-light capitalize" style={{ fontFamily: "Georgia, serif" }}>
                    {detail.session_type} session
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-400">{fmtDateTime(detail.start_ts)}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* The reading — mood + agitation as quiet chips */}
            {summary && (summary.mood_label || summary.agitation_score != null) && (
              <div className="flex flex-wrap gap-2">
                {summary.mood_label && summary.mood_label.toLowerCase() !== "unknown" && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm capitalize"
                    style={{ backgroundColor: `${moodColor(summary.mood_label)}22`, color: INK }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: moodColor(summary.mood_label) }} />
                    {summary.mood_label}
                  </span>
                )}
                {summary.agitation_score != null && (
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-sm"
                    style={{ backgroundColor: "#F4F1EC", color: agitationTone(summary.agitation_score) }}
                  >
                    {agitationWord(summary.agitation_score)} · {summary.agitation_score.toFixed(1)}/10 agitation
                  </span>
                )}
              </div>
            )}

            {/* Summary — the entry body, editable in place */}
            <Section label="Summary">
              {editingSummary ? (
                <div>
                  <Textarea
                    value={summaryDraft}
                    onChange={(e) => setSummaryDraft(e.target.value)}
                    className="min-h-[96px] text-base leading-relaxed"
                    autoFocus
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={async () => {
                        await persistSummary({ summary_text: summaryDraft.trim() })
                        setEditingSummary(false)
                      }}
                      disabled={saving}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: INK }}
                    >
                      <Check className="h-3.5 w-3.5" /> Save
                    </button>
                    <button
                      onClick={() => setEditingSummary(false)}
                      className="rounded-full px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-start justify-between gap-3">
                  <p className="text-base leading-relaxed text-gray-700" style={{ fontFamily: "Georgia, serif" }}>
                    {summary?.summary_text || "No summary yet."}
                  </p>
                  {summary && (
                    <button
                      onClick={() => {
                        setSummaryDraft(summary.summary_text)
                        setEditingSummary(true)
                      }}
                      title="Edit summary"
                      className="shrink-0 rounded-full p-1.5 text-gray-300 transition-colors hover:bg-gray-50 hover:text-[#546A7B]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </Section>

            {/* Tags — add / remove in place */}
            <Section label="Tags">
              <div className="flex flex-wrap items-center gap-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#8BAAAD]/15 px-3 py-1 text-sm text-[#3f5360]"
                  >
                    {t}
                    <button onClick={() => removeTag(t)} title="Remove tag" className="text-[#6E9296] hover:text-[#3f5360]">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {addingTag ? (
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addTag()
                      if (e.key === "Escape") {
                        setAddingTag(false)
                        setTagInput("")
                      }
                    }}
                    onBlur={addTag}
                    autoFocus
                    placeholder="add a tag"
                    className="w-28 rounded-full border border-gray-300 px-3 py-1 text-sm focus:border-[#8BAAAD] focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setAddingTag(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-sm text-gray-400 hover:border-[#8BAAAD] hover:text-[#546A7B]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add tag
                  </button>
                )}
              </div>
            </Section>

            {/* What came up — repeated phrases (emotionally loaded in dementia care) */}
            {repetitions.length > 0 && (
              <Section label="What came up">
                <ul className="space-y-1.5">
                  {repetitions.map((r, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="italic text-gray-700" style={{ fontFamily: "Georgia, serif" }}>
                        &ldquo;{r.phrase}&rdquo;
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">{r.count}×</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Gentle suggestions */}
            {suggestions.length > 0 && (
              <Section label="Gentle suggestions">
                <ul className="space-y-2">
                  {suggestions.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-gray-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: TEAL }} />
                      {s}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Transcript — the raw words, tucked away */}
            {transcript && (
              <Section label="Transcript">
                <button
                  onClick={() => setTranscriptOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-sm text-[#8BAAAD] hover:text-[#546A7B]"
                >
                  {transcriptOpen ? "Hide" : "Show"} transcript
                  <ChevronDown className={`h-4 w-4 transition-transform ${transcriptOpen ? "rotate-180" : ""}`} />
                </button>
                {transcriptOpen && (
                  <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[#FAF8F4] p-4 text-sm leading-relaxed text-gray-600">
                    {transcript}
                  </p>
                )}
              </Section>
            )}

            {/* The caregiver's reflection — on ruled paper, like the capture screen */}
            <Section label="Your reflection">
              {editingNote ? (
                <div>
                  <Textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="What helped today?"
                    autoFocus
                    className="min-h-[88px] resize-none border-0 bg-transparent p-0 text-base leading-[1.5rem] text-gray-700 focus-visible:ring-0"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(transparent, transparent 1.5rem, #E8E6E3 1.5rem, #E8E6E3 calc(1.5rem + 1px))",
                    }}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={saveNote}
                      disabled={saving}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: INK }}
                    >
                      <Check className="h-3.5 w-3.5" /> Save
                    </button>
                    <button onClick={() => setEditingNote(false)} className="rounded-full px-3 py-1 text-xs text-gray-500 hover:text-gray-700">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : detail.notes && !detail.notes.startsWith("Patient:") ? (
                <div className="group flex items-start justify-between gap-3">
                  <p className="text-base italic leading-relaxed text-gray-700" style={{ fontFamily: "Georgia, serif" }}>
                    {detail.notes}
                  </p>
                  <button
                    onClick={() => {
                      setNoteDraft(detail.notes ?? "")
                      setEditingNote(true)
                    }}
                    title="Edit reflection"
                    className="shrink-0 rounded-full p-1.5 text-gray-300 transition-colors hover:bg-gray-50 hover:text-[#546A7B]"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNoteDraft("")
                    setEditingNote(true)
                  }}
                  className="text-sm text-[#8BAAAD] hover:text-[#546A7B]"
                >
                  + Add a reflection
                </button>
              )}
            </Section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
