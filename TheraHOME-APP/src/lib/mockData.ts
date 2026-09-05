// Ported from the Claude Design prototype's `data.js` (`window.APP_DATA`).
// What's left here is content that has no real-data equivalent yet or is
// genuinely static: onboarding `questions`, `articles`, a couple of fixed
// external links. Real per-user data (programs, community, chat,
// notifications, profile, store) all moved to Supabase-backed hooks across
// Phases 2-6 — see CLAUDE.md.

export type OnboardingPartKey = 'goals' | 'status' | 'intro';

export interface Question {
  key: string;
  multi?: boolean;
  title: string;
  subtitle?: string;
  options: string[];
  important?: boolean;
  part: OnboardingPartKey;
}

// Calendar-based statuses (2026-08-31 mechanic change): 'done' = video
// watched; 'missed' = a past unlocked day never watched; 'current' = today's
// day; 'upcoming' = tomorrow ("Mở khoá sau 0h"); 'locked' = further out;
// 'preview' = catalog browsing with no activated program.
export type DayStatus = 'done' | 'missed' | 'current' | 'upcoming' | 'locked' | 'preview';
export type DayType = 'train' | 'rest';

// Structural shape shared with the real `DayRow` type in
// src/hooks/usePrograms.ts — components like PathNode type against this
// rather than the real type so they don't need to import a hook file.
export interface ProgramDay {
  id: number;
  phase: string;
  status: DayStatus;
  video: string;
  type: DayType;
}

export interface Article {
  tag: string;
  title: string;
  readTime: string;
}

export const questions: Question[] = [
  { key: 'goal_main', part: 'goals', title: 'Mục tiêu chính của bạn là gì?', subtitle: 'Chọn mục tiêu phù hợp nhất để chúng tôi cá nhân hóa lộ trình cho bạn.', options: ['Ngủ ngon hơn', 'Làm việc đỡ mỏi hơn', 'Xây dựng thói quen chăm sóc cột sống', 'Tất cả – Lộ trình toàn diện'] },
  { key: 'priority_zone', part: 'goals', title: 'Khu vực bạn muốn ưu tiên?', subtitle: 'Chọn 1 khu vực để cá nhân hoá bài tập phù hợp nhất cho bạn.', options: ['Cổ – vai – gáy', 'Lưng & tư thế', 'Toàn thân'] },
  { key: 'home_reason', part: 'goals', multi: true, title: 'Điều gì khiến bạn chọn chăm sóc tại nhà?', options: ['Tiết kiệm thời gian và chi phí', 'Muốn có người hướng dẫn mỗi ngày', 'Muốn chủ động chăm sóc cơ thể tại nhà'] },
  { key: 'tension_level', part: 'status', title: 'Cơ thể bạn thường cảm thấy thế nào?', options: ['Thoải mái, ít căng mỏi', 'Thỉnh thoảng căng mỏi', 'Thường xuyên căng mỏi', 'Khó chịu gần như mỗi ngày'] },
  { key: 'tension_timing', part: 'status', multi: true, title: 'Khi nào bạn thường cảm thấy căng mỏi nhất?', options: ['Sau khi ngủ dậy', 'Khi ngồi hoặc làm việc lâu', 'Vào cuối ngày', 'Cả ngày'] },
  { key: 'age_group', part: 'intro', title: 'Bạn thuộc nhóm tuổi nào?', options: ['Dưới 25', '25–34', '35–44', '45–54', '55+'] },
  { key: 'daily_activity', part: 'intro', title: 'Một ngày của bạn thường vận động như thế nào?', subtitle: 'Chọn mức phù hợp nhất với thói quen và lối sống hiện tại của bạn.', options: ['Ngồi, cúi làm việc nhiều', 'Đứng hoặc đi lại nhiều', 'Lao động/vận động thể chất nhiều', 'Kết hợp cả ngồi và vận động'] },
  { key: 'daily_time', part: 'intro', title: 'Bạn có thể dành bao nhiêu thời gian mỗi ngày để chăm sóc cơ thể?', subtitle: 'Thời gian phù hợp sẽ giúp bạn duy trì thói quen và đạt hiệu quả tốt nhất.', options: ['10 - 20 phút', '20 - 30 phút', '30 phút trở lên'] },
];

const englishQuestions: Question[] = [
  { key: 'goal_main', part: 'goals', title: 'What is your main goal?', subtitle: 'Choose the goal that best fits you so we can personalize your roadmap.', options: ['Sleep better', 'Feel less tired at work', 'Build a spine-care habit', 'All of it – A complete roadmap'] },
  { key: 'priority_zone', part: 'goals', title: 'Which area would you like to prioritize?', subtitle: 'Choose one area so we can personalize the exercises that suit you best.', options: ['Neck – shoulders', 'Back & posture', 'Whole body'] },
  { key: 'home_reason', part: 'goals', multi: true, title: 'What made you choose home care?', options: ['Save time and money', 'Want daily guidance', 'Want to proactively care for my body at home'] },
  { key: 'tension_level', part: 'status', title: 'How does your body usually feel?', options: ['Comfortable, rarely tense', 'Occasionally tense', 'Frequently tense', 'Uncomfortable almost every day'] },
  { key: 'tension_timing', part: 'status', multi: true, title: 'When do you feel the most tension?', options: ['After waking up', 'While sitting or working for long periods', 'At the end of the day', 'All day'] },
  { key: 'age_group', part: 'intro', title: 'Which age group are you in?', options: ['Under 25', '25–34', '35–44', '45–54', '55+'] },
  { key: 'daily_activity', part: 'intro', title: 'How active is your typical day?', subtitle: 'Choose the level that best matches your current habits and lifestyle.', options: ['Mostly sitting or bending over for work', 'Mostly standing or walking', 'Physical labor / lots of movement', 'A mix of sitting and movement'] },
  { key: 'daily_time', part: 'intro', title: 'How much time can you spend on body care each day?', subtitle: 'A suitable amount of time helps you stay consistent and get better results.', options: ['10–20 minutes', '20–30 minutes', '30+ minutes'] },
];

const malayQuestions: Question[] = [
  { key: 'goal_main', part: 'goals', title: 'Apakah matlamat utama anda?', subtitle: 'Pilih matlamat yang paling sesuai supaya kami dapat memperibadikan pelan anda.', options: ['Tidur lebih lena', 'Kurang lenguh semasa bekerja', 'Membina tabiat menjaga tulang belakang', 'Semua – Pelan menyeluruh'] },
  { key: 'priority_zone', part: 'goals', title: 'Bahagian mana yang ingin anda utamakan?', subtitle: 'Pilih satu bahagian supaya kami dapat memperibadikan senaman yang paling sesuai untuk anda.', options: ['Leher – bahu', 'Belakang & postur', 'Seluruh badan'] },
  { key: 'home_reason', part: 'goals', multi: true, title: 'Apa yang mendorong anda memilih penjagaan di rumah?', options: ['Menjimatkan masa dan kos', 'Mahukan panduan setiap hari', 'Mahu menjaga tubuh secara proaktif di rumah'] },
  { key: 'tension_level', part: 'status', title: 'Bagaimana keadaan tubuh anda biasanya?', options: ['Selesa, jarang lenguh', 'Kadangkala lenguh', 'Kerap lenguh', 'Tidak selesa hampir setiap hari'] },
  { key: 'tension_timing', part: 'status', multi: true, title: 'Bilakah anda paling berasa lenguh?', options: ['Selepas bangun tidur', 'Semasa duduk atau bekerja lama', 'Pada penghujung hari', 'Sepanjang hari'] },
  { key: 'age_group', part: 'intro', title: 'Anda tergolong dalam kumpulan umur yang mana?', options: ['Bawah 25', '25–34', '35–44', '45–54', '55+'] },
  { key: 'daily_activity', part: 'intro', title: 'Bagaimana pergerakan harian anda?', subtitle: 'Pilih tahap yang paling sesuai dengan tabiat dan gaya hidup anda sekarang.', options: ['Duduk, membongkok bekerja banyak', 'Berdiri atau berjalan banyak', 'Kerja fizikal / pergerakan banyak', 'Gabungan duduk dan bergerak'] },
  { key: 'daily_time', part: 'intro', title: 'Berapa lama masa yang anda boleh luangkan setiap hari untuk menjaga tubuh?', subtitle: 'Tempoh yang sesuai membantu anda kekal konsisten dan mendapat hasil terbaik.', options: ['10–20 minit', '20–30 minit', '30 minit ke atas'] },
];

export function onboardingQuestions(language: 'vi' | 'en' | 'ms'): Question[] {
  return language === 'en' ? englishQuestions : language === 'ms' ? malayQuestions : questions;
}

/** Country/region choice — moved out of the pre-auth question flow into its
 * own gated screen, app/(onboarding)/country.tsx, shown right after
 * activation (see RootNavigator's countryPending gate in app/_layout.tsx)
 * so the pick can be persisted to profiles.language once a userId actually
 * exists. Kept as the same content/options as before. */
export const countryQuestion: Record<'vi' | 'en' | 'ms', Question> = {
  vi: { key: 'country', part: 'intro', title: 'Bạn thuộc quốc gia nào?', subtitle: 'Lựa chọn này thiết lập ngôn ngữ ban đầu và nội dung phù hợp với khu vực của bạn.', options: ['US/EU', 'VIET NAM', 'MALAY'] },
  en: { key: 'country', part: 'intro', title: 'Which country or region are you in?', subtitle: 'This choice sets your initial language and region-specific content.', options: ['US/EU', 'VIET NAM', 'MALAY'] },
  ms: { key: 'country', part: 'intro', title: 'Anda berada di negara atau rantau mana?', subtitle: 'Pilihan ini menetapkan bahasa awal dan kandungan khusus untuk rantau anda.', options: ['US/EU', 'VIET NAM', 'MALAY'] },
};

export const articles: Article[] = [
  { tag: 'Hướng dẫn', title: '5 nguyên tắc an toàn khi tập luyện tại nhà', readTime: '4 phút đọc' },
  { tag: 'Kiến thức', title: 'Vì sao ngày tập nhẹ cũng quan trọng như ngày tập nặng', readTime: '3 phút đọc' },
  { tag: 'Dinh dưỡng', title: 'Ăn gì để hỗ trợ quá trình vận động hằng ngày', readTime: '5 phút đọc' },
  { tag: 'Câu chuyện', title: 'Hành trình 14 ngày lấy lại vận động của một khách hàng TheraHOME', readTime: '6 phút đọc' },
  { tag: 'Hướng dẫn', title: 'Nhận biết dấu hiệu cần nghỉ và báo với đội ngũ hỗ trợ TheraHOME', readTime: '3 phút đọc' },
];

const englishArticles: Article[] = [
  { tag: 'Guide', title: '5 safety principles for training at home', readTime: '4 min read' },
  { tag: 'Knowledge', title: 'Why light training days matter as much as intense days', readTime: '3 min read' },
  { tag: 'Nutrition', title: 'What to eat to support daily movement', readTime: '5 min read' },
  { tag: 'Story', title: 'A TheraHOME customer’s 14-day mobility journey', readTime: '6 min read' },
  { tag: 'Guide', title: 'Signs that you should rest and contact TheraHOME support', readTime: '3 min read' },
];

const malayArticles: Article[] = [
  { tag: 'Panduan', title: '5 prinsip keselamatan untuk latihan di rumah', readTime: '4 minit bacaan' },
  { tag: 'Pengetahuan', title: 'Mengapa hari latihan ringan sama penting dengan hari intensif', readTime: '3 minit bacaan' },
  { tag: 'Pemakanan', title: 'Makanan yang menyokong pergerakan harian', readTime: '5 minit bacaan' },
  { tag: 'Cerita', title: 'Perjalanan mobiliti 14 hari pelanggan TheraHOME', readTime: '6 minit bacaan' },
  { tag: 'Panduan', title: 'Tanda anda perlu berehat dan menghubungi sokongan TheraHOME', readTime: '3 minit bacaan' },
];

export function localizedArticles(language: 'vi' | 'en' | 'ms'): Article[] {
  return language === 'en' ? englishArticles : language === 'ms' ? malayArticles : articles;
}

export const introVideo = 'https://www.youtube.com/watch?v=DHuAzpoV0XQ';

// The marketing/e-commerce domain — configurable via env so it can change
// (rebrand, new TLD, ...) without a code change, instead of being baked in
// at every call site. `EXPO_PUBLIC_*` vars are read at build time like the
// existing Supabase ones (see .env.example).
export const websiteDomain = process.env.EXPO_PUBLIC_WEBSITE_DOMAIN ?? 'therahomeai.com';
export const landingPage = `https://${websiteDomain}`;
export const supportEmail = `support@${websiteDomain}`;

// Public, unauthenticated web copies of the legal documents — served by
// TheraHOME-WEB (app/privacy, app/terms, app/account-deletion) on the admin
// subdomain, NOT on the storefront domain, which has no such pages.
// App Store Connect needs the privacy URL; Play Console needs the privacy URL
// *and* a web account-deletion URL (an in-app delete alone is not enough).
export const legalWebBase = `https://ad.${websiteDomain}`;
export const privacyPolicy = `${legalWebBase}/privacy`;
export const termsOfUse = `${legalWebBase}/terms`;
export const accountDeletionPage = `${legalWebBase}/account-deletion`;
