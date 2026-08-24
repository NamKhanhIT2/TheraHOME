import type { AppLanguage } from '@/store/useAppStore';

export interface OfficialArticle {
  id: string;
  tag: string;
  title: string;
  summary: string;
  body: string[];
  readTimeMinutes: number;
  publishedAt: string;
}

export const TEST_BLOG_ARTICLE_ID = 'therahome-safe-home-recovery';

export const TEST_BLOG_ARTICLE: OfficialArticle = {
  id: TEST_BLOG_ARTICLE_ID,
  tag: 'Hướng dẫn',
  title: '5 nguyên tắc an toàn khi tập phục hồi tại nhà',
  summary: 'Những lưu ý đơn giản giúp bạn tập đúng nhịp, theo dõi cơ thể và duy trì lộ trình an toàn hơn.',
  readTimeMinutes: 4,
  publishedAt: '2026-08-17T08:00:00.000Z',
  body: [
    'Phục hồi tại nhà hiệu quả không đến từ việc tập càng nhiều càng tốt. Điều quan trọng là tập đúng hướng dẫn, đều đặn và biết lắng nghe phản ứng của cơ thể.',
    '1. Xem hết video hướng dẫn trước khi bắt đầu. Chuẩn bị đủ không gian và dụng cụ để không phải dừng giữa buổi tập.',
    '2. Thực hiện chậm và trong biên độ thoải mái. Không cố vượt qua cảm giác đau nhói, tê lan hoặc chóng mặt.',
    '3. Ghi nhận mức độ khó chịu mỗi ngày. Biểu đồ sức khỏe giúp bạn và đội ngũ TheraHOME nhận ra xu hướng thay đổi thay vì chỉ dựa vào cảm giác của một ngày.',
    '4. Nghỉ ngắn khi cần và uống đủ nước. Một buổi tập nhẹ nhưng đúng kỹ thuật vẫn có giá trị cho quá trình phục hồi.',
    '5. Dừng tập và liên hệ chuyên gia nếu triệu chứng tăng rõ rệt, xuất hiện yếu tay chân hoặc cảm giác bất thường kéo dài.',
    'Hãy hoàn thành từng ngày theo đúng thứ tự trong lộ trình. Sự đều đặn và an toàn quan trọng hơn tốc độ.',
  ],
};

const ENGLISH_TEST_BLOG_ARTICLE: OfficialArticle = {
  id: TEST_BLOG_ARTICLE_ID,
  tag: 'Guide',
  title: '5 safety principles for home recovery training',
  summary: 'Simple guidance to help you train at the right pace, monitor your body and maintain a safer recovery routine.',
  readTimeMinutes: 4,
  publishedAt: TEST_BLOG_ARTICLE.publishedAt,
  body: [
    'Effective home recovery is not about exercising as much as possible. What matters is following guidance, staying consistent and listening to your body’s response.',
    '1. Watch the full guidance video before you begin. Prepare enough space and the tools you need so you do not have to stop midway.',
    '2. Move slowly and within a comfortable range. Do not push through sharp pain, spreading numbness or dizziness.',
    '3. Record your discomfort each day. Your health chart helps you and the TheraHOME team notice trends instead of relying on how one day feels.',
    '4. Take short breaks when needed and drink enough water. A gentle session with good technique is still valuable for recovery.',
    '5. Stop and contact a specialist if symptoms noticeably worsen, weakness develops in your arms or legs, or unusual sensations persist.',
    'Complete each day in the intended order. Consistency and safety matter more than speed.',
  ],
};

const MALAY_TEST_BLOG_ARTICLE: OfficialArticle = {
  id: TEST_BLOG_ARTICLE_ID,
  tag: 'Panduan',
  title: '5 prinsip keselamatan untuk latihan pemulihan di rumah',
  summary: 'Panduan ringkas untuk membantu anda berlatih mengikut rentak yang sesuai, memantau tubuh dan mengekalkan pemulihan yang lebih selamat.',
  readTimeMinutes: 4,
  publishedAt: TEST_BLOG_ARTICLE.publishedAt,
  body: [
    'Pemulihan di rumah yang berkesan bukan tentang berlatih sebanyak mungkin. Yang penting ialah mengikut panduan, konsisten dan mendengar tindak balas tubuh anda.',
    '1. Tonton video panduan sehingga habis sebelum bermula. Sediakan ruang dan peralatan yang mencukupi supaya anda tidak perlu berhenti di tengah sesi.',
    '2. Bergerak perlahan dan dalam julat yang selesa. Jangan memaksa diri melalui sakit tajam, kebas yang merebak atau pening.',
    '3. Rekodkan tahap ketidakselesaan setiap hari. Carta kesihatan membantu anda dan pasukan TheraHOME melihat corak perubahan, bukan hanya rasa pada satu hari.',
    '4. Berehat seketika apabila perlu dan minum air secukupnya. Sesi ringan dengan teknik yang betul tetap bernilai untuk pemulihan.',
    '5. Hentikan latihan dan hubungi pakar jika gejala semakin teruk, tangan atau kaki menjadi lemah, atau sensasi luar biasa berterusan.',
    'Selesaikan setiap hari mengikut urutan yang disediakan. Konsistensi dan keselamatan lebih penting daripada kelajuan.',
  ],
};

export const OFFICIAL_ARTICLES: OfficialArticle[] = [TEST_BLOG_ARTICLE];

export function getOfficialArticles(language: AppLanguage): OfficialArticle[] {
  if (language === 'en') return [ENGLISH_TEST_BLOG_ARTICLE];
  if (language === 'ms') return [MALAY_TEST_BLOG_ARTICLE];
  return OFFICIAL_ARTICLES;
}

export function getOfficialArticle(id: string | undefined, language: AppLanguage = 'vi'): OfficialArticle | undefined {
  return getOfficialArticles(language).find((article) => article.id === id);
}
