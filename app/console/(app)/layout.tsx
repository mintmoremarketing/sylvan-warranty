import { ConsoleSidebar, type Counts } from "@/components/console/console-sidebar"
import { Badge } from "@/components/ui/badge"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { hasRole, requireStaff } from "@/lib/auth"
import { ROLE_LABELS } from "@/lib/domain/constants"
import { supabaseAdmin } from "@/lib/supabase/admin"

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()
  const db = supabaseAdmin()
  const head = { count: "exact" as const, head: true }

  const [registrations, eWarranties, inspections, claims, callbacks] = await Promise.all([
    db.from("registrations").select("id", head).in("status", ["received", "under_verification", "inspection_completed", "pending_approval"]),
    hasRole(staff, ["management"])
      ? db.from("e_warranties").select("id", head).eq("status", "pending_review")
      : db.from("e_warranties").select("id", head).eq("status", "pending_review").or(`coordinator_id.eq.${staff.id},coordinator_id.is.null`),
    hasRole(staff, ["admin"])
      ? db.from("inspections").select("id", head).in("status", ["assigned", "scheduled", "revisit_required"])
      : db.from("inspections").select("id", head).in("status", ["assigned", "scheduled", "revisit_required"]).eq("inspector_id", staff.id),
    db.from("claims").select("id", head).not("status", "in", "(closed,rejected)"),
    db.from("callback_requests").select("id", head).eq("status", "open"),
  ])
  const counts: Counts = {
    registrations: registrations.count ?? 0,
    eWarranties: eWarranties.count ?? 0,
    inspections: inspections.count ?? 0,
    claims: claims.count ?? 0,
    callbacks: callbacks.count ?? 0,
  }

  return (
    <SidebarProvider>
      <ConsoleSidebar roles={staff.roles} counts={counts} name={staff.full_name} />
      <SidebarInset className="min-w-0 bg-muted">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
          <SidebarTrigger className="size-9" />
          <span className="truncate text-sm font-medium">{staff.full_name}</span>
          <div className="ml-auto hidden gap-1 sm:flex">
            {staff.roles.map((r) => (
              <Badge key={r} variant="secondary">
                {ROLE_LABELS[r]}
              </Badge>
            ))}
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
