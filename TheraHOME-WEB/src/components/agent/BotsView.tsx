"use client";

// Bot CSKH — deliberately empty.
//
// The order book is readable; the conversation logs are not. Rather than fill
// this screen with invented conversation counts to make it look finished, it
// names what is missing and what would fill it.
import { NotConnected, SectionTitle } from "@/components/agent/parts";

export function BotsView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <NotConnected icon="message-circle" title="Chưa đọc được hội thoại của bot">
        Console đọc được đơn hàng từ Pancake, nhưng chưa đọc được hội thoại Messenger và Zalo — nên không có số ca bot chuyển cho người, thời gian trả lời hay tỷ lệ chốt để hiển thị ở đây.
      </NotConnected>

      <SectionTitle>Cần gì để mở màn này</SectionTitle>
      <div className="ac-card ac-card-pad" style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--ac-ink-2)" }}>
        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <li>Quyền đọc hội thoại Messenger của fanpage “Hiểu đúng về cột sống” qua Pancake.</li>
          <li>Cầu nối Zalo cá nhân — hiện bot Zalo chạy thử, người bấm gửi.</li>
          <li>Một chỗ lưu kiến thức bot dùng chung, để biết câu nào đã duyệt và câu nào còn chờ.</li>
        </ul>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--ac-line)", color: "var(--ac-ink-3)", fontSize: 12.5 }}>
          Màn này sẽ hiện: số hội thoại, số ca chuyển người, số đơn bot ghi nhận, và nút bật tắt từng bot.
        </div>
      </div>
    </div>
  );
}
