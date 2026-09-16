"use client";

// Makes the site content readable from CLIENT components — the footer, and
// anything else under /luyen-tap, which is a client page.
//
// The (public) layout is a server component and fetches once per request; this
// only carries the result down. `useSiteContent()` falls back to the built-in
// copy when no provider is above it, so a component can be used outside the
// public layout without crashing.
import { createContext, useContext } from "react";
import { DEFAULT_SITE_CONTENT, type SiteContent } from "@/lib/siteContent";

const Ctx = createContext<SiteContent>(DEFAULT_SITE_CONTENT);

export function SiteContentProvider({ content, children }: { content: SiteContent; children: React.ReactNode }) {
  return <Ctx.Provider value={content}>{children}</Ctx.Provider>;
}

export function useSiteContent(): SiteContent {
  return useContext(Ctx);
}
