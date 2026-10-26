import { DocumentList } from "@/components/document-list"
import { CONSOLE_CARD } from "@/components/console/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime } from "@/lib/domain/dates"
import { FORMS } from "@/lib/domain/inspection-forms"
import type { Doc, Inspection } from "@/lib/queries"

const YNU_LABEL: Record<string, string> = { yes: "Yes", no: "No", unable: "Unable to verify" }

/** Read-only view of a submitted inspection, laid out like the form it was captured with. */
export function InspectionReport({ inspection, docs }: { inspection: Inspection; docs: Doc[] }) {
  const form = inspection.form_version ? FORMS[inspection.form_version] : null
  const answers = inspection.answers as { values?: Record<string, string>; notes?: Record<string, string>; geo_note?: string | null }
  const values = answers.values ?? {}
  const notes = answers.notes ?? {}
  const media = (key: string) => docs.filter((d) => d.kind === `inspection:${key}`)

  return (
    <>
      <Card className={CONSOLE_CARD}>
        <CardHeader>
          <CardTitle>
            {inspection.status === "revisit_required" ? "Revisit required" : "Inspection report"}{" "}
            <Badge variant="secondary">{inspection.staff?.full_name}</Badge>
          </CardTitle>
          <CardDescription>
            Submitted {formatDateTime(inspection.submitted_at)}
            {inspection.customer_ack_name && ` · acknowledged by ${inspection.customer_ack_name}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {inspection.geo_lat != null ? (
            <a className="underline underline-offset-4" href={`https://www.google.com/maps?q=${inspection.geo_lat},${inspection.geo_lng}`} target="_blank" rel="noreferrer">
              GPS {inspection.geo_lat.toFixed(5)}, {inspection.geo_lng!.toFixed(5)} (±{Math.round(inspection.geo_accuracy_m ?? 0)} m)
            </a>
          ) : (
            <p className="text-muted-foreground">No GPS captured: {answers.geo_note ?? "—"}</p>
          )}
        </CardContent>
      </Card>
      {form?.sections.map((section) => {
        const fields = section.fields.filter((f) => values[f.key] || media(f.key).length || media(`evidence:${f.key}`).length)
        if (!fields.length) return null
        return (
          <Card key={section.title} className={CONSOLE_CARD}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {fields.map((f) => {
                const v = values[f.key]
                const adverse = f.type === "ynu" && f.adverse && v === f.adverse
                return (
                  <div key={f.key} className="flex flex-col gap-1.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">{f.label}</span>
                      {v && (
                        <span className="font-medium">
                          {f.type === "ynu" ? (
                            <Badge variant={adverse ? "destructive" : v === "unable" ? "outline" : "secondary"}>{YNU_LABEL[v]}</Badge>
                          ) : (
                            <>
                              {v}
                              {f.type === "number" && f.unit ? ` ${f.unit}` : ""}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    {notes[f.key] && <p className="rounded-md bg-muted p-2">{notes[f.key]}</p>}
                    {media(`evidence:${f.key}`).length > 0 && <DocumentList docs={media(`evidence:${f.key}`)} />}
                    {(f.type === "photos" || f.type === "video") && <DocumentList docs={media(f.key)} />}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}
    </>
  )
}
