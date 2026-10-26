// Inspection forms from the brief: registration verification (p.11) and the claim inspection
// checklist (p.17–18). Versioned so answers always match the form they were captured with.

export type YNU = "yes" | "no" | "unable"

export type FieldDef =
  | { key: string; type: "text" | "textarea"; label: string; required?: boolean; help?: string }
  | { key: string; type: "number"; label: string; unit?: string; required?: boolean; help?: string }
  | { key: string; type: "select"; label: string; options: string[]; required?: boolean }
  /** Yes / No / Unable to verify. The `adverse` answer needs a note and photo evidence. */
  | { key: string; type: "ynu"; label: string; adverse?: "yes" | "no"; required?: boolean }
  | { key: string; type: "photos"; label: string; min: number; max?: number; help?: string }
  | { key: string; type: "video"; label: string; help?: string }

export type SectionDef = { title: string; description?: string; fields: FieldDef[] }
export type FormDef = { version: string; title: string; sections: SectionDef[] }

const RELATIONSHIP = ["Owner", "Family", "Contractor", "Carpenter", "Other"]

export const REGISTRATION_FORM: FormDef = {
  version: "registration-v1",
  title: "SylvanCare+ site verification",
  sections: [
    {
      title: "Visit",
      fields: [
        { key: "person_present", type: "text", label: "Person present during inspection", required: true },
        { key: "relationship", type: "select", label: "Relationship to site owner", options: RELATIONSHIP, required: true },
      ],
    },
    {
      title: "Site and owner",
      fields: [
        { key: "site_matches", type: "ynu", label: "Site matches the registered address", adverse: "no", required: true },
        { key: "owner_verified", type: "ynu", label: "Site owner's identity verified", adverse: "no", required: true },
        { key: "id_document", type: "select", label: "Identity document seen", options: ["Aadhaar", "PAN", "Driving licence", "Voter ID", "Passport", "Property document", "Not available"] },
      ],
    },
    {
      title: "Product and quantity",
      fields: [
        { key: "product_matches", type: "ynu", label: "Installed product matches the covered product", adverse: "no", required: true },
        { key: "branding_visible", type: "ynu", label: "Sylvan branding / stamp / QR visible", adverse: "no", required: true },
        { key: "batch_code", type: "text", label: "Batch / stamp code seen", help: "Used to confirm manufacture on or after 1 Oct 2026" },
        { key: "qty_observed", type: "number", label: "Quantity of covered sheets observed at site", unit: "sheets", required: true },
        { key: "area_inspected", type: "ynu", label: "Installation area physically inspected", adverse: "no", required: true },
      ],
    },
    {
      title: "Installation and site conditions",
      fields: [
        { key: "installation_conditions", type: "textarea", label: "How and where the product is installed", required: true },
        { key: "dampness", type: "ynu", label: "Dampness or water exposure near the installation", adverse: "yes", required: true },
        { key: "ventilation_ok", type: "ynu", label: "Adequate ventilation", adverse: "no", required: true },
        { key: "external_exposure", type: "ynu", label: "Exposure to sunlight, rain or outdoors", adverse: "yes", required: true },
      ],
    },
    {
      title: "Photographs",
      description: "Clear photos from multiple angles. They're stored with this inspection.",
      fields: [
        { key: "photos_location", type: "photos", label: "Location where the product is installed", min: 1 },
        { key: "photos_furniture", type: "photos", label: "Complete furniture / installation", min: 1 },
        { key: "photos_angles", type: "photos", label: "Installation area from multiple angles", min: 2 },
        { key: "photos_branding", type: "photos", label: "Product branding / stamp / QR code", min: 1 },
      ],
    },
    {
      title: "Findings",
      fields: [
        { key: "discrepancies", type: "textarea", label: "Discrepancies with the registration details" },
        { key: "remarks", type: "textarea", label: "Inspector remarks", required: true },
      ],
    },
  ],
}

const ynu = (key: string, label: string, adverse: "yes" | "no"): FieldDef => ({ key, type: "ynu", label, adverse, required: true })

export const CLAIM_FORM: FormDef = {
  version: "claim-v1",
  title: "SylvanCare+ claim inspection",
  sections: [
    {
      title: "Visit",
      fields: [
        { key: "person_present", type: "text", label: "Person present during inspection", required: true },
        { key: "relationship", type: "select", label: "Relationship to site owner", options: RELATIONSHIP, required: true },
      ],
    },
    {
      title: "Product authentication",
      fields: [
        ynu("invoice_product_match", "Invoice and installed product match", "no"),
        ynu("quantity_verified", "Registered quantity verified at site", "no"),
        ynu("branding_verified", "Sylvan branding / QR / stamp verified", "no"),
        ynu("defect_verified", "Reported defect verified", "no"),
      ],
    },
    {
      title: "Defect checks",
      description: "Answer “Yes” if the defect is present.",
      fields: [
        ynu("delamination", "Delamination", "yes"),
        ynu("warping", "Warping / bending", "yes"),
        ynu("thickness_issue", "Thickness variation", "yes"),
        ynu("core_gap", "Core gaps", "yes"),
        ynu("surface_issue", "Surface defects", "yes"),
        ynu("screw_holding", "Poor screw / nail holding", "yes"),
        ynu("termite", "Termite attack", "yes"),
        ynu("borer", "Borer attack", "yes"),
        ynu("fungus", "Fungus / decay", "yes"),
      ],
    },
    {
      title: "Site conditions",
      description: "Answer “Yes” if the condition is present.",
      fields: [
        ynu("water_leakage", "Water leakage", "yes"),
        ynu("dampness", "Dampness / high moisture", "yes"),
        ynu("plumbing_proximity", "Plumbing close to the installation", "yes"),
        ynu("flooding", "Flooding exposure", "yes"),
        ynu("poor_ventilation", "Poor ventilation", "yes"),
        ynu("heat_fire", "Heat / fire / external hazard", "yes"),
      ],
    },
    {
      title: "Installation and workmanship",
      description: "Answer “Yes” if there is a problem.",
      fields: [
        ynu("workmanship_issue", "Poor workmanship / improper installation", "yes"),
        ynu("framing_issue", "Inadequate framing / support", "yes"),
        ynu("fixing_issue", "Improper screw / nail fixing", "yes"),
        ynu("adhesive_issue", "Incompatible adhesive", "yes"),
        ynu("modification", "Cutting / drilling / modification against guidelines", "yes"),
        ynu("storage_issue", "Improper storage / handling", "yes"),
      ],
    },
    {
      title: "Other products",
      fields: [
        ynu("mixed_brand", "Other brands or untreated timber used at the site", "yes"),
        ynu("other_wood_affected", "Other wooden products affected", "yes"),
        { key: "other_sylvan_affected", type: "ynu", label: "Other Sylvan sheets from the same invoice affected", required: true },
      ],
    },
    {
      title: "Measurements",
      fields: [
        { key: "moisture_pct", type: "number", label: "Moisture content", unit: "%", required: true },
        { key: "thickness_mm", type: "number", label: "Measured thickness", unit: "mm", required: true },
        { key: "affected_area_sqft", type: "number", label: "Affected area", unit: "sq ft", required: true },
        { key: "affected_qty", type: "number", label: "Affected quantity", unit: "sheets", required: true },
        { key: "unaffected_qty", type: "number", label: "Unaffected quantity", unit: "sheets", required: true },
      ],
    },
    {
      title: "Evidence",
      fields: [
        { key: "photos_defect", type: "photos", label: "Defect close-ups", min: 2 },
        { key: "photos_overview", type: "photos", label: "Overall installation", min: 1 },
        { key: "video_defect", type: "video", label: "Defect video", help: "Required for termite, borer and delamination cases" },
      ],
    },
    {
      title: "Conclusion",
      fields: [
        { key: "conclusion", type: "textarea", label: "Inspector's technical conclusion", required: true },
        { key: "confidence", type: "select", label: "Confidence level", options: ["Low", "Medium", "High"], required: true },
        { key: "further_testing", type: "select", label: "Further testing required?", options: ["Yes", "No"], required: true },
        { key: "sample_required", type: "select", label: "Sample collection required?", options: ["Yes", "No"], required: true },
      ],
    },
  ],
}

export const FORMS: Record<string, FormDef> = { [REGISTRATION_FORM.version]: REGISTRATION_FORM, [CLAIM_FORM.version]: CLAIM_FORM }
export const formFor = (kind: "registration" | "claim") => (kind === "claim" ? CLAIM_FORM : REGISTRATION_FORM)

export type InspectionAnswers = {
  values: Record<string, string>
  notes: Record<string, string>
}

/** Required answers, adverse-answer notes, photo minimums. `media` = uploaded count per field key. */
export function validateInspection(form: FormDef, a: InspectionAnswers, media: Record<string, number>) {
  const errors: Record<string, string> = {}
  const needsVideo = form.version === "claim-v1" && ["termite", "borer", "delamination"].some((k) => a.values[k] === "yes")
  for (const section of form.sections) {
    for (const f of section.fields) {
      const v = a.values[f.key] ?? ""
      if (f.type === "photos") {
        if ((media[f.key] ?? 0) < f.min) errors[f.key] = `Add at least ${f.min} photo${f.min > 1 ? "s" : ""}`
      } else if (f.type === "video") {
        if (needsVideo && f.key === "video_defect" && !(media[f.key] ?? 0)) errors[f.key] = "A video is required for termite, borer or delamination"
      } else if ("required" in f && f.required && !v.trim()) {
        errors[f.key] = "Required"
      } else if (f.type === "number" && v && !(Number(v) >= 0)) {
        errors[f.key] = "Enter a number"
      }
      if (f.type === "ynu" && f.adverse && v === f.adverse) {
        if ((a.notes[f.key] ?? "").trim().length < 5) errors[`${f.key}.note`] = "Describe what you observed"
        if (!(media[`evidence:${f.key}`] ?? 0)) errors[`${f.key}.evidence`] = "Add photo evidence"
      }
    }
  }
  return errors
}
