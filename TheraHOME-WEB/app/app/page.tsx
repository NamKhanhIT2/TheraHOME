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

export const metadata: Metadata = {
  title: "Ứng dụng TheraHOME · TheraHOME app",
  description: "Lộ trình tập cổ vai gáy mỗi ngày với video hướng dẫn, trợ lý AI và đội ngũ hỗ trợ TheraHOME. Tải trên App Store.",
};

// Store links and contact details are edited in Admin; pick edits up within a minute.
export const revalidate = 60;

const FLAGS: Record<LegalLanguage, string> = { vi: "🇻🇳", en: "🇬🇧", ms: "🇲🇾" };

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
}

const COPY: Record<LegalLanguage, Copy> = {
  vi: {
    download: "Tải app",
    language: "Ngôn ngữ",
    headlineLead: "Tập cổ vai gáy mỗi ngày, có lộ trình rõ ràng cùng",
    headlineBrand: "TheraHOME",
    intro: "Ứng dụng đi kèm thiết bị TheraHOME: video hướng dẫn từng buổi, trợ lý AI và đội ngũ hỗ trợ, gọn trong điện thoại của bạn.",
    highlights: [
      { title: "Lộ trình theo từng ngày", body: "Mỗi ngày một buổi 15–20 phút, chia theo giai đoạn. Ngày mới tự mở lúc 0h, nên bạn luôn biết hôm nay tập gì." },
      { title: "Trợ lý AI luôn sẵn sàng", body: "Hỏi về buổi tập, cách dùng thiết bị hay cường độ phù hợp và nhận gợi ý ngay trên điện thoại." },
      { title: "Video hướng dẫn từng buổi", body: "Làm theo video ngay trong app hoặc phát lên TV. Xem xong, buổi tập được ghi nhận hoàn thành." },
    ],
    phonesAlt: ["Màn hình chính ứng dụng TheraHOME", "Lộ trình tập trong ứng dụng TheraHOME"],
    howTitle: "TheraHOME hoạt động thế nào",
    howIntro: "Từ lúc mở hộp thiết bị đến buổi tập đầu tiên chỉ mất vài phút.",
    steps: [
      { title: "Tạo tài khoản", body: "Đăng nhập bằng Google, Apple hoặc email." },
      { title: "Kích hoạt thiết bị", body: "Nhập số điện thoại hoặc email đã dùng khi đặt hàng. Không cần mã kích hoạt." },
      { title: "Tập theo lộ trình", body: "Mỗi ngày một video, kèm lời nhắc vào khung giờ bạn chọn." },
      { title: "Tự đánh giá cuối giai đoạn", body: "Một khảo sát ngắn giúp TheraHOME đồng hành cùng bạn sát hơn." },
    ],
    insideTitle: "Mọi thứ bạn cần để tập đều đặn",
    insideIntro: "Thiết kế cho người bận rộn: mở app là biết hôm nay tập gì.",
    features: [
      { title: "Lộ trình theo giai đoạn", body: "Các ngày tập được sắp theo từng giai đoạn, tiến độ lưu lại sau mỗi buổi." },
      { title: "Video hướng dẫn", body: "Mỗi ngày có video riêng, xem trong app hoặc chiếu lên TV." },
      { title: "Trợ lý AI TheraHOME", body: "Trả lời tức thì, mọi lúc, về buổi tập và cách dùng thiết bị." },
      { title: "Nhắc tập hằng ngày", body: "Chọn giờ sáng hoặc tối, TheraHOME nhắc đúng giờ để bạn không bỏ lỡ." },
      { title: "Cộng đồng", body: "Chia sẻ hành trình, đọc mẹo từ người đi trước và từ đội ngũ TheraHOME." },
      { title: "Đội ngũ hỗ trợ", body: "Nhắn tin về tài khoản, lộ trình, thiết bị hay ứng dụng, có người trả lời." },
    ],
    faqTitle: "Câu hỏi thường gặp",
    faq: [
      { q: "Ứng dụng có miễn phí không?", a: "Có. Bạn tải và dùng ứng dụng miễn phí; lộ trình mở ra sau khi kích hoạt bằng thông tin đặt hàng thiết bị TheraHOME." },
      { q: "Thiết bị TheraHOME là gì?", a: "TheraNECK/TheraBACK là dụng cụ hỗ trợ thư giãn cơ và tập luyện tại nhà, không phải thiết bị y tế. Thiết bị không đo lường chỉ số sức khỏe và không kết nối dữ liệu với ứng dụng; ứng dụng cung cấp video hướng dẫn tập luyện đi kèm thiết bị." },
      { q: "Ứng dụng có thay thế bác sĩ không?", a: "Không. TheraHOME hỗ trợ vận động, không thay thế chẩn đoán hay điều trị y khoa." },
      { q: "Làm sao để mở ngày tập tiếp theo?", a: "Các ngày trong lộ trình tự mở khoá theo thời gian: mỗi ngày mở một ngày mới vào 0h. Xem video bài tập để ghi nhận hoàn thành ngày hôm đó." },
      { q: "Ứng dụng có trên những nền tảng nào?", a: "iPhone (App Store) và Android (Google Play). Một tài khoản dùng được trên cả hai, tiến độ tập luôn được đồng bộ." },
    ],
    ctaTitle: "Sẵn sàng cho buổi tập đầu tiên?",
    ctaBody: "Tải TheraHOME, kích hoạt thiết bị và bắt đầu lộ trình của bạn ngay hôm nay.",
  },
  en: {
    download: "Download",
    language: "Language",
    headlineLead: "Train your neck and shoulders every day, with a clear roadmap from",
    headlineBrand: "TheraHOME",
    intro: "The companion app for your TheraHOME device: a guided video for every session, an AI assistant and a support team, all on your phone.",
    highlights: [
      { title: "A roadmap, day by day", body: "One 15–20 minute session a day, grouped into phases. A new day opens at midnight, so you always know what to do today." },
      { title: "An AI assistant, always ready", body: "Ask about your session, how to use the device or the right intensity, and get suggestions right on your phone." },
      { title: "A video for every session", body: "Follow along in the app or cast it to your TV. Finish the video and the session is recorded as done." },
    ],
    phonesAlt: ["The TheraHOME app home screen", "The training roadmap in the TheraHOME app"],
    howTitle: "How TheraHOME works",
    howIntro: "From opening the box to your first session takes only a few minutes.",
    steps: [
      { title: "Create an account", body: "Sign in with Google, Apple or email." },
      { title: "Activate your device", body: "Enter the phone number or email you used to order. No activation code needed." },
      { title: "Follow your roadmap", body: "One video a day, with a reminder at the time you choose." },
      { title: "Check in after each phase", body: "A short survey helps TheraHOME support you more closely." },
    ],
    insideTitle: "Everything you need to keep training",
    insideIntro: "Built for busy people: open the app and today's session is waiting.",
    features: [
      { title: "A phased roadmap", body: "Training days are arranged in phases, and your progress is saved after every session." },
      { title: "Guided videos", body: "Each day has its own video, in the app or on your TV." },
      { title: "TheraHOME AI Assistant", body: "Instant answers, any time, about your sessions and your device." },
      { title: "Daily reminders", body: "Pick a morning or evening time and TheraHOME reminds you when it comes round." },
      { title: "Community", body: "Share your journey and read tips from others and from the TheraHOME team." },
      { title: "A real support team", body: "Message us about your account, roadmap, device or the app, and a person replies." },
    ],
    faqTitle: "Frequently asked questions",
    faq: [
      { q: "Is the app free?", a: "Yes. The app is free to download and use; your roadmap opens once you activate it with the order details of your TheraHOME device." },
      { q: "What is the TheraHOME device?", a: "TheraNECK/TheraBACK are home muscle-relaxation and training aids, not medical devices. They do not measure health metrics and do not sync data with the app; the app provides the workout videos that accompany the device." },
      { q: "Does the app replace a doctor?", a: "No. TheraHOME is a fitness and wellness app; it does not provide medical diagnosis or treatment." },
      { q: "How do I unlock the next day?", a: "Days unlock automatically over time: one new day opens at midnight. Watch the workout video to record that day as completed." },
      { q: "Which platforms are supported?", a: "iPhone (App Store) and Android (Google Play). One account works on both, and your progress stays in sync." },
    ],
    ctaTitle: "Ready for your first session?",
    ctaBody: "Download TheraHOME, activate your device and start your roadmap today.",
  },
  ms: {
    download: "Muat turun",
    language: "Bahasa",
    headlineLead: "Latih leher dan bahu setiap hari, dengan pelan yang jelas bersama",
    headlineBrand: "TheraHOME",
    intro: "Aplikasi pengiring peranti TheraHOME anda: video berpandu untuk setiap sesi, pembantu AI dan pasukan sokongan, semuanya dalam telefon anda.",
    highlights: [
      { title: "Pelan hari demi hari", body: "Satu sesi 15–20 minit sehari, disusun mengikut fasa. Hari baharu dibuka pada tengah malam, jadi anda sentiasa tahu latihan hari ini." },
      { title: "Pembantu AI sentiasa sedia", body: "Tanya tentang sesi anda, cara menggunakan peranti atau intensiti yang sesuai, dan terima cadangan terus di telefon." },
      { title: "Video untuk setiap sesi", body: "Ikuti dalam aplikasi atau paparkan ke TV. Selesai menonton, sesi itu direkodkan sebagai selesai." },
    ],
    phonesAlt: ["Skrin utama aplikasi TheraHOME", "Pelan latihan dalam aplikasi TheraHOME"],
    howTitle: "Cara TheraHOME berfungsi",
    howIntro: "Dari membuka kotak peranti hingga sesi pertama hanya beberapa minit.",
    steps: [
      { title: "Cipta akaun", body: "Log masuk dengan Google, Apple atau e-mel." },
      { title: "Aktifkan peranti", body: "Masukkan nombor telefon atau e-mel yang digunakan semasa membuat pesanan. Tiada kod pengaktifan diperlukan." },
      { title: "Ikuti pelan anda", body: "Satu video sehari, dengan peringatan pada waktu pilihan anda." },
      { title: "Penilaian selepas setiap fasa", body: "Tinjauan ringkas membantu TheraHOME menyokong anda dengan lebih dekat." },
    ],
    insideTitle: "Semua yang anda perlukan untuk terus berlatih",
    insideIntro: "Direka untuk orang sibuk: buka aplikasi dan sesi hari ini sudah menanti.",
    features: [
      { title: "Pelan mengikut fasa", body: "Hari latihan disusun mengikut fasa, dan kemajuan anda disimpan selepas setiap sesi." },
      { title: "Video berpandu", body: "Setiap hari ada video tersendiri, dalam aplikasi atau di TV anda." },
      { title: "Pembantu AI TheraHOME", body: "Jawapan segera, bila-bila masa, tentang sesi dan peranti anda." },
      { title: "Peringatan harian", body: "Pilih waktu pagi atau malam dan TheraHOME akan mengingatkan anda tepat pada masanya." },
      { title: "Komuniti", body: "Kongsi perjalanan anda dan baca petua daripada orang lain dan pasukan TheraHOME." },
      { title: "Pasukan sokongan sebenar", body: "Hantar mesej tentang akaun, pelan, peranti atau aplikasi, dan seseorang akan membalas." },
    ],
    faqTitle: "Soalan lazim",
    faq: [
      { q: "Adakah aplikasi ini percuma?", a: "Ya. Aplikasi ini percuma untuk dimuat turun dan digunakan; pelan anda dibuka selepas diaktifkan dengan butiran pesanan peranti TheraHOME anda." },
      { q: "Apakah peranti TheraHOME?", a: "TheraNECK/TheraBACK ialah alat bantu relaksasi otot dan latihan di rumah, bukan peranti perubatan. Ia tidak mengukur metrik kesihatan dan tidak menyegerakkan data dengan aplikasi; aplikasi menyediakan video latihan yang mengiringi peranti." },
      { q: "Adakah aplikasi ini menggantikan doktor?", a: "Tidak. TheraHOME ialah aplikasi kecergasan dan kesejahteraan; ia tidak menyediakan diagnosis atau rawatan perubatan." },
      { q: "Bagaimana saya membuka hari seterusnya?", a: "Hari dalam pelan dibuka secara automatik mengikut masa: satu hari baharu dibuka pada tengah malam. Tonton video latihan untuk merekodkan hari itu sebagai selesai." },
      { q: "Platform apakah yang disokong?", a: "iPhone (App Store) dan Android (Google Play). Satu akaun boleh digunakan pada kedua-duanya, dan kemajuan anda sentiasa diselaraskan." },
    ],
    ctaTitle: "Sedia untuk sesi pertama anda?",
    ctaBody: "Muat turun TheraHOME, aktifkan peranti anda dan mulakan pelan anda hari ini.",
  },
};

// Line icons, one per highlight/feature, drawn on a 24-unit grid.
const ICONS: ReactNode[] = [
  <path key="roadmap" d="M4 6h10M4 12h16M4 18h7M17 4l3 2-3 2M14 16l3 2-3 2" />,
  <path key="ai" d="M5 5h14v10H9l-4 4V5zM9 10h.01M12 10h.01M15 10h.01" />,
  <path key="video" d="M4 6h11v12H4zM15 10l5-3v10l-5-3" />,
  <path key="bell" d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 20a2 2 0 0 0 4 0" />,
  <path key="people" d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 14c2 .6 3 2.4 3 5" />,
  <path key="support" d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2v-6h4M4 13h4v6H6a2 2 0 0 1-2-2v-4z" />,
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
  const { app_links } = await getSiteContent();
  // Highlights reuse icons 0–2 (roadmap, AI, video); the feature grid maps
  // roadmap, video, AI, bell, people, support.
  const featureIcons = [0, 2, 1, 3, 4, 5];

  return (
    <div className="app-landing" lang={language}>
      <header className="al-header">
        <div className="al-wrap">
          <a className="al-brand" href={`/app?lang=${language}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo.png" alt="" width={36} height={36} />
            <span>TheraHOME</span>
          </a>
          <details className="al-lang">
            <summary aria-label={copy.language}>
              <span aria-hidden="true">{FLAGS[language]}</span>
              <span className="al-chev" aria-hidden="true">▼</span>
            </summary>
            <nav className="al-lang-menu" aria-label={copy.language}>
              {LEGAL_LANGUAGES.map((entry) =>
                entry.code === language ? (
                  <span key={entry.code} aria-current="true">
                    <span aria-hidden="true">{FLAGS[entry.code]}</span>
                    {entry.label}
                  </span>
                ) : (
                  <a key={entry.code} href={`?lang=${entry.code}`} hrefLang={entry.code}>
                    <span aria-hidden="true">{FLAGS[entry.code]}</span>
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
        <div className="al-wrap">
          <h1>
            {copy.headlineLead} <em>{copy.headlineBrand}</em>
          </h1>
          <p>{copy.intro}</p>

          <div className="al-cards">
            {copy.highlights.map((item, i) => (
              <div className="al-card" key={item.title}>
                <Icon index={i} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="al-stage">
          <div className="al-phones">
            <div className="al-phone">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/app/home.jpg" alt={copy.phonesAlt[0]} width={760} height={1645} />
            </div>
            <div className="al-phone is-back">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/app/roadmap.jpg" alt={copy.phonesAlt[1]} width={760} height={1645} />
            </div>
          </div>
        </div>
      </section>

      <section className="al-section is-tint">
        <div className="al-wrap">
          <div className="al-section-head">
            <h2>{copy.howTitle}</h2>
            <p>{copy.howIntro}</p>
          </div>
          <ol className="al-steps">
            {copy.steps.map((step) => (
              <li className="al-step" key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="al-section">
        <div className="al-wrap">
          <div className="al-section-head">
            <h2>{copy.insideTitle}</h2>
            <p>{copy.insideIntro}</p>
          </div>
          <div className="al-grid">
            {copy.features.map((item, i) => (
              <div className="al-feature" key={item.title}>
                <Icon index={featureIcons[i]} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="al-section is-tint">
        <div className="al-wrap">
          <div className="al-section-head">
            <h2>{copy.faqTitle}</h2>
          </div>
          <div className="al-faq">
            {copy.faq.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="al-section" id="tai-app">
        <div className="al-wrap">
          <div className="al-cta">
            <h2>{copy.ctaTitle}</h2>
            <p>{copy.ctaBody}</p>
            <StoreBadges links={app_links} language={language} />
          </div>
          <LegalFooter language={language} />
        </div>
      </section>

      <div className="al-stickybar">
        <StoreBadges links={app_links} language={language} note={false} />
      </div>
    </div>
  );
}
