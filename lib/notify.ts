import nodemailer from "nodemailer"

import { supabaseAdmin } from "@/lib/supabase/admin"

// Customer communication templates from the brief. Email only for now; SMS and WhatsApp become
// extra channels here once Sylvan's DLT registration and WhatsApp templates are approved.

type Vars = Record<string, string | number | null | undefined>
type Template = { subject: (v: Vars) => string; heading: string; lines: (v: Vars) => string[]; cta?: (v: Vars) => { label: string; path: string } }

const portal = (path: string) => ({ label: "Open My Care+", path })

const TEMPLATES = {
  registration_received: {
    subject: (v) => `Registration received — ${v.wrn}`,
    heading: "We've received your warranty registration",
    lines: (v) => [
      `Hi ${v.name}, thank you for choosing Sylvan Ply.`,
      `Your Warranty Registration Number is <b>${v.wrn}</b>.`,
      `${v.summary}`,
      "We'll verify your invoice and site details and keep you posted at every step.",
    ],
    cta: (v) => portal(`/my/registrations/${v.slug}`),
  },
  under_verification: {
    subject: (v) => `Your registration ${v.wrn} is under verification`,
    heading: "Verification has started",
    lines: (v) => [`Hi ${v.name}, our team has started verifying registration <b>${v.wrn}</b>.`],
    cta: (v) => portal(`/my/registrations/${v.slug}`),
  },
  info_required: {
    subject: (v) => `Action required — additional information for ${v.wrn}`,
    heading: "We need a little more information",
    lines: (v) => [
      `Hi ${v.name}, to continue verifying registration <b>${v.wrn}</b> we need:`,
      `<b>${v.items}</b>`,
      `Note from our team: ${v.remarks}`,
      "Please log in and upload the details. Your registration continues as soon as we receive them.",
    ],
    cta: (v) => portal(`/my/registrations/${v.slug}`),
  },
  inspection_required: {
    subject: (v) => `Site inspection required — ${v.wrn}`,
    heading: "A site inspection is required",
    lines: (v) => [
      `Hi ${v.name}, a Sylvan authorised representative will visit your site to verify registration <b>${v.wrn}</b>.`,
      "We'll contact you to schedule the visit. Please keep your invoice handy.",
    ],
    cta: (v) => portal(`/my/registrations/${v.slug}`),
  },
  inspector_assigned: {
    subject: (v) => `Site inspector assigned — ${v.ref}`,
    heading: "A site inspector has been assigned",
    lines: (v) => [
      `Hi ${v.name}, ${v.inspector}, a Sylvan authorised representative, will inspect your site for <b>${v.ref}</b>.`,
      "They'll contact you to fix a convenient date and time for the visit.",
    ],
    cta: (v) => portal(v.path as string),
  },
  // To the inspector (brief §4: WRN, customer details, site details and the inspection form link).
  inspection_assignment: {
    subject: (v) => `New site inspection — ${v.ref}`,
    heading: "You've been assigned a site inspection",
    lines: (v) => [
      `Hi ${v.inspector}, ${v.by} has assigned you the inspection for <b>${v.ref}</b>.`,
      `Customer: <b>${v.owner}</b> · ${v.mobile}`,
      `Site: ${v.site}`,
      v.when ? `Visit: <b>${v.when}</b>` : "Please call the customer to schedule the visit, then set the date in the console.",
      "Fill in the inspection form at the site. It captures your location and photos.",
    ],
    cta: (v) => ({ label: "Open inspection form", path: v.path as string }),
  },
  inspection_scheduled: {
    subject: (v) => `Site inspection scheduled — ${v.ref}`,
    heading: "Your site inspection is scheduled",
    lines: (v) => [
      `Hi ${v.name}, an inspection for <b>${v.ref}</b> is scheduled for <b>${v.when}</b>.`,
      `Inspector: ${v.inspector}.`,
      "Please make sure the installation area is accessible and keep your invoice and warranty registration handy.",
    ],
    cta: (v) => portal(v.path as string),
  },
  inspection_completed: {
    subject: (v) => `Site inspection completed — ${v.ref}`,
    heading: "Site inspection completed",
    lines: (v) => [`Hi ${v.name}, the site inspection for <b>${v.ref}</b> is complete. Our team is reviewing the findings.`],
    cta: (v) => portal(v.path as string),
  },
  certificate_issued: {
    subject: (v) => `Your SylvanCare+ warranty is active — ${v.wrn}`,
    heading: "Your SylvanCare+ warranty is active",
    lines: (v) => [
      `Hi ${v.name}, your registration <b>${v.wrn}</b> has been approved and your SylvanCare+ warranty is now active.`,
      `${v.coverage}`,
      "Download your warranty certificate from My Care+. Please keep it with your invoice — you'll need both if you ever raise a claim.",
    ],
    cta: (v) => ({ label: "Download certificate", path: `/my/registrations/${v.slug}` }),
  },
  registration_rejected: {
    subject: (v) => `Update on your SylvanCare+ registration ${v.wrn}`,
    heading: "Your SylvanCare+ registration could not be approved",
    lines: (v) => [
      `Hi ${v.name}, your SylvanCare+ registration bearing Registration No. <b>${v.wrn}</b> could not be approved.`,
      `Reason: <b>${v.reason}</b>.`,
      v.remarks ? `Note from our team: ${v.remarks}` : "",
      "The standard Sylvan product warranty remains applicable as per its terms. You can request a call back from My Care+ if you have questions.",
    ],
    cta: (v) => portal(`/my/registrations/${v.slug}`),
  },
  e_warranty_issued: {
    subject: (v) => `Your Sylvan e-warranty certificate — ${v.number}`,
    heading: "Your e-warranty certificate is ready",
    lines: (v) => [
      `Hi ${v.name}, your Sylvan e-warranty certificate <b>${v.number}</b> (${v.program}) has been issued.`,
      "You can download it any time from My Care+.",
    ],
    cta: (v) => ({ label: "Download e-warranty", path: `/my/registrations/${v.slug}` }),
  },
  claim_received: {
    subject: (v) => `Complaint received — ${v.claim_no}`,
    heading: "We've received your complaint",
    lines: (v) => [
      `Hi ${v.name}, your complaint has been registered with Claim ID <b>${v.claim_no}</b>.`,
      "Our team will review it and may schedule a site inspection. You can track it in My Care+.",
    ],
    cta: (v) => portal(`/my/claims/${v.slug}`),
  },
  claim_info_required: {
    subject: (v) => `Action required — ${v.claim_no}`,
    heading: "We need more information about your complaint",
    lines: (v) => [`Hi ${v.name}, for claim <b>${v.claim_no}</b> we need: <b>${v.items}</b>.`, `Note: ${v.remarks}`],
    cta: (v) => portal(`/my/claims/${v.slug}`),
  },
  claim_further_testing: {
    subject: (v) => `Further testing required — ${v.claim_no}`,
    heading: "Samples sent for testing",
    lines: (v) => [`Hi ${v.name}, samples from your site are being tested to assess claim <b>${v.claim_no}</b>. We'll update you once results are in.`],
    cta: (v) => portal(`/my/claims/${v.slug}`),
  },
  claim_decided: {
    subject: (v) => `Claim ${String(v.decision_label).toLowerCase()} — ${v.claim_no}`,
    heading: "A decision has been made on your claim",
    lines: (v) => [
      `Hi ${v.name}, your claim <b>${v.claim_no}</b> has been <b>${String(v.decision_label).toLowerCase()}</b>.`,
      v.remarks ? `Remarks: ${v.remarks}` : "",
      v.decision === "rejected"
        ? "You can request a call back from My Care+ if you'd like to discuss this."
        : "Our team will contact you about the settlement.",
    ],
    cta: (v) => portal(`/my/claims/${v.slug}`),
  },
  compensation_approved: {
    subject: (v) => `Compensation approved — ${v.claim_no}`,
    heading: "Compensation approved",
    lines: (v) => [`Hi ${v.name}, compensation for claim <b>${v.claim_no}</b> has been approved. Settlement is now in progress.`],
    cta: (v) => portal(`/my/claims/${v.slug}`),
  },
  settlement_completed: {
    subject: (v) => `Settlement completed — ${v.claim_no}`,
    heading: "Settlement completed",
    lines: (v) => [`Hi ${v.name}, the settlement for claim <b>${v.claim_no}</b> is complete.`],
    cta: (v) => portal(`/my/claims/${v.slug}`),
  },
  claim_closed: {
    subject: (v) => `Claim closed — ${v.claim_no}`,
    heading: "Your claim is closed",
    lines: (v) => [`Hi ${v.name}, claim <b>${v.claim_no}</b> is now closed. Your claim closure certificate is available in My Care+.`],
    cta: (v) => portal(`/my/claims/${v.slug}`),
  },
  assisted_consent: {
    subject: () => "Confirm your SylvanCare+ warranty registration",
    heading: "Confirm your warranty registration",
    lines: (v) => [
      `Hi ${v.name}, ${v.staff} from Sylvan is registering your warranty for the site at ${v.site}.`,
      `To confirm the details are correct and to accept the SylvanCare+ terms, share this code with them:`,
      `<span style="font-size:28px;font-weight:bold;letter-spacing:6px">${v.code}</span>`,
      "The code expires in 10 minutes. If you didn't ask for this, ignore this email.",
    ],
  },
  staff_welcome: {
    subject: () => "Your SylvanCare+ console account",
    heading: "Welcome to the SylvanCare+ console",
    lines: (v) => [
      `Hi ${v.name}, an account has been created for you with the role(s): <b>${v.roles}</b>.`,
      "Your administrator will share your temporary password with you. Log in with this email address and change it from your profile.",
    ],
    cta: () => ({ label: "Open the console", path: "/console" }),
  },
} satisfies Record<string, Template>

export type TemplateKey = keyof typeof TEMPLATES

const SITE_URL = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

function render(key: TemplateKey, vars: Vars) {
  const t = TEMPLATES[key] as Template
  const lines = t.lines(vars).filter(Boolean)
  const cta = t.cta?.(vars)
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4">
<div style="background:#b91c1c;color:#fff;padding:16px 24px;font-weight:bold;font-size:18px">SylvanCare+ <span style="font-weight:normal;font-size:13px;opacity:.85">by Sylvan Ply</span></div>
<div style="padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${t.heading}</h1>
${lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5">${l}</p>`).join("\n")}
${cta ? `<p style="margin:20px 0 0"><a href="${SITE_URL()}${cta.path}" style="background:#b91c1c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block">${cta.label}</a></p>` : ""}
</div>
<div style="padding:16px 24px;border-top:1px solid #e7e5e4;color:#78716c;font-size:12px">Sylvan Plyboard (India) Ltd. · This is an automated message about your warranty.</div>
</div></body></html>`
  const text = [t.heading, "", ...lines.map((l) => l.replace(/<[^>]+>/g, "")), cta ? `\n${cta.label}: ${SITE_URL()}${cta.path}` : ""].join("\n")
  return { subject: t.subject(vars), html, text }
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null
function mailer() {
  if (!process.env.SMTP_HOST) return null
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  })
  return transport
}

/**
 * Sends one customer or staff email and records it in message_log. Never throws: a failed email
 * must not roll back the workflow step that triggered it.
 */
export async function notify(
  key: TemplateKey,
  to: string,
  vars: Vars,
  links: { registration_id?: string; claim_id?: string } = {}
) {
  const { subject, html, text } = render(key, vars)
  let status: "sent" | "logged" | "failed" = "logged"
  let error: string | null = null
  const transporter = mailer()
  if (transporter) {
    try {
      await transporter.sendMail({ from: process.env.MAIL_FROM ?? "SylvanCare+ <care@sylvanply.com>", to, subject, html, text })
      status = "sent"
    } catch (e) {
      status = "failed"
      error = e instanceof Error ? e.message : String(e)
      console.error("notify", key, error)
    }
  }
  // The consent code must not be readable later from the message log.
  const body = key === "assisted_consent" ? text.replace(/\b\d{6}\b/, "••••••") : text
  await supabaseAdmin()
    .from("message_log")
    .insert({ channel: "email", template: key, recipient: to, subject, body, status, error, ...links })
}
