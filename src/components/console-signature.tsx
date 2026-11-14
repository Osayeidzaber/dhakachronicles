"use client";

import { useEffect } from "react";
import { OZ } from "@/lib/oz";

const ART = String.raw`
 ██████╗ ███████╗
██╔═══██╗╚══███╔╝
██║   ██║  ███╔╝
██║   ██║ ███╔╝
╚██████╔╝███████╗
 ╚═════╝ ╚══════╝  STUDIOS
`;

/** Prints the developer's signature in the browser console once per page load. Renders nothing. */
export function ConsoleSignature() {
  useEffect(() => {
    const w = window as Window & { __ozSigned?: boolean };
    if (w.__ozSigned) return;
    w.__ozSigned = true;
    console.log(`%c${ART}`, "color:#c8a27a;font-family:monospace;font-size:11px;line-height:1.1");
    console.log(`%cDesigned & built by ${OZ.name}, ${OZ.year}.`, "font-weight:bold;font-size:12px");
    console.log(`${OZ.url}\n${OZ.instagram}`);
  }, []);
  return null;
}
