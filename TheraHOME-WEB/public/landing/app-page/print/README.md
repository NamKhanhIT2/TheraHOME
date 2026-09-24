# Mã QR để in lên sản phẩm

Sinh bằng gói npm `qrcode@1.5.4` chạy tại máy (`npx`), không qua dịch vụ QR nào.
Ảnh là file tĩnh trong repo: không hết hạn, không ai chèn quảng cáo được.

| File | Nội dung mã | Dùng khi |
|---|---|---|
| `qr-print-universal.*` | `https://ad.therahomeai.com/app/tai` | **Mặc định.** Máy chủ tự nhận iPhone → App Store, Android → Google Play, máy tính → trang /app |
| `qr-print-app-store.*` | `https://ad.therahomeai.com/app/tai/ios` | Chỉ khi in riêng phần dành cho iPhone |
| `qr-print-google-play.*` | `https://ad.therahomeai.com/app/tai/android` | Chỉ khi in riêng phần dành cho Android |

Mã **không** chứa thẳng link cửa hàng. Link cửa hàng đọc từ Admin → Nội dung
website tại thời điểm quét, nên đổi link sau này không làm hỏng vật phẩm đã in.
Điều kiện duy nhất: tên miền `ad.therahomeai.com` phải còn hoạt động.

## Thông số

- Mức chống lỗi **H** (khôi phục tới ~30% diện tích hỏng): chịu được xước, nhoè
  mực, cong vênh trên vỏ hộp và tem dán. Bản dùng trên web là mức M, nhẹ hơn.
- Viền trắng 4 ô (quiet zone) đã nằm sẵn trong file — **không cắt sát viền**.
- `.svg` là vector, phóng to bao nhiêu cũng nét: ưu tiên gửi file này cho xưởng in.
  `.png` 2400px dùng khi phần mềm của xưởng không nhận SVG.
- Đã giải mã ngược từ chính file PNG (thư viện jsQR) ở 2400px và 300px: đúng link.

## Quy cách in

- **Kích thước tối thiểu 2×2 cm** khi người dùng quét ở khoảng cách một gang tay.
  Quy tắc chung: cạnh mã ≥ 1/10 khoảng cách quét. Quét xa 50 cm thì mã cần ≥ 5 cm.
- **Đen trên nền trắng**, đừng in âm bản (nền tối chữ sáng) vì nhiều máy quét bỏ qua.
  Nếu cần đổi màu, phần tối phải đậm hơn hẳn phần nền; giữ tương phản ≥ 4:1.
- Chừa quanh mã một khoảng trắng bằng ít nhất 4 ô của mã, không đặt chữ đè lên.
- Tránh đặt lên chỗ cong nhiều, đường gấp hộp, hoặc lớp nhựa bóng gây loá.
- In thử một tem, quét bằng **iPhone và Android thật** trước khi in số lượng lớn.

## Chữ đi kèm

Nên có một dòng ngay dưới mã, người dùng biết mã dẫn đi đâu:
"Quét để tải ứng dụng TheraHOME" — hoặc thêm dòng nhỏ
"App Store & Google Play".
