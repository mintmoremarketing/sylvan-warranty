import { cache } from "react"

import type { EligibilitySettings, ProductRef } from "@/lib/domain/registration"
import type { WorkingHours } from "@/lib/domain/sla"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type Settings = {
  workingHours: WorkingHours
  sla: { registration_hours: number; inspection_to_certificate_hours: number; claim_screening_hours: number }
  eligibility: EligibilitySettings
  policyVersions: { care_plus: string; standard: string }
  holidays: string[]
}

export const getSettings = cache(async (): Promise<Settings> => {
  const db = supabaseAdmin()
  const [{ data: rows }, { data: holidays }] = await Promise.all([
    db.from("app_settings").select("key, value"),
    db.from("holidays").select("day"),
  ])
  const v = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))
  return {
    workingHours: v.working_hours,
    sla: v.sla,
    eligibility: {
      carePlus: {
        manufacturedFrom: v.care_plus.manufactured_from,
        windowDays: v.care_plus.window_days,
        manufactureCheck: v.care_plus.manufacture_check,
      },
      standard: { windowDays: v.standard.window_days },
    },
    policyVersions: v.policy_versions,
    holidays: (holidays ?? []).map((h) => h.day as string),
  }
})

export type ProductRow = ProductRef & {
  sort: number
  active: boolean
  lifetime_multiplier: string | null
  product_url: string | null
}

const PRODUCT_COLS =
  "id, name, category, standard_program, standard_period, care_plus_years, coverage_note, sort, active, lifetime_multiplier, product_url"

export const getProducts = cache(async (): Promise<ProductRow[]> => {
  const { data } = await supabaseAdmin().from("products").select(PRODUCT_COLS).eq("active", true).order("sort")
  return (data ?? []) as ProductRow[]
})

export const getAllProducts = cache(async (): Promise<ProductRow[]> => {
  const { data } = await supabaseAdmin().from("products").select(PRODUCT_COLS).order("sort")
  return (data ?? []) as ProductRow[]
})
