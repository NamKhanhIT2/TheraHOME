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
    <div>
      <Link
        href="/"
        className="-ml-1 mt-1 inline-flex items-center gap-1 py-2 text-[15px] font-medium text-primary active:opacity-70"
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
        Lộ trình
      </Link>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="rounded-chip bg-primary px-3 py-1.5 text-[12px] font-semibold text-white">
          Ngày {ngay.day_number}
        </span>
        {gd && (
          <span className="rounded-chip bg-accent-orange-tint px-3 py-1.5 text-[12px] font-semibold text-text-primary">
            {gd.name.split("·")[0].trim()}
          </span>
        )}
      </div>

      <h1 className="mt-3 text-[24px] font-bold leading-tight tracking-tight">
        {ten || `Ngày ${ngay.day_number}`}
      </h1>

      {ma ? (
        <>
          <div className="the mt-4 overflow-hidden bg-black p-0">
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
          {/* Service worker lưu được chữ, không lưu được video (cross-origin,
              opaque, rất nặng). Nói thẳng thay vì để người dùng tự đoán. */}
          <p className="mt-2 text-[13px] text-text-muted">Video cần mạng để phát.</p>
        </>
      ) : (
        <p className="the mt-4 p-4 text-[15px] leading-relaxed text-text-secondary">
          Ngày này chưa có link video trong bản sao.
        </p>
      )}

      {ngay.support_tools_url && (
        <a
          href={ngay.support_tools_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block rounded-chip bg-primary px-5 py-3.5 text-center text-[16px] font-semibold text-white active:opacity-80"
        >
          {ngay.support_tools_label ?? "Nội dung thêm"}
        </a>
      )}

      <nav className="mt-7 grid grid-cols-2 gap-3">
        {truoc ? (
          <Link href={`/ngay/${truoc.day_number}`} className="the p-4 active:opacity-70">
            <span className="block text-[12px] font-medium text-text-muted">Trước</span>
            <span className="mt-0.5 block truncate text-[15px] font-semibold">
              Ngày {truoc.day_number}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {sau && (
          <Link href={`/ngay/${sau.day_number}`} className="the p-4 text-right active:opacity-70">
            <span className="block text-[12px] font-medium text-text-muted">Tiếp theo</span>
            <span className="mt-0.5 block truncate text-[15px] font-semibold">
              Ngày {sau.day_number}
            </span>
          </Link>
        )}
      </nav>
    </div>
  );
}
