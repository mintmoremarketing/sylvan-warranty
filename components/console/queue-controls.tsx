import Link from "next/link"
import { IconSearch } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

/** Filter chips + search box for a queue page. Plain links and a GET form, so it works without JS. */
export function QueueControls({
  basePath,
  tabs,
  current,
  search,
  placeholder,
}: {
  basePath: string
  tabs: readonly { key: string; label: string }[]
  current: string
  search: string
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-3">
      {placeholder && (
        <form action={basePath} className="px-4 sm:px-0">
          <input type="hidden" name="q" value={current} />
          <InputGroup className="bg-background">
            <InputGroupAddon>
              <IconSearch />
            </InputGroupAddon>
            <InputGroupInput
              name="s"
              defaultValue={search}
              placeholder={placeholder}
              type="search"
            />
          </InputGroup>
        </form>
      )}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 px-4 pb-2 sm:px-0">
          {tabs.map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={t.key === current ? "default" : "outline"}
              className="max-sm:h-9"
              render={
                <Link
                  href={`${basePath}?q=${t.key}${search ? `&s=${encodeURIComponent(search)}` : ""}`}
                />
              }
              nativeButton={false}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
