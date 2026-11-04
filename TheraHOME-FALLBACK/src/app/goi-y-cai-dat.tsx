"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type SuKienCaiDat = Event & { prompt: () => Promise<void> };

const KHOA = "an-goi-y-cai-dat";
const khongDangKy = () => () => {};

/** Trả false khi render trên máy chủ, true sau khi hydrate xong. Cần vì mọi
 * thứ dưới đây đều phải đọc navigator/matchMedia, mà đọc lúc render máy chủ
 * thì lệch hydrate. */
function useLaTrinhDuyet() {
  return useSyncExternalStore(
    khongDangKy,
    () => true,
    () => false,
  );
}

/**
 * Mời cài lên màn hình chính.
 *
 * Hai đường khác hẳn nhau: Android/Chrome cho gọi prompt() thật qua sự kiện
 * `beforeinstallprompt`, iOS Safari không có API nào — chỉ còn cách chỉ
 * người dùng bấm nút Chia sẻ. (04/11/2026)
 */
export function GoiYCaiDat() {
  const laTrinhDuyet = useLaTrinhDuyet();
  // Cả hai state dưới đây chỉ được đặt từ trong callback (sự kiện của trình
  // duyệt, cú bấm của người dùng), không bao giờ đặt thẳng trong thân effect.
  const [suKien, setSuKien] = useState<SuKienCaiDat | null>(null);
  const [vuaDong, setVuaDong] = useState(false);

  useEffect(() => {
    const bat = (e: Event) => {
      e.preventDefault();
      setSuKien(e as SuKienCaiDat);
    };
    window.addEventListener("beforeinstallprompt", bat);
    return () => window.removeEventListener("beforeinstallprompt", bat);
  }, []);

  if (!laTrinhDuyet) return null;

  // Đã chạy trong chế độ đã cài thì không mời nữa. Safari iOS dùng cờ riêng
  // `navigator.standalone` chứ không theo display-mode.
  const daCai =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  // Người đã tự tay đóng thì đừng hỏi lại mỗi lần mở. Chế độ riêng tư chặn
  // localStorage — cứ hiện, thà hơi phiền còn hơn vỡ.
  let daTungDong = false;
  try {
    daTungDong = localStorage.getItem(KHOA) === "1";
  } catch {
    daTungDong = false;
  }

  const ua = window.navigator.userAgent;
  const laIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);

  if (daCai || daTungDong || vuaDong) return null;
  // Android mà trình duyệt chưa bắn beforeinstallprompt thì chưa có gì để mời.
  if (!laIOS && !suKien) return null;

  function dong() {
    setVuaDong(true);
    try {
      localStorage.setItem(KHOA, "1");
    } catch {
      // Không lưu được thì lần sau hiện lại, chấp nhận được.
    }
  }

  return (
    <div className="the mt-4 flex items-start gap-3 p-4">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-tint10 text-primary">
        <svg className="size-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 3v9m0 0 3.2-3.2M10 12 6.8 8.8M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">Cài lên màn hình chính</p>
        {laIOS ? (
          <p className="mt-1 text-[14px] leading-relaxed text-text-secondary">
            Bấm nút Chia sẻ ở thanh dưới, chọn <strong>Thêm vào MH chính</strong>. Mở ra là
            toàn màn hình như ứng dụng, xem lại được cả khi mất mạng.
          </p>
        ) : (
          <p className="mt-1 text-[14px] leading-relaxed text-text-secondary">
            Mở toàn màn hình như ứng dụng, xem lại được cả khi mất mạng.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {!laIOS && suKien && (
            <button
              type="button"
              onClick={() => {
                void suKien.prompt();
                setVuaDong(true);
              }}
              className="rounded-chip bg-primary px-4 py-2 text-[14px] font-semibold text-white active:opacity-80"
            >
              Cài đặt
            </button>
          )}
          <button
            type="button"
            onClick={dong}
            className="rounded-chip px-3 py-2 text-[14px] font-medium text-text-secondary active:opacity-70"
          >
            Để sau
          </button>
        </div>
      </div>
    </div>
  );
}
