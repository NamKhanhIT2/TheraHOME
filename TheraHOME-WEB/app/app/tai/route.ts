// /app/tai — the one link the download QR code points at.
//
// The QR code is printed and shared, so it must never need regenerating: it
// encodes this fixed URL, and this route decides where to send each scan at
// the moment it happens. iPhone/iPad → App Store, Android → Google Play, and
// anything else (or a store whose link is still empty in Admin → Nội dung
// website) → the /app landing page. Filling in the Play link in Admin
// therefore upgrades every QR code already out there.
import { NextResponse, type NextRequest } from "next/server";
import { getSiteContent } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  const { app_links } = await getSiteContent();

  // iPadOS reports itself as a Mac; the touch hint in the UA is not reliable,
  // so a Mac simply lands on the page, which offers both buttons.
  const isApple = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  const target =
    (isApple && app_links.appStore) ||
    (isAndroid && app_links.playStore) ||
    new URL("/app", request.url).toString();

  return NextResponse.redirect(target, 302);
}
