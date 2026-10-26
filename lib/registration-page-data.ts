import type { DealerOption } from "@/components/registration/form-state"
import { todayIST } from "@/lib/domain/dates"
import type { ProductRef } from "@/lib/domain/registration"
import { getProducts, getSettings } from "@/lib/settings"
import { supabaseAdmin } from "@/lib/supabase/admin"

/** Everything the registration form needs from the server. */
export async function registrationFormData() {
  const [settings, products, { data: dealers }] = await Promise.all([
    getSettings(),
    getProducts(),
    supabaseAdmin().from("dealers").select("id, name, city, gstin").eq("active", true).eq("authorised", true).order("name"),
  ])
  return {
    settings: settings.eligibility,
    products: products.map(
      ({ id, name, category, standard_program, standard_period, care_plus_years, coverage_note }): ProductRef => ({
        id,
        name,
        category,
        standard_program,
        standard_period,
        care_plus_years,
        coverage_note,
      })
    ),
    dealers: (dealers ?? []) as DealerOption[],
    today: todayIST(),
  }
}
