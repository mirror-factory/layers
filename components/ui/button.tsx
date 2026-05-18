import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius-pill)] border border-transparent bg-clip-padding text-sm font-bold whitespace-nowrap transition-all outline-none select-none focus-visible:border-[var(--layers-mint)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--layers-mint)_22%,transparent)] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-[var(--signal-live)] aria-invalid:ring-3 aria-invalid:ring-[color-mix(in_oklch,var(--signal-live)_20%,transparent)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--layers-ink)] text-[var(--layers-paper)] shadow-[var(--shadow-sm)] [a]:hover:bg-[color-mix(in_oklch,var(--layers-ink)_88%,var(--layers-violet)_12%)]",
        outline:
          "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)] hover:bg-[var(--bg-surface-muted)] aria-expanded:bg-[var(--bg-surface-muted)] aria-expanded:text-[var(--fg-default)]",
        secondary:
          "bg-[var(--layers-mint)] text-[var(--layers-ink)] shadow-[var(--shadow-glow-mint)] hover:bg-[var(--layers-mint-soft)] aria-expanded:bg-[var(--layers-mint)] aria-expanded:text-[var(--layers-ink)]",
        ghost:
          "text-[var(--fg-muted)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--fg-default)] aria-expanded:bg-[var(--bg-surface-muted)] aria-expanded:text-[var(--fg-default)]",
        destructive:
          "bg-[color-mix(in_oklch,var(--signal-live)_10%,transparent)] text-[var(--signal-live)] hover:bg-[color-mix(in_oklch,var(--signal-live)_16%,transparent)] focus-visible:border-[var(--signal-live)] focus-visible:ring-[color-mix(in_oklch,var(--signal-live)_20%,transparent)]",
        link: "text-[var(--layers-violet)] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-8 gap-1.5 px-3 text-xs in-data-[slot=button-group]:rounded-[var(--radius-lg)] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-[var(--radius-lg)] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-14 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11",
        "icon-xs":
          "size-8 in-data-[slot=button-group]:rounded-[var(--radius-lg)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-9 in-data-[slot=button-group]:rounded-[var(--radius-lg)]",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
