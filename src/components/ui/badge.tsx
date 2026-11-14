import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // Dhaka Chronicles: white solid, quiet outlines, soft status tints.
        default: "bg-white text-black [a]:hover:bg-neutral-800",
        secondary: "bg-white/[0.08] text-neutral-700 [a]:hover:bg-white/[0.12]",
        destructive: "border-red-500/30 bg-red-500/10 text-red-300 [a]:hover:bg-red-500/20",
        success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
        warning: "border-amber-400/30 bg-amber-500/10 text-amber-200",
        outline: "border-white/20 text-neutral-700 [a]:hover:border-white/40 [a]:hover:text-white",
        ghost: "hover:bg-white/[0.06] hover:text-white",
        link: "text-white underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
