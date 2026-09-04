# StoreKit Configuration (test IAP không cần App Store)

`Configuration.storekit` khai 4 non-consumable đúng bằng Product ID thật
(`ai.therahome.{neckplus,neckpro,backplus,backpro}.phase3unlock`) để chạy thử
luồng mua ngay trên simulator, không cần Sandbox Tester hay Paid Apps
Agreement.

**Bản gốc để ở đây vì `ios/` nằm trong .gitignore** (thư mục do
`expo prebuild` sinh ra) — nếu prebuild lại sẽ mất file trong đó.

## Cách dùng
1. `cp storekit/Configuration.storekit ios/Configuration.storekit`
2. Mở `ios/TheraHOME.xcworkspace` → Product › Scheme › Edit Scheme › Run ›
   Options › StoreKit Configuration → chọn `Configuration.storekit`
3. Chạy app TỪ XCODE (config chỉ có hiệu lực khi launch từ Xcode, không áp
   dụng cho bản chạy bằng `expo run:ios` sau đó mở tay).

Lưu ý: muốn thấy paywall để bấm mua thì phải bật lại công tắc "Đang mở bán"
cho giai đoạn tương ứng trong WEB Admin (Nội dung Upsell) — hiện đang tắt
để phát hành bản free.
