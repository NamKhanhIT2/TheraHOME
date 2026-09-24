// /app/tai/ios and /app/tai/android — one fixed link per store.
//
// Same reasoning as the universal /app/tai next door, applied per store: the
// QR codes on /app are printed and shared, so they encode these fixed URLs
// rather than the store URLs themselves. The destination is whatever is in
// Admin → Nội dung website at the moment of the scan, so changing a store
// link there updates every code already out there.
//
// A scan that reaches the wrong route still lands somewhere useful: a store
// link that is empty (or a path we do not recognise) falls through to /app,
// which offers both buttons.
import { NextResponse, type NextRequest } from "next/server";
import { getSiteContent } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
  const { store } = await params;
  const { app_links } = await getSiteContent();

  const target =
    (store === "ios" && app_links.appStore) ||
    (store === "android" && app_links.playStore) ||
    new URL("/app", request.url).toString();

  return NextResponse.redirect(target, 302);
}
