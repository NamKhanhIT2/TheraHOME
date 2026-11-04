import Link from "next/link";
import { notFound } from "next/navigation";
import { layMotNgay, layCacNgay, laySanPham, maYouTube } from "@/lib/noi-dung";

export const dynamic = "force-dynamic";

export default async function TrangNgay({ params }: { params: Promise<{ so: string }> }) {
  const { so } = await params;
  const soNgay = Number(so);
  if (!Number.isInteger(soNgay) || soNgay < 1) notFound();

  const ngay = await layMotNgay(soNgay);
  if (!ngay) notFound();

  const sanPham = await laySanPham();
  const tatCa = sanPham ? await layCacNgay(sanPham.id) : [];
  const truoc = tatCa.find((n) => n.day_number === soNgay - 1);
  const sau = tatCa.find((n) => n.day_number === soNgay + 1);
  const ma = maYouTube(ngay.video_url);

  return (
    <div>
      <Link href="/" className="text-sm text-thuong underline">
        ← Tất cả các ngày
      </Link>
      <p className="mt-3 text-sm font-semibold text-thuong">Ngày {ngay.day_number}</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {ngay.title?.replace(/^\s*Ngày\s*\d+\s*:?\s*/i, "").trim() || `Ngày ${ngay.day_number}`}
      </h1>

      {ma ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-vien bg-black">
          {/* Nhúng thẳng YouTube: video vốn đã nằm trên YouTube chứ không phải
              Supabase, nên phần nặng nhất của bài tập không phụ thuộc vào thứ
              đang hỏng. */}
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube-nocookie.com/embed/${ma}`}
            title={`Bài tập ngày ${ngay.day_number}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-vien bg-white p-4 text-muc-nhat">
          Ngày này chưa có link video trong bản sao.
        </p>
      )}

      {ngay.support_tools_url && (
        <a
          href={ngay.support_tools_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-lg bg-thuong px-4 py-2 font-medium text-white"
        >
          {ngay.support_tools_label ?? "Nội dung thêm"}
        </a>
      )}

      <nav className="mt-8 flex justify-between gap-3">
        {truoc ? (
          <Link href={`/ngay/${truoc.day_number}`} className="rounded-lg border border-vien bg-white px-4 py-2">
            ← Ngày {truoc.day_number}
          </Link>
        ) : (
          <span />
        )}
        {sau && (
          <Link href={`/ngay/${sau.day_number}`} className="rounded-lg border border-vien bg-white px-4 py-2">
            Ngày {sau.day_number} →
          </Link>
        )}
      </nav>
    </div>
  );
}
