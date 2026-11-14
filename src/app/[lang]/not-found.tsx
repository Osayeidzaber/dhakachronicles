import Link from "next/link";

/** 404 (design/claude-design/NotFound.dc.html): English first, Bangla underneath. */
export default function NotFound() {
  return (
    <div className="flex flex-wrap items-center gap-12 py-16 md:py-24">
      <section className="reveal flex flex-[999_1_480px] flex-col gap-5">
        <span className="font-display text-[clamp(7rem,16vw,11rem)] leading-[0.8] text-[#2e2e2e]" aria-hidden="true">
          404
        </span>
        <h1 className="font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05]">This page isn&apos;t here.</h1>
        <p className="max-w-lg text-[17px] leading-relaxed text-neutral-600">The story may have moved, or the link may be wrong. Try searching, or start from the front page.</p>
        <p lang="bn" className="max-w-lg text-[17px] leading-relaxed text-muted">
          পাতাটি পাওয়া যায়নি। খবরটি সরানো হয়ে থাকতে পারে, বা লিংকটি ভুল।
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href="/en" className="btn btn-primary h-11 px-5">
            Front page
          </Link>
          <Link href="/en/search" className="btn h-11 px-5">
            Search
          </Link>
          <Link href="/bn" lang="bn" className="btn h-11 px-5">
            প্রচ্ছদ
          </Link>
        </div>
      </section>
    </div>
  );
}
