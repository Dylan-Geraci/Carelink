"use client"

import CarelinkApp from "@/components/carelink-app"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { SiteHeader } from "@/components/site-header"
import { PatientProvider } from "@/components/providers/patient-provider"

export default function AppWorkspacePage() {
  return (
    <ProtectedRoute>
      <PatientProvider>
        <div className="min-h-screen bg-[#fdfcf9]">
          <SiteHeader />
          <CarelinkApp />
        </div>
      </PatientProvider>
    </ProtectedRoute>
  )
}
