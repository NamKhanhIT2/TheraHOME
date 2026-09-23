// /app — "get the TheraHOME app", laid out after pacerai.vn (owner request
// 2026-09-22): a light page with a sticky header, one headline, three
// highlight cards, the phones, how it works, what's inside, FAQ, a closing
// call to action, the legal footer and — on phones — a sticky store bar.
//
// Lives outside app/(public) on purpose: that group is the dark marketing
// site, and this page belongs with /privacy and /terms, which are light,
// trilingual and follow `?lang=` → Accept-Language → Vietnamese.
//
// The copy describes the app exactly as it ships, in the same wellness terms
// the store listings use — no treatment or recovery claims. The two
// medical/device answers are the app's own FAQ strings, word for word.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/app-landing.css";
import type { LegalLanguage } from "@/lib/appLegalContent";
import { LEGAL_LANGUAGES, resolveLegalLanguage } from "@/lib/legalLanguage";
import { getSiteContent } from "@/lib/siteContent";
import { LegalFooter } from "@/components/LegalFooter";
import { StoreBadges } from "@/components/appLanding/StoreBadges";
import { brandFont } from "@/lib/brandFont";
import { DownloadPrompt } from "@/components/appLanding/DownloadPrompt";
import { Illustration, type IlloKind } from "@/components/appLanding/Illustrations";
import { Flag } from "@/components/appLanding/Flag";
import { Reveal } from "@/components/appLanding/Reveal";
import { AppGallery } from "@/components/appLanding/AppGallery";
import { LangMenuCloser } from "@/components/appLanding/LangMenuCloser";

/** The store's own pages (Shopify), linked from the hero and the device section. */
const ABOUT_URL = "https://therahomeai.com/pages/v%E1%BB%81-chung-toi";
const PRODUCT_URL = "https://therahomeai.com/products/maytrilieuco";

const STEP_ILLOS: IlloKind[] = ["signin", "activate", "daily", "survey"];
const FEATURE_ILLOS: IlloKind[] = ["roadmap", "video", "ai", "reminder", "community", "support"];

export const metadata: Metadata = {
  // The tab reads just the brand, next to the house favicon (owner 2026-09-22).
  title: "TheraHOME",
  description: "Lộ trình tập cổ vai gáy mỗi ngày với video hướng dẫn, trợ lý AI và đội ngũ hỗ trợ TheraHOME. Tải trên App Store.",
};

// Store links and contact details are edited in Admin; pick edits up within a minute.
export const revalidate = 60;

// The owner's English App Store set (2026-09-22), used for every language.
// Panels 1 and 4 are the same files the hero shows, so they are reused, not
// downloaded twice.
const GALLERY = ["home", "gallery-2", "gallery-3", "community", "gallery-5", "gallery-6", "gallery-7"];

type Item = { title: string; body: string };

interface Copy {
  download: string;
  language: string;
  headlineLead: string;
  headlineBrand: string;
  intro: string;
  highlights: [Item, Item, Item];
  phonesAlt: [string, string];
  howTitle: string;
  howIntro: string;
  steps: Item[];
  insideTitle: string;
  insideIntro: string;
  features: [Item, Item, Item, Item, Item, Item];
  faqTitle: string;
  faq: { q: string; a: string }[];
  ctaTitle: string;
  ctaBody: string;
  qrLabel: string;
  qrAlt: string;
  startLabel: string;
  nav: { how: string; features: string; screens: string; device: string };
  stats: { value: string; label: string }[];
  galleryTitle: string;
  galleryIntro: string;
  galleryAlts: string[];
  galleryNav: { prev: string; next: string; dot: string };
  deviceTitle: string;
  deviceBody: string;
  deviceLink: string;
  deviceAlt: string;
  trustTitle: string;
  reviewsTitle: string;
  starsLabel: string;
  trust: { title: string; body: string; href?: string }[];
  about: string;
  prompt: { title: string; body: string; featuresTitle: string; features: string[]; dontShow: string; close: string };
}

const COPY: Record<LegalLanguage, Copy> = {
  vi: {
    download: "Tải app",
    language: "Ngôn ngữ",
    headlineLead: "Tập cổ\u00a0vai\u00a0gáy mỗi ngày cùng",
    headlineBrand: "TheraHOME",
    intro: "Lộ trình theo ngày, video hướng dẫn và người hỗ trợ khi cần. Dùng kèm thiết bị TheraHOME.",
    highlights: [
      { title: "Biết hôm nay tập gì", body: "Mỗi ngày một buổi 15–20 phút. Ngày mới mở lúc 0h." },
      { title: "Hỏi AI bất cứ lúc nào", body: "Về buổi tập, cách dùng thiết bị, cường độ phù hợp." },
      { title: "Tập theo video", body: "Xem trong app hoặc phát lên TV. Xem xong là ghi nhận." },
    ],
    phonesAlt: ["Màn hình chính ứng dụng TheraHOME", "Cộng đồng trong ứng dụng TheraHOME"],
    howTitle: "Bắt đầu trong 4 bước",
    howIntro: "",
    steps: [
      { title: "Đăng nhập", body: "Bằng Google, Apple hoặc email." },
      { title: "Kích hoạt thiết\u00a0bị", body: "Nhập số điện thoại hoặc email lúc đặt hàng. Không cần mã." },
      { title: "Tập mỗi ngày", body: "Một video mỗi ngày, nhắc theo giờ bạn chọn." },
      { title: "Đánh giá cuối giai đoạn", body: "Vài câu hỏi ngắn để TheraHOME theo sát bạn hơn." },
    ],
    insideTitle: "Trong ứng dụng có gì",
    insideIntro: "",
    features: [
      { title: "Lộ trình theo giai đoạn", body: "Tiến độ tự lưu sau mỗi buổi." },
      { title: "Video hướng dẫn", body: "Mỗi ngày một video riêng." },
      { title: "Trợ lý AI", body: "Trả lời ngay, mọi lúc." },
      { title: "Nhắc giờ tập", body: "Chọn sáng hoặc tối, app nhắc đúng giờ." },
      { title: "Cộng đồng", body: "Chia sẻ hành trình, học mẹo từ người đi trước." },
      { title: "Hỗ trợ", body: "Nhắn tin là có người của TheraHOME trả lời." },
    ],
    faqTitle: "Câu hỏi thường gặp",
    faq: [
      { q: "Ứng dụng có miễn phí không?", a: "Có. Lộ trình mở sau khi bạn kích hoạt bằng thông tin đặt hàng thiết bị TheraHOME." },
      { q: "Thiết bị TheraHOME là gì?", a: "TheraNECK/TheraBACK là dụng cụ hỗ trợ thư giãn cơ và tập luyện tại nhà, không phải thiết bị y tế. Thiết bị không đo lường chỉ số sức khỏe và không kết nối dữ liệu với ứng dụng; ứng dụng cung cấp video hướng dẫn tập luyện đi kèm thiết bị." },
      { q: "Ứng dụng có thay thế bác sĩ không?", a: "Không. TheraHOME hỗ trợ vận động, không thay thế chẩn đoán hay điều trị y khoa." },
      { q: "Làm sao để mở ngày tập tiếp theo?", a: "Các ngày trong lộ trình tự mở khoá theo thời gian: mỗi ngày mở một ngày mới vào 0h. Xem video bài tập để ghi nhận hoàn thành ngày hôm đó." },
      { q: "Dùng được trên những máy nào?", a: "iPhone và Android. Một tài khoản dùng trên cả hai, tiến độ luôn đồng bộ." },
      { q: "Quên mật khẩu thì làm sao?", a: "Chọn Quên mật khẩu ở màn đăng nhập và nhập email, TheraHOME sẽ gửi mã để bạn đặt lại mật khẩu." },
    ],
    startLabel: "Tải ứng dụng để bắt đầu",
    nav: { how: "Cách dùng", features: "Tính năng", screens: "Xem trước", device: "Thiết bị" },
    stats: [
      { value: "14 ngày", label: "một lộ trình" },
      { value: "15–20 phút", label: "mỗi buổi tập" },
      { value: "24/7", label: "trợ lý AI" },
      { value: "3", label: "ngôn ngữ" },
    ],
    galleryTitle: "Xem trước ứng dụng",
    galleryIntro: "Vuốt để xem từng màn hình.",
    galleryNav: { prev: "Màn trước", next: "Màn tiếp theo", dot: "Xem màn {n}" },
    galleryAlts: ["Màn hình chính", "Lộ trình 14 ngày", "Buổi tập có video", "Cộng đồng", "Tập theo video", "Trợ lý AI", "Hỗ trợ từ TheraHOME"],
    deviceTitle: "Đi cùng thiết\u00a0bị TheraNECK+",
    deviceBody: "Ứng dụng cung cấp video hướng dẫn tập luyện đi kèm thiết bị. TheraNECK+ là dụng cụ hỗ trợ thư giãn cơ và tập luyện tại nhà, không phải thiết bị y tế.",
    deviceLink: "Xem thiết bị",
    deviceAlt: "Thiết bị TheraNECK+",
    trustTitle: "Yên tâm khi dùng",
    reviewsTitle: "Khách hàng nói gì",
    starsLabel: "{n} trên 5 sao",
    trust: [
      { title: "Dữ liệu được bảo vệ", body: "Xem TheraHOME thu thập và xử lý dữ liệu thế nào.", href: "/privacy" },
      { title: "Xoá tài khoản bất cứ lúc nào", body: "Ngay trong app, mục Hồ sơ.", href: "/account-deletion" },
      { title: "Ba ngôn ngữ", body: "Tiếng Việt, English và Bahasa Melayu." },
    ],
    about: "Tìm hiểu về TheraHOME",
    ctaTitle: "Tải TheraHOME",
    ctaBody: "Kích hoạt thiết bị và tập buổi đầu tiên ngay hôm nay.",
    qrLabel: "Quét bằng camera điện thoại để tải",
    qrAlt: "Mã QR tải ứng dụng TheraHOME",
    prompt: {
      title: "Tải ứng dụng TheraHOME",
      body: "Tập theo lộ trình mỗi ngày, ngay trên điện thoại.",
      featuresTitle: "Có gì trong app:",
      features: ["Video hướng dẫn từng buổi", "Trợ lý AI trả lời ngay", "Nhắc giờ tập hằng ngày"],
      dontShow: "Không hiện lại",
      close: "Đóng",
    },
  },
  en: {
    download: "Download",
    language: "Language",
    headlineLead: "Train your neck and shoulders daily\u00a0with",
    headlineBrand: "TheraHOME",
    intro: "A day-by-day roadmap, guided videos and real people when you need them. Made for your TheraHOME device.",
    highlights: [
      { title: "Know what to do today", body: "One 15–20 minute session a day. A new day opens at midnight." },
      { title: "Ask the AI any time", body: "About your session, the device, or the right intensity." },
      { title: "Follow the video", body: "In the app or on your TV. Finish it and the day is logged." },
    ],
    phonesAlt: ["The TheraHOME app home screen", "The community in the TheraHOME app"],
    howTitle: "Get started in 4 steps",
    howIntro: "",
    steps: [
      { title: "Sign in", body: "With Google, Apple or email." },
      { title: "Activate your device", body: "Enter the phone or email from your order. No code needed." },
      { title: "Train daily", body: "One video a day, with a reminder when you choose." },
      { title: "Check in after each phase", body: "A few short questions so TheraHOME can follow your progress." },
    ],
    insideTitle: "What's in the app",
    insideIntro: "",
    features: [
      { title: "Phased roadmap", body: "Progress saves after every session." },
      { title: "Guided videos", body: "A new video each day." },
      { title: "AI assistant", body: "Instant answers, any time." },
      { title: "Reminders", body: "Pick morning or evening; the app reminds you." },
      { title: "Community", body: "Share your journey and pick up tips." },
      { title: "Support", body: "Message us and a TheraHOME person replies." },
    ],
    faqTitle: "Questions",
    faq: [
      { q: "Is the app free?", a: "Yes. Your roadmap opens once you activate it with your TheraHOME order details." },
      { q: "What is the TheraHOME device?", a: "TheraNECK/TheraBACK are home muscle-relaxation and training aids, not medical devices. They do not measure health metrics and do not sync data with the app; the app provides the workout videos that accompany the device." },
      { q: "Does the app replace a doctor?", a: "No. TheraHOME is a fitness and wellness app; it does not provide medical diagnosis or treatment." },
      { q: "How do I unlock the next day?", a: "Days unlock automatically over time: one new day opens at midnight. Watch the workout video to record that day as completed." },
      { q: "Which phones does it run on?", a: "iPhone and Android. One account works on both, and progress stays in sync." },
      { q: "I forgot my password. What now?", a: "Tap Forgot password on the sign-in screen and enter your email; TheraHOME sends a code to reset it." },
    ],
    startLabel: "Download the app to get started",
    nav: { how: "How it works", features: "Features", screens: "Screens", device: "Device" },
    stats: [
      { value: "14 days", label: "per roadmap" },
      { value: "15–20 min", label: "per session" },
      { value: "24/7", label: "AI assistant" },
      { value: "3", label: "languages" },
    ],
    galleryTitle: "See the app",
    galleryIntro: "Swipe through the screens.",
    galleryNav: { prev: "Previous screen", next: "Next screen", dot: "Show screen {n}" },
    galleryAlts: ["Home screen", "14-day roadmap", "Video session", "Community", "Follow the video", "AI assistant", "Support from TheraHOME"],
    deviceTitle: "Made for TheraNECK+",
    deviceBody: "The app provides the workout videos that accompany the device. TheraNECK+ is a home muscle-relaxation and training aid, not a medical device.",
    deviceLink: "See the device",
    deviceAlt: "The TheraNECK+ device",
    trustTitle: "Use it with confidence",
    reviewsTitle: "What customers say",
    starsLabel: "{n} out of 5 stars",
    trust: [
      { title: "Your data is protected", body: "See how TheraHOME collects and handles it.", href: "/privacy" },
      { title: "Delete your account any time", body: "Right in the app, under Profile.", href: "/account-deletion" },
      { title: "Three languages", body: "Tiếng Việt, English and Bahasa Melayu." },
    ],
    about: "About TheraHOME",
    ctaTitle: "Get TheraHOME",
    ctaBody: "Activate your device and do your first session today.",
    qrLabel: "Scan with your phone camera to download",
    qrAlt: "QR code to download the TheraHOME app",
    prompt: {
      title: "Get the TheraHOME app",
      body: "Follow your roadmap every day, right on your phone.",
      featuresTitle: "In the app:",
      features: ["A guided video for every session", "An AI assistant that answers instantly", "Daily training reminders"],
      dontShow: "Don't show again",
      close: "Close",
    },
  },
  ms: {
    download: "Muat turun",
    language: "Bahasa",
    headlineLead: "Latih leher dan bahu setiap hari bersama",
    headlineBrand: "TheraHOME",
    intro: "Pelan harian, video berpandu dan pasukan sokongan bila perlu. Untuk peranti TheraHOME anda.",
    highlights: [
      { title: "Tahu latihan hari ini", body: "Satu sesi 15–20 minit sehari. Hari baharu dibuka pada tengah malam." },
      { title: "Tanya AI bila-bila masa", body: "Tentang sesi, peranti atau intensiti yang sesuai." },
      { title: "Ikut video", body: "Dalam aplikasi atau di TV. Selesai menonton, hari itu direkodkan." },
    ],
    phonesAlt: ["Skrin utama aplikasi TheraHOME", "Komuniti dalam aplikasi TheraHOME"],
    howTitle: "Mula dalam 4 langkah",
    howIntro: "",
    steps: [
      { title: "Log masuk", body: "Dengan Google, Apple atau e-mel." },
      { title: "Aktifkan peranti", body: "Masukkan telefon atau e-mel pesanan anda. Tiada kod diperlukan." },
      { title: "Berlatih setiap hari", body: "Satu video sehari, dengan peringatan pada waktu pilihan anda." },
      { title: "Penilaian setiap fasa", body: "Beberapa soalan ringkas supaya TheraHOME dapat mengikuti kemajuan anda." },
    ],
    insideTitle: "Apa ada dalam aplikasi",
    insideIntro: "",
    features: [
      { title: "Pelan mengikut fasa", body: "Kemajuan disimpan selepas setiap sesi." },
      { title: "Video berpandu", body: "Video baharu setiap hari." },
      { title: "Pembantu AI", body: "Jawapan segera, bila-bila masa." },
      { title: "Peringatan", body: "Pilih pagi atau malam; aplikasi akan mengingatkan anda." },
      { title: "Komuniti", body: "Kongsi perjalanan dan dapatkan petua." },
      { title: "Sokongan", body: "Hantar mesej dan pasukan TheraHOME akan membalas." },
    ],
    faqTitle: "Soalan lazim",
    faq: [
      { q: "Adakah aplikasi ini percuma?", a: "Ya. Pelan anda dibuka selepas diaktifkan dengan butiran pesanan TheraHOME anda." },
      { q: "Apakah peranti TheraHOME?", a: "TheraNECK/TheraBACK ialah alat bantu relaksasi otot dan latihan di rumah, bukan peranti perubatan. Ia tidak mengukur metrik kesihatan dan tidak menyegerakkan data dengan aplikasi; aplikasi menyediakan video latihan yang mengiringi peranti." },
      { q: "Adakah aplikasi ini menggantikan doktor?", a: "Tidak. TheraHOME ialah aplikasi kecergasan dan kesejahteraan; ia tidak menyediakan diagnosis atau rawatan perubatan." },
      { q: "Bagaimana saya membuka hari seterusnya?", a: "Hari dalam pelan dibuka secara automatik mengikut masa: satu hari baharu dibuka pada tengah malam. Tonton video latihan untuk merekodkan hari itu sebagai selesai." },
      { q: "Telefon apa yang disokong?", a: "iPhone dan Android. Satu akaun untuk kedua-duanya, kemajuan sentiasa diselaraskan." },
      { q: "Saya lupa kata laluan. Bagaimana?", a: "Ketik Lupa kata laluan di skrin log masuk dan masukkan e-mel anda; TheraHOME akan menghantar kod untuk menetapkannya semula." },
    ],
    startLabel: "Muat turun aplikasi untuk bermula",
    nav: { how: "Cara guna", features: "Ciri", screens: "Skrin", device: "Peranti" },
    stats: [
      { value: "14 hari", label: "setiap pelan" },
      { value: "15–20 min", label: "setiap sesi" },
      { value: "24/7", label: "pembantu AI" },
      { value: "3", label: "bahasa" },
    ],
    galleryTitle: "Lihat aplikasi",
    galleryIntro: "Leret untuk melihat setiap skrin.",
    galleryNav: { prev: "Skrin sebelumnya", next: "Skrin seterusnya", dot: "Tunjuk skrin {n}" },
    galleryAlts: ["Skrin utama", "Pelan 14 hari", "Sesi video", "Komuniti", "Ikut video", "Pembantu AI", "Sokongan TheraHOME"],
    deviceTitle: "Untuk peranti TheraNECK+",
    deviceBody: "Aplikasi menyediakan video latihan yang mengiringi peranti. TheraNECK+ ialah alat bantu relaksasi otot dan latihan di rumah, bukan peranti perubatan.",
    deviceLink: "Lihat peranti",
    deviceAlt: "Peranti TheraNECK+",
    trustTitle: "Guna dengan yakin",
    reviewsTitle: "Kata pelanggan",
    starsLabel: "{n} daripada 5 bintang",
    trust: [
      { title: "Data anda dilindungi", body: "Lihat cara TheraHOME mengumpul dan mengendalikannya.", href: "/privacy" },
      { title: "Padam akaun bila-bila masa", body: "Terus dalam aplikasi, di bahagian Profil.", href: "/account-deletion" },
      { title: "Tiga bahasa", body: "Tiếng Việt, English dan Bahasa Melayu." },
    ],
    about: "Tentang TheraHOME",
    ctaTitle: "Dapatkan TheraHOME",
    ctaBody: "Aktifkan peranti anda dan mulakan sesi pertama hari ini.",
    qrLabel: "Imbas dengan kamera telefon untuk muat turun",
    qrAlt: "Kod QR untuk memuat turun aplikasi TheraHOME",
    prompt: {
      title: "Dapatkan aplikasi TheraHOME",
      body: "Ikuti pelan anda setiap hari, terus di telefon.",
      featuresTitle: "Dalam aplikasi:",
      features: ["Video berpandu untuk setiap sesi", "Pembantu AI yang menjawab segera", "Peringatan latihan harian"],
      dontShow: "Jangan tunjuk lagi",
      close: "Tutup",
    },
  },
};

// Line icons for the three hero points, drawn on a 24-unit grid.
const ICONS: ReactNode[] = [
  <path key="roadmap" d="M4 6h10M4 12h16M4 18h7M17 4l3 2-3 2M14 16l3 2-3 2" />,
  <path key="ai" d="M5 5h14v10H9l-4 4V5zM9 10h.01M12 10h.01M15 10h.01" />,
  <path key="video" d="M4 6h11v12H4zM15 10l5-3v10l-5-3" />,
];

function Icon({ index }: { index: number }) {
  return (
    <span className="al-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {ICONS[index]}
      </svg>
    </span>
  );
}

function DownloadGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}

export default async function AppLandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const language = await resolveLegalLanguage(searchParams);
  const copy = COPY[language];
  const { app_links, app_reviews } = await getSiteContent();
  // Published only with the customer's consent and actual words.
  const reviews = app_reviews.filter((r) => r.consent && r.quote.trim());

  return (
    <div className={`app-landing ${brandFont.variable}`} lang={language}>
      <header className="al-header">
        <div className="al-wrap">
          <a className="al-brand" href={`/app?lang=${language}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo.png" alt="" width={36} height={36} />
            <span className="al-wordmark">Thera<b>HOME</b></span>
          </a>
          <nav className="al-nav" aria-label="TheraHOME">
            <a href="#cach-dung">{copy.nav.how}</a>
            <a href="#tinh-nang">{copy.nav.features}</a>
            <a href="#xem-truoc">{copy.nav.screens}</a>
            <a href="#thiet-bi">{copy.nav.device}</a>
          </nav>
          <details className="al-lang">
            <summary aria-label={copy.language}>
              <Flag code={language} />
              <svg className="al-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <nav className="al-lang-menu" aria-label={copy.language}>
              {LEGAL_LANGUAGES.map((entry) =>
                entry.code === language ? (
                  <span key={entry.code} aria-current="true">
                    <Flag code={entry.code} />
                    {entry.label}
                  </span>
                ) : (
                  <a key={entry.code} href={`?lang=${entry.code}`} hrefLang={entry.code}>
                    <Flag code={entry.code} />
                    {entry.label}
                  </a>
                ),
              )}
            </nav>
          </details>
          <a className="al-download" href="#tai-app">
            <DownloadGlyph />
            {copy.download}
          </a>
        </div>
      </header>

      <section className="al-hero">
        <div className="al-wrap al-hero-grid">
          <div className="al-hero-copy al-enter">
            <h1>
              {copy.headlineLead} <em>{copy.headlineBrand}</em>
            </h1>
            <p className="al-lede">{copy.intro}</p>

            <p className="al-start">{copy.startLabel}</p>
            <StoreBadges links={app_links} language={language} />
            <a className="al-signin" href={ABOUT_URL} target="_blank" rel="noopener">
              {copy.about}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>

            <ul className="al-points">
              {copy.highlights.map((item, i) => (
                <li key={item.title}>
                  <Icon index={i} />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="al-stage al-enter-late">
            <div className="al-phones">
              {/* The owner's two App Store panels, whole: they are the brand's
                  own artwork and already frame the app screens. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="al-phone" src="/landing/app-page/home.webp" alt={copy.phonesAlt[0]} width={853} height={1844} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="al-phone is-back" src="/landing/app-page/community.webp" alt={copy.phonesAlt[1]} width={853} height={1844} />
            </div>
          </div>
        </div>
      </section>

      <section className="al-stats">
        <div className="al-wrap">
          <dl className="al-stats-row">
            {copy.stats.map((st, i) => (
              <div key={st.label} data-reveal data-reveal-delay={i * 80}>
                <dt>{st.label}</dt>
                <dd>{st.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="al-section is-tint" id="cach-dung">
        <div className="al-wrap">
          <div className="al-section-head" data-reveal>
            <h2>{copy.howTitle}</h2>
            {copy.howIntro ? <p>{copy.howIntro}</p> : null}
          </div>
          <ol className="al-steps">
            {copy.steps.map((step, i) => (
              <li className="al-step" key={step.title} data-reveal data-reveal-delay={i * 90}>
                <span className="al-step-num" aria-hidden="true">{i + 1}</span>
                <div className="al-step-card">
                  <Illustration kind={STEP_ILLOS[i]} />
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="al-section" id="tinh-nang">
        <div className="al-wrap">
          <div className="al-section-head" data-reveal>
            <h2>{copy.insideTitle}</h2>
            {copy.insideIntro ? <p>{copy.insideIntro}</p> : null}
          </div>
          <div className="al-grid">
            {copy.features.map((item, i) => (
              <div className="al-feature" key={item.title} data-reveal data-reveal-delay={(i % 3) * 90}>
                <div className="al-window-bar" aria-hidden="true"><i /><i /><i /></div>
                <Illustration kind={FEATURE_ILLOS[i]} />
                <div className="al-feature-text">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="al-section is-tint al-gallery-section" id="xem-truoc">
        <div className="al-wrap">
          <div className="al-section-head" data-reveal>
            <h2>{copy.galleryTitle}</h2>
            <p>{copy.galleryIntro}</p>
          </div>
        </div>
        <div data-reveal>
          <AppGallery
            images={GALLERY.map((name, i) => ({ src: `/landing/app-page/${name}.webp`, alt: copy.galleryAlts[i] }))}
            prevLabel={copy.galleryNav.prev}
            nextLabel={copy.galleryNav.next}
            dotLabel={copy.galleryNav.dot}
          />
        </div>
      </section>

      <section className="al-section" id="thiet-bi">
        <div className="al-wrap al-device">
          <div className="al-device-art" data-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/combo/may.webp" alt={copy.deviceAlt} loading="lazy" />
          </div>
          <div className="al-device-copy" data-reveal data-reveal-delay={120}>
            <h2>{copy.deviceTitle}</h2>
            <p>{copy.deviceBody}</p>
            <a className="al-link" href={PRODUCT_URL} target="_blank" rel="noopener">
              {copy.deviceLink}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          </div>
        </div>

        <div className="al-wrap al-trust">
          <h2 className="al-trust-title" data-reveal>{copy.trustTitle}</h2>
          <div className="al-trust-row">
            {copy.trust.map((item, i) => {
              const inner = (
                <>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </>
              );
              return item.href ? (
                <a key={item.title} className="al-trust-card" href={`${item.href}?lang=${language}`} data-reveal data-reveal-delay={i * 90}>{inner}</a>
              ) : (
                <div key={item.title} className="al-trust-card" data-reveal data-reveal-delay={i * 90}>{inner}</div>
              );
            })}
          </div>
        </div>
      </section>

      {reviews.length ? (
        <section className="al-section">
          <div className="al-wrap">
            <div className="al-section-head" data-reveal>
              <h2>{copy.reviewsTitle}</h2>
            </div>
            <div className="al-reviews">
              {reviews.map((r, i) => {
                const stars = Math.min(5, Math.max(1, Math.round(r.stars || 5)));
                return (
                  <figure className="al-review" key={`${r.name}-${i}`} data-reveal data-reveal-delay={(i % 3) * 90}>
                    <div className="al-stars" role="img" aria-label={copy.starsLabel.replace("{n}", String(stars))}>
                      {Array.from({ length: 5 }, (_, k) => (
                        <svg key={k} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={k < stars ? "on" : ""}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>
                      ))}
                    </div>
                    <blockquote>{r.quote}</blockquote>
                    <figcaption>
                      <span className="al-avatar" aria-hidden="true">{(r.name.trim()[0] ?? "•").toUpperCase()}</span>
                      <span><strong>{r.name}</strong>{r.detail ? <small>{r.detail}</small> : null}</span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="al-section is-tint" id="hoi-dap">
        <div className="al-wrap">
          <div className="al-section-head" data-reveal>
            <h2>{copy.faqTitle}</h2>
          </div>
          <div className="al-faq">
            {copy.faq.map((item) => (
              <details key={item.q} data-reveal>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="al-section" id="tai-app">
        <div className="al-wrap">
          <div className="al-cta" data-reveal>
            <div className="al-cta-body">
              <div>
                <h2>{copy.ctaTitle}</h2>
                <p>{copy.ctaBody}</p>
                <StoreBadges links={app_links} language={language} />
              </div>
              {/* Encodes /app/tai, which sends each scan to the right store —
                  see app/app/tai/route.ts. Desktop only: on a phone the
                  visitor is already holding the device the code would open. */}
              <figure className="al-qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/app-page/qr-tai-app.svg" alt={copy.qrAlt} width={148} height={148} loading="lazy" />
                <figcaption>{copy.qrLabel}</figcaption>
              </figure>
            </div>
          </div>
          <LegalFooter language={language} />
        </div>
      </section>

      <DownloadPrompt {...copy.prompt}>
        <StoreBadges links={app_links} language={language} />
      </DownloadPrompt>

      <Reveal />
      <LangMenuCloser />

      <div className="al-stickybar">
        <StoreBadges links={app_links} language={language} />
      </div>
    </div>
  );
}
