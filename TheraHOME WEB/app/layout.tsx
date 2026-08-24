import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TheraHOME",
  description: "Bảng điều khiển nội bộ TheraHOME cho Admin và Chăm sóc khách hàng",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
