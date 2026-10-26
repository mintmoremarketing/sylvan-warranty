// Dev helper: renders sample certificates to ./tmp-certs for visual checks.
// Usage: npx tsx --tsconfig tsconfig.json scripts/render-sample-certificates.tsx <outDir>
import { writeFile } from "node:fs/promises"

import { renderCarePlusCertificate, renderClosureCertificate, renderEWarrantyCertificate } from "@/lib/certificates"

const out = process.argv[2] ?? "."
const care = await renderCarePlusCertificate({
  wrn: "WRN/26/000001",
  owner_name: "Ramesh Kumar",
  owner_mobile: "9876543210",
  site: "Flat 4B, Lake Gardens Residency, 12 Southern Avenue, Kolkata, KOLKATA, WEST BENGAL — 700029",
  activated_at: "2026-10-10T16:00:00Z",
  invoices: [{ invoice_number: "INV/2026/0412", invoice_date: "2026-10-05", dealer_name: "Shree Ganesh Plywood House (Demo)" }],
  items: [{ product_name: "Z+ Premium", category: "plywood", qty_used: 35, care_start: "2026-10-05", care_expiry: "2041-10-04", years: 15 }],
})
await writeFile(`${out}/care.pdf`, care)
const ew = await renderEWarrantyCertificate({
  number: "EW/26/000001",
  program: "LIFETIME",
  title: "E-Warranty Certificate — Lifetime Products (Ply/BB)",
  issued_at: "2026-10-10T16:00:00Z",
  customer_name: "Ramesh Kumar",
  customer_address: "Flat 4B, Lake Gardens Residency, 12 Southern Avenue, Kolkata, WEST BENGAL, 700029",
  dealer_name: "Shree Ganesh Plywood House (Demo)",
  invoice_number: "INV/2026/0412",
  invoice_date: "2026-10-05",
  issued_by: "Neha Gupta",
  items: [{ product_name: "Z+ Premium", category: "plywood", qty: 40, warranty_period: "Lifetime", invoice_number: "INV/2026/0412" }],
})
await writeFile(`${out}/ew.pdf`, ew)
const closure = await renderClosureCertificate({
  claim_no: "CLM/WRN/26/000001",
  wrn: "WRN/26/000001",
  owner_name: "Ramesh Kumar",
  site: "Flat 4B, Lake Gardens Residency, Kolkata, WEST BENGAL — 700029",
  product: "Z+ Premium",
  complaint_type: "Delamination",
  decision: "Partially approved",
  approved_qty: 4,
  total_payable: 18450,
  settlement_mode: "Replacement of material",
  closed_at: "2026-10-10T16:00:00Z",
})
await writeFile(`${out}/closure.pdf`, closure)
console.log("ok")
