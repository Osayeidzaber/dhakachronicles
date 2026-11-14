import { cn } from "@/lib/utils"

/** Loading placeholder: a near-black block with a soft white shimmer (Dhaka Chronicles style). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-xl bg-white/[0.05]", className)}
      {...props}
    />
  )
}

export { Skeleton }
