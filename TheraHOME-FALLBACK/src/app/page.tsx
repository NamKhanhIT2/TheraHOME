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
      <div className="khung py-20 text-center text-base text-muted">Chưa có nội dung lộ trình.</div>
    );
  }

  const [giaiDoan, cacNgay] = await Promise.all([
    layGiaiDoan(sanPham.id),
    layCacNgay(sanPham.id),
  ]);

  // Tên sản phẩm trong CSDL là "Thiết bị hỗ trợ cổ · TheraNECK+"; app chỉ in
  // phần thương hiệu, viết hoa, giãn chữ.
  const tenNganSP = sanPham.name.split("·").pop()?.trim() ?? sanPham.name;

  // `products.total_days` trong Supabase đang là 14, nhưng ba giai đoạn phủ
  // tới ngày 28 và có đủ 28 buổi tập. Lấy theo số ngày thật, nếu không đầu
  // trang in "NGÀY 14" còn ngay bên dưới lại ghi "28 buổi tập". (04/11/2026)
  const soNgay = cacNgay.length || sanPham.total_days;

  return (
    <div>
      {/* Đầu trang dựng theo màn Home: ảnh nền phủ trời 5 chặng, con số lớn
          mảnh, nút viên thuốc. Cao đúng một màn hình nên máy nào cũng thấy
          trọn bố cục, rồi mũi tên dưới cùng mời cuộn tiếp. */}
      <header className="troi-home phu-anh relative isolate flex min-h-[100svh] flex-col overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh trong
            public, không cần image optimization (vốn không chạy sẵn trên Workers) */}
        <img
          src="/hero.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <div className="an-toan-tren khung pt-5">
          <p className="chu-tren-anh gian-2 text-center text-md font-semibold uppercase text-text">
            {tenNganSP}
          </p>
        </div>

        {/* Đẩy khối số xuống dưới figure trong ảnh, như app. */}
        <div className="flex-1" aria-hidden="true" />

        <div className="chu-tren-anh khung flex flex-col items-center text-center">
          <p className="gian-4 text-2xs font-semibold uppercase text-soft">Ngày</p>
          <p className="text-so mt-[clamp(0.1rem,0.7vw,0.3rem)] font-extralight tracking-[-0.03em] text-text">
            {soNgay}
          </p>
          <p className="mt-[clamp(0.8rem,2.6svh,1.25rem)] max-w-[20rem] text-base text-soft">
            TheraHOME đồng hành cùng bạn để chủ động chăm sóc bản thân mỗi ngày ngay tại nhà!
          </p>
          <Link href="/ngay/1" className="nut-chinh mt-[clamp(1.25rem,3.6svh,1.75rem)] text-md">
            <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4.5 3.2 12 8l-7.5 4.8z" fill="currentColor" />
            </svg>
            Bắt đầu
          </Link>
        </div>

        <a
          href="#lotrinh"
          className="an-toan-duoi mt-[clamp(1.5rem,4.5svh,2.5rem)] flex flex-col items-center gap-2 pb-[clamp(0.9rem,2.2svh,1.4rem)] text-faint active:opacity-60"
        >
          <span className="gian-3 text-2xs font-semibold uppercase">Lộ trình</span>
          <svg className="mui-xuong size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 6 8 10.5 12.5 6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </header>

      {/* Phần dưới là màn Lộ trình: trời riêng của nó, tối hơn. */}
      <section id="lotrinh" className="troi-noi-tiep">
        <div className="khung pt-[clamp(1.75rem,5svh,2.5rem)]">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Lộ trình</h1>
            <span className="kinh flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold">
              <span className="size-2 rounded-full bg-tick" aria-hidden="true" />
              {tenNganSP}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-faint">
            {giaiDoan.length} giai đoạn · {cacNgay.length} buổi tập
          </p>

          <GoiYCaiDat />

          <div className="mt-8 space-y-9">
            {giaiDoan.map((gd) => {
              const ngayCuaGd = cacNgay.filter(
                (n) => n.day_number >= gd.day_start && n.day_number <= gd.day_end,
              );
              if (!ngayCuaGd.length) return null;
              const { nhan, chuDe } = tachGiaiDoan(gd.name);
              return (
                <section key={gd.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
                        {nhan}
                      </span>
                      <span className="text-sm text-muted">{chuDe}</span>
                    </div>
                    <span className="shrink-0 text-2xs font-medium tabular-nums text-faint">
                      Ngày {gd.day_start}–{gd.day_end}
                    </span>
                  </div>

                  <ul className="mt-3.5 space-y-2.5">
                    {ngayCuaGd.map((n) => (
                      <li key={n.day_number}>
                        <Link
                          href={`/ngay/${n.day_number}`}
                          className="kinh flex items-center gap-4 p-4 transition-colors active:bg-white/[0.07]"
                        >
                          <span className="flex size-[clamp(2.875rem,13.5vw,3.5rem)] shrink-0 flex-col items-center justify-center rounded-2xl bg-inset">
                            <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-faint">
                              Ngày
                            </span>
                            <span className="mt-0.5 text-lg font-semibold leading-none tabular-nums text-text">
                              {n.day_number}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1 text-base font-semibold leading-snug text-text">
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

          <div className="an-toan-duoi h-[clamp(2.5rem,8svh,4rem)]" aria-hidden="true" />
        </div>
      </section>
    </div>
  );
}
