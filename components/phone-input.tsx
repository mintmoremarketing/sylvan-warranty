"use client"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"

type PhoneInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "value" | "onChange" | "type"
> & {
  value: string
  onValueChange: (digits: string) => void
}

/** 10-digit Indian number with a fixed +91 prefix; strips anything that isn't a digit. */
export function PhoneInput({ value, onValueChange, ...props }: PhoneInputProps) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>+91</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        value={value}
        onChange={(e) => onValueChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        {...props}
      />
    </InputGroup>
  )
}
