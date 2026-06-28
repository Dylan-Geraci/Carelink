"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/providers/auth-provider"
import { api, type PatientWithRole, type Role } from "@/lib/api"

// M4: holds the caregiver's patients and the active one. Identity comes from
// the Firebase user when configured, else a stable local fallback so the app
// still works fully offline. The chosen patient is mirrored onto the API client
// (as headers) and persisted so it survives reloads.

const ACTIVE_KEY = "carelink.activePatient"

type PatientContextValue = {
  loading: boolean
  patients: PatientWithRole[]
  activePatientId?: string
  activePatient?: PatientWithRole
  role?: Role
  setActivePatient: (patientId: string) => void
  refresh: () => Promise<void>
}

const PatientContext = createContext<PatientContextValue | undefined>(undefined)

const readStored = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, authEnabled } = useAuth()
  const [patients, setPatients] = useState<PatientWithRole[]>([])
  const [activePatientId, setActiveId] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  const setActivePatient = useCallback((patientId: string) => {
    setActiveId(patientId)
    api.setActivePatient(patientId)
    try {
      localStorage.setItem(ACTIVE_KEY, patientId)
    } catch {
      /* ignore storage errors */
    }
  }, [])

  const sync = useCallback(async () => {
    const caregiverId = user?.uid || "local-caregiver"
    api.setCaregiverId(caregiverId)
    setLoading(true)
    try {
      const res = await api.syncCaregiver(caregiverId, user?.email ?? null, user?.displayName ?? user?.email ?? "You")
      setPatients(res.patients)
      const stored = readStored()
      const pick = res.patients.find((p) => p.patient_id === stored) || res.patients[0]
      if (pick) {
        setActivePatient(pick.patient_id)
      } else {
        setActiveId(undefined)
        api.setActivePatient(undefined)
      }
    } catch (e) {
      console.error("Caregiver sync failed:", e)
    } finally {
      setLoading(false)
    }
  }, [user, setActivePatient])

  // Re-list patients after a create/invite/remove without re-claiming anything.
  const refresh = useCallback(async () => {
    try {
      const res = await api.getPatients()
      setPatients(res.patients)
      setActiveId((prev) => {
        if (prev && res.patients.some((p) => p.patient_id === prev)) return prev
        const first = res.patients[0]?.patient_id
        api.setActivePatient(first)
        if (first) {
          try {
            localStorage.setItem(ACTIVE_KEY, first)
          } catch {
            /* ignore */
          }
        }
        return first
      })
    } catch (e) {
      console.error("Failed to refresh patients:", e)
    }
  }, [])

  useEffect(() => {
    if (authEnabled && authLoading) return // wait for Firebase to settle
    sync()
  }, [authEnabled, authLoading, sync])

  const activePatient = patients.find((p) => p.patient_id === activePatientId)

  const value = useMemo<PatientContextValue>(
    () => ({
      loading,
      patients,
      activePatientId,
      activePatient,
      role: activePatient?.role,
      setActivePatient,
      refresh,
    }),
    [loading, patients, activePatientId, activePatient, setActivePatient, refresh],
  )

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>
}

export function usePatient() {
  const ctx = useContext(PatientContext)
  if (!ctx) throw new Error("usePatient must be used within a PatientProvider")
  return ctx
}
