import Image from "next/image";
import white from "../../../public/brand/logo-white-trim.png";
import black from "../../../public/brand/logo-black-trim.png";

/**
 * Dhaka Chronicles wordmark (emblem + "DHAKA CHRONICLES").
 * `height` sets the rendered height in px; width follows the 3.96:1 artwork.
 * Static imports give Next.js the real size, so there is no layout shift.
 */
export function Logo({
  height = 40,
  tone = "white",
  priority = false,
  className = "",
  label = "Dhaka Chronicles",
}: {
  height?: number;
  tone?: "white" | "black";
  priority?: boolean;
  className?: string;
  label?: string;
}) {
  const src = tone === "white" ? white : black;
  return (
    <Image
      src={src}
      alt={label}
      height={height}
      width={Math.round((height * src.width) / src.height)}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      sizes={`${Math.round((height * src.width) / src.height)}px`}
      className={`select-none ${className}`}
      style={{ height: "auto", width: "auto", maxHeight: height }}
    />
  );
}
