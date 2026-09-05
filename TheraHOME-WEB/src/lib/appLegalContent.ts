// PUBLIC WEB COPY of the mobile app's legal documents.
// Source of truth: TheraHOME-APP/src/lib/legalContent.ts — keep the two in
// sync when either changes (App Store Connect points to the /privacy and
// /terms pages rendered from this file).
// Ported from the Claude Design prototype's `legal-content.js`.
// Legal entity confirmed by the owner 2026-09-03: "Công ty H-COMMERCE GLOBAL
// COMPANY LIMITED" (no bracketed placeholders remain). The wording itself is
// still AI-drafted, not counsel-reviewed — worth a legal pass before
// App Store / Play Store submission.
//
// LANGUAGES: the Vietnamese (`legalContent`) documents are the original,
// legally-authoritative text. The English (`legalContentEn`) and Malay
// (`legalContentMs`) versions are AI translations of that Vietnamese
// original and have NOT been reviewed by counsel — they need a legal review
// before any release that presents them as binding. The public pages
// (`LegalPage`) still render the Vietnamese original by default; `getLegalDoc()`
// is exported for whenever the web grows a language switcher.

// Mirrors the mobile app's support address (TheraHOME-APP/src/lib/mockData.ts).
const supportEmail = 'support@therahomeai.com';

export type LegalDocKey = 'terms' | 'privacy' | 'security' | 'community';

export interface LegalDoc {
  title: string;
  text: string;
}

export type LegalLanguage = 'vi' | 'en' | 'ms';

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
Bạn có thể tự xoá tài khoản trực tiếp trong Ứng dụng tại: Hồ sơ → Xoá tài khoản (nút ở cuối trang Hồ sơ), không cần liên hệ bộ phận hỗ trợ. Khi xác nhận xoá, toàn bộ dữ liệu cá nhân gắn với tài khoản sẽ được xoá hoặc ẩn danh hoá theo Mục 7. Nếu gặp khó khăn, bạn có thể liên hệ support@therahomeai.com.
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

// ---------------------------------------------------------------------------
// ENGLISH — AI translation of the Vietnamese original above. NOT
// counsel-reviewed; the Vietnamese text is the authoritative version.
// ---------------------------------------------------------------------------

export const legalContentEn: Record<LegalDocKey, LegalDoc> = {
  terms: {
    title: 'Terms of Use',
    text: `TERMS OF USE
TheraHOME App
Last updated: 20/08/2026
1. Acceptance of terms
By creating an account or using the TheraHOME application ("the App") provided by H-COMMERCE GLOBAL COMPANY LIMITED ("we", "us"), you confirm that you have read, understood and agree to be bound by these Terms of Use together with the Privacy Policy. If you do not agree, please do not use the App.
2. Eligibility
The App is intended for users aged 16 and over. Users under 16 may only use the App with the consent and supervision of a parent or legal guardian.
3. Medical disclaimer — please read carefully
The App is not a medical service. The content, exercises, training programs and responses from the AI Assistant in TheraHOME are for reference and support only, and do not replace diagnosis, advice or treatment from a qualified doctor or physiotherapist.
\t• You should consult a doctor or qualified professional before starting any exercise program, especially if you have an underlying medical condition.
\t• Stop exercising immediately and contact a professional or a medical facility if you experience unusual sharp pain, numbness, rapidly increasing swelling or any other abnormal signs.
\t• The App is not an emergency service. In an emergency, call the emergency number 115 (in Vietnam) or go to the nearest medical facility immediately — do not use the App as a substitute.
\t• Content generated by the AI Assistant may be inaccurate or incomplete; it is a reference and support tool, not professional medical advice.
4. User accounts
You are responsible for providing accurate information when registering, for keeping your password secure, and for all activity that takes place under your account. Please notify us immediately if you detect unauthorized access. You can delete your account at any time under Profile → Settings → Delete account.
5. User-generated content (Community section)
When posting articles, comments or images in the Community section, you agree to:
\t• Not post false or misleading medical information, or content that could harm others.
\t• Not post offensive, harassing or discriminatory content, spam or unauthorized advertising.
\t• Respect other users' privacy and not share other people's personal information without their consent.
We reserve the right to remove violating content, or to suspend or terminate violating accounts, without prior notice. You grant us the right to display the content you post within the scope of the App's operation; you remain the owner of your content and may delete it at any time.
6. Purchases in the Store
The Store inside the App sells physical products that support exercise and relaxation (for example therapy wraps and training accessories). Prices, stock availability and delivery times are shown at the time of ordering and may change. Return and refund policies follow Vietnam's consumer-protection and e-commerce laws, as detailed in the Return Policy section in the App.
These are purchases of physical goods and are not covered by Apple's In-App Purchase mechanism.
7. Subscriptions / in-app purchases (if applicable)
If the App offers paid upgrades or paid content through Apple's in-app purchase mechanism, any auto-renewing subscriptions (if offered) will be clearly described before payment, including: package name, duration, price (including tax where applicable), and when auto-renewal occurs.
\t• Payment is charged to your Apple ID account when the purchase is confirmed.
\t• Subscriptions renew automatically unless you turn off auto-renewal at least 24 hours before the end of the current period, in your Apple ID account settings.
\t• You can manage or cancel a subscription at any time in your device Settings (Settings → [Your name] → Subscriptions).
\t• Refund requests for App Store transactions are handled by Apple under Apple's policies, not by us.
8. Intellectual property
All content, trademarks, interfaces and source code of TheraHOME (except user-generated content) are the property of H-COMMERCE GLOBAL COMPANY LIMITED or its licensors. You may not copy, redistribute or commercially exploit them without our prior written permission.
9. Prohibited conduct
\t• Using the App for unlawful purposes.
\t• Attempting to gain unauthorized access to our systems, tampering with source code, or interfering with the App's operation.
\t• Impersonating others or providing false information when registering.
\t• Using automated tools to collect data from the App without permission.
10. Termination
We may suspend or terminate your access if you violate these Terms. You may stop using the App and delete your account at any time.
11. Limitation of liability
To the maximum extent permitted by law, H-COMMERCE GLOBAL COMPANY LIMITED is not liable for indirect or incidental damages arising from the use of, or inability to use, the App, including but not limited to applying exercises unsuited to your personal health condition without seeking professional advice as recommended in Section 3.
12. Governing law and dispute resolution
These Terms are governed by the laws of Vietnam. Any dispute will first be resolved through negotiation; if no agreement is reached, the dispute will be brought before the competent courts of Vietnam.
13. Changes to these Terms
We may update these Terms from time to time. Continuing to use the App after changes take effect means you accept those changes.
14. Contact
\t• H-COMMERCE GLOBAL COMPANY LIMITED — 11th Floor, RoxCenter Building, 136 Ho Tung Mau, Phu Dien, Hanoi, Vietnam
\t• Support email: support@therahomeai.com`,
  },
  privacy: {
    title: 'Privacy Policy',
    text: `PRIVACY POLICY
TheraHOME App
Last updated: 01/09/2026
1. Introduction
This Policy applies to the TheraHOME application ("the App"), developed and operated by H-COMMERCE GLOBAL COMPANY LIMITED ("we", "us"), and explains how we collect, use, share and protect your personal data when you use the App. By creating an account or using the App, you agree to the contents of this Policy.
TheraHOME is a home fitness & wellness app, not a medical app. Because the App processes some data you provide yourself about how your body feels (discomfort levels, training progress), we apply stronger-than-usual safeguards to this data, as described throughout this Policy.
2. Data we collect
2.1 Data you provide directly
\t• Account information: full name, phone number, email, password (encrypted), profile photo.
\t• Training profile: the discomfort level you self-report each day, the body areas/training programs you take part in, and exercise completion status.
\t• Content you post: posts, comments and photos in the Community section, and messages sent to the AI Assistant or the support team.
\t• Order information: products purchased in the Store, delivery address, order history. Card/payment details are processed directly by our payment partners; we do not store full card numbers.
2.2 Data collected automatically
\t• Usage data: the features you access, time spent, and consecutive days completing a program.
\t• Device data and technical logs: device type, operating system, app version, device identifiers, and error logs used for troubleshooting.
2.3 Data from third parties
If you sign in with an Apple/Google account, we receive some basic information (name, email) within the scope you allow at the time of sign-in.
3. How we use your data
\t• To create and manage your account and authenticate sign-in.
\t• To build and personalize your training roadmap and the charts tracking discomfort levels and progress.
\t• To process orders, deliveries and customer care related to the Store.
\t• To operate the Community section and display content posted by you and other users.
\t• To operate the AI Assistant that answers questions about your training program (see Section 5.1 for details).
\t• To send workout reminders, order updates and program information (you can turn these off in Settings).
\t• To analyze and improve the App and to detect and prevent fraud and technical errors.
\t• To comply with legal obligations upon lawful requests from competent state authorities.
4. Legal basis and consent
Under Vietnam's Decree 13/2023/ND-CP on personal data protection, the processing of your personal data is based on your consent, except in cases where the law permits processing without consent (for example to perform contractual obligations, to protect life or public health, or at the request of competent authorities). You may withdraw your consent at any time; withdrawal does not affect the lawfulness of processing carried out before the withdrawal.
5. Sharing data with third parties
We do not sell your personal data. We only share data in the following cases, to the minimum extent necessary:
\t• Payment partners and shipping providers: to process orders you place in the Store.
\t• Cloud hosting and analytics providers: to operate and improve the App, under data-protection agreements.
\t• The AI-model provider behind the AI Assistant: see Section 5.1 below.
\t• Our customer-support team: when you actively message us or request support.
\t• Competent state authorities: upon lawful requests under applicable law.
5.1 AI Assistant — third-party AI service
The AI Assistant feature uses a third-party language-model service (currently: Groq, Inc., with servers located in the United States) to generate responses. Specifically:
\t• Data sent: only the message content you type in the conversation with the AI Assistant (together with the most recent conversation context). We do not send your name, email, phone number, order information or training data to the AI provider.
\t• When it is sent: data is only sent when you actively send a message in the AI Assistant, and only after you have read and agreed to the notice shown the first time you open this feature.
\t• Purpose: solely to generate responses for you; not used for advertising; not sold to third parties.
\t• Recommendation: do not share sensitive information (identity documents, financial details, detailed medical conditions) in the conversation. AI Assistant responses are for training reference only, not medical advice.
Your training data and body-feeling data are not shared with any third party beyond providing the service to you, unless you explicitly consent to another purpose.
6. Public content in the Community section
Posts, comments and achievement badges you share in the Community section may be publicly visible to other users in the App. Please consider carefully before sharing sensitive information. You can delete content you have posted at any time.
7. Data retention
We retain personal data while your account remains active and for as long as necessary for the purposes for which it was collected, to comply with legal obligations (for example accounting records and invoices), or to resolve disputes. After you request account deletion, personal data is deleted or anonymized within a reasonable time, except data the law requires us to retain longer.
8. Your rights
Under personal-data-protection law, you have the following rights over your personal data:
\t• The right to be informed about the processing of your personal data.
\t• The right to access and review the personal data you have provided.
\t• The right to request correction of inaccurate data.
\t• The right to withdraw consent.
\t• The right to request deletion of your personal data.
\t• The right to request restriction of, or to object to, data processing.
\t• The right to complain, report or initiate legal proceedings as provided by law.
8.1 How to delete your account directly in the App
You can delete your account yourself directly in the App at: Profile → Delete account (the button at the bottom of the Profile screen), with no need to contact support. Once you confirm deletion, all personal data linked to the account is deleted or anonymized as described in Section 7. If you run into any difficulty, you can contact support@therahomeai.com.
9. Data security
We apply appropriate technical and organizational measures to protect personal data from unauthorized access, use or disclosure. Details of these measures are set out in our separate Information Security Policy.
10. Children
The App is not directed at users under 16. If you are under 16, please only use the App with the consent and supervision of a parent or legal guardian. If we discover that we have collected a child's personal data without valid consent, we will delete that data.
11. Cross-border data transfers
Where our hosting servers or service providers are located outside Vietnam, transfers of personal data abroad are carried out in accordance with Decree 13/2023/ND-CP, including preparing and maintaining a cross-border data-transfer impact assessment where required by law.
12. Changes to this Policy
We may update this Policy from time to time. When there are significant changes, we will notify you in the App or by email before the changes take effect.
13. Contact
If you have questions about this Policy or wish to exercise your rights over your personal data, please contact:
\t• H-COMMERCE GLOBAL COMPANY LIMITED
\t• Address: 11th Floor, RoxCenter Building, 136 Ho Tung Mau, Phu Dien, Hanoi, Vietnam
\t• Personal-data-protection email: support@therahomeai.com`,
  },
  security: {
    title: 'Information Security Policy',
    text: `INFORMATION SECURITY POLICY
TheraHOME App
Last updated: 01/09/2026
1. Purpose and scope
This Policy describes the technical and organizational measures that H-COMMERCE GLOBAL COMPANY LIMITED applies to protect personal data — especially health-related data — from unauthorized access, use, disclosure, alteration or destruction, in line with Vietnam's Decree 13/2023/ND-CP on personal data protection.
2. Technical measures
\t• Encryption of data in transit (HTTPS/TLS) between the App and our servers.
\t• Encryption of sensitive data at rest, including passwords (one-way hashed) and health-related data.
\t• Role-based access control: only personnel whose duties require it may access users' health-related data.
\t• Multi-factor authentication for internal system administrator accounts.
\t• Access logging to monitor for and detect unusual access.
\t• A web application firewall and periodic vulnerability scanning.
\t• Regular data backups and restore-capability testing.
3. Organizational measures
\t• Personal-data-protection awareness training for all personnel with access to user data.
\t• The principle of least privilege — each staff member is granted only the access needed for their work.
\t• Confidentiality/data-processing agreements signed with third parties (payment partners, cloud hosting, AI providers) before any data is shared.
\t• Periodic security assessments and penetration testing.
\t• An approval process before deploying system changes that affect user data.
4. Incident management and data-breach notification
When a violation of personal-data-protection regulations is detected (for example a leak or unauthorized access), we:
\t• Contain and remediate the incident as soon as it is detected.
\t• Notify the Department of Cybersecurity and High-Tech Crime Prevention (Ministry of Public Security of Vietnam) no later than 72 hours after the violation occurs, as required by Decree 13/2023/ND-CP; if notification is made later, the reasons will be clearly stated.
\t• Notify affected users of the incident, the data involved and the measures taken or being taken, as soon as practicable.
\t• Review the root cause and update preventive measures after the incident.
5. Secure storage and deletion
Data is stored on infrastructure with appropriate access controls and encryption. When the retention period ends, or upon a user's account-deletion request, data is deleted or anonymized through a secure deletion process, ensuring it cannot be recovered except where the law requires retention.
6. User responsibilities
Users are responsible for protecting their account password, not sharing their sign-in credentials, and notifying us immediately if they suspect unauthorized access to their account.
7. Reporting security vulnerabilities
If you discover a security vulnerability in the App, please report it to us at support@therahomeai.com. We are committed to receiving, verifying and handling valid reports as quickly as possible.
8. Review and updates
This Policy is reviewed periodically and updated when there are changes to our systems, to legal regulations, or to requirements from app-distribution platforms (Apple App Store, Google Play).`,
  },
  community: {
    title: 'Community Guidelines',
    text: `COMMUNITY GUIDELINES
Community section — TheraHOME App
Last updated: 01/09/2026
The Community section is where TheraHOME members share their training journeys, encourage one another and exchange experiences. These Guidelines apply to every post, comment, image and interaction in the Community section, together with the Terms of Use and the Privacy Policy.
1. General spirit
The TheraHOME community is built on mutual respect and support among people on a journey of caring for their bodies. Share the way you would like to be treated: sincerely, positively, and with respect for other people's experiences.
2. Do
\t• Share your training progress, honest impressions, and what works for you.
\t• Encourage other members and celebrate their achievements.
\t• Ask questions and exchange experiences constructively.
\t• Report violating content instead of taking matters into your own hands with harsh comments.
3. Not allowed
\t• Posting false or misleading medical information, or encouraging others to stop treatment or self-medicate without professional advice.
\t• Offensive, harassing, threatening or discriminatory content of any kind.
\t• Spam, unauthorized advertising, or external links unrelated to exercise and wellness.
\t• Sharing other people's personal information without their consent.
\t• Impersonating others, including TheraHOME staff or specialists.
\t• Posting graphic, violent or otherwise inappropriate content.
4. Reporting violations
If you come across violating content, tap "..." on that post or comment and choose "Report", then select the appropriate reason. The TheraHOME team will review and handle it as soon as possible — you do not need to confront the poster directly.
5. Consequences of violations
Depending on the severity of the violation, we may:
\t• Hide or remove violating content without prior notice.
\t• Warn the violating member.
\t• Temporarily suspend or terminate account access for serious or repeated violations.
Moderation decisions are final and made by the TheraHOME administration team. If you believe your content was handled in error, please contact the support team via Chat with the TheraHOME team or email ${supportEmail}.
6. Content you post
You remain the owner of the content you post and can delete it at any time. By posting, you grant TheraHOME the right to display that content within the scope of the App's operation — see Sections 5 and 6 of the Privacy Policy for details.
7. Changes to these Guidelines
We may update these Community Guidelines from time to time as the community grows. Continuing to use the Community section after changes take effect means you accept those changes.`,
  },
};

// ---------------------------------------------------------------------------
// MALAY — AI translation of the Vietnamese original above. NOT
// counsel-reviewed; the Vietnamese text is the authoritative version.
// ---------------------------------------------------------------------------

export const legalContentMs: Record<LegalDocKey, LegalDoc> = {
  terms: {
    title: 'Terma Penggunaan',
    text: `TERMA PENGGUNAAN
Aplikasi TheraHOME
Kemas kini terakhir: 20/08/2026
1. Penerimaan terma
Dengan mencipta akaun atau menggunakan aplikasi TheraHOME ("Aplikasi") yang disediakan oleh H-COMMERCE GLOBAL COMPANY LIMITED ("kami"), anda mengesahkan bahawa anda telah membaca, memahami dan bersetuju untuk terikat dengan Terma Penggunaan ini bersama Dasar Privasi. Jika anda tidak bersetuju, sila jangan gunakan Aplikasi.
2. Kelayakan pengguna
Aplikasi ini ditujukan untuk pengguna berumur 16 tahun ke atas. Pengguna bawah 16 tahun hanya boleh menggunakan Aplikasi dengan persetujuan dan pengawasan ibu bapa atau penjaga yang sah.
3. Penafian perubatan — sila baca dengan teliti
Aplikasi ini bukan perkhidmatan perubatan. Kandungan, senaman, program latihan dan respons daripada Pembantu AI dalam TheraHOME hanyalah untuk rujukan dan sokongan, dan tidak menggantikan diagnosis, nasihat atau rawatan perubatan daripada doktor atau ahli fisioterapi bertauliah.
\t• Anda dinasihatkan berunding dengan doktor atau pakar sebelum memulakan sebarang program senaman, terutamanya jika anda mempunyai penyakit sedia ada.
\t• Berhenti bersenam serta-merta dan hubungi pakar atau kemudahan perubatan jika anda mengalami sakit menusuk yang luar biasa, kebas, bengkak yang cepat membesar atau sebarang tanda tidak normal yang lain.
\t• Aplikasi ini bukan perkhidmatan kecemasan. Dalam keadaan kecemasan, sila hubungi nombor kecemasan 115 (di Vietnam) atau pergi ke kemudahan perubatan terdekat dengan segera — jangan gunakan Aplikasi sebagai ganti.
\t• Kandungan yang dijana oleh Pembantu AI mungkin tidak tepat atau tidak lengkap; ia adalah alat rujukan sokongan, bukan nasihat perubatan profesional.
4. Akaun pengguna
Anda bertanggungjawab memberikan maklumat yang tepat semasa mendaftar, menjaga kerahsiaan kata laluan anda, dan atas semua aktiviti yang berlaku di bawah akaun anda. Sila maklumkan kami dengan segera jika anda mengesan capaian tanpa kebenaran. Anda boleh memadam akaun anda pada bila-bila masa di Profil → Tetapan → Padam akaun.
5. Kandungan yang dimuat naik oleh pengguna (bahagian Komuniti)
Apabila menyiarkan kiriman, komen atau imej dalam bahagian Komuniti, anda bersetuju untuk:
\t• Tidak menyiarkan maklumat perubatan yang palsu, mengelirukan atau boleh memudaratkan orang lain.
\t• Tidak menyiarkan kandungan yang menghina, mengganggu, mendiskriminasi, spam atau iklan tanpa kebenaran.
\t• Menghormati privasi pengguna lain dan tidak berkongsi maklumat peribadi orang lain tanpa persetujuan mereka.
Kami berhak mengalih keluar kandungan yang melanggar peraturan, atau menggantung/menamatkan akaun yang melanggar, tanpa notis terlebih dahulu. Anda memberikan kami hak untuk memaparkan kandungan yang anda siarkan dalam skop operasi Aplikasi; anda kekal sebagai pemilik kandungan anda dan boleh memadamnya pada bila-bila masa.
6. Pembelian di Kedai
Kedai dalam Aplikasi menjual produk fizikal yang menyokong senaman dan relaksasi (contohnya pembalut terapi dan alat bantu latihan). Harga, ketersediaan stok dan masa penghantaran dipaparkan pada masa pesanan dibuat dan mungkin berubah. Polisi pemulangan dan bayaran balik mengikut undang-undang perlindungan pengguna dan e-dagang Vietnam, seperti yang diperincikan dalam bahagian Polisi Pemulangan dalam Aplikasi.
Ini ialah transaksi pembelian barangan fizikal dan tidak termasuk dalam mekanisme pembelian dalam aplikasi (In-App Purchase) Apple.
7. Langganan / pembelian dalam aplikasi (jika berkenaan)
Jika Aplikasi menawarkan pakej naik taraf atau kandungan berbayar melalui mekanisme pembelian dalam aplikasi Apple, sebarang langganan pembaharuan automatik (jika ada) akan diterangkan dengan jelas sebelum pembayaran, termasuk: nama pakej, tempoh, harga (termasuk cukai jika berkenaan), dan masa pembaharuan automatik berlaku.
\t• Bayaran dicaj ke akaun Apple ID anda apabila pembelian disahkan.
\t• Langganan diperbaharui secara automatik melainkan anda mematikan pembaharuan automatik sekurang-kurangnya 24 jam sebelum tamat tempoh semasa, melalui tetapan akaun Apple ID anda.
\t• Anda boleh mengurus atau membatalkan langganan pada bila-bila masa dalam Tetapan peranti anda (Tetapan → [Nama anda] → Langganan).
\t• Permohonan bayaran balik untuk transaksi App Store dikendalikan oleh Apple mengikut polisi Apple, bukan oleh kami.
8. Harta intelek
Semua kandungan, jenama, antara muka dan kod sumber TheraHOME (kecuali kandungan yang dimuat naik oleh pengguna) adalah milik H-COMMERCE GLOBAL COMPANY LIMITED atau pemberi lesennya. Anda tidak boleh menyalin, mengedar semula atau mengeksploitasinya secara komersial tanpa kebenaran bertulis kami.
9. Perbuatan yang dilarang
\t• Menggunakan Aplikasi untuk tujuan yang menyalahi undang-undang.
\t• Cuba mengakses sistem tanpa kebenaran, mengganggu kod sumber, atau menjejaskan operasi Aplikasi.
\t• Menyamar sebagai orang lain atau memberikan maklumat palsu semasa mendaftar.
\t• Menggunakan alat automatik untuk mengumpul data daripada Aplikasi tanpa kebenaran.
10. Penamatan penggunaan
Kami berhak menggantung atau menamatkan akses anda jika anda melanggar Terma ini. Anda boleh berhenti menggunakan Aplikasi dan memadam akaun anda pada bila-bila masa.
11. Had liabiliti
Setakat maksimum yang dibenarkan oleh undang-undang, H-COMMERCE GLOBAL COMPANY LIMITED tidak bertanggungjawab atas kerosakan tidak langsung atau sampingan yang timbul daripada penggunaan atau ketidakupayaan menggunakan Aplikasi, termasuk tetapi tidak terhad kepada mengamalkan senaman yang tidak sesuai dengan keadaan kesihatan peribadi anda tanpa mendapatkan nasihat profesional seperti yang disyorkan dalam Seksyen 3.
12. Undang-undang terpakai dan penyelesaian pertikaian
Terma ini ditadbir oleh undang-undang Vietnam. Sebarang pertikaian akan diselesaikan terlebih dahulu melalui rundingan; jika tiada persetujuan dicapai, pertikaian akan dirujuk kepada mahkamah yang berbidang kuasa di Vietnam.
13. Perubahan Terma
Kami mungkin mengemas kini Terma ini dari semasa ke semasa. Penggunaan Aplikasi secara berterusan selepas perubahan berkuat kuasa bermakna anda menerima perubahan tersebut.
14. Hubungi kami
\t• H-COMMERCE GLOBAL COMPANY LIMITED — Tingkat 11, Bangunan RoxCenter, 136 Ho Tung Mau, Phu Dien, Hanoi, Vietnam
\t• E-mel sokongan: support@therahomeai.com`,
  },
  privacy: {
    title: 'Dasar Privasi',
    text: `DASAR PRIVASI
Aplikasi TheraHOME
Kemas kini terakhir: 01/09/2026
1. Pengenalan
Dasar ini terpakai kepada aplikasi TheraHOME ("Aplikasi") yang dibangunkan dan dikendalikan oleh H-COMMERCE GLOBAL COMPANY LIMITED ("kami"), dan menerangkan cara kami mengumpul, menggunakan, berkongsi dan melindungi data peribadi anda apabila anda menggunakan Aplikasi. Dengan mencipta akaun atau menggunakan Aplikasi, anda bersetuju dengan kandungan Dasar ini.
TheraHOME ialah aplikasi kecergasan dan kesejahteraan (fitness & wellness) di rumah, bukan aplikasi perubatan. Oleh kerana Aplikasi memproses sebahagian data yang anda berikan sendiri tentang keadaan badan anda (tahap ketidakselesaan, kemajuan latihan), kami mengenakan langkah perlindungan yang lebih ketat daripada biasa untuk data ini, seperti yang diterangkan di sepanjang Dasar ini.
2. Data yang kami kumpul
2.1 Data yang anda berikan secara langsung
\t• Maklumat akaun: nama penuh, nombor telefon, e-mel, kata laluan (disulitkan), gambar profil.
\t• Profil latihan: tahap ketidakselesaan yang anda nilai sendiri setiap hari, bahagian badan/program latihan yang anda sertai, dan status penyiapan senaman.
\t• Kandungan yang anda siarkan: kiriman, komen dan gambar dalam bahagian Komuniti, serta mesej yang dihantar kepada Pembantu AI atau pasukan sokongan.
\t• Maklumat pesanan: produk yang dibeli di Kedai, alamat penghantaran, sejarah pesanan. Maklumat kad/pembayaran diproses terus oleh rakan pembayaran kami; kami tidak menyimpan nombor kad penuh.
2.2 Data yang dikumpul secara automatik
\t• Data penggunaan: ciri yang anda akses, masa penggunaan, dan bilangan hari berturut-turut menyiapkan program.
\t• Data peranti dan log teknikal: jenis peranti, sistem pengendalian, versi aplikasi, pengecam peranti, dan log ralat untuk penyelesaian masalah.
2.3 Data daripada pihak ketiga
Jika anda log masuk dengan akaun Apple/Google, kami menerima beberapa maklumat asas (nama, e-mel) mengikut skop yang anda benarkan semasa log masuk.
3. Tujuan penggunaan data
\t• Mencipta dan mengurus akaun serta mengesahkan log masuk.
\t• Membina dan memperibadikan pelan latihan anda serta carta penjejakan tahap ketidakselesaan dan kemajuan.
\t• Memproses pesanan, penghantaran dan khidmat pelanggan berkaitan Kedai.
\t• Mengendalikan bahagian Komuniti dan memaparkan kandungan yang disiarkan oleh anda dan pengguna lain.
\t• Mengendalikan Pembantu AI untuk menjawab soalan berkaitan program latihan anda (lihat butiran dalam Seksyen 5.1).
\t• Menghantar peringatan senaman, kemas kini pesanan dan maklumat program (anda boleh mematikannya dalam Tetapan).
\t• Menganalisis dan menambah baik Aplikasi serta mengesan dan mencegah penipuan dan ralat teknikal.
\t• Mematuhi kewajipan undang-undang apabila terdapat permintaan sah daripada pihak berkuasa negara yang berwibawa.
4. Asas undang-undang dan persetujuan
Menurut Dekri 13/2023/ND-CP Vietnam mengenai perlindungan data peribadi, pemprosesan data peribadi anda adalah berdasarkan persetujuan anda, kecuali dalam kes yang dibenarkan oleh undang-undang tanpa persetujuan (contohnya untuk melaksanakan kewajipan kontrak, melindungi nyawa atau kesihatan awam, atau atas permintaan pihak berkuasa yang berwibawa). Anda berhak menarik balik persetujuan pada bila-bila masa; penarikan balik tidak menjejaskan kesahihan pemprosesan data yang telah dilakukan sebelum itu.
5. Perkongsian data dengan pihak ketiga
Kami tidak menjual data peribadi anda. Kami hanya berkongsi data dalam keadaan berikut, dengan skop minimum yang diperlukan:
\t• Rakan pembayaran dan penyedia penghantaran: untuk memproses pesanan yang anda buat di Kedai.
\t• Penyedia infrastruktur storan awan dan perkhidmatan analitik: untuk mengendalikan dan menambah baik Aplikasi, di bawah perjanjian perlindungan data.
\t• Penyedia model AI bagi Pembantu AI: lihat butiran dalam Seksyen 5.1 di bawah.
\t• Pasukan sokongan pelanggan kami: apabila anda menghubungi kami atau meminta bantuan.
\t• Pihak berkuasa negara yang berwibawa: apabila terdapat permintaan sah menurut undang-undang.
5.1 Pembantu AI — perkhidmatan AI pihak ketiga
Ciri Pembantu AI menggunakan perkhidmatan model bahasa pihak ketiga (buat masa ini: Groq, Inc., dengan pelayan di Amerika Syarikat) untuk menjana jawapan. Secara khusus:
\t• Data yang dihantar: hanya kandungan mesej yang anda taip dalam perbualan dengan Pembantu AI (bersama konteks perbualan terkini). Kami tidak menghantar nama, e-mel, nombor telefon, maklumat pesanan atau data latihan anda kepada penyedia AI.
\t• Masa penghantaran: data hanya dihantar apabila anda sendiri menghantar mesej dalam Pembantu AI, dan hanya selepas anda membaca dan bersetuju dengan notis yang dipaparkan pada kali pertama anda membuka ciri ini.
\t• Tujuan: semata-mata untuk menjana jawapan bagi anda; tidak digunakan untuk pengiklanan; tidak dijual kepada pihak ketiga.
\t• Nasihat: jangan berkongsi maklumat sensitif (dokumen pengenalan, maklumat kewangan, keadaan perubatan terperinci) dalam perbualan. Jawapan Pembantu AI hanyalah rujukan latihan, bukan nasihat perubatan.
Data latihan dan data keadaan badan anda tidak dikongsi dengan mana-mana pihak ketiga selain untuk menyediakan perkhidmatan kepada anda, kecuali anda memberikan persetujuan yang jelas untuk tujuan lain.
6. Kandungan awam dalam bahagian Komuniti
Kiriman, komen dan lencana pencapaian yang anda kongsi dalam bahagian Komuniti mungkin dipaparkan secara terbuka kepada pengguna lain dalam Aplikasi. Sila pertimbangkan dengan teliti sebelum berkongsi maklumat sensitif. Anda boleh memadam kandungan yang telah anda siarkan pada bila-bila masa.
7. Tempoh penyimpanan data
Kami menyimpan data peribadi selagi akaun anda aktif dan selama tempoh yang diperlukan untuk tujuan pengumpulan, untuk mematuhi kewajipan undang-undang (contohnya rekod perakaunan dan invois), atau untuk menyelesaikan pertikaian. Selepas anda meminta pemadaman akaun, data peribadi akan dipadam atau dianonimkan dalam tempoh yang munasabah, kecuali data yang wajib disimpan lebih lama menurut undang-undang.
8. Hak anda
Menurut undang-undang perlindungan data peribadi, anda mempunyai hak berikut ke atas data peribadi anda:
\t• Hak untuk dimaklumkan tentang pemprosesan data peribadi anda.
\t• Hak untuk mengakses dan menyemak data peribadi yang telah anda berikan.
\t• Hak untuk meminta pembetulan data yang tidak tepat.
\t• Hak untuk menarik balik persetujuan.
\t• Hak untuk meminta pemadaman data peribadi.
\t• Hak untuk meminta pengehadan atau membantah pemprosesan data.
\t• Hak untuk membuat aduan, laporan atau tindakan undang-undang menurut peraturan yang berkuat kuasa.
8.1 Cara memadam akaun terus dalam Aplikasi
Anda boleh memadam akaun sendiri terus dalam Aplikasi di: Profil → Padam akaun (butang di bahagian bawah skrin Profil), tanpa perlu menghubungi pasukan sokongan. Apabila pemadaman disahkan, semua data peribadi yang berkaitan dengan akaun akan dipadam atau dianonimkan menurut Seksyen 7. Jika menghadapi masalah, sila hubungi support@therahomeai.com.
9. Keselamatan data
Kami mengambil langkah teknikal dan organisasi yang sesuai untuk melindungi data peribadi daripada capaian, penggunaan atau pendedahan tanpa kebenaran. Butiran langkah keselamatan dinyatakan dalam Dasar Keselamatan Maklumat kami yang berasingan.
10. Kanak-kanak
Aplikasi tidak ditujukan kepada pengguna bawah 16 tahun. Jika anda berumur bawah 16 tahun, sila gunakan Aplikasi hanya dengan persetujuan dan pengawasan ibu bapa atau penjaga yang sah. Jika kami mendapati data peribadi kanak-kanak telah dikumpul tanpa persetujuan yang sah, kami akan memadam data tersebut.
11. Pemindahan data ke luar negara
Sekiranya pelayan storan atau penyedia perkhidmatan kami berada di luar wilayah Vietnam, pemindahan data peribadi ke luar negara akan dilaksanakan menurut peruntukan Dekri 13/2023/ND-CP, termasuk penyediaan dan penyimpanan dokumen penilaian impak pemindahan data ke luar negara apabila dikehendaki oleh undang-undang.
12. Perubahan Dasar
Kami mungkin mengemas kini Dasar ini dari semasa ke semasa. Apabila terdapat perubahan penting, kami akan memberitahu anda dalam Aplikasi atau melalui e-mel sebelum perubahan berkuat kuasa.
13. Hubungi kami
Jika anda mempunyai soalan tentang Dasar ini atau ingin melaksanakan hak anda ke atas data peribadi, sila hubungi:
\t• H-COMMERCE GLOBAL COMPANY LIMITED
\t• Alamat: Tingkat 11, Bangunan RoxCenter, 136 Ho Tung Mau, Phu Dien, Hanoi, Vietnam
\t• E-mel perlindungan data peribadi: support@therahomeai.com`,
  },
  security: {
    title: 'Dasar Keselamatan Maklumat',
    text: `DASAR KESELAMATAN MAKLUMAT
Aplikasi TheraHOME
Kemas kini terakhir: 01/09/2026
1. Objektif dan skop
Dasar ini menerangkan langkah teknikal dan organisasi yang diambil oleh H-COMMERCE GLOBAL COMPANY LIMITED untuk melindungi data peribadi — terutamanya data kesihatan — daripada capaian, penggunaan, pendedahan, pengubahsuaian atau pemusnahan tanpa kebenaran, selaras dengan Dekri 13/2023/ND-CP Vietnam mengenai perlindungan data peribadi.
2. Langkah teknikal
\t• Penyulitan data semasa penghantaran (HTTPS/TLS) antara Aplikasi dan pelayan kami.
\t• Penyulitan data sensitif semasa penyimpanan, termasuk kata laluan (cincangan sehala) dan data kesihatan.
\t• Kawalan capaian berasaskan peranan (role-based access control): hanya kakitangan dengan tugas berkaitan boleh mengakses data kesihatan pengguna.
\t• Pengesahan berbilang faktor untuk akaun pentadbir sistem dalaman.
\t• Log capaian (access log) untuk memantau dan mengesan capaian luar biasa.
\t• Tembok api aplikasi web dan imbasan kelemahan keselamatan secara berkala.
\t• Sandaran data berkala dan ujian keupayaan pemulihan.
3. Langkah organisasi
\t• Latihan kesedaran perlindungan data peribadi untuk semua kakitangan yang mengakses data pengguna.
\t• Prinsip capaian minimum (least privilege) — setiap kakitangan hanya diberi capaian yang diperlukan untuk tugasnya.
\t• Menandatangani perjanjian kerahsiaan/pemprosesan data dengan pihak ketiga (rakan pembayaran, storan awan, penyedia AI) sebelum sebarang data dikongsi.
\t• Penilaian keselamatan dan ujian penembusan (penetration testing) secara berkala.
\t• Proses kelulusan sebelum melaksanakan perubahan sistem yang menjejaskan data pengguna.
4. Pengurusan insiden dan pemberitahuan pelanggaran data
Apabila pelanggaran peraturan perlindungan data peribadi dikesan (contohnya kebocoran atau capaian tanpa kebenaran), kami akan:
\t• Menyekat dan membaiki insiden sebaik sahaja dikesan.
\t• Memberitahu Jabatan Keselamatan Siber dan Pencegahan Jenayah Berteknologi Tinggi (Kementerian Keselamatan Awam Vietnam) selewat-lewatnya 72 jam selepas pelanggaran berlaku, menurut Dekri 13/2023/ND-CP; jika pemberitahuan dibuat lewat, sebabnya akan dinyatakan dengan jelas.
\t• Memberitahu pengguna yang terjejas tentang insiden, data yang terlibat dan langkah yang telah/sedang diambil, secepat mungkin.
\t• Menyemak punca dan mengemas kini langkah pencegahan selepas insiden.
5. Penyimpanan dan pemadaman data yang selamat
Data disimpan pada infrastruktur dengan kawalan capaian dan penyulitan yang sesuai. Apabila tempoh penyimpanan tamat, atau atas permintaan pemadaman akaun oleh pengguna, data dipadam atau dianonimkan melalui proses pemadaman selamat, bagi memastikan ia tidak boleh dipulihkan kecuali untuk tujuan yang dikehendaki oleh undang-undang.
6. Tanggungjawab pengguna
Pengguna bertanggungjawab melindungi kata laluan akaun, tidak berkongsi maklumat log masuk, dan memberitahu kami dengan segera jika mengesyaki akaun diakses tanpa kebenaran.
7. Melaporkan kelemahan keselamatan
Jika anda menemui kelemahan keselamatan dalam Aplikasi, sila laporkan kepada kami melalui support@therahomeai.com. Kami komited untuk menerima, mengesahkan dan menangani laporan yang sah secepat mungkin.
8. Semakan dan kemas kini
Dasar ini disemak secara berkala dan dikemas kini apabila terdapat perubahan pada sistem kami, peraturan undang-undang, atau keperluan daripada platform pengedaran aplikasi (Apple App Store, Google Play).`,
  },
  community: {
    title: 'Garis Panduan Komuniti',
    text: `GARIS PANDUAN KOMUNITI
Bahagian Komuniti — Aplikasi TheraHOME
Kemas kini terakhir: 01/09/2026
Bahagian Komuniti ialah tempat ahli TheraHOME berkongsi perjalanan latihan, saling memberi semangat dan bertukar pengalaman. Garis Panduan ini terpakai kepada semua kiriman, komen, imej dan interaksi dalam bahagian Komuniti, bersama Terma Penggunaan dan Dasar Privasi.
1. Semangat umum
Komuniti TheraHOME dibina atas rasa hormat dan sokongan bersama antara mereka yang sedang dalam perjalanan menjaga kesihatan badan. Kongsikan sebagaimana anda mahu dilayan: ikhlas, positif dan menghormati pengalaman orang lain.
2. Digalakkan
\t• Berkongsi kemajuan latihan, pengalaman sebenar dan apa yang berkesan untuk anda.
\t• Memberi semangat dan meraikan pencapaian ahli lain.
\t• Bertanya soalan dan bertukar pengalaman secara membina.
\t• Melaporkan kandungan yang melanggar peraturan dan bukannya membalas sendiri dengan komen kasar.
3. Tidak dibenarkan
\t• Menyiarkan maklumat perubatan palsu atau mengelirukan, atau menggalakkan orang lain menghentikan rawatan/mengambil ubat sendiri tanpa nasihat profesional.
\t• Kandungan menghina, mengganggu, mengugut atau mendiskriminasi dalam apa jua bentuk.
\t• Spam, iklan tanpa kebenaran, atau pautan luar yang tidak berkaitan dengan senaman dan penjagaan kesihatan.
\t• Berkongsi maklumat peribadi orang lain tanpa persetujuan.
\t• Menyamar sebagai orang lain, termasuk kakitangan atau pakar TheraHOME.
\t• Menyiarkan kandungan tidak senonoh, ganas atau tidak sesuai untuk komuniti umum.
4. Melaporkan pelanggaran
Jika anda melihat kandungan yang melanggar peraturan, tekan "..." pada kiriman atau komen tersebut dan pilih "Lapor", kemudian pilih sebab yang sesuai. Pasukan TheraHOME akan menyemak dan mengambil tindakan secepat mungkin — anda tidak perlu berdepan terus dengan penyiar kandungan itu.
5. Akibat pelanggaran
Bergantung pada tahap pelanggaran, kami mungkin:
\t• Menyembunyikan atau mengalih keluar kandungan yang melanggar tanpa notis terlebih dahulu.
\t• Memberi peringatan kepada ahli yang melanggar.
\t• Menggantung sementara atau menamatkan akses akaun bagi pelanggaran yang serius atau berulang.
Keputusan tindakan adalah muktamad dan dibuat oleh pasukan pentadbiran TheraHOME. Jika anda percaya kandungan anda dikendalikan secara tersilap, sila hubungi pasukan sokongan melalui Chat dengan pasukan TheraHOME atau e-mel ${supportEmail}.
6. Kandungan yang anda siarkan
Anda kekal sebagai pemilik kandungan yang anda siarkan dan boleh memadamnya pada bila-bila masa. Dengan menyiarkannya, anda memberi TheraHOME hak untuk memaparkan kandungan tersebut dalam skop operasi Aplikasi — lihat butiran dalam Seksyen 5 dan 6 Dasar Privasi.
7. Perubahan garis panduan
Kami mungkin mengemas kini Garis Panduan Komuniti ini dari semasa ke semasa selaras dengan perkembangan komuniti. Penggunaan berterusan bahagian Komuniti selepas perubahan berkuat kuasa bermakna anda menerima perubahan tersebut.`,
  },
};

const legalContentByLanguage: Record<LegalLanguage, Record<LegalDocKey, LegalDoc>> = {
  vi: legalContent,
  en: legalContentEn,
  ms: legalContentMs,
};

/** Returns the requested document in the given app language, falling back to
 * the Vietnamese original (the legally-authoritative version) for any
 * unknown/missing language. */
export function getLegalDoc(docKey: LegalDocKey, language: string): LegalDoc {
  const byLanguage = legalContentByLanguage[language as LegalLanguage];
  return byLanguage?.[docKey] ?? legalContent[docKey];
}
