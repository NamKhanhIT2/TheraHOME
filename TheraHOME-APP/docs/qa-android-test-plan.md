# QA Android — 2 tài khoản, 2 vai trò (2026-09-13)

Hai tài khoản cố ý **khác loại**, vì hai việc cần hai thứ trái ngược nhau:
giao diện cần *mở hết mọi màn hình ngay*, chức năng cần *bị khoá đúng như
khách thật*.

| | Giao diện (UI) | Chức năng |
|---|---|---|
| Đăng nhập (email) | `uitester@thera.local` | `qatester@thera.local` |
| `account_type` | `review` | `tester` |
| Khoá ngày / giai đoạn | **Bỏ qua hết** | **Áp dụng như khách thật** |
| Nội dung | Tự cấp toàn bộ catalog khi tạo | Phải tự kích hoạt thiết bị |
| Bộ câu hỏi đầu vào | Bỏ qua | Phải làm |
| Duyệt bài cộng đồng | Lên thẳng, không giới hạn tần suất | Vào hàng chờ duyệt, có giới hạn |

Tạo tài khoản: `node scripts/create-android-qa-accounts.mjs` (xem đầu file
script để biết biến môi trường). Mật khẩu sinh ra tại máy bạn và ghi vào
`scripts/android-qa-credentials.csv` (đã git-ignore).

Email kích hoạt `qatester@thera.local` đã nằm sẵn trong allow-list TheraNECK+.

---

## 1. Tài khoản GIAO DIỆN — `uitester`

Mục tiêu: **không có chữ nào chìm, không có popup nào mất mép**, ở **cả chế độ
sáng và tối**. Đổi chế độ trong Hồ sơ → Cài đặt. Mỗi mục làm 2 lượt.

**Màn hình nền cố định — kiểm thanh trạng thái (giờ/pin) có nhìn rõ không**
- Màn đăng nhập, màn đồng ý điều khoản, màn đèn mascot, màn câu hỏi, màn Gợi ý
  sau khảo sát.

**Trang chủ**
- Menu chọn sản phẩm, thẻ uống nước, biểu đồ đau + menu chọn khoảng thời gian,
  popup nhắc nhở và bộ chọn giờ của nó.

**Lộ trình + Ngày**
- Đường 14 ngày, ngày đang tới / đã xong / bị khoá; mở một ngày bất kỳ, video,
  thang điểm đau; khảo sát cuối giai đoạn và màn Gợi ý.

**Cộng đồng**
- Feed, tạo bài (icon, nút X gỡ ảnh), menu "…", **popup chọn lý do báo cáo**,
  chặn người dùng, **thông báo nhỏ hiện sau khi báo cáo/chặn**, chi tiết bài +
  các vạch chia trong phần bình luận.

**Chat**
- Chat AI và chat chuyên gia: nhấn giữ tin nhắn ra bảng thao tác, đính ảnh và
  nút X gỡ ảnh.

**Thông báo**
- Chấm badge cạnh avatar, avatar TheraHOME/chuyên gia trong danh sách.

**Hồ sơ**
- Sửa hồ sơ, cài đặt thông báo + bộ chọn giờ, tài khoản, trợ giúp, các trang
  pháp lý, hộp thoại xoá tài khoản, hộp thoại chia sẻ câu chuyện, hộp thoại mở
  liên kết ngoài, hộp thoại video sản phẩm.
- Trang hồ sơ cộng đồng của người khác: 3 con số streak / hoàn thành / bài viết.

> Tài khoản này đăng bài là **lên thẳng**, không qua duyệt. Đừng đăng bài rác
> lên cộng đồng thật; nếu lỡ, xoá ngay trong app.

---

## 2. Tài khoản CHỨC NĂNG — `qatester`

Mục tiêu: **luồng thật của khách chạy đúng**. Làm đúng thứ tự.

1. **Đăng nhập** bằng email + mật khẩu. Thử sai mật khẩu một lần: phải báo lỗi
   rõ ràng, không lộ email nào tồn tại.
2. **Bộ câu hỏi đầu vào** → màn đồng ý điều khoản → vào app.
3. **Kích hoạt thiết bị**: nhập `qatester@thera.local` ở màn Kích hoạt. Phải
   nhận được TheraNECK+. Thử một email lạ trước đó: phải bị từ chối.
4. **Ngày 1**: xem video, chấm điểm đau, hoàn thành. Ngày 2 phải **vẫn khoá**
   (mở theo ngày thật) — đây là hành vi đúng, không phải lỗi.
5. **Uống nước**: tăng/giảm ly, đóng app mở lại xem có giữ số không.
6. **Cộng đồng**: đăng 1 bài có ảnh → phải hiện **"Đang chờ duyệt"**. Thích,
   lưu, bình luận, trả lời bình luận, báo cáo, chặn, ẩn bài.
7. **Giới hạn tần suất**: đăng liên tiếp vài bài → phải bị chặn và báo lý do.
8. **Chat AI**: gửi câu hỏi tiếng Việt, phải có trả lời. Chat chuyên gia: gửi
   được, hiển thị trạng thái ngoại tuyến.
9. **Thông báo**: bật nhắc nhở sáng/tối trong Cài đặt, đặt giờ gần hiện tại,
   chờ tới giờ xem điện thoại có nổ thông báo không.
10. **Hồ sơ**: đổi tên, đổi ảnh đại diện, đổi ngôn ngữ.
11. **Xoá tài khoản** (làm **cuối cùng**): xoá xong phải bị đăng xuất ngay và
    **không đăng nhập lại được** bằng chính email đó.

> Sau bước 11, email `qatester@thera.local` vẫn bị đánh dấu đã dùng trong
> allow-list. Muốn test lại từ đầu thì phải nhả nó ra:
> ```sql
> update public.product_activation_contacts
>    set claimed_by_user_id = null, claimed_at = null
>  where normalized_value = 'qatester@thera.local';
> ```

---

## Ghi chú

- Bản Android đang cài trên máy là từ nhánh `android-dev` (commit `1cf893d`).
  iOS build 21 **không** có các sửa giao diện này; iOS chỉ nhận từ build 22 trở
  đi, sau khi Apple duyệt xong bản 21.
- Cả hai tài khoản đều là thị trường VN. Muốn kiểm bản US/MALAY thì tạo thêm
  bằng `COUNTRY=US node scripts/create-android-qa-accounts.mjs` với username
  khác.
