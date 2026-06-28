"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronDown, Crown, Mail, Plus, Trash2, UserPlus, Users } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { api, type Member } from "@/lib/api"
import { usePatient } from "@/components/providers/patient-provider"

const INK = "#546A7B"
const TEAL = "#8BAAAD"

// Patient switcher + Care-circle entry point. Drops into the home header.
export function PatientBar() {
  const { patients, activePatient, activePatientId, role, setActivePatient, refresh, loading } = usePatient()
  const [newOpen, setNewOpen] = useState(false)
  const [circleOpen, setCircleOpen] = useState(false)

  // Avoid flashing the empty state before the first sync resolves.
  if (loading) {
    return <div className="h-8 w-44 animate-pulse rounded-full bg-gray-100" />
  }

  if (!activePatient && patients.length === 0) {
    return (
      <>
        <Button
          onClick={() => setNewOpen(true)}
          size="sm"
          className="rounded-full"
          style={{ backgroundColor: INK, color: "white" }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add a patient
        </Button>
        <NewPatientDialog open={newOpen} onOpenChange={setNewOpen} />
      </>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-2 rounded-full border border-[#8BAAAD]/40 bg-white/70 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:border-[#8BAAAD]">
            <Users className="h-4 w-4" style={{ color: TEAL }} />
            <span className="max-w-[10rem] truncate font-medium">{activePatient?.name ?? "Select patient"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {patients.map((p) => (
            <DropdownMenuItem
              key={p.patient_id}
              onClick={() => setActivePatient(p.patient_id)}
              className="flex cursor-pointer items-center justify-between"
            >
              <span className={p.patient_id === activePatientId ? "font-semibold" : ""}>{p.name}</span>
              {p.role === "owner" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setNewOpen(true)} className="cursor-pointer text-[#546A7B]">
            <Plus className="mr-2 h-4 w-4" /> New patient…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={() => setCircleOpen(true)}
        title="Care circle"
        className="inline-flex items-center gap-1.5 rounded-full border border-[#8BAAAD]/40 bg-white/70 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-[#8BAAAD]"
      >
        <UserPlus className="h-4 w-4" style={{ color: TEAL }} />
        Care circle
      </button>

      <NewPatientDialog open={newOpen} onOpenChange={setNewOpen} />
      {activePatientId && (
        <CareCircleDialog
          open={circleOpen}
          onOpenChange={setCircleOpen}
          patientId={activePatientId}
          patientName={activePatient?.name ?? ""}
          isOwner={role === "owner"}
          onChanged={refresh}
        />
      )}
    </div>
  )
}

function NewPatientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { refresh, setActivePatient } = usePatient()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName("")
      setError(null)
    }
  }, [open])

  const save = async () => {
    if (!name.trim()) return setError("Give the patient a name.")
    setSaving(true)
    try {
      const created = await api.createPatient(name.trim())
      await refresh()
      setActivePatient(created.patient_id)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the patient.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New patient</DialogTitle>
          <DialogDescription>A separate care record. You&apos;ll be its owner.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1 py-1 text-left text-sm">
          <span className="font-medium text-gray-600">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mom"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#8BAAAD] focus:outline-none"
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="rounded-full" style={{ backgroundColor: INK, color: "white" }}>
            {saving ? "Creating…" : "Create patient"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function initials(member: Member): string {
  const src = member.display_name || member.email || "?"
  return src.slice(0, 2).toUpperCase()
}

function CareCircleDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  isOwner,
  onChanged,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  patientId: string
  patientName: string
  isOwner: boolean
  onChanged: () => void
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [asOwner, setAsOwner] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getMembers(patientId)
      setMembers(res.members)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (open) {
      setEmail("")
      setError(null)
      setAsOwner(false)
      load()
    }
  }, [open, load])

  const invite = async () => {
    if (!email.trim()) return setError("Enter an email to invite.")
    setBusy(true)
    setError(null)
    try {
      await api.inviteMember(patientId, email.trim(), asOwner ? "owner" : "caregiver")
      setEmail("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the invite.")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (membershipId: number) => {
    setBusy(true)
    setError(null)
    try {
      await api.removeMember(patientId, membershipId)
      await load()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove this member.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Care circle</DialogTitle>
          <DialogDescription>Everyone who helps care for {patientName}.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[44vh] space-y-2 overflow-y-auto py-1">
          {loading ? (
            <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
          ) : (
            members.map((m) => (
              <div key={m.membership_id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: m.status === "pending" ? "#C9B8E0" : TEAL }}
                >
                  {initials(m)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {m.display_name || m.email || "Invited caregiver"}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {m.role === "owner" ? "Owner" : "Caregiver"}
                    {m.status === "pending" && " · invite pending"}
                  </p>
                </div>
                {m.role === "owner" && <Crown className="h-4 w-4 shrink-0 text-amber-500" />}
                {isOwner && (
                  <button
                    onClick={() => remove(m.membership_id)}
                    disabled={busy}
                    title="Remove"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {isOwner ? (
          <div className="border-t border-gray-100 pt-4">
            <p className="mb-2 text-sm font-medium text-gray-600">Invite a caregiver</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && invite()}
                  placeholder="name@email.com"
                  className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[#8BAAAD] focus:outline-none"
                />
              </div>
              <Button onClick={invite} disabled={busy} className="rounded-full" style={{ backgroundColor: INK, color: "white" }}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <input type="checkbox" checked={asOwner} onChange={(e) => setAsOwner(e.target.checked)} />
              Invite as owner (can manage the circle)
            </label>
            <p className="mt-2 text-xs text-gray-400">
              They&apos;ll get access the next time they sign in with this email.
            </p>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <p className="border-t border-gray-100 pt-4 text-xs text-gray-400">
            Only an owner can invite or remove caregivers.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
