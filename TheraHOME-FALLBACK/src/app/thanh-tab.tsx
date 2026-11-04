"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Thanh tab nổi ở đáy, dựng theo thanh của app (homeGlassColors.surfaceNav,
 * navIcon, navIconActive, tab đang chọn là một hốc lõm sẫm hơn mặt thanh).
 *
 * App có 5 tab; ở đây chỉ có hai chỗ thật sự đi được nên chỉ bày hai. Thà
 * ít mà bấm được còn hơn bày đủ 5 rồi ba cái không làm gì. (04/11/2026)
 */
export function ThanhTab() {
  const duongDan = usePathname();
  const oLoTrinh = duongDan === "/" || duongDan.startsWith("/ngay");

  return (
    <nav className="an-toan-duoi pointer-events-none fixed inset-x-0 bottom-0 z-20">
      <div className="mx-auto mb-3 flex w-fit items-center gap-1 rounded-full border border-white/[0.14] bg-nav p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.55)] pointer-events-auto">
        <Link
          href="/"
          aria-label="Lộ trình"
          aria-current={oLoTrinh ? "page" : undefined}
          className={`flex h-12 w-16 items-center justify-center rounded-full transition-colors ${
            oLoTrinh ? "bg-[#091118] text-nav-active" : "text-nav-icon"
          }`}
        >
          <svg className="size-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5V14h-7v6.5H5A1.5 1.5 0 0 1 3.5 19z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <a
          href="tel:+84364263552"
          aria-label="Gọi hỗ trợ"
          className="flex h-12 w-16 items-center justify-center rounded-full text-nav-icon transition-colors active:text-nav-active"
        >
          <svg className="size-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6.2 3.8h3l1.5 3.8-2 1.4a12 12 0 0 0 5.3 5.3l1.4-2 3.8 1.5v3a1.7 1.7 0 0 1-1.9 1.7A16.2 16.2 0 0 1 4.5 5.7 1.7 1.7 0 0 1 6.2 3.8Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </nav>
  );
}
