import Link from "next/link";
import { laySanPham, layGiaiDoan, layCacNgay, layLanDongBo } from "@/lib/noi-dung";

export const dynamic = "force-dynamic";

/** Tiêu đề YouTube đã mở đầu bằng "Ngày N:" rồi, bỏ đi cho khỏi lặp với nhãn. */
function tenNgan(title: string | null) {
  if (!title) return null;
  return title.replace(/^\s*Ngày\s*\d+\s*:?\s*/i, "").trim() || title;
}

function ngayDoc(iso: string | null) {
  if (!iso) return "chưa rõ";
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export default async function TrangChu() {
  const sanPham = await laySanPham();

  if (!sanPham) {
    return (
      <div className="rounded-xl border border-vien bg-white p-6">
        <h1 className="text-xl font-semibold">Chưa có dữ liệu</h1>
        <p className="mt-2 text-muc-nhat">
          Bản dự phòng chưa được đồng bộ lần nào. Chạy <code>npm run dong-bo</code> để chép nội
          dung lộ trình từ Supabase sang.
        </p>
      </div>
    );
  }

  const [giaiDoan, cacNgay, lanDongBo] = await Promise.all([
    layGiaiDoan(sanPham.id),
    layCacNgay(sanPham.id),
    layLanDongBo(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{sanPham.name}</h1>
      <p className="mt-2 text-muc-nhat">
        Toàn bộ bài tập theo ngày. Trang này đọc từ bản sao riêng nên vẫn mở được khi ứng dụng
        gặp sự cố.
      </p>

      <div className="mt-6 space-y-6">
        {giaiDoan.map((gd) => {
          const ngayCuaGd = cacNgay.filter(
            (n) => n.day_number >= gd.day_start && n.day_number <= gd.day_end,
          );
          if (!ngayCuaGd.length) return null;
          return (
            <section key={gd.id}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muc-nhat">
                {gd.name}
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {ngayCuaGd.map((n) => (
                  <li key={n.day_number}>
                    <Link
                      href={`/ngay/${n.day_number}`}
                      className="flex h-full flex-col justify-between rounded-xl border border-vien bg-white p-4 transition-colors hover:border-thuong"
                    >
                      <span className="text-sm font-semibold text-thuong">
                        Ngày {n.day_number}
                      </span>
                      <span className="mt-1 text-base font-medium leading-snug">
                        {tenNgan(n.title) ?? (n.video_url ? "Bài tập" : "Chưa có video")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-sm text-muc-nhat">
        Nội dung được chép về lúc {ngayDoc(lanDongBo)} · {cacNgay.length} ngày tập
      </p>
    </div>
  );
}
