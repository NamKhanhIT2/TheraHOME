import Link from "next/link";
import { laySanPham, layGiaiDoan, layCacNgay, layLanDongBo } from "@/lib/noi-dung";
import { GoiYCaiDat } from "./goi-y-cai-dat";

export const dynamic = "force-dynamic";

/** Tiêu đề YouTube đã mở đầu bằng "Ngày N:" rồi, bỏ cho khỏi lặp với nhãn. */
function tenNgan(title: string | null) {
  if (!title) return null;
  return title.replace(/^\s*Ngày\s*\d+\s*:?\s*/i, "").trim() || title;
}

/** "Giai đoạn 1 · Giảm khó chịu & làm quen" tách đôi: chip gọi tên giai đoạn,
 * dòng tiêu đề nói giai đoạn đó để làm gì. Cách app chia (TodayCard.tsx). */
function tachGiaiDoan(name: string) {
  const [nhan, ...phanConLai] = name.split("·").map((p) => p.trim());
  return { nhan, chuDe: phanConLai.join(" · ") };
}

function ngayDoc(iso: string | null) {
  if (!iso) return "chưa rõ";
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export default async function TrangChu() {
  const sanPham = await laySanPham();

  if (!sanPham) {
    return (
      <div className="the mt-4 p-5">
        <h1 className="text-[20px] font-bold">Chưa có dữ liệu</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
          Bản dự phòng chưa được đồng bộ lần nào. Chạy <code>npm run dong-bo</code>.
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
      <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight">
        {sanPham.name}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
        Toàn bộ bài tập theo ngày. Trang này giữ bản sao riêng nên vẫn mở được khi ứng dụng
        gặp sự cố.
      </p>

      <GoiYCaiDat />

      <div className="mt-6 space-y-7">
        {giaiDoan.map((gd) => {
          const ngayCuaGd = cacNgay.filter(
            (n) => n.day_number >= gd.day_start && n.day_number <= gd.day_end,
          );
          if (!ngayCuaGd.length) return null;
          const { nhan, chuDe } = tachGiaiDoan(gd.name);
          return (
            <section key={gd.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-chip bg-accent-orange-tint px-3 py-1.5 text-[12px] font-semibold text-text-primary">
                  {nhan}
                </span>
                <span className="text-[13px] font-medium text-text-secondary">{chuDe}</span>
              </div>

              <ul className="mt-3 space-y-3">
                {ngayCuaGd.map((n) => (
                  <li key={n.day_number}>
                    <Link
                      href={`/ngay/${n.day_number}`}
                      className="the flex items-center gap-4 p-4 active:opacity-70"
                    >
                      <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-tint10">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Ngày
                        </span>
                        <span className="text-[17px] font-bold leading-none text-primary">
                          {n.day_number}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-semibold leading-snug">
                          {tenNgan(n.title) ?? (n.video_url ? "Bài tập" : "Chưa có video")}
                        </span>
                      </span>
                      <svg
                        className="size-5 shrink-0 text-text-muted"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M7.5 4.5 13 10l-5.5 5.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-7 text-[13px] text-text-muted">
        Nội dung chép về lúc {ngayDoc(lanDongBo)} · {cacNgay.length} ngày tập
      </p>
    </div>
  );
}
