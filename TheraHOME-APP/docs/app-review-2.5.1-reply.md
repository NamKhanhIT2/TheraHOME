# Nộp lại cho Apple — Guideline 2.5.1 (HealthKit), 04/11/2026

Submission ID bị từ chối: `6fecb666-7296-49a0-a4a8-4f4b13464ce6` ·
bản 1.0.3 (50) · máy duyệt: iPad Air 11-inch (M3).

Nguyên nhân và hai chỗ đã sửa: xem `docs/feature-notes.md`, mục
**2026-11-04 — App Review 2.5.1**. Build number đã tăng lên **51**
(`app.json` + `CURRENT_PROJECT_VERSION` ở hai nơi trong pbxproj).

---

## 1. Việc cần làm, theo thứ tự

1. ~~Build 1.0.3 (51), validate rồi upload.~~ **Xong 04/11/2026 23:28** —
   `VERIFY SUCCEEDED` rồi `UPLOAD SUCCEEDED`, Delivery UUID
   `9372d075-ec00-4f23-8c03-945470814509`. Apple xử lý khoảng 5–15 phút rồi
   build 51 mới chọn được trong App Store Connect.
2. Quay screen recording trên **iPhone thật** — xem mục 4 bên dưới.
3. App Store Connect → bản 1.0.3 → chọn **Build 51** (thay cho 50) →
   **App Review Information → Notes**: dán nguyên văn mục 2.
4. **Resolution Center** → trả lời thư từ chối: dán nguyên văn mục 3, đính
   kèm screen recording.
5. Submit.

---

## 2. App Review Information → Notes

Ô Notes **đã có sẵn 3.511 ký tự** (mục đích app, cách đăng nhập, IAP đang
tắt, camera, dịch vụ ngoài) nhưng **không nhắc gì tới HealthKit** — đúng
điểm Apple từ chối. Trần của ô là 4.000, chỉ còn trống 489, không đủ.

Cách làm: **xoá khối `WHAT IS NEW IN 1.0.3`** (322 ký tự, đã lặp lại nguyên
văn ô "What's New in This Version"), rồi dán đoạn dưới đây vào đúng chỗ vừa
xoá — ngay sau phần `APP PURPOSE`, trước `HOW TO ACCESS THE APP`. Đoạn này
dài 746 ký tự, vừa khít và còn dư 65.

```
APPLE HEALTH - THE 2.5.1 ISSUE FROM BUILD 50

TheraHOME uses HealthKit read-only: step count, walking + running distance, flights climbed and the daily activity summary. It never writes to the Health app.

Build 50 named this only on the Home Activity card, which is hidden where HealthKit is unavailable - and that review ran on an iPad, which has no Health app. Build 51 adds:

1. Home - the "Vận động" (Activity) card now carries the line "Đọc từ Apple Health" in every state.
2. Profile - "Apple Health": a screen naming the integration, listing every type read, and stating that the app only reads, never writes, and keeps the data on the device. Present on every iOS device, iPad included.

The attached recording shows both on an iPhone.
```

Dán xong bấm **Save** ở góc phải trên.

## 3. Trả lời trong Resolution Center (dán nguyên văn)

```
Hello,

Thank you for the detailed feedback. We have submitted build 51, which
resolves the Guideline 2.5.1 issue.

TheraHOME uses HealthKit read-only (step count, walking + running distance,
flights climbed and the daily activity summary) and never writes to it. In
build 50 this was only named on the Home screen's Activity card, which is
hidden on devices where HealthKit is unavailable — and the review was run on
an iPad Air, where iPadOS has no Health app. That is why no HealthKit
functionality was visible to you.

In build 51:

1. The "Vận động" (Activity) card on the Home tab now carries the line
   "Đọc từ Apple Health" ("Read from Apple Health") in every state, next to
   the "Kết nối Apple Health" ("Connect Apple Health") action.

2. A new screen at Profile > Apple Health names the integration, lists every
   HealthKit type the app reads, states explicitly that the app only reads
   and never writes to the Health app, and states that the data stays on the
   device. This screen is reachable on every iOS device, iPad included.

We have attached a screen recording made on a physical iPhone showing both
places, and we have also described them in the App Review Information notes
for future submissions.

Thank you for your time.

TheraHOME
```

---

## 4. Screen recording — quay trên iPhone thật

Apple yêu cầu máy thật. iPad không quay được thẻ "Vận động" vì trên iPad nó
không tồn tại — quay bằng iPhone đã cài bản 51.

Trước khi quay, vào **Cài đặt › Sức khoẻ › Truy cập & Thiết bị dữ liệu ›
TheraHOME › Xoá tất cả dữ liệu** (hoặc gỡ app cài lại) để quay được cả bước
cấp quyền.

Thứ tự quay, khoảng 40–60 giây, không cần tiếng:

1. Mở app → trang chủ → cuộn xuống thẻ **Vận động**. Dừng khoảng 2 giây để
   thấy rõ dòng **"Đọc từ Apple Health"** dưới tiêu đề.
2. Nhấn **Kết nối Apple Health** → sheet của iOS hiện ra → **Bật tất cả** →
   **Cho phép**.
3. Thẻ hiện số bước / quãng đường / số tầng. Dừng 2 giây.
4. Nhấn nút hồ sơ ở góc trái trên → **Hồ sơ**.
5. Nhấn dòng **Apple Health** → cuộn hết màn hình đó, chậm, để đọc được cả
   bốn thẻ: tình trạng kết nối, "TheraHOME đọc những mục này", "TheraHOME
   không ghi gì vào Apple Health", "Dữ liệu ở đâu", "Xem ở đâu trong ứng
   dụng".

Xuất file .mov hoặc .mp4 rồi đính kèm vào phần trả lời ở Resolution Center.

---

## 5. Nếu Apple vẫn hỏi lại

Thư của họ có nêu một đường khác: trả lời rằng bản này là bug fix và xin
duyệt ngay, sửa ở bản sau. Đường đó chỉ nên dùng nếu 1.0.3 thật sự là bản
sửa lỗi cho người đang dùng app — và giờ đã có bản 51 rồi thì không cần nữa.
