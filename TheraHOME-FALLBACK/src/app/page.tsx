import Link from "next/link";
import { laySanPham, layGiaiDoan, layCacNgay } from "@/lib/noi-dung";
import { GoiYCaiDat } from "./goi-y-cai-dat";

export const dynamic = "force-dynamic";

/** Tiêu đề YouTube mở đầu bằng "Ngày N:" rồi, bỏ cho khỏi lặp với nhãn. */
function tenNgan(title: string | null) {
  if (!title) return null;
  return title.replace(/^\s*Ngày\s*\d+\s*:?\s*/i, "").trim() || title;
}

/** "Giai đoạn 1 · Giảm khó chịu & làm quen" tách đôi: chip gọi tên giai đoạn,
 * dòng bên cạnh nói giai đoạn đó để làm gì — cách TodayCard.tsx chia. */
function tachGiaiDoan(name: string) {
  const [nhan, ...conLai] = name.split("·").map((p) => p.trim());
  return { nhan, chuDe: conLai.join(" · ") };
}

export default async function TrangChu() {
  const sanPham = await laySanPham();
  if (!sanPham) {
    return (
      <div className="px-5 py-20 text-center text-muted">Chưa có nội dung lộ trình.</div>
    );
  }

  const [giaiDoan, cacNgay] = await Promise.all([
    layGiaiDoan(sanPham.id),
    layCacNgay(sanPham.id),
  ]);

  // Tên sản phẩm trong CSDL là "Thiết bị hỗ trợ cổ · TheraNECK+"; app chỉ in
  // phần thương hiệu, viết hoa, giãn chữ.
  const tenNganSP = sanPham.name.split("·").pop()?.trim() ?? sanPham.name;

  return (
    <div>
      {/* Đầu trang dựng theo màn Home: ảnh nền phủ trời 5 chặng, con số lớn
          mảnh, nút viên thuốc. */}
      <header className="troi-home relative isolate flex min-h-[92svh] flex-col overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh trong
            public, không cần image optimization (vốn không chạy sẵn trên Workers) */}
        <img
          src="/hero.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        {/* Scrim chỉ ăn ở đáy, để phần trời xanh phía trên còn nguyên — trong
            app ảnh mờ dần vào nền chứ không bị phủ tối từ đầu. */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent from-55% to-[#060D14]"
          aria-hidden="true"
        />

        <div className="an-toan-tren mx-auto w-full max-w-xl px-5 pt-4">
          <p className="text-center text-[17px] font-semibold uppercase tracking-[0.18em] text-text">
            {tenNganSP}
          </p>
        </div>

        {/* Đẩy khối số xuống dưới figure trong ảnh, như app. */}
        <div className="flex-1" aria-hidden="true" />

        <div className="mx-auto w-full max-w-xl px-5 pb-10">
          <div className="text-center">
            <div className="flex items-end justify-center gap-3">
              <span className="pb-3 text-[15px] font-medium uppercase tracking-[0.2em] text-muted">
                Ngày
              </span>
              <span className="text-[86px] font-extralight leading-none tracking-tight text-text">
                {sanPham.total_days}
              </span>
            </div>
            <p className="mx-auto mt-4 max-w-[19rem] text-[15px] leading-relaxed text-soft">
              TheraHOME đồng hành cùng bạn để chủ động chăm sóc bản thân mỗi ngày ngay tại nhà!
            </p>
            <Link
              href="/ngay/1"
              className="noi mt-6 inline-flex items-center gap-2 rounded-full bg-action px-7 py-3.5 text-[16px] font-semibold text-text active:opacity-80"
            >
              <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4.5 3.2 12 8l-7.5 4.8z" fill="currentColor" />
              </svg>
              Bắt đầu
            </Link>
          </div>
        </div>
      </header>

      {/* Phần dưới là màn Lộ trình: trời riêng của nó, tối hơn. */}
      <div className="troi-lotrinh min-h-dvh">
        <div className="mx-auto max-w-xl px-5 pt-7">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[28px] font-bold tracking-tight">Lộ trình</h1>
            <span className="kinh flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-semibold">
              <span className="size-2 rounded-full bg-tick" aria-hidden="true" />
              {tenNganSP}
            </span>
          </div>

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
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-faint">
                      {nhan}
                    </span>
                    <span className="text-[14px] text-muted">{chuDe}</span>
                  </div>

                  <ul className="mt-3 space-y-2.5">
                    {ngayCuaGd.map((n) => (
                      <li key={n.day_number}>
                        <Link
                          href={`/ngay/${n.day_number}`}
                          className="kinh flex items-center gap-4 p-3.5 active:opacity-70"
                        >
                          <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-inset">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-faint">
                              Ngày
                            </span>
                            <span className="text-[18px] font-semibold leading-none text-text">
                              {n.day_number}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">
                            {tenNgan(n.title) ?? "Bài tập"}
                          </span>
                          <svg
                            className="size-5 shrink-0 text-faint"
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
        </div>
      </div>
    </div>
  );
}
