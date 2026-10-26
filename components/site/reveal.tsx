"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Marks its children `data-reveal="shown"` the first time they scroll into view, so CSS can play an
 * entrance once. Content is never hidden before the script runs, so it stays readable without JS.
 */
export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<"idle" | "pending" | "shown">("idle")

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("shown")
          observer.disconnect()
        } else {
          setState((s) => (s === "idle" ? "pending" : s))
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} data-reveal={state} className={className}>
      {children}
    </div>
  )
}
