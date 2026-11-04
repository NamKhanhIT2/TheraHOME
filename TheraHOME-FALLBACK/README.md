# TheraHOME — bản dự phòng (web)

Trang web chỉ-đọc chứa toàn bộ nội dung lộ trình trị liệu, chạy trên Cloudflare
Workers + D1. Mục đích: **khi Supabase bị khoá vì vượt egress, khách vẫn mở
được bài tập.**

- Trang: https://therahome-duphong.therahome-crm.workers.dev
- D1: `therahome-duphong` (vùng APAC)
- Cron đồng bộ: worker `therahome-duphong-cron`, 02:00 giờ VN mỗi ngày

## Cài như ứng dụng (PWA)

Hầu như không ai mở trang này trên máy tính, nên nó được làm cho điện thoại
trước và trông phải giống app.

Màu lấy từ **`homeGlassColors`** trong `TheraHOME-APP/src/theme/colors.ts`,
KHÔNG phải `lightColors`/`darkColors`. App đọc trên nền ảnh tối phủ scrim gần
đen nên nó có bảng riêng không lật theo cài đặt sáng/tối của máy — chỉ có đúng
một mặt. Nền Lộ trình `#080D12`, thẻ kính `rgba(20,40,56,0.38)` + đường tóc
`rgba(255,255,255,0.12)`, đỏ CTA `#E5484D`, xanh hoàn thành `#2F8FFF`, thanh
tab nổi `#111920`. Ảnh hero là `assets/home-hero.webp` của app.

Những gì app có mà bản này không làm, vì đều cần đăng nhập: vòng tròn Mức đau
/ Giai đoạn / Luyện tập / Uống nước, lịch tiến độ, tab Cửa hàng và Cộng đồng.
Không có thanh tab: app có 5 tab, ở đây chỉ còn đúng một đích đến nên một
thanh tab là thừa và trông giả. Số hỗ trợ nằm ở chân trang.

- `public/manifest.webmanifest` — `display: standalone`, khoá dọc, icon lấy từ
  `TheraHOME-APP/assets/icon.png`
- `src/app/goi-y-cai-dat.tsx` — mời cài. Android/Chrome dùng
  `beforeinstallprompt` gọi hộp thoại thật; iOS Safari không có API nào nên chỉ
  hướng dẫn bấm Chia sẻ → Thêm vào MH chính. Đóng một lần thì nhớ, không hỏi lại.
- `public/sw.js` — service worker, mạng trước / cache sau. Đổi `PHIEN_BAN`
  mỗi lần giao diện thay đổi hẳn, nếu không máy từng mở bản cũ sẽ kẹt bản cũ
  khi offline. Trang đã mở một lần
  thì lần sau **mất mạng vẫn xem được chữ**. Next prefetch các link trong tầm
  nhìn nên lướt qua danh sách là đã lưu sẵn kha khá ngày.
- Font nạp bằng `next/font`, tự host lúc build — không gọi fonts.googleapis.com
  lúc chạy, nên offline vẫn đúng chữ.

**Video thì không cache được** (cross-origin, opaque, rất nặng). Mất mạng thì
chữ còn, video không — trang nói thẳng điều đó dưới khung video thay vì để
người dùng tự đoán.

## Vì sao nó độc lập được với Supabase

Ba thứ đã tách hẳn:

1. **Dữ liệu** nằm trong D1, chép sẵn từ Supabase. Trang không gọi Supabase lúc
   người dùng mở.
2. **Video** vốn đã ở YouTube (`program_days.video_url_vn`), không phải Supabase
   Storage. Phần nặng nhất của bài tập không liên quan gì tới Supabase.
3. **Không có đăng nhập.** Supabase Auth cũng nằm trong thứ có thể chết, nên
   trang này cố ý không cần tài khoản.

Hệ quả của điều 3: trang **không chứa dữ liệu cá nhân nào** — không hồ sơ,
không tiến độ, không số điện thoại. Chỉ nội dung lộ trình, vốn đã công khai
qua YouTube. Xem `db/schema.sql`.

Nghĩa là bản dự phòng cho khách xem được **bài tập của mọi ngày**, nhưng không
biết họ đang ở ngày thứ mấy. Đổi lại, nó chạy được kể cả khi Supabase tắt hẳn.

## Chạy

```
npm install
npm run dev            # cần .env.local, xem bên dưới
```

`.env.local`:

```
SUPABASE_URL=https://nyjvtvmllwbyfokldgtj.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
```

Dùng khoá anon (publishable) chứ không phải service role: mấy bảng nội dung
đều cho đọc công khai nên anon là đủ, và rò cũng không mở thêm được gì.

## Đồng bộ

Một chiều, Supabase → D1. Không bao giờ ghi ngược.

```
npm run dong-bo        # chạy tay, vào D1 thật
npm run dong-bo:local  # vào D1 local của wrangler
```

Tự động: worker trong `cron/` chạy 19:00 UTC (02:00 VN) hằng ngày. Đổi lịch ở
`cron/wrangler.jsonc`. Đặt lại secret khi cần:

```
npx wrangler secret put SUPABASE_ANON_KEY --config cron/wrangler.jsonc
npx wrangler deploy --config cron/wrangler.jsonc
```

Cả hai đường đồng bộ đều **dừng lại nếu Supabase trả về 0 sản phẩm hoặc 0
ngày**. Lý do: khi project bị khoá, REST trả 200 kèm mảng rỗng chứ không phải
lỗi — ghi đè lúc đó là tự tay xoá bản dự phòng đúng lúc cần nó nhất.

Tên bài ("Mở vai & Thả lỏng lưng trên") lấy từ YouTube oEmbed lúc đồng bộ, vì
Supabase không lưu tên bài — app chỉ hiện "Ngày N".

## Chỉ chép phần lộ trình mở

Giai đoạn 3 của TheraNECK+ (ngày 15–28) là nội dung khách mua thêm trong
app — `phase_promos.apple_product_id` = `ai.therahome.neckplus.phase3unlock`,
`google_product_id` = `neckplus_phase3`. App khoá nó cho tới khi có giao dịch
đã xác minh.

Trang này không có đăng nhập, nên nó không thể biết ai đã mua. Vì vậy khâu
đồng bộ **bỏ hẳn** mọi giai đoạn có một trong hai id đó, cùng toàn bộ ngày
thuộc giai đoạn ấy — lọc ngay lúc chép chứ không phải ẩn lúc hiển thị, để nội
dung trả phí không nằm trong D1 (vốn phục vụ công khai) ngay từ đầu.

Ngày không gắn giai đoạn nào cũng bị bỏ: không biết nó có bị khoá hay không.

Nếu đọc `phase_promos` hỏng thì cả lần đồng bộ dừng và D1 giữ nguyên. Cố ý:
thà bản dự phòng cũ đi vài ngày còn hơn một lần lỡ phát thứ đang bán.

Hệ quả: bản dự phòng có 14 ngày, khớp `products.total_days`. Nếu sau này bán
thêm giai đoạn nào thì không phải sửa gì ở đây — chỉ cần set id sản phẩm
trong WEB Admin là lần đồng bộ sau tự bỏ nó ra.

## Deploy

```
npm run cf:deploy
```

Sau khi sửa `wrangler.jsonc` thì chạy `npm run cf:typegen` để cập nhật
`cloudflare-env.d.ts`, nếu không `npm run build` sẽ báo thiếu type của binding.

## Những chỗ dễ vấp

- D1 **không nhận** `BEGIN TRANSACTION` / `COMMIT`. `wrangler d1 execute --file`
  đã chạy cả file như một khối và tự quay lui khi hỏng; trong worker thì dùng
  `env.DB.batch()`.
- Cron phải là worker riêng: `@opennextjs/cloudflare` tự sinh
  `.open-next/worker.js` và không chừa chỗ cho export `scheduled`.
- `@opennextjs/cloudflare` 1.20.16 đòi `next >= 16.4.5`, nên repo này dùng
  16.4.5 chứ không phải 16.4.3 như CRM.
