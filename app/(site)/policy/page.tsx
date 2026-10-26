import type { Metadata } from "next"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CARE_PLUS_POLICY, type PolicyBlock } from "@/lib/content/policy"
import { STANDARD_TERMS } from "@/lib/content/terms"

export const metadata: Metadata = { title: "Warranty policy" }

function Block({ block }: { block: PolicyBlock }) {
  if (typeof block === "string") return <p>{block}</p>
  return (
    <ol className="ml-5 flex list-[lower-alpha] flex-col gap-1.5">
      {block.list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  )
}

const STANDARD_LABELS = {
  LIFETIME: "Lifetime products (plywood & blockboard)",
  STD_710: "710 Ply/BB · 303 BWP Ply · Blockboards · Flush doors",
  WPC: "WPC Solid Polymer Board (30 years)",
} as const

export default function PolicyPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">Effective for products manufactured from 1 Oct 2026</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">SylvanCare+ Warranty Policy</h1>
        <p className="text-muted-foreground">
          The SylvanCare+ Warranty is supplementary to Sylvan&apos;s standard product warranty and is available only on successful registration within 90 days of purchase.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-8 text-sm leading-relaxed">
          {CARE_PLUS_POLICY.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h2 className="text-base font-semibold">{section.title}</h2>
              {section.clauses.map((clause) => (
                <div key={clause.no} className="grid gap-x-3 sm:grid-cols-[2.5rem_1fr]">
                  <span className="font-medium text-muted-foreground">{clause.no}</span>
                  <div className="flex flex-col gap-2">
                    {clause.blocks.map((b, i) => (
                      <Block key={i} block={b} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </CardContent>
      </Card>

      <Separator />

      <section id="standard" className="flex scroll-mt-20 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Standard e-warranty terms</h2>
          <p className="text-muted-foreground">
            These terms are printed on the standard e-warranty certificate for each product range. Standard e-warranties must be registered within 30 days of purchase.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Choose a product range</CardTitle>
            <CardDescription>Each certificate type has its own terms.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion>
              {(Object.keys(STANDARD_TERMS) as (keyof typeof STANDARD_TERMS)[]).map((key) => {
                const t = STANDARD_TERMS[key]
                return (
                  <AccordionItem key={key} value={key}>
                    <AccordionTrigger>{STANDARD_LABELS[key]}</AccordionTrigger>
                    <AccordionContent className="flex flex-col gap-3 text-sm leading-relaxed">
                      <p>{t.intro}</p>
                      {t.coveredProducts && (
                        <>
                          <h3 className="font-medium">Products</h3>
                          <ul className="ml-5 list-disc">
                            {t.coveredProducts.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      <h3 className="font-medium">Terms and conditions</h3>
                      <ol className="ml-5 flex list-decimal flex-col gap-1.5">
                        {t.terms.map((term) => (
                          <li key={term}>{term}</li>
                        ))}
                      </ol>
                      {t.exclusions && (
                        <>
                          <h3 className="font-medium">This warranty does not cover damage or defects caused by</h3>
                          <ol className="ml-5 flex list-[lower-alpha] flex-col gap-1.5">
                            {t.exclusions.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ol>
                        </>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
