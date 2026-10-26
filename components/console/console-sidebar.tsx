"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  IconBuildingStore,
  IconCertificate,
  IconChartBar,
  IconClipboardCheck,
  IconFilePlus,
  IconHome,
  IconLayoutDashboard,
  IconLogout,
  IconMail,
  IconMessageReport,
  IconPackage,
  IconPhoneCall,
  IconSettings,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react"

import { staffLogout } from "@/app/console/login/actions"
import { Brand } from "@/components/brand"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Role } from "@/lib/domain/constants"

type NavItem = { href: string; label: string; icon: typeof IconHome; roles: Role[] | "all"; count?: keyof Counts }
export type Counts = { registrations: number; eWarranties: number; inspections: number; claims: number; callbacks: number }

const WORK: NavItem[] = [
  { href: "/console", label: "Dashboard", icon: IconLayoutDashboard, roles: "all" },
  { href: "/console/registrations", label: "Registrations", icon: IconShieldCheck, roles: ["verifier", "approver", "customer_care", "management"], count: "registrations" },
  { href: "/console/e-warranties", label: "E-warranties", icon: IconCertificate, roles: ["sales_coordinator", "management"], count: "eWarranties" },
  { href: "/console/inspections", label: "Inspections", icon: IconClipboardCheck, roles: ["inspector", "verifier", "technical"], count: "inspections" },
  { href: "/console/claims", label: "Claims", icon: IconMessageReport, roles: ["verifier", "technical", "approver", "finance", "customer_care", "management"], count: "claims" },
  { href: "/console/assisted", label: "Assisted registration", icon: IconFilePlus, roles: ["customer_care"] },
  { href: "/console/callbacks", label: "Call-back requests", icon: IconPhoneCall, roles: ["customer_care"], count: "callbacks" },
]

const INSIGHT: NavItem[] = [
  { href: "/console/reports", label: "Reports", icon: IconChartBar, roles: ["management", "approver", "finance"] },
  { href: "/console/messages", label: "Messages sent", icon: IconMail, roles: ["customer_care"] },
]

const SETTINGS: NavItem[] = [
  { href: "/console/settings/staff", label: "Staff & roles", icon: IconUsers, roles: [] },
  { href: "/console/settings/products", label: "Products", icon: IconPackage, roles: [] },
  { href: "/console/settings/dealers", label: "Dealers", icon: IconBuildingStore, roles: ["admin"] },
  { href: "/console/settings/general", label: "SLA & rules", icon: IconSettings, roles: [] },
]

export function ConsoleSidebar({ roles, counts, name }: { roles: Role[]; counts: Counts; name: string }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const allowed = (item: NavItem) => item.roles === "all" || roles.includes("admin") || item.roles.some((r) => roles.includes(r))
  const active = (href: string) => (href === "/console" ? pathname === href : pathname.startsWith(href))

  const group = (label: string, items: NavItem[]) => {
    const visible = items.filter(allowed)
    if (!visible.length) return null
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={active(item.href)}
                  render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                  className="max-md:h-10"
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {item.count && counts[item.count] > 0 && <SidebarMenuBadge>{counts[item.count]}</SidebarMenuBadge>}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <Brand href="/console" subtitle="Console" />
      </SidebarHeader>
      <SidebarContent>
        {group("Work", WORK)}
        {group("Insight", INSIGHT)}
        {group("Settings", SETTINGS)}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/" />} className="max-md:h-10">
              <IconHome />
              <span>Public site</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => staffLogout()} className="max-md:h-10">
              <IconLogout />
              <span>Log out {name.split(" ")[0]}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
