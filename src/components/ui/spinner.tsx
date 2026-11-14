import { cn } from "@/lib/utils"

/** Thin white ring spinner (Dhaka Chronicles): a faint track with a bright quarter arc. */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      {...props}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  )
}

export { Spinner }
