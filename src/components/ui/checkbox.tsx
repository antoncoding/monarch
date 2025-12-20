import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"

import { cn } from "@/utils/components"
import { FaCheck } from "react-icons/fa6";
type CheckboxVariant = "default" | "highlighted"

type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
  variant?: CheckboxVariant
  label?: React.ReactNode
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, variant = "default", label, id, ...props }, ref) => {
  // Auto-generate ID if label is provided but no ID is given
  const checkboxId = id ?? (label ? React.useId() : undefined)

  const checkbox = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={checkboxId}
      className={cn(
        "grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("grid place-content-center text-current")}
      >
        <FaCheck className="h-3.5 w-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )

  // If no label, return just the checkbox
  if (!label) {
    return checkbox
  }

  // Highlighted variant with label
  if (variant === "highlighted") {
    return (
      <label
        htmlFor={checkboxId}
        className="flex items-center cursor-pointer gap-3 rounded-sm border border-primary/20 bg-primary/5 p-4 shadow-sm transition-colors hover:bg-primary/10"
      >
        {checkbox}
        <span className="text-sm leading-none text-secondary">{label}</span>
      </label>
    )
  }

  // Default variant with label
  return (
    <div className="flex items-center space-x-2">
      {checkbox}
      <label
        htmlFor={checkboxId}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
      >
        {label}
      </label>
    </div>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
