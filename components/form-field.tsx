import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

type FormFieldProps = {
  label: React.ReactNode
  htmlFor: string
  required?: boolean
  error?: string
  description?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/** Label + control + error-or-hint, wired for `data-invalid` styling. */
export function FormField({
  label,
  htmlFor,
  required,
  error,
  description,
  className,
  children,
}: FormFieldProps) {
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden className="-ml-1.5 text-primary">
            *
          </span>
        )}
      </FieldLabel>
      {children}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : (
        description && <FieldDescription>{description}</FieldDescription>
      )}
    </Field>
  )
}
