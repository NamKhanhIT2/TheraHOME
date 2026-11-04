import Link from "next/link";
import { notFound } from "next/navigation";
import { layMotNgay, layCacNgay, laySanPham, layGiaiDoan, maYouTube } from "@/lib/noi-dung";

export const dynamic = "force-dynamic";

export default async function TrangNgay({ params }: { params: Promise<{ so: string }> }) {
  const { so } = await params;
  const soNgay = Number(so);
  if (!Number.isInteger(soNgay) || soNgay < 1) notFound();

  const ngay = await layMotNgay(soNgay);
  if (!ngay) notFound();

  const sanPham = await laySanPham();
  const [tatCa, giaiDoan] = await Promise.all([
    sanPham ? layCacNgay(sanPham.id) : Promise.resolve([]),
    sanPham ? layGiaiDoan(sanPham.id) : Promise.resolve([]),
  ]);
  const truoc = tatCa.find((n) => n.day_number === soNgay - 1);
  const sau = tatCa.find((n) => n.day_number === soNgay + 1);
  const gd = giaiDoan.find((g) => g.id === ngay.phase_id);
  const ma = maYouTube(ngay.video_url);
  const ten = ngay.title?.replace(/^\s*Ngày\s*\d+\s*:?\s*/i, "").trim();

  return (
    <div className="troi-lotrinh min-h-dvh">
      <div className="khung">
        {/* BackBar kiểu app: mũi tên + nhãn, trên nền kính. */}
        <div className="an-toan-tren flex items-center gap-2.5 pt-3.5">
          <Link
            href="/#lotrinh"
            aria-label="Quay lại lộ trình"
            className="noi flex size-10 shrink-0 items-center justify-center rounded-full active:opacity-70"
          >
            <svg className="size-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M12.5 4.5 7 10l5.5 5.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <span className="text-md font-semibold tabular-nums">Ngày {ngay.day_number}</span>
        </div>

        <h1 className="mt-6 text-xl font-bold leading-tight tracking-tight text-balance">
          {ten || `Ngày ${ngay.day_number}`}
        </h1>

        {gd && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="noi rounded-full px-3 py-1.5 text-xs font-medium text-soft">
              {gd.name.split("·")[0].trim()}
            </span>
            <span className="noi flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-soft">
              <svg className="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 5.8v3l1.8 1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {/* App cũng in cứng 10 phút cho mọi ngày
                  (SESSION_MINUTES trong app/(tabs)/roadmap.tsx) — CSDL không
                  có cột thời lượng. Giữ đúng con số app đang hiện. */}
              10 phút
            </span>
          </div>
        )}

        {ma ? (
          <div className="noi mt-6 overflow-hidden rounded-[clamp(1.125rem,5vw,1.375rem)] shadow-[0_10px_34px_rgba(0,0,0,0.45)]">
            {/* Nhúng thẳng YouTube: video vốn đã ở YouTube chứ không phải
                Supabase Storage, nên phần nặng nhất của buổi tập không phụ
                thuộc vào thứ đang hỏng. */}
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${ma}`}
              title={ngay.title ?? `Bài tập ngày ${ngay.day_number}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="kinh mt-5 p-4 text-base text-muted">Ngày này chưa có video.</p>
        )}

        {ma && (
          <div className="noi mt-4 flex items-start gap-3 rounded-[clamp(0.9rem,4.2vw,1.125rem)] p-4">
            <svg className="mt-0.5 size-5 shrink-0 text-faint" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 2.6a5 5 0 0 0-2.8 9.1v1.6h5.6v-1.6A5 5 0 0 0 10 2.6ZM8 16.2h4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {/* Nguyên văn chuỗi `videoTip` trong src/lib/i18n.ts của app. */}
            <p className="text-sm text-muted">
              Mẹo nhỏ: Chọn chỗ yên tĩnh, đủ rộng để duỗi tay và xoay người thoải mái.
            </p>
          </div>
        )}

        {ngay.support_tools_url && (
          <a
            href={ngay.support_tools_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block rounded-full bg-focus px-5 py-4 text-center text-md font-semibold text-white active:opacity-80"
          >
            {ngay.support_tools_label ?? "Nội dung thêm"}
          </a>
        )}

        <nav className="mt-7 grid grid-cols-2 gap-3">
          {truoc ? (
            <Link
              href={`/ngay/${truoc.day_number}`}
              className="kinh p-4 transition-colors active:bg-white/[0.07]"
            >
              <span className="block text-2xs font-medium text-faint">Trước</span>
              <span className="mt-0.5 block truncate text-sm font-semibold tabular-nums">
                Ngày {truoc.day_number}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {sau && (
            <Link
              href={`/ngay/${sau.day_number}`}
              className="kinh p-4 text-right transition-colors active:bg-white/[0.07]"
            >
              <span className="block text-2xs font-medium text-faint">Tiếp theo</span>
              <span className="mt-0.5 block truncate text-sm font-semibold tabular-nums">
                Ngày {sau.day_number}
              </span>
            </Link>
          )}
        </nav>

        {/* Dải chọn nhanh các ngày cùng giai đoạn. Thay cho nút "Xem tất cả"
            (mũi tên quay lại ở đầu trang đã làm đúng việc đó), và lấp chỗ
            trống dưới đáy sau khi bỏ thẻ hỗ trợ. */}
        {gd && (
          <div className="kinh mt-4 p-4">
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-faint">
              {gd.name.split("·")[0].trim()} · Ngày {gd.day_start}–{gd.day_end}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tatCa
                .filter((n) => n.day_number >= gd.day_start && n.day_number <= gd.day_end)
                .map((n) => {
                  const dangXem = n.day_number === ngay.day_number;
                  return (
                    <Link
                      key={n.day_number}
                      href={`/ngay/${n.day_number}`}
                      aria-current={dangXem ? "page" : undefined}
                      className={
                        dangXem
                          ? "flex size-9 items-center justify-center rounded-xl bg-tick text-sm font-semibold tabular-nums text-white"
                          : "flex size-9 items-center justify-center rounded-xl bg-inset text-sm font-semibold tabular-nums text-soft active:opacity-70"
                      }
                    >
                      {n.day_number}
                    </Link>
                  );
                })}
            </div>
          </div>
        )}

        <div className="an-toan-duoi h-[clamp(2.5rem,8svh,4rem)]" aria-hidden="true" />
      </div>
    </div>
  );
}
