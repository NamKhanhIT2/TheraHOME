// PUBLIC WEB COPY of the mobile app's legal documents.
// Source of truth: TheraHOME-APP/src/lib/legalContent.ts — keep the two in
// sync when either changes (App Store Connect points to the /privacy and
// /terms pages rendered from this file).
// Ported verbatim from the Claude Design prototype's `legal-content.js`.
// NOTE: this is explicitly an UNREVIEWED DRAFT per its own header — it contains
// bracketed placeholders (e.g. "Công ty H-COMMERCE GLOBAL COMPANY LIMITED") that must be
// filled in and reviewed by counsel before any App Store / Play Store submission.
// See CLAUDE.md.

// Mirrors the mobile app's support address (TheraHOME-APP/src/lib/mockData.ts).
const supportEmail = 'support@therahomeai.com';

export type LegalDocKey = 'terms' | 'privacy' | 'security' | 'community';

export interface LegalDoc {
  title: string;
  text: string;
}

export const legalContent: Record<LegalDocKey, LegalDoc> = {
  terms: {
    title: 'Điều khoản sử dụng',
    text: `ĐIỀU KHOẢN SỬ DỤNG
Ứng dụng TheraHOME
Cập nhật lần cuối: 20/08/2026
1. Chấp nhận điều khoản
Bằng việc tạo tài khoản hoặc sử dụng ứng dụng TheraHOME ("Ứng dụng") do Công ty H-COMMERCE GLOBAL COMPANY LIMITED ("chúng tôi") cung cấp, bạn xác nhận đã đọc, hiểu và đồng ý bị ràng buộc bởi các Điều khoản sử dụng này cùng Chính sách quyền riêng tư. Nếu không đồng ý, vui lòng không sử dụng Ứng dụng.
2. Đối tượng sử dụng
Ứng dụng dành cho người từ đủ 16 tuổi trở lên. Người dùng dưới 16 tuổi chỉ được sử dụng dưới sự đồng ý và giám sát của cha mẹ/người giám hộ hợp pháp.
3. Miễn trừ trách nhiệm y tế — vui lòng đọc kỹ
Ứng dụng không phải là dịch vụ y tế. Nội dung, bài tập, lộ trình tập luyện và phản hồi từ Trợ lý AI trong TheraHOME chỉ mang tính chất tham khảo, hỗ trợ, không thay thế cho chẩn đoán, tư vấn hoặc điều trị y tế từ bác sĩ, chuyên viên vật lý trị liệu có chuyên môn.
\t• Bạn nên tham khảo ý kiến bác sĩ hoặc chuyên viên trước khi bắt đầu bất kỳ chương trình tập luyện nào, đặc biệt nếu có bệnh lý nền.
\t• Ngừng tập ngay và liên hệ chuyên viên hoặc cơ sở y tế nếu xuất hiện đau nhói bất thường, tê, sưng tăng nhanh hoặc bất kỳ dấu hiệu bất thường nào.
\t• Ứng dụng không phải là dịch vụ cấp cứu. Trong tình huống khẩn cấp, vui lòng gọi ngay số cấp cứu 115 hoặc tới cơ sở y tế gần nhất, không sử dụng Ứng dụng để thay thế.
\t• Nội dung do Trợ lý AI tạo ra có thể không chính xác hoặc không đầy đủ; đây là công cụ hỗ trợ tham khảo, không phải lời khuyên y tế chuyên môn.
4. Tài khoản người dùng
Bạn chịu trách nhiệm cung cấp thông tin chính xác khi đăng ký, bảo mật mật khẩu và mọi hoạt động diễn ra dưới tài khoản của mình. Vui lòng thông báo ngay cho chúng tôi nếu phát hiện truy cập trái phép. Bạn có thể xoá tài khoản bất kỳ lúc nào trong mục Hồ sơ → Cài đặt → Xoá tài khoản.
5. Nội dung do người dùng đăng tải (mục Cộng đồng)
Khi đăng bài viết, bình luận, hình ảnh trong mục Cộng đồng, bạn cam kết:
\t• Không đăng thông tin y khoa sai lệch, gây hiểu nhầm hoặc nguy hại cho người khác.
\t• Không đăng nội dung xúc phạm, quấy rối, phân biệt đối xử, spam hoặc quảng cáo trái phép.
\t• Tôn trọng quyền riêng tư của người dùng khác, không chia sẻ thông tin cá nhân của người khác khi chưa được đồng ý.
Chúng tôi có quyền gỡ bỏ nội dung vi phạm hoặc tạm khoá/chấm dứt tài khoản vi phạm mà không cần báo trước. Bạn cấp cho chúng tôi quyền hiển thị nội dung bạn đăng trong phạm vi hoạt động của Ứng dụng; bạn vẫn là chủ sở hữu nội dung của mình và có thể xoá bất kỳ lúc nào.
6. Mua hàng tại Cửa hàng
Cửa hàng trong Ứng dụng bán các sản phẩm vật lý hỗ trợ tập luyện và thư giãn (ví dụ đai chườm, dụng cụ tập luyện). Giá, tình trạng còn hàng, thời gian giao hàng được hiển thị tại thời điểm đặt hàng và có thể thay đổi. Chính sách đổi trả, hoàn tiền tuân theo quy định pháp luật về bảo vệ quyền lợi người tiêu dùng và thương mại điện tử của Việt Nam, được nêu chi tiết tại mục Chính sách đổi trả trong Ứng dụng.
Đây là giao dịch mua bán hàng hoá vật lý, không thuộc phạm vi cơ chế mua hàng trong ứng dụng (In-App Purchase) của Apple.
7. Gói đăng ký / Mua hàng trong ứng dụng (nếu áp dụng)
Nếu Ứng dụng cung cấp gói nâng cấp hoặc nội dung trả phí thông qua cơ chế mua hàng trong ứng dụng của Apple, các gói đăng ký tự động gia hạn (nếu có) sẽ được mô tả rõ ràng trước khi thanh toán, gồm: tên gói, thời hạn, giá (đã bao gồm thuế nếu có), và thời điểm tự động gia hạn.
\t• Thanh toán được trừ vào tài khoản Apple ID của bạn khi xác nhận mua.
\t• Gói tự động gia hạn trừ khi bạn tắt tự động gia hạn ít nhất 24 giờ trước khi kết thúc chu kỳ hiện tại, thực hiện trong Cài đặt tài khoản Apple ID của bạn.
\t• Bạn có thể quản lý hoặc huỷ gói bất kỳ lúc nào trong Cài đặt của thiết bị (Cài đặt → [Tên bạn] → Đăng ký).
\t• Yêu cầu hoàn tiền cho giao dịch qua App Store được xử lý bởi Apple theo chính sách của Apple, không phải bởi chúng tôi.
8. Sở hữu trí tuệ
Toàn bộ nội dung, thương hiệu, giao diện, mã nguồn của TheraHOME (trừ nội dung do người dùng đăng tải) thuộc quyền sở hữu của Công ty H-COMMERCE GLOBAL COMPANY LIMITED hoặc các bên cấp phép. Bạn không được sao chép, phân phối lại hoặc khai thác thương mại khi chưa có sự cho phép bằng văn bản.
9. Hành vi bị cấm
\t• Sử dụng Ứng dụng cho mục đích trái pháp luật.
\t• Cố gắng truy cập trái phép hệ thống, can thiệp mã nguồn, gây ảnh hưởng tới hoạt động của Ứng dụng.
\t• Mạo danh người khác hoặc cung cấp thông tin sai sự thật khi đăng ký.
\t• Sử dụng công cụ tự động để thu thập dữ liệu từ Ứng dụng khi chưa được phép.
10. Chấm dứt sử dụng
Chúng tôi có quyền tạm ngưng hoặc chấm dứt quyền truy cập của bạn nếu vi phạm Điều khoản này. Bạn có thể ngừng sử dụng và xoá tài khoản bất kỳ lúc nào.
11. Giới hạn trách nhiệm
Trong phạm vi tối đa pháp luật cho phép, Công ty H-COMMERCE GLOBAL COMPANY LIMITED không chịu trách nhiệm đối với thiệt hại gián tiếp, ngẫu nhiên phát sinh từ việc sử dụng hoặc không thể sử dụng Ứng dụng, bao gồm nhưng không giới hạn ở việc tự ý áp dụng bài tập không phù hợp với tình trạng sức khoẻ cá nhân mà không tham khảo ý kiến chuyên môn theo khuyến cáo tại Mục 3.
12. Luật áp dụng và giải quyết tranh chấp
Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Mọi tranh chấp phát sinh sẽ được ưu tiên giải quyết thông qua thương lượng; nếu không đạt được thoả thuận, tranh chấp sẽ được đưa ra cơ quan tài phán có thẩm quyền tại Việt Nam.
13. Thay đổi Điều khoản
Chúng tôi có thể cập nhật Điều khoản này theo thời gian. Việc tiếp tục sử dụng Ứng dụng sau khi thay đổi có hiệu lực đồng nghĩa bạn chấp nhận các thay đổi đó.
14. Liên hệ
\t• Công ty H-COMMERCE GLOBAL COMPANY LIMITED — Tầng 11, toà RoxCenter, số 136 Hồ Tùng Mậu, Phú Diễn, Hà Nội
\t• Email hỗ trợ: support@therahomeai.com`,
  },
  privacy: {
    title: 'Chính sách quyền riêng tư',
    text: `CHÍNH SÁCH QUYỀN RIÊNG TƯ
Ứng dụng TheraHOME
Cập nhật lần cuối: 01/09/2026
1. Giới thiệu
Chính sách này áp dụng cho ứng dụng TheraHOME (sau đây gọi là "Ứng dụng") do Công ty H-COMMERCE GLOBAL COMPANY LIMITED (sau đây gọi là "chúng tôi") phát triển và vận hành, nhằm giải thích chúng tôi thu thập, sử dụng, chia sẻ và bảo vệ dữ liệu cá nhân của bạn như thế nào khi bạn sử dụng Ứng dụng. Khi tạo tài khoản hoặc sử dụng Ứng dụng, bạn đồng ý với các nội dung trong Chính sách này.
TheraHOME là ứng dụng thể dục và chăm sóc sức khoẻ (fitness & wellness) tại nhà, không phải ứng dụng y tế. Vì Ứng dụng xử lý một số dữ liệu bạn tự cung cấp về cảm nhận cơ thể (mức độ khó chịu, tiến độ tập luyện), chúng tôi áp dụng các biện pháp bảo vệ chặt chẽ hơn mức thông thường cho các dữ liệu này, được mô tả xuyên suốt Chính sách.
2. Dữ liệu chúng tôi thu thập
2.1 Dữ liệu bạn cung cấp trực tiếp
\t• Thông tin tài khoản: họ tên, số điện thoại, email, mật khẩu (được mã hoá), ảnh đại diện.
\t• Hồ sơ tập luyện: mức độ khó chịu bạn tự đánh giá theo từng ngày, vùng cơ thể/chương trình tập luyện bạn tham gia, tình trạng hoàn thành bài tập.
\t• Nội dung bạn đăng tải: bài viết, bình luận, ảnh trong mục Cộng đồng, tin nhắn gửi tới Trợ lý AI hoặc đội ngũ hỗ trợ.
\t• Thông tin đơn hàng: sản phẩm đã mua trong Cửa hàng, địa chỉ giao hàng, lịch sử đơn hàng. Thông tin thẻ/thanh toán được xử lý trực tiếp bởi đối tác thanh toán, chúng tôi không lưu trữ số thẻ đầy đủ.
2.2 Dữ liệu thu thập tự động
\t• Dữ liệu sử dụng: tính năng bạn truy cập, thời gian sử dụng, số ngày liên tiếp hoàn thành chương trình.
\t• Dữ liệu thiết bị và nhật ký kỹ thuật: loại thiết bị, hệ điều hành, phiên bản ứng dụng, mã định danh thiết bị, nhật ký lỗi phục vụ khắc phục sự cố.
2.3 Dữ liệu từ bên thứ ba
Nếu bạn đăng nhập bằng tài khoản Apple/Google, chúng tôi nhận một số thông tin cơ bản (tên, email) theo phạm vi bạn cho phép tại thời điểm đăng nhập.
3. Mục đích sử dụng dữ liệu
\t• Tạo và quản lý tài khoản, xác thực đăng nhập.
\t• Xây dựng và cá nhân hoá lộ trình tập luyện, biểu đồ theo dõi mức độ khó chịu và tiến độ.
\t• Xử lý đơn hàng, giao hàng, chăm sóc khách hàng liên quan tới Cửa hàng.
\t• Vận hành mục Cộng đồng, hiển thị nội dung bạn và người dùng khác đăng tải.
\t• Vận hành Trợ lý AI để trả lời câu hỏi liên quan tới chương trình tập luyện (xem chi tiết tại Mục 5.1).
\t• Gửi thông báo nhắc lịch tập, cập nhật đơn hàng, thông tin chương trình (bạn có thể tắt trong Cài đặt).
\t• Phân tích, cải thiện chất lượng Ứng dụng và phát hiện, phòng ngừa gian lận, lỗi kỹ thuật.
\t• Tuân thủ nghĩa vụ pháp lý khi có yêu cầu hợp pháp từ cơ quan nhà nước có thẩm quyền.
4. Cơ sở pháp lý và sự đồng ý
Theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân, việc xử lý dữ liệu cá nhân của bạn dựa trên sự đồng ý của bạn, trừ các trường hợp pháp luật cho phép xử lý mà không cần sự đồng ý (ví dụ để thực hiện nghĩa vụ theo hợp đồng, bảo vệ tính mạng, sức khoẻ cộng đồng, hoặc theo yêu cầu của cơ quan có thẩm quyền). Bạn có quyền rút lại sự đồng ý bất kỳ lúc nào; việc rút lại không ảnh hưởng tới tính hợp pháp của việc xử lý dữ liệu đã thực hiện trước đó.
5. Chia sẻ dữ liệu với bên thứ ba
Chúng tôi không bán dữ liệu cá nhân của bạn. Chúng tôi chỉ chia sẻ dữ liệu trong các trường hợp sau, với phạm vi tối thiểu cần thiết:
\t• Đối tác thanh toán, đơn vị vận chuyển: để xử lý đơn hàng bạn đặt trong Cửa hàng.
\t• Nhà cung cấp hạ tầng lưu trữ đám mây, dịch vụ phân tích: để vận hành và cải thiện Ứng dụng, theo thoả thuận bảo mật dữ liệu.
\t• Nhà cung cấp mô hình AI của Trợ lý AI: xem chi tiết tại Mục 5.1 bên dưới.
\t• Đội ngũ hỗ trợ khách hàng của chúng tôi: khi bạn chủ động nhắn tin hoặc yêu cầu hỗ trợ.
\t• Cơ quan nhà nước có thẩm quyền: khi có yêu cầu hợp pháp theo quy định pháp luật.
5.1 Trợ lý AI — dịch vụ AI của bên thứ ba
Tính năng Trợ lý AI sử dụng dịch vụ mô hình ngôn ngữ của bên thứ ba (hiện tại: Groq, Inc., máy chủ đặt tại Hoa Kỳ) để tạo câu trả lời. Cụ thể:
\t• Dữ liệu được gửi: chỉ nội dung tin nhắn bạn gõ trong cuộc trò chuyện với Trợ lý AI (kèm ngữ cảnh hội thoại gần nhất). Chúng tôi không gửi họ tên, email, số điện thoại, thông tin đơn hàng hay dữ liệu tập luyện của bạn cho nhà cung cấp AI.
\t• Thời điểm gửi: dữ liệu chỉ được gửi khi bạn chủ động nhắn tin trong Trợ lý AI, và chỉ sau khi bạn đã đọc và đồng ý với thông báo hiển thị ở lần đầu mở tính năng này.
\t• Mục đích: duy nhất để tạo câu trả lời cho bạn; không dùng cho quảng cáo; không bán cho bên thứ ba.
\t• Khuyến cáo: không chia sẻ thông tin nhạy cảm (giấy tờ tuỳ thân, tài chính, tình trạng bệnh lý chi tiết) trong cuộc trò chuyện. Câu trả lời của Trợ lý AI chỉ mang tính tham khảo về tập luyện, không phải tư vấn y tế.
Dữ liệu tập luyện và cảm nhận cơ thể của bạn không được chia sẻ cho bất kỳ bên thứ ba nào ngoài mục đích cung cấp dịch vụ cho chính bạn, trừ khi bạn đồng ý rõ ràng cho mục đích khác.
6. Nội dung công khai trong mục Cộng đồng
Bài viết, bình luận, huy hiệu thành tích bạn chia sẻ trong mục Cộng đồng có thể hiển thị công khai với người dùng khác trong Ứng dụng. Vui lòng cân nhắc trước khi chia sẻ thông tin nhạy cảm. Bạn có thể xoá nội dung mình đã đăng bất kỳ lúc nào.
7. Thời gian lưu trữ dữ liệu
Chúng tôi lưu trữ dữ liệu cá nhân trong thời gian tài khoản của bạn còn hoạt động và trong khoảng thời gian cần thiết để phục vụ mục đích thu thập, tuân thủ nghĩa vụ pháp lý (ví dụ chứng từ kế toán, hoá đơn) hoặc giải quyết tranh chấp. Sau khi bạn yêu cầu xoá tài khoản, dữ liệu cá nhân sẽ được xoá hoặc ẩn danh hoá trong thời gian hợp lý, trừ dữ liệu pháp luật bắt buộc phải lưu giữ thêm.
8. Quyền của bạn
Theo quy định pháp luật về bảo vệ dữ liệu cá nhân, bạn có các quyền sau đối với dữ liệu cá nhân của mình:
\t• Quyền được biết về việc xử lý dữ liệu cá nhân của mình.
\t• Quyền truy cập, xem lại dữ liệu cá nhân đã cung cấp.
\t• Quyền yêu cầu chỉnh sửa dữ liệu không chính xác.
\t• Quyền rút lại sự đồng ý.
\t• Quyền yêu cầu xoá dữ liệu cá nhân.
\t• Quyền yêu cầu hạn chế, phản đối việc xử lý dữ liệu.
\t• Quyền khiếu nại, tố cáo, khởi kiện theo quy định pháp luật.
8.1 Cách xoá tài khoản ngay trong Ứng dụng
Bạn có thể tự xoá tài khoản trực tiếp trong Ứng dụng tại: Hồ sơ → Cài đặt → Quản lý tài khoản → Xoá tài khoản, không cần liên hệ bộ phận hỗ trợ. Khi xác nhận xoá, toàn bộ dữ liệu cá nhân gắn với tài khoản sẽ được xoá hoặc ẩn danh hoá theo Mục 7. Nếu gặp khó khăn, bạn có thể liên hệ support@therahomeai.com.
9. Bảo mật dữ liệu
Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ dữ liệu cá nhân khỏi truy cập, sử dụng, tiết lộ trái phép. Chi tiết các biện pháp bảo mật được trình bày trong Chính sách bảo mật thông tin riêng của chúng tôi.
10. Trẻ em
Ứng dụng không hướng tới người dùng dưới 16 tuổi. Nếu bạn dưới 16 tuổi, vui lòng chỉ sử dụng Ứng dụng với sự đồng ý và giám sát của cha mẹ hoặc người giám hộ hợp pháp. Nếu phát hiện đã thu thập dữ liệu cá nhân của trẻ em mà không có sự đồng ý hợp lệ, chúng tôi sẽ xoá dữ liệu đó.
11. Chuyển dữ liệu ra nước ngoài
Trong trường hợp máy chủ lưu trữ hoặc nhà cung cấp dịch vụ của chúng tôi đặt ngoài lãnh thổ Việt Nam, việc chuyển dữ liệu cá nhân ra nước ngoài sẽ được thực hiện theo đúng quy định tại Nghị định 13/2023/NĐ-CP, bao gồm việc lập và lưu giữ hồ sơ đánh giá tác động chuyển dữ liệu ra nước ngoài khi pháp luật yêu cầu.
12. Thay đổi Chính sách
Chúng tôi có thể cập nhật Chính sách này theo thời gian. Khi có thay đổi quan trọng, chúng tôi sẽ thông báo trong Ứng dụng hoặc qua email trước khi thay đổi có hiệu lực.
13. Liên hệ
Nếu có câu hỏi về Chính sách này hoặc muốn thực hiện quyền của mình đối với dữ liệu cá nhân, vui lòng liên hệ:
\t• Công ty H-COMMERCE GLOBAL COMPANY LIMITED
\t• Địa chỉ: Tầng 11, toà RoxCenter, số 136 Hồ Tùng Mậu, Phú Diễn, Hà Nội
\t• Email bảo vệ dữ liệu cá nhân: support@therahomeai.com`,
  },
  security: {
    title: 'Chính sách bảo mật thông tin',
    text: `CHÍNH SÁCH BẢO MẬT THÔNG TIN
Ứng dụng TheraHOME
Cập nhật lần cuối: 01/09/2026
1. Mục tiêu và phạm vi
Chính sách này mô tả các biện pháp kỹ thuật và tổ chức mà Công ty H-COMMERCE GLOBAL COMPANY LIMITED áp dụng để bảo vệ dữ liệu cá nhân, đặc biệt là dữ liệu sức khoẻ, khỏi truy cập, sử dụng, tiết lộ, sửa đổi hoặc phá huỷ trái phép, phù hợp với Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.
2. Biện pháp kỹ thuật
\t• Mã hoá dữ liệu khi truyền tải (HTTPS/TLS) giữa Ứng dụng và máy chủ.
\t• Mã hoá dữ liệu nhạy cảm khi lưu trữ, bao gồm mật khẩu (băm một chiều) và dữ liệu sức khoẻ.
\t• Kiểm soát truy cập theo vai trò (role-based access control): chỉ nhân sự có nhiệm vụ liên quan mới được truy cập dữ liệu sức khoẻ của người dùng.
\t• Xác thực đa yếu tố cho tài khoản quản trị hệ thống nội bộ.
\t• Ghi nhật ký truy cập (access log) để giám sát và phát hiện truy cập bất thường.
\t• Tường lửa ứng dụng web, quét lỗ hổng bảo mật định kỳ.
\t• Sao lưu dữ liệu định kỳ và kiểm tra khả năng khôi phục.
3. Biện pháp tổ chức
\t• Đào tạo nhận thức bảo vệ dữ liệu cá nhân cho toàn bộ nhân sự tiếp cận dữ liệu người dùng.
\t• Nguyên tắc truy cập tối thiểu (least privilege) — mỗi nhân sự chỉ được cấp quyền truy cập cần thiết cho công việc.
\t• Ký thoả thuận bảo mật/xử lý dữ liệu với các bên thứ ba (đối tác thanh toán, lưu trữ đám mây, nhà cung cấp AI) trước khi chia sẻ dữ liệu.
\t• Đánh giá bảo mật và kiểm thử xâm nhập (penetration testing) định kỳ.
\t• Quy trình phê duyệt trước khi triển khai thay đổi hệ thống có ảnh hưởng tới dữ liệu người dùng.
4. Quản lý sự cố và thông báo vi phạm dữ liệu
Khi phát hiện có hành vi vi phạm quy định về bảo vệ dữ liệu cá nhân (ví dụ rò rỉ, truy cập trái phép), chúng tôi thực hiện:
\t• Ngăn chặn, khắc phục sự cố ngay khi phát hiện.
\t• Thông báo cho Cục An ninh mạng và phòng, chống tội phạm sử dụng công nghệ cao (Bộ Công an) chậm nhất 72 giờ sau khi xảy ra hành vi vi phạm, theo đúng quy định tại Nghị định 13/2023/NĐ-CP; trường hợp thông báo chậm hơn sẽ nêu rõ lý do.
\t• Thông báo cho người dùng bị ảnh hưởng về sự cố, các dữ liệu liên quan và biện pháp đã/đang thực hiện, trong thời gian sớm nhất có thể.
\t• Rà soát nguyên nhân và cập nhật biện pháp phòng ngừa sau sự cố.
5. Lưu trữ và xoá dữ liệu an toàn
Dữ liệu được lưu trữ trên hạ tầng có kiểm soát truy cập và mã hoá phù hợp. Khi hết thời hạn lưu trữ hoặc theo yêu cầu xoá tài khoản của người dùng, dữ liệu được xoá hoặc ẩn danh hoá theo quy trình xoá an toàn, đảm bảo không thể khôi phục ngoài mục đích pháp luật yêu cầu lưu giữ.
6. Trách nhiệm của người dùng
Người dùng có trách nhiệm bảo vệ mật khẩu tài khoản, không chia sẻ thông tin đăng nhập, và thông báo ngay cho chúng tôi nếu nghi ngờ tài khoản bị truy cập trái phép.
7. Báo cáo lỗ hổng bảo mật
Nếu bạn phát hiện lỗ hổng bảo mật trong Ứng dụng, vui lòng báo cho chúng tôi qua support@therahomeai.com. Chúng tôi cam kết tiếp nhận, xác minh và xử lý các báo cáo hợp lệ trong thời gian sớm nhất.
8. Rà soát và cập nhật
Chính sách này được rà soát định kỳ và cập nhật khi có thay đổi về hệ thống, quy định pháp luật hoặc yêu cầu từ nền tảng phân phối ứng dụng (Apple App Store, Google Play).`,
  },
  community: {
    title: 'Quy định cộng đồng',
    text: `QUY ĐỊNH CỘNG ĐỒNG
Mục Cộng đồng — Ứng dụng TheraHOME
Cập nhật lần cuối: 01/09/2026
Mục Cộng đồng là nơi các thành viên TheraHOME chia sẻ hành trình tập luyện, động viên lẫn nhau và trao đổi kinh nghiệm. Quy định này áp dụng cho mọi bài viết, bình luận, hình ảnh và tương tác trong mục Cộng đồng, cùng với Điều khoản sử dụng và Chính sách quyền riêng tư.
1. Tinh thần chung
Cộng đồng TheraHOME được xây dựng trên sự tôn trọng và hỗ trợ lẫn nhau giữa những người đang trên hành trình chăm sóc cơ thể. Hãy chia sẻ như bạn muốn được đối xử: chân thành, tích cực và tôn trọng trải nghiệm của người khác.
2. Nên làm
\t• Chia sẻ tiến trình tập luyện, cảm nhận thực tế và những gì hiệu quả với bạn.
\t• Động viên, chúc mừng thành tích của thành viên khác.
\t• Đặt câu hỏi, trao đổi kinh nghiệm một cách xây dựng.
\t• Báo cáo nội dung vi phạm thay vì tự xử lý bằng bình luận gay gắt.
3. Không được phép
\t• Đăng thông tin y khoa sai lệch, gây hiểu nhầm hoặc khuyến khích ngừng điều trị/tự ý dùng thuốc mà không qua tư vấn chuyên môn.
\t• Nội dung xúc phạm, quấy rối, đe doạ, phân biệt đối xử dưới bất kỳ hình thức nào.
\t• Spam, quảng cáo trái phép, liên kết ngoài không liên quan tới tập luyện và chăm sóc sức khoẻ.
\t• Chia sẻ thông tin cá nhân của người khác khi chưa được đồng ý.
\t• Mạo danh người khác, kể cả nhân viên hoặc chuyên viên TheraHOME.
\t• Đăng nội dung phản cảm, bạo lực hoặc không phù hợp với cộng đồng chung.
4. Báo cáo vi phạm
Nếu gặp nội dung vi phạm, nhấn "..." trên bài viết hoặc bình luận đó và chọn "Báo cáo", sau đó chọn lý do phù hợp. Đội ngũ TheraHOME sẽ xem xét và xử lý trong thời gian sớm nhất — bạn không cần đối đầu trực tiếp với người đăng.
5. Hậu quả vi phạm
Tuỳ mức độ vi phạm, chúng tôi có thể:
\t• Ẩn hoặc gỡ bỏ nội dung vi phạm mà không cần báo trước.
\t• Nhắc nhở thành viên vi phạm.
\t• Tạm khoá hoặc chấm dứt quyền truy cập tài khoản đối với vi phạm nghiêm trọng hoặc lặp lại.
Quyết định xử lý là quyết định cuối cùng của đội ngũ quản trị TheraHOME. Nếu bạn cho rằng nội dung của mình bị xử lý nhầm, vui lòng liên hệ đội ngũ hỗ trợ qua mục Chat với đội ngũ TheraHOME hoặc email ${supportEmail}.
6. Nội dung do bạn đăng tải
Bạn vẫn là chủ sở hữu nội dung mình đăng và có thể xoá bất kỳ lúc nào. Bằng việc đăng tải, bạn cấp cho TheraHOME quyền hiển thị nội dung đó trong phạm vi hoạt động của Ứng dụng — chi tiết tại Mục 5, 6 của Chính sách quyền riêng tư.
7. Thay đổi quy định
Chúng tôi có thể cập nhật Quy định cộng đồng theo thời gian để phù hợp với sự phát triển của cộng đồng. Việc tiếp tục sử dụng mục Cộng đồng sau khi thay đổi có hiệu lực đồng nghĩa bạn chấp nhận các thay đổi đó.`,
  },
};
