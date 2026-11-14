import { notFound } from "next/navigation";

/** Any unknown /en/… or /bn/… address renders the designed 404 inside the site layout. */
export default function CatchAll() {
  notFound();
}
