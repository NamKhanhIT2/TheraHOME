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

export const metadata: Metadata = {
  title: "Ứng dụng TheraHOME · TheraHOME app",
  description: "Lộ trình tập cổ vai gáy mỗi ngày với video hướng dẫn, trợ lý AI và đội ngũ hỗ trợ TheraHOME. Tải trên App Store.",
};

// Store links and contact details are edited in Admin; pick edits up within a minute.
export const revalidate = 60;

const CODES: Record<LegalLanguage, string> = { vi: "VI", en: "EN", ms: "MS" };

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
    headlineLead: "Tập cổ vai gáy mỗi ngày cùng",
    headlineBrand: "TheraHOME",
    intro: "Lộ trình theo ngày, video hướng dẫn và người hỗ trợ khi cần. Dùng kèm thiết bị TheraHOME.",
    highlights: [
      { title: "Biết hôm nay tập gì", body: "Mỗi ngày một buổi 15–20 phút. Ngày mới mở lúc 0h." },
      { title: "Hỏi AI bất cứ lúc nào", body: "Về buổi tập, cách dùng thiết bị, cường độ phù hợp." },
      { title: "Tập theo video", body: "Xem trong app hoặc phát lên TV. Xem xong là ghi nhận." },
    ],
    phonesAlt: ["Màn hình chính ứng dụng TheraHOME", "Lộ trình tập trong ứng dụng TheraHOME"],
    howTitle: "Bắt đầu trong 4 bước",
    howIntro: "",
    steps: [
      { title: "Đăng nhập", body: "Bằng Google, Apple hoặc email." },
      { title: "Kích hoạt thiết bị", body: "Nhập số điện thoại hoặc email lúc đặt hàng. Không cần mã." },
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
    ],
    ctaTitle: "Tải TheraHOME",
    ctaBody: "Kích hoạt thiết bị và tập buổi đầu tiên ngay hôm nay.",
  },
  en: {
    download: "Download",
    language: "Language",
    headlineLead: "Train your neck and shoulders daily with",
    headlineBrand: "TheraHOME",
    intro: "A day-by-day roadmap, guided videos and real people when you need them. Made for your TheraHOME device.",
    highlights: [
      { title: "Know what to do today", body: "One 15–20 minute session a day. A new day opens at midnight." },
      { title: "Ask the AI any time", body: "About your session, the device, or the right intensity." },
      { title: "Follow the video", body: "In the app or on your TV. Finish it and the day is logged." },
    ],
    phonesAlt: ["The TheraHOME app home screen", "The training roadmap in the TheraHOME app"],
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
    ],
    ctaTitle: "Get TheraHOME",
    ctaBody: "Activate your device and do your first session today.",
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
    phonesAlt: ["Skrin utama aplikasi TheraHOME", "Pelan latihan dalam aplikasi TheraHOME"],
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
    ],
    ctaTitle: "Dapatkan TheraHOME",
    ctaBody: "Aktifkan peranti anda dan mulakan sesi pertama hari ini.",
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
    <div className={`app-landing ${brandFont.variable}`} lang={language}>
      <header className="al-header">
        <div className="al-wrap">
          <a className="al-brand" href={`/app?lang=${language}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo.png" alt="" width={36} height={36} />
            <span className="al-wordmark">Thera<b>HOME</b></span>
          </a>
          <details className="al-lang">
            <summary aria-label={copy.language}>
              <span aria-hidden="true">{CODES[language]}</span>
              <svg className="al-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <nav className="al-lang-menu" aria-label={copy.language}>
              {LEGAL_LANGUAGES.map((entry) =>
                entry.code === language ? (
                  <span key={entry.code} aria-current="true">
                    <span className="al-code" aria-hidden="true">{CODES[entry.code]}</span>
                    {entry.label}
                  </span>
                ) : (
                  <a key={entry.code} href={`?lang=${entry.code}`} hrefLang={entry.code}>
                    <span className="al-code" aria-hidden="true">{CODES[entry.code]}</span>
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
            {copy.howIntro ? <p>{copy.howIntro}</p> : null}
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
            {copy.insideIntro ? <p>{copy.insideIntro}</p> : null}
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
