/* Service worker của bản dự phòng.
 *
 * Lý do tồn tại: bản dự phòng là để dùng lúc hỏng. Nếu nó chỉ sống khi có
 * mạng tốt thì mới giải quyết được một nửa — Supabase chết thì vẫn mở được,
 * nhưng mất sóng giữa buổi tập thì vẫn tắt. Cache lại trang đã xem để lần
 * sau mở offline vẫn ra. (04/11/2026)
 *
 * Video YouTube thì KHÔNG cache được (cross-origin, opaque, rất nặng) — mất
 * mạng thì chữ vẫn còn, video thì không. Nói thẳng điều đó trên giao diện.
 */
// Đổi tên mỗi lần giao diện thay đổi hẳn: activate xoá mọi cache khác tên,
// nên máy từng mở bản cũ không bị kẹt bản cũ khi offline. (04/11/2026)
const PHIEN_BAN = 'therahome-duphong-v3';
const VO_APP = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/hero.webp'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PHIEN_BAN).then((c) => c.addAll(VO_APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ten) => Promise.all(ten.filter((t) => t !== PHIEN_BAN).map((t) => caches.delete(t))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Chỉ lo phần của mình. YouTube và mọi domain khác cứ để trình duyệt tự xử.
  if (url.origin !== self.location.origin) return;

  // Mạng trước, cache sau. Trang là SSR nên có mạng thì luôn muốn bản mới;
  // không có mạng thì lấy bản đã lưu còn hơn không có gì.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const ban_sao = res.clone();
          caches.open(PHIEN_BAN).then((c) => c.put(req, ban_sao));
        }
        return res;
      })
      .catch(async () => {
        const da_luu = await caches.match(req);
        if (da_luu) return da_luu;
        // Chưa từng mở trang này khi còn mạng.
        const trang_chu = await caches.match('/');
        if (trang_chu && req.mode === 'navigate') return trang_chu;
        return new Response('Chưa tải được và chưa có bản lưu.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }),
  );
});
