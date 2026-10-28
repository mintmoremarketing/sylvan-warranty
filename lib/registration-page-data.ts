import { todayIST } from "@/lib/domain/dates"
import type { ProductRef } from "@/lib/domain/registration"
import { getProducts, getSettings } from "@/lib/settings"

/** Everything the registration form needs from the server. */
export async function registrationFormData() {
  const [settings, products] = await Promise.all([getSettings(), getProducts()])
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
    today: todayIST(),
  }
}
