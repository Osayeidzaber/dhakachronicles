import Image from "next/image";
import type { Lang } from "@/lib/db/types";
import type { Interviewee } from "@/lib/portfolio";

function initials(name: string) {
  const words = name.replace(/^Barrister\s+/i, "").split(/\s+/).filter((w) => /^[A-Za-z]{2,}/.test(w));
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

/** Portrait cards for people we have interviewed, with their current role and, for MPs, their seat. */
export function IntervieweeGrid({ people, lang }: { people: Interviewee[]; lang: Lang }) {
  const credited = people.flatMap((p) => (p.photo && p.credit ? [{ name: p.name, credit: p.credit }] : []));
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
        {people.map((p) => (
          <li key={p.name.en} className="flex flex-col gap-3">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface">
              {p.photo ? (
                <Image
                  src={p.photo}
                  alt={p.name[lang]}
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                  placeholder="blur"
                  className="object-cover grayscale-[35%] transition duration-500 hover:grayscale-0"
                  style={{ objectPosition: p.focus ?? "50% 25%" }}
                />
              ) : (
                <span aria-hidden className="font-display absolute inset-0 grid place-items-center text-5xl text-subtle">
                  {initials(p.name.en)}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium leading-snug">{p.name[lang]}</span>
              <span className="text-[13px] leading-snug text-neutral-600">{p.role[lang]}</span>
              {p.seat && <span className="text-[13px] leading-snug text-muted">{p.seat[lang]}</span>}
            </div>
          </li>
        ))}
      </ul>
      {credited.length > 0 && (
        <p className="text-[12px] leading-relaxed text-subtle">
          {lang === "bn" ? "ছবি: " : "Photos: "}
          {credited.map((p, i) => (
            <span key={p.name.en}>
              {i > 0 && "; "}
              {p.name[lang]},{" "}
              <a href={p.credit.source} target="_blank" rel="noopener noreferrer" className="underline decoration-white/20 underline-offset-2 hover:text-white">
                {p.credit.author}
              </a>
              ,{" "}
              <a href={p.credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline decoration-white/20 underline-offset-2 hover:text-white">
                {p.credit.license}
              </a>
            </span>
          ))}
          {lang === "bn" ? "। অন্যান্য ছবি ঢাকা ক্রনিকলস ও উইকিমিডিয়া কমন্স (পাবলিক ডোমেইন) থেকে।" : ". Other photos: Dhaka Chronicles and Wikimedia Commons (public domain)."}
        </p>
      )}
    </div>
  );
}
