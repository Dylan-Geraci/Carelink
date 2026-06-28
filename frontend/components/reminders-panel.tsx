"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, CalendarClock, Check, Pill, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { api, type Reminder, type ReminderKind, type ReminderRecurrence } from "@/lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Care reminders (M3) — in-app only (offline app, no push). Surfaces what's due
// on the home screen and lets a caregiver add meds (recurring: every day / other
// day / weekly) / appointments (one-off), mark them done, and remove them.
// Occurrence + overdue status is derived against a live clock here, not stored.
// Cohesive with InsightsPanel.
// ─────────────────────────────────────────────────────────────────────────────

const INK = "#546A7B"
const TEAL = "#8BAAAD"
const CLAY = "#E2A2A2"
const HAIRLINE = "#ECEAE4"

type Status = "overdue" | "today" | "upcoming" | "done"
type Resolved = { reminder: Reminder; status: Status; nextTs: number; dueLabel: string }

// Medication cadences offered in the Add dialog. interval = days between doses.
type MedRecurrence = Exclude<ReminderRecurrence, "once">
const MED_CADENCES: { value: MedRecurrence; label: string; interval: number }[] = [
  { value: "daily", label: "Every day", interval: 1 },
  { value: "every_other_day", label: "Every other day", interval: 2 },
  { value: "weekly", label: "Weekly", interval: 7 },
]

// Local 'yyyy-mm-dd' for <input type="date"> (avoids the UTC shift of toISOString).
const todayISODate = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const startOfDay = (ts: number) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b)

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })

const DAY = 86_400_000

// Apply an 'HH:MM' local time onto a local-midnight day (epoch ms).
const atTimeOnDay = (day0: number, timeOfDay: string) => {
  const [h, m] = timeOfDay.split(":").map(Number)
  return day0 + (h || 0) * 3_600_000 + (m || 0) * 60_000
}

const cadenceLabel = (interval: number) =>
  interval === 1
    ? "Every day"
    : interval === 2
      ? "Every other day"
      : interval === 7
        ? "Weekly"
        : `Every ${interval} days`

// Where `day0` falls in the cadence counted from the start anchor.
const onDay = (anchor0: number, interval: number, day0: number) => {
  const since = Math.round((day0 - anchor0) / DAY)
  const rem = ((since % interval) + interval) % interval
  return { isOn: since >= 0 && rem === 0, daysUntilNext: rem === 0 ? 0 : interval - rem }
}

function resolve(reminder: Reminder, now: number): Resolved {
  // Recurring medication: a dose every `interval_days` days at `time_of_day`,
  // counted from the `due_ts` start anchor (which also pins the weekday).
  if (reminder.recurrence !== "once" && reminder.time_of_day) {
    const interval = reminder.interval_days && reminder.interval_days > 0 ? reminder.interval_days : 1
    const anchor0 = startOfDay(reminder.due_ts ?? reminder.created_ts)
    const today0 = startOfDay(now)
    const { isOn } = onDay(anchor0, interval, today0)
    const occToday = atTimeOnDay(today0, reminder.time_of_day)
    const doneToday = reminder.last_done_ts != null && sameDay(reminder.last_done_ts, now)
    const cadence = cadenceLabel(interval)

    if (isOn && !doneToday) {
      const status: Status = now >= occToday ? "overdue" : "today"
      return { reminder, status, nextTs: occToday, dueLabel: `${cadence} · ${fmtTime(occToday)}` }
    }
    // Done for today, or today isn't a scheduled day — point to the next dose.
    const stepDays = isOn ? interval : onDay(anchor0, interval, today0).daysUntilNext
    const nextOcc = atTimeOnDay(today0 + stepDays * DAY, reminder.time_of_day)
    const status: Status = doneToday ? "done" : "upcoming"
    return { reminder, status, nextTs: nextOcc, dueLabel: `${cadence} · next ${fmtDate(nextOcc)}, ${fmtTime(nextOcc)}` }
  }
  // one-off appointment
  const due = reminder.due_ts ?? now
  const done = reminder.last_done_ts != null
  const status: Status = done ? "done" : now >= due ? "overdue" : sameDay(due, now) ? "today" : "upcoming"
  const dueLabel = sameDay(due, now) ? `Today · ${fmtTime(due)}` : `${fmtDate(due)} · ${fmtTime(due)}`
  return { reminder, status, nextTs: due, dueLabel }
}

const KindIcon = ({ kind }: { kind: ReminderKind }) =>
  kind === "medication" ? (
    <Pill className="h-4 w-4" style={{ color: TEAL }} />
  ) : (
    <CalendarClock className="h-4 w-4" style={{ color: TEAL }} />
  )

export function RemindersPanel({ patientId }: { patientId?: string }) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [addOpen, setAddOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.getReminders()
      setReminders(res.reminders)
    } catch (e) {
      console.error("Failed to load reminders:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Reload when the active patient changes (the API client carries the header).
  useEffect(() => {
    load()
  }, [load, patientId])

  // Keep overdue/upcoming transitions live without a refetch.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const resolved = useMemo(
    () => reminders.map((r) => resolve(r, now)).sort((a, b) => a.nextTs - b.nextTs),
    [reminders, now],
  )
  // Home surface shows what still needs doing; done items live in Manage.
  const actionable = resolved.filter((r) => r.status !== "done")
  const visible = actionable.slice(0, 5)
  const overflow = actionable.length - visible.length

  const markDone = async (id: number) => {
    setBusyId(id)
    try {
      await api.completeReminder(id)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: number) => {
    setBusyId(id)
    try {
      await api.deleteReminder(id)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      className="rounded-[20px] border border-gray-100 bg-white/70 p-7 shadow-sm backdrop-blur-sm"
      style={{ boxShadow: "0 2px 18px rgba(84,106,123,0.06)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" style={{ color: INK }} />
          <h3 className="text-lg font-light text-gray-800" style={{ fontFamily: "Georgia, serif" }}>
            Care reminders
          </h3>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white transition-colors"
          style={{ backgroundColor: TEAL }}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="mt-5 space-y-2.5">
        {loading ? (
          <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
        ) : actionable.length === 0 ? (
          <p className="py-2 text-sm leading-relaxed text-gray-400">
            Nothing due right now. Add a medication time or an appointment to keep track.
          </p>
        ) : (
          visible.map(({ reminder, status, dueLabel }) => {
            const overdue = status === "overdue"
            return (
              <div
                key={reminder.reminder_id}
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                style={{
                  borderColor: overdue ? `${CLAY}66` : HAIRLINE,
                  backgroundColor: overdue ? `${CLAY}14` : "transparent",
                }}
              >
                <KindIcon kind={reminder.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{reminder.title}</p>
                  <p className="text-xs" style={{ color: overdue ? "#A65A5A" : "#9CA3AF" }}>
                    {overdue ? "Overdue · " : ""}
                    {dueLabel}
                  </p>
                </div>
                <button
                  onClick={() => markDone(reminder.reminder_id)}
                  disabled={busyId === reminder.reminder_id}
                  title="Mark done"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-[#8BAAAD] hover:text-white disabled:opacity-50"
                  style={{ borderColor: TEAL, color: INK }}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            )
          })
        )}

        {(overflow > 0 || actionable.length > 0) && !loading && (
          <button
            onClick={() => setManageOpen(true)}
            className="pt-1 text-xs font-medium text-[#8BAAAD] hover:text-[#546A7B]"
          >
            {overflow > 0 ? `+${overflow} more · manage all` : "Manage all"}
          </button>
        )}
      </div>

      <AddReminderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          setAddOpen(false)
          load()
        }}
      />

      <ManageDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        resolved={resolved}
        busyId={busyId}
        onDone={markDone}
        onDelete={remove}
      />
    </div>
  )
}

// ── Add dialog ───────────────────────────────────────────────────────────────

function AddReminderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [kind, setKind] = useState<ReminderKind>("medication")
  const [title, setTitle] = useState("")
  const [cadence, setCadence] = useState<MedRecurrence>("daily")
  const [timeOfDay, setTimeOfDay] = useState("08:00")
  const [startDate, setStartDate] = useState("")
  const [dateTime, setDateTime] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset to a clean slate whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setKind("medication")
      setTitle("")
      setCadence("daily")
      setTimeOfDay("08:00")
      setStartDate(todayISODate())
      setDateTime("")
      setNotes("")
      setError(null)
    }
  }, [open])

  // 'daily' repeats every day, so the start date is irrelevant; other cadences
  // count from a start date that also fixes the weekday for 'weekly'.
  const needsStart = kind === "medication" && cadence !== "daily"

  const save = async () => {
    if (!title.trim()) return setError("Give the reminder a name.")
    if (kind === "appointment" && !dateTime) return setError("Pick a date and time.")
    if (needsStart && !startDate) return setError("Pick a start date.")
    setError(null)
    setSaving(true)
    try {
      const interval = MED_CADENCES.find((c) => c.value === cadence)?.interval ?? 1
      await api.createReminder({
        title: title.trim(),
        kind,
        recurrence: kind === "medication" ? cadence : "once",
        interval_days: kind === "medication" ? interval : null,
        time_of_day: kind === "medication" ? timeOfDay : null,
        due_ts:
          kind === "appointment"
            ? new Date(dateTime).getTime()
            : needsStart
              ? new Date(`${startDate}T00:00`).getTime()
              : null,
        notes: notes.trim() || null,
      })
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the reminder.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New reminder</DialogTitle>
          <DialogDescription>Stays on this device — shown in the app while it&apos;s open.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1 text-left">
          {/* kind toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["medication", "appointment"] as ReminderKind[]).map((k) => {
              const selected = kind === k
              return (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm capitalize transition-colors"
                  style={{
                    borderColor: selected ? TEAL : "#E5E7EB",
                    backgroundColor: selected ? `${TEAL}1A` : "transparent",
                    color: selected ? INK : "#6B7280",
                  }}
                >
                  {k === "medication" ? <Pill className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                  {k}
                </button>
              )
            })}
          </div>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-gray-600">{kind === "medication" ? "Medication" : "What"}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "medication" ? "e.g. Donepezil 5mg" : "e.g. Neurology appointment"}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#8BAAAD] focus:outline-none"
            />
          </label>

          {kind === "medication" ? (
            <>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-gray-600">Repeat</span>
                  <select
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value as MedRecurrence)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#8BAAAD] focus:outline-none"
                  >
                    {MED_CADENCES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-gray-600">Time</span>
                  <input
                    type="time"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#8BAAAD] focus:outline-none"
                  />
                </label>
              </div>
              {needsStart && (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-gray-600">Starting</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#8BAAAD] focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">
                    {cadence === "weekly" ? "Repeats this weekday." : "Counts from this day."}
                  </span>
                </label>
              )}
            </>
          ) : (
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-gray-600">When</span>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#8BAAAD] focus:outline-none"
              />
            </label>
          )}

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-gray-600">Notes (optional)</span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to remember"
              className="min-h-[60px] resize-none text-sm"
            />
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            onClick={save}
            disabled={saving}
            className="rounded-full"
            style={{ backgroundColor: INK, color: "white" }}
          >
            {saving ? "Saving…" : "Add reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Manage dialog ────────────────────────────────────────────────────────────

function ManageDialog({
  open,
  onOpenChange,
  resolved,
  busyId,
  onDone,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  resolved: Resolved[]
  busyId: number | null
  onDone: (id: number) => void
  onDelete: (id: number) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>All reminders</DialogTitle>
          <DialogDescription>Mark today&apos;s as done, or remove ones you no longer need.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto py-1">
          {resolved.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No reminders yet.</p>
          ) : (
            resolved.map(({ reminder, status, dueLabel }) => {
              const done = status === "done"
              return (
                <div key={reminder.reminder_id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
                  <KindIcon kind={reminder.kind} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${done ? "text-gray-400 line-through" : "text-gray-800"}`}>
                      {reminder.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {done ? "Done · " : status === "overdue" ? "Overdue · " : ""}
                      {dueLabel}
                    </p>
                  </div>
                  {!done && (
                    <button
                      onClick={() => onDone(reminder.reminder_id)}
                      disabled={busyId === reminder.reminder_id}
                      title="Mark done"
                      className="flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover:bg-[#8BAAAD] hover:text-white disabled:opacity-50"
                      style={{ borderColor: TEAL, color: INK }}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(reminder.reminder_id)}
                    disabled={busyId === reminder.reminder_id}
                    title="Remove"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
