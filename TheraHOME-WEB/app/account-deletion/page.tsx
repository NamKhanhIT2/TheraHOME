import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalPage";
import type { LegalLanguage } from "@/lib/appLegalContent";
import { resolveLegalLanguage } from "@/lib/legalLanguage";

export const metadata: Metadata = {
  title: "Xoá tài khoản · Delete account · TheraHOME",
  description:
    "Cách xoá tài khoản TheraHOME và dữ liệu liên quan — tự xoá trong ứng dụng hoặc gửi yêu cầu qua email.",
};

/** Google Play requires a publicly reachable URL describing how to request
 * account + data deletion (an in-app delete button alone is not enough), and
 * that URL must name the app, the developer, what is deleted, what is kept
 * and for how long. Linked from the Play Console listing ("Data deletion")
 * and from the footer of /privacy and /terms. Kept consistent with the real
 * `delete_account()` RPC — see TheraHOME-APP/docs/backend.md.
 *
 * All three of the app's languages live here because Play takes ONE deletion
 * URL for the whole app: a reviewer for the UK or Malaysian listing opens the
 * same address as a Vietnamese customer, and until now found only Vietnamese.
 * The Vietnamese wording is the legally authoritative one; the other two are
 * translations of it and must be updated together. */

const SUPPORT_EMAIL = "support@therahomeai.com";
const PACKAGE_NAME = "ai.therahome";
const COMPANY = "Công ty H-COMMERCE GLOBAL COMPANY LIMITED";

interface DeletionCopy {
  title: string;
  intro: string;
  inAppHeading: string;
  inAppSteps: string[];
  inAppNote: string;
  emailHeading: string;
  emailSubject: string;
  emailBody: string;
  deletedHeading: string;
  deleted: string[];
  keptHeading: string;
  kept: { lead: string; rest: string }[];
  moreHeading: string;
  moreBody: string;
  privacyLabel: string;
}

/** `{token}` is replaced by a node, `**text**` renders bold — so a translator
 * can move the app name or the email link wherever the sentence needs it.
 *
 * Recurses into a bold run so a token nested inside one still resolves: every
 * language here writes the email subject as **“{subject}”**, and a flat pass
 * printed that placeholder to the page verbatim. */
function render(text: string, nodes: Record<string, ReactNode> = {}): ReactNode[] {
  return text
    .split(/(\{[a-zA-Z]+\}|\*\*[^*]*\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("{") && part.endsWith("}")) {
        return <Fragment key={index}>{nodes[part.slice(1, -1)] ?? part}</Fragment>;
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{render(part.slice(2, -2), nodes)}</strong>;
      }
      return <Fragment key={index}>{part}</Fragment>;
    });
}

const COPY: Record<LegalLanguage, DeletionCopy> = {
  vi: {
    title: "Yêu cầu xoá tài khoản và dữ liệu",
    intro:
      "Trang này áp dụng cho ứng dụng **TheraHOME** (mã ứng dụng {code}), do **{company}** phát hành. Bạn có thể xoá tài khoản TheraHOME và dữ liệu cá nhân gắn với tài khoản đó theo một trong hai cách dưới đây.",
    inAppHeading: "Cách 1 — Tự xoá ngay trong ứng dụng",
    inAppSteps: [
      "Mở ứng dụng TheraHOME và đăng nhập.",
      "Vào tab **Hồ sơ**.",
      "Cuộn xuống cuối trang, chọn **Xoá tài khoản**.",
      "Đọc thông báo xác nhận và bấm **Xoá**.",
    ],
    inAppNote:
      "Việc xoá được thực hiện ngay lập tức và không thể hoàn tác. Bạn sẽ được đăng xuất khỏi ứng dụng sau khi hoàn tất.",
    emailHeading: "Cách 2 — Gửi yêu cầu qua email",
    emailSubject: "Yêu cầu xoá tài khoản",
    emailBody:
      "Nếu bạn không còn truy cập được ứng dụng, gửi email tới {email} với tiêu đề **“{subject}”**, kèm địa chỉ email hoặc số điện thoại đã dùng để đăng ký. Chúng tôi có thể hỏi thêm thông tin để xác minh bạn là chủ tài khoản, và sẽ xử lý yêu cầu trong vòng **30 ngày** kể từ khi xác minh xong.",
    deletedHeading: "Dữ liệu bị xoá vĩnh viễn",
    deleted: [
      "Lộ trình tập đã kích hoạt, tiến độ từng ngày và nhật ký mức độ khó chịu (0–10).",
      "Nhật ký uống nước.",
      "Hộp thông báo trong ứng dụng và mã thiết bị dùng để gửi thông báo đẩy.",
      "Thông tin cá nhân trong hồ sơ (họ tên, ảnh đại diện, số điện thoại, email liên hệ) được xoá hoặc ẩn danh hoá.",
    ],
    keptHeading: "Dữ liệu được giữ lại và lý do",
    kept: [
      {
        lead: "Bài viết và bình luận trong mục Cộng đồng",
        rest: " không bị xoá mà được ẩn danh hoá (tên tác giả hiển thị thành “Người dùng đã xoá”), để không làm mất các chuỗi thảo luận mà người dùng khác đã tham gia. Nếu muốn xoá hẳn nội dung này, hãy tự xoá từng bài viết/bình luận trong ứng dụng trước khi xoá tài khoản, hoặc nêu rõ yêu cầu trong email ở Cách 2.",
      },
      {
        lead: "Chứng từ giao dịch, hoá đơn mua hàng",
        rest: " (nếu có) được lưu theo thời hạn pháp luật về kế toán, thuế bắt buộc, sau đó sẽ được xoá.",
      },
      {
        lead: "Bản sao lưu hệ thống",
        rest: " có thể còn chứa dữ liệu trong tối đa 30 ngày trước khi bị ghi đè theo chu kỳ sao lưu thông thường.",
      },
    ],
    moreHeading: "Câu hỏi khác",
    moreBody:
      "Chi tiết về việc thu thập và xử lý dữ liệu có trong {privacy}. Mọi thắc mắc xin gửi về {email}.",
    privacyLabel: "Chính sách quyền riêng tư",
  },

  en: {
    title: "Request account and data deletion",
    intro:
      "This page applies to the **TheraHOME** app (package {code}), published by **{company}**. You can delete your TheraHOME account and the personal data attached to it in either of the two ways below.",
    inAppHeading: "Option 1 — Delete it yourself in the app",
    inAppSteps: [
      "Open the TheraHOME app and sign in.",
      "Go to the **Profile** tab.",
      "Scroll to the bottom and choose **Delete account**.",
      "Read the confirmation and tap **Delete**.",
    ],
    inAppNote:
      "Deletion happens immediately and cannot be undone. You are signed out of the app once it completes.",
    emailHeading: "Option 2 — Ask us by email",
    emailSubject: "Account deletion request",
    emailBody:
      "If you can no longer reach the app, email {email} with the subject **“{subject}”**, including the email address or phone number you registered with. We may ask for more information to confirm you own the account, and will complete the request within **30 days** of confirming it.",
    deletedHeading: "Data that is permanently deleted",
    deleted: [
      "Your activated program, day-by-day progress and discomfort log (0–10).",
      "Your water log.",
      "Your in-app notification inbox and the device token used to send you push notifications.",
      "The personal details in your profile (name, profile photo, phone number, contact email) are deleted or anonymised.",
    ],
    keptHeading: "Data that is kept, and why",
    kept: [
      {
        lead: "Community posts and comments",
        rest: " are not deleted but anonymised — the author shows as “Deleted user” — so that discussions other people took part in are not broken. If you want this content gone entirely, delete each post and comment in the app before deleting your account, or say so in your email under Option 2.",
      },
      {
        lead: "Transaction records and purchase invoices",
        rest: " (if any) are kept for the period accounting and tax law requires, and deleted afterwards.",
      },
      {
        lead: "System backups",
        rest: " may still contain your data for up to 30 days, until they are overwritten on the normal backup cycle.",
      },
    ],
    moreHeading: "Anything else",
    moreBody:
      "How we collect and process data is set out in the {privacy}. For any other question, write to {email}.",
    privacyLabel: "Privacy Policy",
  },

  ms: {
    title: "Permintaan pemadaman akaun dan data",
    intro:
      "Halaman ini terpakai bagi aplikasi **TheraHOME** (pakej {code}), yang diterbitkan oleh **{company}**. Anda boleh memadamkan akaun TheraHOME anda dan data peribadi yang berkaitan dengannya melalui salah satu daripada dua cara di bawah.",
    inAppHeading: "Cara 1 — Padam sendiri di dalam aplikasi",
    inAppSteps: [
      "Buka aplikasi TheraHOME dan log masuk.",
      "Pergi ke tab **Profil**.",
      "Tatal ke bahagian bawah dan pilih **Padam akaun**.",
      "Baca mesej pengesahan dan tekan **Padam**.",
    ],
    inAppNote:
      "Pemadaman berlaku serta-merta dan tidak boleh dibatalkan. Anda akan dilog keluar daripada aplikasi setelah ia selesai.",
    emailHeading: "Cara 2 — Hantar permintaan melalui e-mel",
    emailSubject: "Permintaan pemadaman akaun",
    emailBody:
      "Jika anda tidak lagi boleh mengakses aplikasi, hantar e-mel ke {email} dengan subjek **“{subject}”**, sertakan alamat e-mel atau nombor telefon yang anda gunakan semasa mendaftar. Kami mungkin meminta maklumat tambahan untuk mengesahkan bahawa anda pemilik akaun, dan akan menyelesaikan permintaan dalam masa **30 hari** selepas pengesahan.",
    deletedHeading: "Data yang dipadam secara kekal",
    deleted: [
      "Pelan latihan yang telah diaktifkan, kemajuan harian dan log rasa tidak selesa (0–10).",
      "Log pengambilan air.",
      "Peti masuk pemberitahuan dalam aplikasi dan token peranti yang digunakan untuk menghantar pemberitahuan tolak.",
      "Butiran peribadi dalam profil anda (nama, foto profil, nombor telefon, e-mel hubungan) dipadam atau dijadikan tanpa nama.",
    ],
    keptHeading: "Data yang disimpan, dan sebabnya",
    kept: [
      {
        lead: "Kiriman dan komen dalam Komuniti",
        rest: " tidak dipadam tetapi dijadikan tanpa nama — nama penulis dipaparkan sebagai “Pengguna dipadam” — supaya perbincangan yang disertai orang lain tidak terputus. Jika anda mahu kandungan ini hilang sepenuhnya, padamkan setiap kiriman dan komen di dalam aplikasi sebelum memadam akaun, atau nyatakannya dalam e-mel pada Cara 2.",
      },
      {
        lead: "Rekod transaksi dan invois pembelian",
        rest: " (jika ada) disimpan selama tempoh yang dikehendaki undang-undang perakaunan dan cukai, kemudian dipadam.",
      },
      {
        lead: "Sandaran sistem",
        rest: " mungkin masih mengandungi data anda sehingga 30 hari, sehingga ia ditulis ganti mengikut kitaran sandaran biasa.",
      },
    ],
    moreHeading: "Soalan lain",
    moreBody:
      "Cara kami mengumpul dan memproses data dijelaskan dalam {privacy}. Untuk sebarang soalan lain, e-mel kami di {email}.",
    privacyLabel: "Dasar Privasi",
  },
};

const sectionStyle = { marginTop: 28 } as const;
const h2Style = { fontSize: 19, fontWeight: 700, marginBottom: 8 } as const;
const bodyStyle = { fontSize: 15, color: "var(--text-secondary, #3d4a58)" } as const;
const listStyle = { ...bodyStyle, paddingLeft: 20, margin: "8px 0" } as const;
const linkStyle = { color: "var(--color-primary, #007fd9)" } as const;

export default async function AccountDeletionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const language = await resolveLegalLanguage(searchParams);
  const copy = COPY[language];

  const emailLink = (
    <a href={`mailto:${SUPPORT_EMAIL}`} style={linkStyle}>
      {SUPPORT_EMAIL}
    </a>
  );
  const privacyLink = (
    <a href={`/privacy?lang=${language}`} style={linkStyle}>
      {copy.privacyLabel}
    </a>
  );

  return (
    <LegalShell title={copy.title} language={language}>
      <p style={bodyStyle}>
        {render(copy.intro, { code: <code>{PACKAGE_NAME}</code>, company: COMPANY })}
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>{copy.inAppHeading}</h2>
        <ol style={listStyle}>
          {copy.inAppSteps.map((step, index) => (
            <li key={index}>{render(step)}</li>
          ))}
        </ol>
        <p style={bodyStyle}>{copy.inAppNote}</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>{copy.emailHeading}</h2>
        <p style={bodyStyle}>{render(copy.emailBody, { email: emailLink, subject: copy.emailSubject })}</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>{copy.deletedHeading}</h2>
        <ul style={listStyle}>
          {copy.deleted.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>{copy.keptHeading}</h2>
        <ul style={listStyle}>
          {copy.kept.map((item, index) => (
            <li key={index}>
              <strong>{item.lead}</strong>
              {item.rest}
            </li>
          ))}
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>{copy.moreHeading}</h2>
        <p style={bodyStyle}>{render(copy.moreBody, { privacy: privacyLink, email: emailLink })}</p>
      </section>
    </LegalShell>
  );
}
