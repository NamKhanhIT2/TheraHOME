# Rà soát phạm vi quản trị TheraHOME

Ngày rà soát: 18/08/2026

## Kết luận

Admin WEB hiện là prototype tương tác trên dữ liệu mock. Ngoài đăng nhập Google và RPC xác minh quyền truy cập web, các màn hình Admin không đọc hoặc ghi dữ liệu Supabase. Vì vậy trạng thái hiện tại chưa thể được xem là hệ thống quản trị cho mobile app production.

Các nút thêm, sửa, xóa hiện chỉ cập nhật React `useState`; tải lại trang sẽ mất dữ liệu. Một số khái niệm trong UI (`role`, `locked`, `paused` của người dùng) cũng chưa tồn tại trong schema mobile và không được phép ánh xạ ngầm sang dữ liệu thật.

## Ma trận phạm vi

| Phạm vi mobile | Bảng/dịch vụ thật | Admin hiện tại | Cần hoàn thiện |
|---|---|---|---|
| Dashboard vận hành | profiles, user_programs, user_program_days, pain_logs, community_posts, chat_threads | Số liệu hard-code/mock | KPI thật, cảnh báo người dùng đau tăng, bỏ tập, chat chưa trả lời, đơn chưa kích hoạt |
| Sản phẩm và lộ trình | products, program_phases, program_days | CRUD cục bộ; chưa quản lý đầy đủ giai đoạn | CRUD thật có transaction, sắp xếp ngày/giai đoạn, kiểm tra không trùng khoảng ngày, bảo vệ sản phẩm đang được sử dụng |
| Cửa hàng | store_categories, store_items | CRUD cục bộ | CRUD thật, thứ tự hiển thị, bật/tắt, liên kết sản phẩm, kiểm tra URL/giá |
| Đơn hàng và kích hoạt | orders; activate_order, lookup_order_by_code | Không có tab dù prototype có `LandingOrdersView` | Tìm kiếm, tạo/sửa, trạng thái, mã kích hoạt, Shopify order ID, lịch sử kích hoạt, chống trùng mã |
| Người dùng và hồ sơ | profiles | Danh sách mock; role/locked không có trong DB | Tra cứu hồ sơ thật, cập nhật hợp lệ, trạng thái xóa mềm; thiết kế bảng suspension/ban nếu cần khóa tài khoản |
| Tiến độ chương trình | user_programs, user_program_days | Chỉ hiển thị mock trong chi tiết user | Xem thiết bị đã kích hoạt, ngày hiện tại, tuân thủ, lịch sử ngày; thao tác reset/tạm dừng cần RPC và audit log riêng |
| Đau và nước | pain_logs, water_logs | Biểu đồ mock; không có lịch sử nước | Lịch sử thật, bộ lọc thời gian, cảnh báo; dữ liệu sức khỏe nên mặc định chỉ đọc và ghi audit khi truy cập |
| Cộng đồng | community_posts, post_comments, likes/saves, Storage | CRUD cục bộ trên mock | Moderation thật, xóa/ẩn bài và bình luận, bài chính thức, xem ảnh, audit log; không sửa trực tiếp bộ đếm trigger-maintained |
| Thông báo | notifications, push_tokens | Soạn/gửi/lên lịch chỉ là mock | Gửi theo user/thiết bị, hàng đợi gửi, lịch, trạng thái delivery; hiện backend chưa có broadcast/scheduler/Expo Push pipeline |
| Nội dung bài viết | articles; mobile còn có nội dung tĩnh | Không có tab | CRUD/publish bài viết và nối mobile vào bảng hoặc xác nhận tiếp tục dùng nội dung tĩnh |
| AI assistant | Edge Function `chat-ai-reply` | Textarea prompt mock | Version hóa prompt trong DB/secret, test prompt, rollback; không thể đổi prompt deployed chỉ bằng client anon |
| CSKH/chat người thật | chat_threads, chat_messages, Realtime Presence | Surface CSKH vẫn dùng mock | API đặc quyền để gửi `specialist`, thread thật, realtime, presence, trạng thái phân công/đóng thread |
| Tài khoản nội bộ | web_access_contacts | UI mock | CRUD quyền admin/cskh qua RPC đặc quyền; không được cho client đọc toàn bộ danh sách liên hệ |
| Tích hợp vận hành | Shopify webhook, Anthropic, Google OAuth, Expo Push | Không có giám sát | Trang trạng thái không lộ secret: lần chạy gần nhất, lỗi gần nhất, số đơn đồng bộ, trạng thái cấu hình |
| An toàn quản trị | Chưa có audit log/admin RPC chuẩn | Không có | `admin_audit_logs`, kiểm tra role server-side, xác nhận thao tác nguy hiểm, idempotency và least privilege |

## Kiến trúc bắt buộc trước khi nối dữ liệu thật

1. Không đưa Supabase service-role key vào `NEXT_PUBLIC_*` hoặc browser bundle.
2. Mọi thao tác quản trị phải đi qua Route Handler/Server Action chạy server-side hoặc `SECURITY DEFINER` RPC đã kiểm tra người gọi có role `admin` trong `web_access_contacts`.
3. CSKH chỉ được quyền chat và đọc dữ liệu tối thiểu cần thiết; không dùng chung toàn bộ quyền Admin.
4. Thêm bảng audit bất biến cho thao tác thêm/sửa/xóa, khóa user, reset tiến độ, kích hoạt đơn, moderation và gửi thông báo.
5. Các thao tác nhiều bảng như tạo sản phẩm + phases + days phải chạy transaction và validate toàn bộ trước khi commit.
6. Thao tác xóa dữ liệu đang được user sử dụng phải bị chặn hoặc chuyển sang `is_active=false`, không hard-delete tùy tiện.

## Thứ tự triển khai đề xuất

1. Nền tảng quyền Admin/CSKH, admin RPC/server API và audit log.
2. Đơn hàng/kích hoạt, người dùng và tiến độ (vận hành cốt lõi).
3. Sản phẩm/lộ trình và cửa hàng.
4. Community moderation và chat CSKH thật.
5. Notifications/push pipeline, articles và AI prompt management.
6. Dashboard/health monitoring tổng hợp từ dữ liệu thật.

## Điều kiện nghiệm thu

- Không còn số liệu hoặc mutation mock trên `/admin` và `/care`.
- Mọi màn hình có loading, empty, error, retry và optimistic state phù hợp.
- Refresh trang vẫn giữ đúng dữ liệu vừa thay đổi.
- Quyền được kiểm tra lại ở server cho từng mutation, không chỉ ẩn nút ở UI.
- Có audit log gồm actor, action, resource, before/after, thời gian và request ID.
- Test xác nhận Admin làm được đúng quyền, CSKH bị từ chối các mutation Admin, user mobile không thể gọi admin API.
- `npm run lint`, `npm run build` và các integration test đều đạt.
