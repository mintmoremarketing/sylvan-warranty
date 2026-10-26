"use client"

import { useRouter } from "next/navigation"
import { IconFilePlus, IconHome, IconListDetails, IconLogout, IconUser } from "@tabler/icons-react"

import { logout } from "@/app/my/actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function PortalUserMenu({ email }: { email: string }) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="h-10 gap-2 pl-1.5" aria-label="Account menu" />}>
        <Avatar className="size-7">
          <AvatarFallback>
            <IconUser className="size-4" />
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-48 truncate sm:inline">{email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/my")}>
            <IconListDetails />
            My warranties
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/my/register")}>
            <IconFilePlus />
            Register another warranty
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/")}>
            <IconHome />
            SylvanCare+ home
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => logout()}>
          <IconLogout />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
