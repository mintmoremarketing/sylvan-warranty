import Image from "next/image"
import Link from "next/link"
import {
  IconArrowRight,
  IconCertificate,
  IconCheck,
  IconClipboardCheck,
  IconExternalLink,
  IconFileInvoice,
  IconHeadset,
  IconMail,
  IconCash,
  IconCircleCheck,
  IconFlask,
  IconMapPin,
  IconMessageReport,
  IconPhoneCall,
  IconPlayerPlay,
  IconSearch,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react"

import { CallbackDialog } from "@/components/site/callback-dialog"
import { Reveal } from "@/components/site/reveal"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { COVERED_ITEMS, NOT_COVERED_SHORT } from "@/lib/content/policy"
import { cn } from "@/lib/utils"

const COVERED_PRODUCTS = [
  // Product shots from sylvanply.com, trimmed and compressed (public/products).
  {
    name: "Z+ Premium",
    years: 15,
    image: "/products/z-plus-premium.webp",
    href: "https://sylvanply.com/product/z-premium",
    blurb: "Our flagship premium plywood.",
  },
  {
    name: "Premium Club",
    years: 12,
    image: "/products/premium-club.webp",
    href: "https://sylvanply.com/product/premium-club",
    blurb: "Premium plywood for furniture and interiors.",
  },
  {
    name: "Elite Plus",
    years: 12,
    image: "/products/elite-plus.webp",
    href: "https://sylvanply.com/product/elite-plus",
    blurb: "Dependable premium plywood.",
  },
]

type Step = { icon: typeof IconShieldCheck; title: string; text: string }

const STEPS: Step[] = [
  {
    icon: IconFileInvoice,
    title: "Buy and keep your invoice",
    text: "Buy a covered Sylvan plywood from an authorised dealer. The invoice must show the product name and quantity.",
  },
  {
    icon: IconShieldCheck,
    title: "Register within 90 days",
    text: "Log in with your email, add your site and invoice details, and upload the invoice. You get a Warranty Registration Number (WRN) instantly.",
  },
  {
    icon: IconClipboardCheck,
    title: "Verification",
    text: "Our team checks your invoice and details. Sometimes an authorised representative visits the site to verify the installation.",
  },
  {
    icon: IconCertificate,
    title: "Your certificate",
    text: "Once approved, your SylvanCare+ certificate is emailed to you and stays downloadable in My Care+.",
  },
]

// The brief's claim journey: complaint → pre-screening → site inspection → technical decision →
// claim approval → settlement → closure.
const CLAIM_STEPS: Step[] = [
  {
    icon: IconMessageReport,
    title: "Raise a complaint",
    text: "From My Care+ on your active warranty, with photos (and a video if you can). You get a Claim ID.",
  },
  {
    icon: IconSearch,
    title: "Pre-screening",
    text: "We check your warranty, the product, the quantity and your photos.",
  },
  {
    icon: IconMapPin,
    title: "Site inspection",
    text: "An authorised representative inspects the site and may take samples.",
  },
  {
    icon: IconFlask,
    title: "Technical decision",
    text: "Sylvan's technical team assesses the cause of the problem.",
  },
  {
    icon: IconCircleCheck,
    title: "Claim approval",
    text: "Eligible compensation is calculated and approved as per the policy.",
  },
  {
    icon: IconCash,
    title: "Settlement",
    text: "Repair, replacement or reimbursement, as agreed with you.",
  },
  {
    icon: IconCertificate,
    title: "Closure",
    text: "You get a claim closure certificate in My Care+.",
  },
]

function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol
      className={cn(
        "grid gap-6",
        steps.length > 4 ? "lg:grid-cols-7 lg:gap-4" : "lg:grid-cols-4"
      )}
    >
      {steps.map((s, i) => (
        <li
          key={s.title}
          data-step
          style={{ "--i": i } as React.CSSProperties}
          className="relative flex gap-4 lg:flex-col lg:gap-3"
        >
          {i < steps.length - 1 && (
            <span
              aria-hidden
              data-step-line
              className="absolute top-12 -bottom-6 left-6 w-px bg-primary/30 lg:top-6 lg:right-[-1rem] lg:bottom-auto lg:left-12 lg:h-px lg:w-auto"
            />
          )}
          <span
            data-step-circle
            className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground"
          >
            {i + 1}
          </span>
          <div data-step-text className="flex flex-col gap-1 pt-1 lg:pt-0">
            <p className="flex items-center gap-2 font-medium">
              <s.icon className="size-4 shrink-0 text-primary" />
              {s.title}
            </p>
            <p className="text-sm text-muted-foreground">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

const FAQS = [
  {
    q: "What is SylvanCare+?",
    a: "SylvanCare+ is a premium warranty on selected Sylvan plywood, on top of the standard Sylvan product warranty. If a covered sheet has a manufacturing defect, or suffers termite, borer or fungal decay, it covers the affected sheets and certain ancillary costs such as laminates, adhesives, labour and veneers, as set out in the policy.",
  },
  {
    q: "Which products are covered, and for how long?",
    a: "Z+ Premium (15 years), Premium Club (12 years) and Elite Plus (12 years) plywood manufactured on or after 1 October 2026. The period runs from your invoice date. Blockboards are not covered under SylvanCare+.",
  },
  {
    q: "How long do I have to register?",
    a: "SylvanCare+ must be registered within 90 days of your invoice date. The standard Sylvan e-warranty must be registered within 30 days. Registering once covers both where eligible.",
  },
  {
    q: "What do I need to register?",
    a: "The home or site owner's details, the site address, a clear copy of the GST invoice showing the Sylvan product name and quantity, dealer details, and how many sheets were used at the site.",
  },
  {
    q: "Who can register and claim?",
    a: "The warranty is issued only in the name of the home or site owner, and only they can claim. Dealers, contractors, carpenters, architects and interior designers can help you register, but can't claim.",
  },
  {
    q: "Will someone visit my site?",
    a: "Sylvan may send an authorised representative to verify the installation after you register, and will inspect the site if you raise a complaint. Please cooperate with inspections — it's a condition of the warranty.",
  },
  {
    q: "How do I raise a complaint?",
    a: "Log in to My Care+, open your active SylvanCare+ warranty and choose Raise a Complaint. Add photos (and a video if you can) of the affected area. You'll get a Claim ID and can track it in My Care+.",
  },
  {
    q: "Can I claim more than once?",
    a: "No. A SylvanCare+ warranty can be claimed once per purchase. After a complaint is registered, that warranty is marked as inactive for further claims.",
  },
]

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-background">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-10 pb-16 sm:pt-14 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:pb-24">
          <div className="flex flex-col justify-center gap-6">
            <h1
              data-hero-item
              className="text-[2.75rem] leading-[0.98] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.5rem]"
            >
              Up to 15 years of total cover
            </h1>
            <p
              data-hero-item
              className="max-w-lg text-lg text-pretty text-foreground/80 sm:text-xl"
            >
              SylvanCare+ is the premium warranty on Sylvan plywood. Break
              nahiin banta — and if it ever does, it covers the affected sheets
              plus laminates, adhesives, labour and more.
            </p>
            <div
              data-hero-item
              className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
            >
              <Button
                size="lg"
                className="h-12 px-6 text-base"
                render={<Link href="/my/register" />}
                nativeButton={false}
              >
                Register warranty
                <IconArrowRight data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-6 text-base"
                render={<Link href="/my?intent=complaint" />}
                nativeButton={false}
              >
                <IconMessageReport data-icon="inline-start" />
                Raise a complaint
              </Button>
            </div>
            <div data-hero-item>
              <CallbackDialog
                defaultTopic="Help with registration"
                render={
                  <Button variant="link" className="h-auto p-0 text-base" />
                }
              >
                <IconPhoneCall data-icon="inline-start" />
                Need help registering? Request a call back
              </CallbackDialog>
            </div>
          </div>

          {/* How-to-register video slot (brief). Sylvan's own interior photo is the cover until the video arrives. */}
          <div
            data-hero-media
            className="relative min-h-[17rem] overflow-hidden rounded-2xl bg-muted sm:min-h-[24rem] lg:min-h-[34rem]"
          >
            <Image
              src="/hero-room.webp"
              alt="Furniture made with Sylvan plywood"
              fill
              priority
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16 text-white sm:p-6 sm:pt-20">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <IconPlayerPlay className="size-6" />
              </span>
              <span className="flex flex-col">
                <span className="text-base font-medium sm:text-lg">
                  How to register for SylvanCare+
                </span>
                <span className="text-sm text-white/85">
                  Walkthrough video coming soon
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Covered products */}
      <section
        id="covered-products"
        className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:py-16"
      >
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Covered products
          </h2>
          <p className="text-muted-foreground">
            SylvanCare+ applies to these plywood products manufactured on or
            after 1 October 2026, for the period below from your invoice date.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {COVERED_PRODUCTS.map((p) => (
            <Card key={p.name} className="pt-0">
              <AspectRatio
                ratio={1}
                className="relative overflow-hidden bg-muted"
              >
                <Image
                  src={p.image}
                  alt={`${p.name} plywood`}
                  fill
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className="object-contain p-6"
                />
              </AspectRatio>
              <CardHeader>
                <CardTitle className="text-xl">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-4xl font-semibold text-primary">
                  {p.years}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    years
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Plywood · {p.blurb}
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  render={<a href={p.href} target="_blank" rel="noreferrer" />}
                  nativeButton={false}
                >
                  View product
                  <IconExternalLink data-icon="inline-end" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        <Item variant="muted" className="mt-4">
          <ItemMedia variant="icon">
            <IconCertificate />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Bought other Sylvan products?</ItemTitle>
            <ItemDescription className="line-clamp-none">
              Register any Sylvan plywood, blockboard, flush door or WPC board
              within 30 days of purchase to get your standard e-warranty
              certificate — in the same form.
            </ItemDescription>
          </ItemContent>
        </Item>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <Reveal>
            <Tabs defaultValue="register" className="gap-8">
              <TabsList>
                <TabsTrigger value="register">Register</TabsTrigger>
                <TabsTrigger value="complaint">Raise a complaint</TabsTrigger>
              </TabsList>
              <TabsContent value="register">
                <Stepper steps={STEPS} />
              </TabsContent>
              <TabsContent value="complaint">
                <Stepper steps={CLAIM_STEPS} />
              </TabsContent>
            </Tabs>
          </Reveal>
        </div>
      </section>

      {/* Coverage */}
      <section
        id="coverage"
        className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:py-16"
      >
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          {/* Same trapezium as the "ply" tag in the Sylvan logo: long left side, shorter right side. */}
          <div className="flex flex-col gap-5 bg-primary px-6 pt-12 pb-14 text-primary-foreground [clip-path:polygon(0_0,100%_2rem,100%_calc(100%-1.25rem),0_100%)] sm:px-8 md:pt-20 md:pr-12 md:pb-16 md:[clip-path:polygon(0_0,100%_3rem,100%_calc(100%-2rem),0_100%)]">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                What SylvanCare+ covers
              </h2>
              <p className="text-primary-foreground/85">
                After inspection and verification by Sylvan.
              </p>
            </div>
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-1">
              {COVERED_ITEMS.map((c) => (
                <li key={c} className="flex gap-2.5 font-medium">
                  <IconCheck className="mt-0.5 size-5 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
            <p className="text-sm text-primary-foreground/80">Defective sheets are covered for the affected area; furniture for the affected portion.</p>
          </div>
          <div className="flex flex-col gap-5 bg-muted px-6 pt-12 pb-14 [clip-path:polygon(0_2rem,100%_0,100%_100%,0_calc(100%-1.25rem))] sm:px-8 md:pt-20 md:pb-16 md:pl-12 md:[clip-path:polygon(0_3rem,100%_0,100%_100%,0_calc(100%-2rem))]">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                What it doesn&apos;t cover
              </h2>
              <p className="text-sm text-muted-foreground">
                In short. The policy has the full wording.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {NOT_COVERED_SHORT.map((c) => (
                <li key={c} className="flex gap-2.5 text-foreground/80">
                  <IconX className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  {c}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="w-fit"
              render={<Link href="/policy" />}
              nativeButton={false}
            >
              Read the full policy
            </Button>
          </div>
        </div>
      </section>

      {/* Track */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:pb-16">
        <Card className="bg-muted/60">
          <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Already registered?</h2>
              <p className="text-muted-foreground">
                Log in to track your warranty or complaint, download
                certificates, or upload missing documents.
              </p>
            </div>
            <Button
              size="lg"
              className="h-11 w-full px-5 sm:w-auto"
              render={<Link href="/my" />}
              nativeButton={false}
            >
              <IconSearch data-icon="inline-start" />
              Track status
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* FAQs */}
      <section id="faqs" className="scroll-mt-20 bg-muted/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:py-16 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Frequently asked questions
            </h2>
            <p className="text-muted-foreground">
              Can&apos;t find your answer? Our customer care team is happy to
              help.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                className="justify-start"
                render={<a href="mailto:reach@sylvanply.com" />}
                nativeButton={false}
              >
                <IconMail data-icon="inline-start" />
                reach@sylvanply.com
              </Button>
              <CallbackDialog
                render={<Button variant="outline" className="justify-start" />}
              >
                <IconHeadset data-icon="inline-start" />
                Request a call back
              </CallbackDialog>
            </div>
          </div>
          <Accordion className="rounded-xl border bg-background px-4">
            {FAQS.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-base">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </main>
  )
}
