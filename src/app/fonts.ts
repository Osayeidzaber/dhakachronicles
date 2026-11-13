import { Hind_Siliguri, Inter, Instrument_Serif } from "next/font/google";

/** Self-hosted by next/font at build time: no runtime request to Google. */
export const inter = Inter({ subsets: ["latin"], variable: "--nf-inter", display: "swap" });
export const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--nf-serif", display: "swap" });
export const bangla = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600"], variable: "--nf-bangla", display: "swap" });

export const fontVars = `${inter.variable} ${serif.variable} ${bangla.variable}`;
