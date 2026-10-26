/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer"
import QRCode from "qrcode"

import { COVERED_SUMMARY } from "@/lib/content/policy"
import { STANDARD_TERMS } from "@/lib/content/terms"
import { categoryLabel } from "@/lib/domain/constants"
import { formatDate } from "@/lib/domain/dates"
import { formatMobile } from "@/lib/domain/format"
import { toSlug } from "@/lib/domain/numbers"

const RED = "#b91c1c"
const MUTED = "#57534e"
const LINE = "#e7e5e4"

const s = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 56, paddingHorizontal: 0, fontSize: 9.5, fontFamily: "Helvetica", color: "#1c1917" },
  band: { backgroundColor: RED, color: "#fff", paddingHorizontal: 36, paddingVertical: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 96, height: 38, backgroundColor: "#fff", borderRadius: 4, padding: 3 },
  bandTitle: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  bandSub: { fontSize: 9, marginTop: 2, opacity: 0.9 },
  body: { paddingHorizontal: 36, paddingTop: 20 },
  numberRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  label: { color: MUTED, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 10.5, marginTop: 2 },
  big: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  cell: { width: "50%", marginBottom: 9, paddingRight: 10 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 6, color: RED },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  th: { padding: 5, fontFamily: "Helvetica-Bold", fontSize: 8.5, backgroundColor: "#f5f5f4" },
  td: { padding: 5, fontSize: 9 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  dot: { width: 10, color: RED },
  footer: { position: "absolute", bottom: 18, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
  small: { fontSize: 7.5, color: MUTED },
  qr: { width: 64, height: 64 },
  termsText: { fontSize: 8, lineHeight: 1.4, marginBottom: 3 },
})

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

async function assets(ref: string) {
  const logo = await readFile(path.join(process.cwd(), "public", "sylvan-logo.jpg"))
  const verifyUrl = `${SITE()}/verify/${toSlug(ref)}`
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240 })
  return { logo, verifyUrl, qr }
}

function Band({ logo, title, sub }: { logo: Buffer; title: string; sub: string }) {
  return (
    <View style={s.band}>
      <View>
        <Text style={s.bandTitle}>{title}</Text>
        <Text style={s.bandSub}>{sub}</Text>
      </View>
      <Image src={{ data: logo, format: "jpg" }} style={s.logo} />
    </View>
  )
}

function Footer({ qr, verifyUrl, note }: { qr: string; verifyUrl: string; note: string }) {
  return (
    <View style={s.footer} fixed>
      <View style={{ width: "75%" }}>
        <Text style={s.small}>{note}</Text>
        <Text style={[s.small, { marginTop: 3 }]}>Verify this certificate: {verifyUrl}</Text>
        <Text style={[s.small, { marginTop: 3 }]}>Sylvan Plyboard (India) Limited · This is a system-generated certificate and needs no signature.</Text>
      </View>
      <Image src={qr} style={s.qr} />
    </View>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.cell}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  )
}

function Cols({ widths, cells, header }: { widths: string[]; cells: string[]; header?: boolean }) {
  return (
    <View style={s.tr} wrap={false}>
      {cells.map((c, i) => (
        <Text key={i} style={[header ? s.th : s.td, { width: widths[i] }]}>
          {c}
        </Text>
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------------

export type CarePlusData = {
  wrn: string
  owner_name: string
  owner_mobile: string
  site: string
  activated_at: string | null
  invoices: { invoice_number: string; invoice_date: string; dealer_name: string }[]
  items: { product_name: string; category: string; qty_used: number; care_start: string | null; care_expiry: string | null; years: number | null }[]
}

export async function renderCarePlusCertificate(d: CarePlusData) {
  const { logo, verifyUrl, qr } = await assets(d.wrn)
  const widths = ["34%", "12%", "14%", "20%", "20%"]
  return renderToBuffer(
    <Document title={`SylvanCare+ Warranty Certificate ${d.wrn}`} author="Sylvan Plyboard (India) Limited">
      <Page size="A4" style={s.page}>
        <Band logo={logo} title="SylvanCare+ Warranty Certificate" sub="Total cover warranty on premium Sylvan plywood" />
        <View style={s.body}>
          <View style={s.numberRow}>
            <View>
              <Text style={s.label}>Warranty Registration Number</Text>
              <Text style={s.big}>{d.wrn}</Text>
            </View>
            <View>
              <Text style={s.label}>Issued on</Text>
              <Text style={s.value}>{formatDate(d.activated_at)}</Text>
            </View>
          </View>
          <View style={s.grid}>
            <Field label="Home / site owner" value={d.owner_name} />
            <Field label="Registered mobile" value={formatMobile(d.owner_mobile)} />
            <View style={[s.cell, { width: "100%" }]}>
              <Text style={s.label}>Registered site</Text>
              <Text style={s.value}>{d.site}</Text>
            </View>
            <View style={[s.cell, { width: "100%" }]}>
              <Text style={s.label}>Invoice details</Text>
              <Text style={s.value}>{d.invoices.map((i) => `${i.invoice_number} dated ${formatDate(i.invoice_date)} — ${i.dealer_name}`).join("\n")}</Text>
            </View>
          </View>

          <Text style={s.h2}>Covered products</Text>
          <View style={s.table}>
            <Cols header widths={widths} cells={["Product", "Quantity", "Tenure", "Warranty start", "Warranty expiry"]} />
            {d.items.map((i, idx) => (
              <Cols
                key={idx}
                widths={widths}
                cells={[`${i.product_name} ${categoryLabel(i.category)}`, `${i.qty_used} sheets`, i.years ? `${i.years} years` : "—", formatDate(i.care_start), formatDate(i.care_expiry)]}
              />
            ))}
          </View>

          <Text style={s.h2}>What SylvanCare+ covers</Text>
          {COVERED_SUMMARY.map((c) => (
            <View key={c} style={s.bullet}>
              <Text style={s.dot}>•</Text>
              <Text style={{ flex: 1 }}>{c}</Text>
            </View>
          ))}
          <Text style={[s.small, { marginTop: 4 }]}>
            Subject to inspection, testing and verification by Sylvan, and to the exclusions in the SylvanCare+ Warranty Policy (site conditions, installation and workmanship, mixed-brand usage and others). The benefit can be claimed once per purchase.
          </Text>

          <Text style={s.h2}>How to raise a claim</Text>
          {[
            "Log in to My Care+ with your registered email and open this warranty.",
            "Choose “Raise a complaint”, select the affected product and add clear photos (and a video if possible).",
            "Keep this certificate and the original invoice ready — Sylvan's authorised representative will inspect the site.",
            "Track every step of your claim in My Care+.",
          ].map((t, i) => (
            <View key={i} style={s.bullet}>
              <Text style={s.dot}>{i + 1}.</Text>
              <Text style={{ flex: 1 }}>{t}</Text>
            </View>
          ))}
          <Text style={[s.small, { marginTop: 6 }]}>Full policy: {SITE()}/policy</Text>
        </View>
        <Footer qr={qr} verifyUrl={verifyUrl} note="This SylvanCare+ Warranty is supplementary to Sylvan's standard product warranty and is valid only for the registered site and quantity, in the name of the home / site owner." />
      </Page>
    </Document>
  )
}

// ---------------------------------------------------------------------------

export type EWarrantyData = {
  number: string
  program: "LIFETIME" | "STD_710" | "WPC"
  title: string
  issued_at: string
  customer_name: string
  customer_address: string
  dealer_name: string
  invoice_number: string
  invoice_date: string
  issued_by: string | null
  items: { product_name: string; category: string; qty: number; warranty_period: string; invoice_number: string }[]
}

export async function renderEWarrantyCertificate(d: EWarrantyData) {
  const { logo, verifyUrl, qr } = await assets(d.number)
  const terms = STANDARD_TERMS[d.program]
  const widths = ["34%", "18%", "12%", "16%", "20%"]
  return renderToBuffer(
    <Document title={`Sylvan e-Warranty ${d.number}`} author="Sylvan Plyboard (India) Limited">
      <Page size="A4" style={s.page}>
        <Band logo={logo} title="E-Warranty Certificate" sub={d.title.replace(/^E-Warranty Certificate — /, "")} />
        <View style={s.body}>
          <Text style={[s.termsText, { fontSize: 9 }]}>{terms.intro}</Text>
          {terms.coveredProducts && (
            <Text style={[s.small, { marginBottom: 8 }]}>This warranty applies to: {terms.coveredProducts.join(", ")}.</Text>
          )}
          <Text style={s.h2}>Warranty details</Text>
          <View style={s.grid}>
            <Field label="Name" value={d.customer_name} />
            <Field label="Dealer / sub-dealer / OEM" value={d.dealer_name} />
            <Field label="Warranty no." value={d.number} />
            <Field label="Warranty issue date" value={formatDate(d.issued_at)} />
            {d.program === "WPC" && <Field label="Invoice no. / date" value={`${d.invoice_number} · ${formatDate(d.invoice_date)}`} />}
            <View style={[s.cell, { width: "100%" }]}>
              <Text style={s.label}>Address</Text>
              <Text style={s.value}>{d.customer_address}</Text>
            </View>
          </View>
          <View style={s.table}>
            <Cols header widths={widths} cells={["Product", "Category", "Qty", d.program === "LIFETIME" ? "Warranty*" : "Warranty", "Invoice no."]} />
            {d.items.map((i, idx) => (
              <Cols key={idx} widths={widths} cells={[i.product_name, categoryLabel(i.category), String(i.qty), i.warranty_period, i.invoice_number]} />
            ))}
          </View>
          {d.program === "LIFETIME" && <Text style={[s.small, { marginTop: 3 }]}>*Limited to the manufacturing defects as mentioned in the terms below.</Text>}
          {d.issued_by && <Text style={[s.small, { marginTop: 6 }]}>Warranty issued by: {d.issued_by}</Text>}
        </View>
        <Footer qr={qr} verifyUrl={verifyUrl} note="Present this certificate with the original invoice to your authorised Sylvan dealer / sub-dealer for any warranty assistance." />
      </Page>
      <Page size="A4" style={[s.page, { paddingTop: 30 }]}>
        <View style={s.body}>
          <Text style={s.h2}>Terms and conditions</Text>
          {terms.terms.map((t, i) => (
            <Text key={i} style={s.termsText}>
              {i + 1}. {t}
            </Text>
          ))}
          {terms.exclusions && (
            <>
              <Text style={s.h2}>This warranty does not cover damages or defects caused by</Text>
              {terms.exclusions.map((t, i) => (
                <Text key={i} style={s.termsText}>
                  {String.fromCharCode(97 + i)}. {t}
                </Text>
              ))}
            </>
          )}
        </View>
        <Footer qr={qr} verifyUrl={verifyUrl} note={`${d.title} · ${d.number}`} />
      </Page>
    </Document>
  )
}

// ---------------------------------------------------------------------------

export type ClosureData = {
  claim_no: string
  wrn: string
  owner_name: string
  site: string
  product: string
  complaint_type: string
  decision: string
  approved_qty: number | null
  total_payable: number | null
  settlement_mode: string | null
  closed_at: string
}

export async function renderClosureCertificate(d: ClosureData) {
  const { logo, verifyUrl, qr } = await assets(d.wrn)
  return renderToBuffer(
    <Document title={`Claim Closure Certificate ${d.claim_no}`} author="Sylvan Plyboard (India) Limited">
      <Page size="A4" style={s.page}>
        <Band logo={logo} title="Claim Closure Certificate" sub="SylvanCare+ warranty claim" />
        <View style={s.body}>
          <View style={s.numberRow}>
            <View>
              <Text style={s.label}>Claim ID</Text>
              <Text style={s.big}>{d.claim_no}</Text>
            </View>
            <View>
              <Text style={s.label}>Closed on</Text>
              <Text style={s.value}>{formatDate(d.closed_at)}</Text>
            </View>
          </View>
          <View style={s.grid}>
            <Field label="Home / site owner" value={d.owner_name} />
            <Field label="Warranty registration" value={d.wrn} />
            <View style={[s.cell, { width: "100%" }]}>
              <Text style={s.label}>Registered site</Text>
              <Text style={s.value}>{d.site}</Text>
            </View>
            <Field label="Product" value={d.product} />
            <Field label="Complaint" value={d.complaint_type} />
            <Field label="Decision" value={d.decision} />
            <Field label="Compensated quantity" value={d.approved_qty != null ? `${d.approved_qty} sheets` : "—"} />
            <Field label="Settlement" value={d.settlement_mode ?? "—"} />
            <Field label="Approved compensation" value={d.total_payable != null ? `INR ${d.total_payable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"} />
          </View>
          <Text style={[s.termsText, { marginTop: 10 }]}>
            This certifies that the above claim under the SylvanCare+ Warranty has been settled and closed. In accordance with Clause 2.3 of the SylvanCare+ Warranty Policy, the compensated quantity has been recorded as warranty benefit utilised and no further claim shall be entertained in respect of it. The SylvanCare+ Warranty for this registration is inactive for further claims.
          </Text>
        </View>
        <Footer qr={qr} verifyUrl={verifyUrl} note="Sylvan Plyboard (India) Limited · SylvanCare+ claims" />
      </Page>
    </Document>
  )
}
