import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TheraHOME · Lộ trình trị liệu",
  description:
    "Bản dự phòng: toàn bộ bài tập theo ngày của lộ trình TheraNECK+, xem được cả khi ứng dụng gặp sự cố.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh">
        <header className="border-b border-vien bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Thera<span className="text-thuong">HOME</span>
            </Link>
            <span className="rounded-full bg-thuong-nhat px-3 py-1 text-xs font-medium text-thuong">
              Bản dự phòng
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-3xl px-4 pb-10 pt-4 text-sm text-muc-nhat">
          Cần hỗ trợ: <a className="underline" href="tel:+84364263552">0364 263 552</a> ·{" "}
          <a className="underline" href="mailto:support@therahomeai.com">support@therahomeai.com</a>
        </footer>
      </body>
    </html>
  );
}
