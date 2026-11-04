"use client";

import { useEffect } from "react";

/** Đăng ký service worker. Tách ra client component vì layout là server
 * component và việc này chỉ chạy được trên trình duyệt. */
export function DangKySW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Đợi load xong rồi mới đăng ký, để việc cài không giành băng thông với
    // lần hiển thị đầu tiên.
    const dangKy = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") dangKy();
    else window.addEventListener("load", dangKy, { once: true });
  }, []);
  return null;
}
