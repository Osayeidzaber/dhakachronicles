/** Round profile photo, or initials on black when there is none. */
export function Avatar({ name, url, size = 36, className = "" }: { name: string; url?: string | null; size?: number; className?: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars are pre-sized WebP variants on R2
    return <img src={url} alt="" width={size} height={size} style={style} className={`shrink-0 rounded-full border border-line object-cover ${className}`} />;
  }
  return (
    <span aria-hidden="true" style={style} className={`font-display grid shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-white ${className}`}>
      {initials}
    </span>
  );
}
