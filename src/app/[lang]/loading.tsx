export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-8 w-2/3 rounded bg-neutral-200" />
      <div className="aspect-video w-full rounded bg-neutral-200" />
      <div className="h-4 w-full rounded bg-neutral-200" />
      <div className="h-4 w-5/6 rounded bg-neutral-200" />
    </div>
  );
}
