# TheraHOME — bản dự phòng (web)

Trang web chỉ-đọc chứa toàn bộ nội dung lộ trình trị liệu, chạy trên Cloudflare
Workers + D1. Mục đích: **khi Supabase bị khoá vì vượt egress, khách vẫn mở
được bài tập.**

- Trang: https://therahome-duphong.therahome-crm.workers.dev
- D1: `therahome-duphong` (vùng APAC)
- Cron đồng bộ: worker `therahome-duphong-cron`, 02:00 giờ VN mỗi ngày

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
