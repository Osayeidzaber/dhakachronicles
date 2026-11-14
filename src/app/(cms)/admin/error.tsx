"use client";

/** Shown when an admin screen fails to load. Details stay in the server log, not on screen. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="card mx-auto mt-16 max-w-md text-center">
      <h1 className="font-display text-3xl">This screen didn&rsquo;t load</h1>
      <p className="mt-2 text-sm text-neutral-500">Nothing was lost. Try again, and if it keeps happening tell an administrator.</p>
      {error.digest && <p className="mt-2 text-xs text-neutral-600">Reference: {error.digest}</p>}
      <button onClick={reset} className="btn btn-primary mt-6">
        Try again
      </button>
    </div>
  );
}
