"use client";

// Nhật ký — who asked for what, which agent ran it, who approved.
//
// Empty until the console runs for real: an audit log seeded with invented
// entries is the one kind of fake data that could later be mistaken for
// evidence.
import { NotConnected } from "@/components/agent/parts";

export function LogView() {
  return (
    <NotConnected icon="clock" title="Nhật ký còn trống">
      Mỗi lần giao việc và mỗi lần duyệt sẽ ghi một dòng ở đây: thời điểm, người giao, agent chạy, kết quả. Chưa có dòng nào vì console chưa chạy thật — và nhật ký là thứ không nên mồi bằng dữ liệu giả.
    </NotConnected>
  );
}
