import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Cho `next dev` nhìn thấy binding D1 thật của wrangler, nếu không thì chạy
// local sẽ không có env.DB và mọi trang đều rỗng.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Ảnh duy nhất là thumbnail YouTube, dùng thẳng <img>. Image optimization
  // của Next không chạy sẵn trên Workers nên tắt cho khỏi bẫy người sau.
  images: { unoptimized: true },
};

export default nextConfig;
