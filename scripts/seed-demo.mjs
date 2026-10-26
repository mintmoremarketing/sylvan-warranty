// Demo data for draft 1: staff accounts for every role and a few dealers.
// Usage: node --env-file=.env.local scripts/seed-demo.mjs
// Safe to re-run. Never run against production.

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
const db = createClient(url, key, { auth: { persistSession: false } })

const PASSWORD = process.env.DEMO_STAFF_PASSWORD ?? "Sylvan@2026"

const STAFF = [
  { email: "admin@example.com", full_name: "Demo Admin", designation: "System administrator", roles: ["admin"] },
  { email: "care@example.com", full_name: "Meera Nair", designation: "Customer care lead", roles: ["customer_care"] },
  { email: "verifier@example.com", full_name: "Priya Sharma", designation: "Warranty executive", roles: ["verifier"] },
  { email: "approver@example.com", full_name: "Anil Mehta", designation: "HO warranty manager", roles: ["approver"] },
  { email: "inspector@example.com", full_name: "Rahul Das", designation: "Field inspector", roles: ["inspector"], regions: ["WEST BENGAL"] },
  { email: "inspector2@example.com", full_name: "Suresh Iyer", designation: "Field inspector", roles: ["inspector"], regions: ["KARNATAKA", "TAMIL NADU"] },
  { email: "coordinator@example.com", full_name: "Neha Gupta", designation: "Sales coordinator", roles: ["sales_coordinator"] },
  { email: "technical@example.com", full_name: "Vikram Rao", designation: "Technical head (HO)", roles: ["technical"] },
  { email: "finance@example.com", full_name: "Kavita Joshi", designation: "Finance manager", roles: ["finance"] },
  { email: "management@example.com", full_name: "Sanjay Bose", designation: "Management", roles: ["management"] },
]

async function ensureStaff(s) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
  let user = list.users.find((u) => u.email === s.email)
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email: s.email, password: PASSWORD, email_confirm: true })
    if (error) throw error
    user = data.user
  }
  const { error } = await db
    .from("staff")
    .upsert({ id: user.id, email: s.email, full_name: s.full_name, designation: s.designation, roles: s.roles, regions: s.regions ?? [] })
  if (error) throw error
  return user.id
}

// Accounts from earlier drafts whose roles no longer exist.
const REMOVED = ["dealer@example.com"]
{
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
  for (const u of list.users.filter((u) => REMOVED.includes(u.email))) await db.auth.admin.deleteUser(u.id)
}

const ids = {}
for (const s of STAFF) ids[s.email] = await ensureStaff(s)
console.log(`staff: ${STAFF.length} accounts (password: ${PASSWORD})`)

const coordinator = ids["coordinator@example.com"]
const DEALERS = [
  { code: "DLR-KOL-001", name: "Shree Ganesh Plywood House (Demo)", city: "Kolkata", state: "WEST BENGAL", gstin: "19AABCS1234A1Z5", phone: "9830012345" },
  { code: "DLR-KOL-002", name: "Bengal Timber & Ply Mart (Demo)", city: "Howrah", state: "WEST BENGAL", gstin: "19AABCB5678B1Z2", phone: "9831198765" },
  { code: "DLR-BLR-001", name: "Karnataka Plywood Centre (Demo)", city: "Bengaluru", state: "KARNATAKA", gstin: "29AABCK4321C1Z8", phone: "9845011122" },
  { code: "DLR-DEL-001", name: "Capital Ply & Laminates (Demo)", city: "New Delhi", state: "DELHI", gstin: "07AABCC8765D1Z1", phone: "9810022233" },
  { code: "DLR-MUM-001", name: "Western Ply Traders (Demo)", city: "Mumbai", state: "MAHARASHTRA", gstin: "27AABCW2468E1Z4", phone: "9820033344" },
  { code: "DLR-CHN-001", name: "Chennai Wood Works (Demo)", city: "Chennai", state: "TAMIL NADU", gstin: "33AABCC1357F1Z9", phone: "9840044455" },
]
for (const d of DEALERS) {
  const { error } = await db.from("dealers").upsert({ ...d, sales_coordinator_id: coordinator }, { onConflict: "code" })
  if (error) throw error
}
console.log(`dealers: ${DEALERS.length}`)
console.log("done")
