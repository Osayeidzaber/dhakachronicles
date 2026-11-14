"use client";

import { useParams } from "next/navigation";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ lang: string }>();
  const bn = params?.lang === "bn";
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">{bn ? "কিছু একটা সমস্যা হয়েছে" : "Something went wrong"}</h1>
      <button onClick={reset} className="btn mt-6">
        {bn ? "আবার চেষ্টা করুন" : "Try again"}
      </button>
    </div>
  );
}
