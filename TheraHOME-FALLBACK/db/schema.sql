-- Bản sao chỉ đọc của nội dung lộ trình trị liệu, dùng khi Supabase bị khoá.
--
-- Cố ý KHÔNG chứa bất cứ dữ liệu cá nhân nào: không profiles, không
-- user_programs, không số điện thoại, không tiến độ. Lý do: trang này công
-- khai, không có đăng nhập (Supabase Auth cũng nằm trong thứ có thể chết),
-- nên mọi thứ đổ vào đây phải là thứ công khai được. Video bài tập vốn đã là
-- link YouTube công khai, nên nội dung lộ trình không phải bí mật.
-- (04/11/2026)
--
-- Chạy lại được nhiều lần: script đồng bộ xoá rồi chèn trong một transaction.

DROP TABLE IF EXISTS program_days;
DROP TABLE IF EXISTS program_phases;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS dong_bo_log;

CREATE TABLE products (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  category       TEXT,
  total_days     INTEGER NOT NULL,
  accent_color_key TEXT
);

CREATE TABLE program_phases (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id),
  name        TEXT NOT NULL,
  day_start   INTEGER NOT NULL,
  day_end     INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL
);

CREATE TABLE program_days (
  id                     TEXT PRIMARY KEY,
  product_id             TEXT NOT NULL REFERENCES products(id),
  phase_id               TEXT REFERENCES program_phases(id),
  day_number             INTEGER NOT NULL,
  day_type               TEXT NOT NULL,
  -- Tiêu đề lấy từ chính YouTube lúc đồng bộ (oEmbed), vì Supabase không lưu
  -- tên bài — app chỉ hiện "Ngày N". Có tên thì người mở bản dự phòng biết
  -- hôm nay tập gì mà không phải bấm vào từng ngày. (04/11/2026)
  title                  TEXT,
  video_url              TEXT,
  support_tools_label    TEXT,
  support_tools_url      TEXT
);

CREATE INDEX idx_days_product_number ON program_days(product_id, day_number);
CREATE INDEX idx_phases_product_sort ON program_phases(product_id, sort_order);

-- Một dòng mỗi lần đồng bộ. Trang chủ đọc dòng mới nhất để nói cho khách biết
-- nội dung được chép về lúc nào — nếu Supabase chết lâu thì số này đứng yên,
-- và đó là thông tin người đọc cần có.
CREATE TABLE dong_bo_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chay_luc    TEXT NOT NULL,
  so_ngay     INTEGER NOT NULL,
  so_giai_doan INTEGER NOT NULL
);
