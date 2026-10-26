"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

type Result = { ok: true } | { ok: false; error: string }

/**
 * A bottom drawer holding one workflow decision (approve, reject, request info…).
 * Works one-handed on phones; the action runs on submit and the page refreshes.
 */
export function ActionDrawer({
  trigger,
  label,
  title,
  description,
  submitLabel,
  destructive,
  run,
  children,
  success,
}: {
  trigger: React.ReactElement
  label: React.ReactNode
  title: string
  description?: string
  submitLabel: string
  destructive?: boolean
  run: () => Promise<Result>
  children?: React.ReactNode
  success?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()

  return (
    <Drawer open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError("") }}>
      <DrawerTrigger render={trigger}>{label}</DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto flex max-h-[85svh] w-full max-w-lg flex-col overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4">{children}</div>
          <DrawerFooter>
            <FieldError>{error}</FieldError>
            <Button
              size="lg"
              variant={destructive ? "destructive" : "default"}
              className="h-11"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError("")
                  const res = await run()
                  if (!res.ok) return setError(res.error)
                  toast.success(success ?? "Done")
                  setOpen(false)
                  router.refresh()
                })
              }
            >
              {pending && <Spinner data-icon="inline-start" />}
              {submitLabel}
            </Button>
            <DrawerClose render={<Button variant="outline" size="lg" className="h-11" />}>Cancel</DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/** Sticky on phones (thumb reach), inline on desktop. */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-0 flex flex-wrap gap-2 border-t bg-background/95 p-3 backdrop-blur sm:static sm:rounded-xl sm:border sm:p-4">
      {children}
    </div>
  )
}
