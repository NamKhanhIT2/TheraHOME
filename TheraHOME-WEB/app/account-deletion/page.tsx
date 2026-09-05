import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Xoá tài khoản · TheraHOME",
  description:
    "Cách xoá tài khoản TheraHOME và dữ liệu liên quan — tự xoá trong ứng dụng hoặc gửi yêu cầu qua email.",
};

/** Google Play requires a publicly reachable URL describing how to request
 * account + data deletion (an in-app delete button alone is not enough), and
 * that URL must name the app, the developer, what is deleted, what is kept
 * and for how long. Linked from the Play Console listing ("Data deletion")
 * and from the footer of /privacy and /terms. Kept consistent with the real
 * `delete_account()` RPC — see TheraHOME-APP/docs/backend.md. */

const sectionStyle = { marginTop: 28 } as const;
const h2Style = { fontSize: 19, fontWeight: 700, marginBottom: 8 } as const;
const bodyStyle = { fontSize: 15, color: "var(--text-secondary, #3d4a58)" } as const;
const listStyle = { ...bodyStyle, paddingLeft: 20, margin: "8px 0" } as const;

export default function AccountDeletionPage() {
  return (
    <LegalShell title="Yêu cầu xoá tài khoản và dữ liệu">
      <p style={bodyStyle}>
        Trang này áp dụng cho ứng dụng <strong>TheraHOME</strong> (mã ứng dụng{" "}
        <code>ai.therahome</code>), do <strong>Công ty H-COMMERCE GLOBAL COMPANY LIMITED</strong>{" "}
        phát hành. Bạn có thể xoá tài khoản TheraHOME và dữ liệu cá nhân gắn với tài khoản đó
        theo một trong hai cách dưới đây.
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Cách 1 — Tự xoá ngay trong ứng dụng</h2>
        <ol style={listStyle}>
          <li>Mở ứng dụng TheraHOME và đăng nhập.</li>
          <li>Vào tab <strong>Hồ sơ</strong>.</li>
          <li>Cuộn xuống cuối trang, chọn <strong>Xoá tài khoản</strong>.</li>
          <li>Đọc thông báo xác nhận và bấm <strong>Xoá</strong>.</li>
        </ol>
        <p style={bodyStyle}>
          Việc xoá được thực hiện ngay lập tức và không thể hoàn tác. Bạn sẽ được đăng xuất
          khỏi ứng dụng sau khi hoàn tất.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Cách 2 — Gửi yêu cầu qua email</h2>
        <p style={bodyStyle}>
          Nếu bạn không còn truy cập được ứng dụng, gửi email tới{" "}
          <a href="mailto:support@therahomeai.com" style={{ color: "var(--color-primary, #007fd9)" }}>
            support@therahomeai.com
          </a>{" "}
          với tiêu đề <strong>&ldquo;Yêu cầu xoá tài khoản&rdquo;</strong>, kèm địa chỉ email hoặc số
          điện thoại đã dùng để đăng ký. Chúng tôi có thể hỏi thêm thông tin để xác minh bạn là
          chủ tài khoản, và sẽ xử lý yêu cầu trong vòng <strong>30 ngày</strong> kể từ khi xác
          minh xong.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Dữ liệu bị xoá vĩnh viễn</h2>
        <ul style={listStyle}>
          <li>Lộ trình tập đã kích hoạt, tiến độ từng ngày và nhật ký mức độ khó chịu (0–10).</li>
          <li>Nhật ký uống nước.</li>
          <li>Hộp thông báo trong ứng dụng và mã thiết bị dùng để gửi thông báo đẩy.</li>
          <li>
            Thông tin cá nhân trong hồ sơ (họ tên, ảnh đại diện, số điện thoại, email liên hệ)
            được xoá hoặc ẩn danh hoá.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Dữ liệu được giữ lại và lý do</h2>
        <ul style={listStyle}>
          <li>
            <strong>Bài viết và bình luận trong mục Cộng đồng</strong> không bị xoá mà được ẩn
            danh hoá (tên tác giả hiển thị thành &ldquo;Người dùng đã xoá&rdquo;), để không làm mất
            các chuỗi thảo luận mà người dùng khác đã tham gia. Nếu muốn xoá hẳn nội dung này,
            hãy tự xoá từng bài viết/bình luận trong ứng dụng <em>trước khi</em> xoá tài khoản,
            hoặc nêu rõ yêu cầu trong email ở Cách 2.
          </li>
          <li>
            <strong>Chứng từ giao dịch, hoá đơn mua hàng</strong> (nếu có) được lưu theo thời hạn
            pháp luật về kế toán, thuế bắt buộc, sau đó sẽ được xoá.
          </li>
          <li>
            <strong>Bản sao lưu hệ thống</strong> có thể còn chứa dữ liệu trong tối đa 30 ngày
            trước khi bị ghi đè theo chu kỳ sao lưu thông thường.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Câu hỏi khác</h2>
        <p style={bodyStyle}>
          Chi tiết về việc thu thập và xử lý dữ liệu có trong{" "}
          <a href="/privacy" style={{ color: "var(--color-primary, #007fd9)" }}>
            Chính sách quyền riêng tư
          </a>
          . Mọi thắc mắc xin gửi về{" "}
          <a href="mailto:support@therahomeai.com" style={{ color: "var(--color-primary, #007fd9)" }}>
            support@therahomeai.com
          </a>
          .
        </p>
      </section>
    </LegalShell>
  );
}
