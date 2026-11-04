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
      <div className="mx-auto max-w-xl px-5">
        {/* BackBar kiểu app: mũi tên + nhãn, trên nền kính. */}
        <div className="an-toan-tren flex items-center gap-2 pt-3">
          <Link
            href="/"
            aria-label="Quay lại lộ trình"
            className="noi flex size-10 items-center justify-center rounded-full active:opacity-70"
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
          <span className="text-[17px] font-semibold">Ngày {ngay.day_number}</span>
        </div>

        <h1 className="mt-5 text-[26px] font-bold leading-tight tracking-tight">
          {ten || `Ngày ${ngay.day_number}`}
        </h1>

        {gd && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="noi rounded-full px-3 py-1.5 text-[13px] font-medium text-soft">
              {gd.name.split("·")[0].trim()}
            </span>
            <span className="noi flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-soft">
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
          <div className="noi mt-5 overflow-hidden rounded-[22px]">
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
          <p className="kinh mt-5 p-4 text-[15px] leading-relaxed text-muted">
            Ngày này chưa có video.
          </p>
        )}

        {ngay.support_tools_url && (
          <a
            href={ngay.support_tools_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block rounded-full bg-focus px-5 py-4 text-center text-[16px] font-semibold text-white active:opacity-80"
          >
            {ngay.support_tools_label ?? "Nội dung thêm"}
          </a>
        )}

        <nav className="mt-7 grid grid-cols-2 gap-3">
          {truoc ? (
            <Link href={`/ngay/${truoc.day_number}`} className="kinh p-4 active:opacity-70">
              <span className="block text-[12px] font-medium text-faint">Trước</span>
              <span className="mt-0.5 block truncate text-[15px] font-semibold">
                Ngày {truoc.day_number}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {sau && (
            <Link href={`/ngay/${sau.day_number}`} className="kinh p-4 text-right active:opacity-70">
              <span className="block text-[12px] font-medium text-faint">Tiếp theo</span>
              <span className="mt-0.5 block truncate text-[15px] font-semibold">
                Ngày {sau.day_number}
              </span>
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
