"use client";

import SplitText from "@/components/ui/vendor/reactbits/SplitText";

/** 404 headline: words rise out of a mask, one after another. */
export function NotFoundTitle() {
  return (
    <SplitText
      text="This page isn’t here."
      tag="h1"
      splitType="words"
      mask
      effect="rise"
      trigger="load"
      delay={70}
      textAlign="left"
      className="font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05]"
    />
  );
}
