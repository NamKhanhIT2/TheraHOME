import { Be_Vietnam_Pro } from "next/font/google";

/** The brand face for the public, light pages (/app, /privacy, /terms,
 * /account-deletion). Same family the dark marketing site loads in
 * app/(public)/layout.tsx: designed for Vietnamese diacritics, and the round
 * geometric shape of the TheraHOME store artwork. Self-hosted by next/font. */
export const brandFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-brand",
});
