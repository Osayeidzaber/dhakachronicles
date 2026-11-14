import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a public page loads, in the shape of the front page (lead poster + featured list). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-16">
      <span className="sr-only">Loading…</span>
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:col-span-8">
          <Skeleton className="aspect-[4/5] rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-12 w-11/12" />
            <Skeleton className="h-12 w-4/5" />
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
        <div className="space-y-5 lg:col-span-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="grid grid-cols-[84px_1fr] gap-4">
              <Skeleton className="aspect-square" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[4/5] rounded-2xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
