"use client"

import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { TrendsResponse } from "@/lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Carelink Insights — the quiet margin of the care journal where patterns
// surface over weeks. Tokens derive entirely from the existing app aesthetic
// (cream / Georgia serif / muted teal) so this reads as part of the same diary,
// not a bolted-on dashboard. Agitation is on a 0–10 scale (0 = calm).
// ─────────────────────────────────────────────────────────────────────────────

const INK = "#546A7B" // deep slate-teal — primary text
const TEAL = "#8BAAAD" // calm
const HAIRLINE = "#ECEAE4" // warm divider

// Free-text mood label (LLM output) → a stable accent from the app palette.
export const moodColor = (mood: string): string => {
  const m = mood.toLowerCase()
  if (/(calm|content|happy|peace|relax|warm|engaged)/.test(m)) return TEAL
  if (/(anx|agitat|upset|distress|angry|frustrat|restless)/.test(m)) return "#E2A2A2"
  if (/(sad|low|tear|withdraw|lonely)/.test(m)) return "#A9B7D0"
  return "#C9B8E0"
}

// Ink color for the focal calm word, tinted by how the week is trending.
const calmTone = (label: string): string => {
  switch (label) {
    case "Calm":
      return INK
    case "Mixed":
      return "#9A7B3A"
    case "Elevated":
      return "#9E5151"
    default:
      return "#9CA3AF"
  }
}

const formatWeek = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">{children}</p>
)

const Surface = ({ children }: { children: React.ReactNode }) => (
  <div
    className="rounded-[20px] border border-gray-100 bg-white/70 p-7 shadow-sm backdrop-blur-sm"
    style={{ boxShadow: "0 2px 18px rgba(84,106,123,0.06)" }}
  >
    {children}
  </div>
)

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDatum }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-gray-100 bg-white/95 px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-gray-700">Week of {d.label}</p>
      <p className="text-gray-400">
        {d.agitation.toFixed(1)} / 10 · {d.sessions} session{d.sessions === 1 ? "" : "s"}
      </p>
    </div>
  )
}

type ChartDatum = { label: string; agitation: number; sessions: number; last: boolean }

export function InsightsPanel({
  trends,
  isLoading,
}: {
  trends: TrendsResponse | null
  isLoading: boolean
}) {
  // Respect reduced-motion for the chart's draw animation (quality floor).
  const [animate, setAnimate] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setAnimate(!mq.matches)
    const onChange = () => setAnimate(!mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  if (isLoading) {
    return (
      <Surface>
        <div className="space-y-4">
          <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-9 w-32 animate-pulse rounded bg-gray-100" />
          <div className="h-28 w-full animate-pulse rounded-xl bg-gray-100" />
        </div>
      </Surface>
    )
  }

  if (!trends || trends.total_sessions === 0) {
    return (
      <Surface>
        <Eyebrow>Patterns</Eyebrow>
        <p className="mt-3 leading-relaxed text-gray-400" style={{ fontFamily: "Georgia, serif" }}>
          As you record sessions, the rhythms of mood and calm will gather here.
        </p>
      </Surface>
    )
  }

  const series: ChartDatum[] = trends.weekly
    .filter((w) => w.avg_agitation !== null && w.avg_agitation !== undefined)
    .map((w, i, arr) => ({
      label: formatWeek(w.week_start_ts),
      agitation: w.avg_agitation as number,
      sessions: w.session_count,
      last: i === arr.length - 1,
    }))

  const moods = trends.mood_distribution
  const moodTotal = moods.reduce((sum, m) => sum + m.count, 0)
  const avgText =
    trends.avg_agitation !== null && trends.avg_agitation !== undefined
      ? trends.avg_agitation.toFixed(1)
      : "—"

  return (
    <Surface>
      {/* Focal reading — the stretch in a word, not a KPI */}
      <Eyebrow>Across your sessions</Eyebrow>
      <h3
        className="mt-3 text-[40px] font-light leading-none"
        style={{ fontFamily: "Georgia, serif", color: calmTone(trends.calm_label) }}
      >
        {trends.calm_label}
      </h3>
      <p className="mt-2.5 text-sm text-gray-400">
        Average agitation {avgText}
        <span className="text-gray-300">/10</span>
      </p>
      <p className="text-xs text-gray-300">
        across {trends.total_sessions} session{trends.total_sessions === 1 ? "" : "s"}
      </p>

      {/* Signature: agitation as "emotional weather" — a soft gradient area with
          the scale spoken in words. Needs ≥2 weeks to be a trend. */}
      {series.length >= 2 ? (
        <div className="mt-7">
          <div className="mb-3 h-px w-full" style={{ backgroundColor: HAIRLINE }} />
          <p className="mb-3 text-sm font-medium text-gray-500">Agitation over time</p>
          <div className="flex gap-2.5">
            <div className="flex flex-col justify-between py-1 text-[10px] uppercase tracking-wider text-gray-300">
              <span>harder</span>
              <span>calmer</span>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={series} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="agitationFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TEAL} stopOpacity={0.34} />
                      <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={[0, 10]} hide />
                  <XAxis
                    dataKey="label"
                    interval="preserveStartEnd"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "#B6B2A8" }}
                    dy={4}
                  />
                  <RechartsTooltip content={<TrendTooltip />} cursor={{ stroke: HAIRLINE }} />
                  <Area
                    type="monotone"
                    dataKey="agitation"
                    stroke="#6E9296"
                    strokeWidth={2.25}
                    fill="url(#agitationFill)"
                    isAnimationActive={animate}
                    animationDuration={900}
                    dot={(props) => {
                      const { cx, cy, payload, key } = props
                      if (!payload.last) return <g key={key} />
                      return <circle key={key} cx={cx} cy={cy} r={4} fill="#6E9296" stroke="#FFFFFF" strokeWidth={2} />
                    }}
                    activeDot={{ r: 5, fill: "#6E9296", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-gray-400">
          A weekly trend appears here once you&apos;ve recorded across more than one week.
        </p>
      )}

      {/* Mood ribbon — the week's emotional spectrum as one continuous band */}
      {moodTotal > 0 && (
        <div className="mt-7">
          <div className="mb-3 h-px w-full" style={{ backgroundColor: HAIRLINE }} />
          <p className="mb-3 text-sm font-medium text-gray-500">Mood</p>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-50">
            {moods.map((m) => (
              <div
                key={m.mood_label}
                title={`${m.mood_label}: ${m.count}`}
                style={{ flexGrow: m.count, backgroundColor: moodColor(m.mood_label) }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {moods.map((m) => (
              <span key={m.mood_label} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: moodColor(m.mood_label) }} />
                <span className="capitalize">{m.mood_label}</span>
                <span className="text-gray-300">{m.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* The repeated phrase — a remembered line, set as a quote */}
      {trends.top_phrase && (
        <div className="mt-7">
          <div className="mb-3 h-px w-full" style={{ backgroundColor: HAIRLINE }} />
          <p className="mb-2 text-sm font-medium text-gray-500">Heard often</p>
          <figure className="relative pl-5">
            <span
              aria-hidden
              className="absolute -left-1 -top-2 text-3xl leading-none text-gray-200"
              style={{ fontFamily: "Georgia, serif" }}
            >
              &ldquo;
            </span>
            <blockquote className="text-[17px] italic leading-snug text-gray-700" style={{ fontFamily: "Georgia, serif" }}>
              {trends.top_phrase}
            </blockquote>
            <figcaption className="mt-1.5 text-xs text-gray-400">
              {trends.top_phrase_count} time{trends.top_phrase_count === 1 ? "" : "s"}
            </figcaption>
          </figure>
        </div>
      )}
    </Surface>
  )
}
