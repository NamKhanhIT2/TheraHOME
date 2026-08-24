window.APP_DATA = (function(){
  var questions = [
    {key:'goals', multi:true, title:'Mục tiêu của bạn là gì?', subtitle:'Có thể chọn nhiều', options:['Ngủ ngon hơn','Giảm đau mỏi','Giảm đau đầu, căng thẳng','Giảm tê tay, tê chân']},
    {key:'zone', title:'Khu vực bạn muốn cải thiện nhất?', options:['Cổ – vai – gáy','Lưng – hông','Cả cổ và lưng']},
    {key:'condition', title:'Tình trạng hiện tại của bạn?', options:['Chỉ đau mỏi thông thường','Thoái hóa','Thoát vị đĩa đệm','Không rõ / Chưa được chẩn đoán']},
    {key:'symptoms', multi:true, title:'Bạn đang gặp triệu chứng nào?', subtitle:'Có thể chọn nhiều', options:['Đau mỏi cổ – vai – gáy','Đau mỏi lưng – hông','Tê hoặc yếu tay','Tê hoặc yếu chân','Đau đầu','Đau lan xuống chân','Khác']},
    {key:'severity', title:'Tình trạng này ảnh hưởng đến bạn ở mức nào?', options:['Nhẹ — thỉnh thoảng khó chịu','Vừa — xuất hiện thường xuyên','Nhiều — ảnh hưởng sinh hoạt hoặc công việc']},
    {key:'timing', title:'Khi nào bạn cảm thấy khó chịu nhất?', options:['Khi ngủ / vừa thức dậy','Khi làm việc hoặc ngồi lâu','Cuối ngày','Cả ngày']},
    {key:'job', title:'Công việc hằng ngày của bạn là gì?', options:['Nhân viên văn phòng','Làm nghề thủ công / lao động','Lái xe','Giáo viên','Công việc khác']}
  ];
  var videoByDay = {
    1:'https://www.youtube.com/watch?v=DRPy1sxtePg',
    2:'https://www.youtube.com/watch?v=t9PiSLEmfFY',
    3:'https://www.youtube.com/watch?v=MajRQz9Q0dI',
    4:'https://www.youtube.com/watch?v=7sLwCAqyR0U&t=768s',
    5:'https://www.youtube.com/watch?v=9soWyYof1sc',
    6:'https://www.youtube.com/watch?v=ngz8vFqY_9w&t=2s',
    7:'https://www.youtube.com/watch?v=ssw1oQcYebg&t=1s',
    8:'https://www.youtube.com/watch?v=OG3_ISIFy4Q&t=17s',
    9:'https://www.youtube.com/watch?v=bO57d32dz00&t=7s',
    10:'https://www.youtube.com/watch?v=XVAzTHgKCYQ&t=6s',
    11:'https://www.youtube.com/watch?v=bzbnbZ_c9lQ&t=9s',
    12:'https://www.youtube.com/watch?v=y7SowOGSPUc&t=1s',
    13:'https://www.youtube.com/watch?v=Nm6ftXfabHk&t=5s',
    14:'https://www.youtube.com/watch?v=LOZjXwQJTqo&t=80s'
  };
  function videoForDay(i){ return videoByDay[((i-1)%14)+1]; }
  function buildDays(total, phaseList, doneCount){
    var arr = [];
    for (var i=1;i<=total;i++){
      var ph = phaseList.find(function(p){return i>=p.range[0]&&i<=p.range[1];});
      var status = i < doneCount ? 'done' : (i === doneCount ? 'current' : 'locked');
      var isPhase3 = ph.range[0] === 15;
      var type = (isPhase3 && i % 2 === 1) ? 'rest' : 'train';
      arr.push({id:i, phase:ph.name, status:status, video:videoForDay(i), type:type});
    }
    return arr;
  }
  var neckPhases = [
    {name:'Giai đoạn 1 · Giảm khó chịu & làm quen', range:[1,7]},
    {name:'Giai đoạn 2 · Tăng cường vận động cổ', range:[8,14]},
    {name:'Giai đoạn 3 · Duy trì', range:[15,28]}
  ];
  var backPhases = [
    {name:'Giai đoạn 1 · Giảm khó chịu & làm quen', range:[1,7]},
    {name:'Giai đoạn 2 · Tăng cường sức bền cột sống', range:[8,14]},
    {name:'Giai đoạn 3 · Duy trì', range:[15,28]}
  ];
  var products = [
    {id:'neck-plus', name:'Thiết bị hỗ trợ cổ · TheraNECK+', accent:'#FF9F0A', totalDays:28, phases:neckPhases, days:buildDays(28, neckPhases, 14), painLevels:[8,7,7,6,6,5,5,5,4,4,4,3,3,3]},
    {id:'neck-pro', name:'Thiết bị hỗ trợ cổ · TheraNECK PRO', accent:'#FF9F0A', totalDays:28, phases:neckPhases, days:buildDays(28, neckPhases, 14), painLevels:[7,6,6,5,5,5,4,4,4,3,3,3,2,2]},
    {id:'back-plus', name:'Thiết bị hỗ trợ lưng · TheraBACK+', accent:'var(--color-primary)', totalDays:28, phases:backPhases, days:buildDays(28, backPhases, 20), painLevels:[8,8,7,7,6,6,6,5,5,5,4,4,4,3,4,3,3,3,2,3]},
    {id:'back-pro', name:'Thiết bị hỗ trợ lưng · TheraBACK PRO', accent:'var(--color-primary)', totalDays:28, phases:backPhases, days:buildDays(28, backPhases, 28), painLevels:[9,8,8,7,7,6,6,6,5,5,5,4,4,4,3,4,3,3,3,2,3,2,2,2,1,2,1,1]}
  ];
  var articles = [
    {tag:'Hướng dẫn', title:'5 nguyên tắc an toàn khi tập phục hồi tại nhà', readTime:'4 phút đọc'},
    {tag:'Kiến thức', title:'Vì sao ngày tập nhẹ cũng quan trọng như ngày tập nặng', readTime:'3 phút đọc'},
    {tag:'Dinh dưỡng', title:'Ăn gì để hỗ trợ quá trình phục hồi vận động', readTime:'5 phút đọc'},
    {tag:'Câu chuyện', title:'Hành trình 14 ngày lấy lại vận động của một khách hàng TheraHOME', readTime:'6 phút đọc'},
    {tag:'Hướng dẫn', title:'Nhận biết dấu hiệu cần nghỉ và báo với đội ngũ hỗ trợ TheraHOME', readTime:'3 phút đọc'}
  ];
  var weekAdherence = [1,1,1,0.5,1,0,0];
  var communityPosts = [
    {id:1, official:true, name:'TheraHOME', meta:'Hướng dẫn', text:'5 nguyên tắc an toàn khi tập phục hồi tại nhà', likes:128, comments:14, commentsList:[
      {name:'Mai', avatarColor:'#FFD9A0', text:'Bài viết hữu ích quá, cảm ơn TheraHOME!', time:'2 giờ', likes:5, replies:[
        {name:'TheraHOME', official:true, text:'Cảm ơn bạn đã theo dõi TheraHOME!', time:'1 giờ'}
      ]},
      {name:'Đức', avatarColor:'#BFEAD0', text:'Mình sẽ áp dụng ngay hôm nay.', time:'1 giờ', likes:2}
    ]},
    {id:2, name:'Lan', avatarColor:'#C9BEFF', meta:'Ngày 14, Giai đoạn 1', text:'Vừa hoàn thành 14 ngày đầu tiên, đỡ khó chịu hơn hẳn so với lúc bắt đầu. Cảm ơn mọi người đã động viên mấy hôm mình nản.', badge:'Hoàn thành Giai đoạn 1', likes:42, comments:9, action:'Chúc mừng', tag:'story', commentsList:[
      {name:'Huy', avatarColor:'#BFEAD0', text:'Chúc mừng bạn nhé, cố lên giai đoạn 2!', time:'3 giờ'},
      {name:'Mai', avatarColor:'#FFD9A0', text:'Bạn dùng thiết bị nào vậy?', time:'2 giờ'},
      {name:'TheraHOME', official:true, text:'Chúc mừng Lan đã hoàn thành Giai đoạn 1! Tiếp tục phát huy nhé.', time:'1 giờ'}
    ]},
    {id:3, name:'Huy', avatarColor:'#BFEAD0', meta:'Ngày 5, Giai đoạn 1', text:'Có ai dùng đai chườm nóng trong Cửa hàng chưa, đỡ khó chịu vùng vai được không?', likes:6, comments:11, tag:'story', commentsList:[
      {name:'Lan', avatarColor:'#C9BEFF', text:'Mình có dùng, khá hiệu quả với vùng vai đó.', time:'40 phút', likes:3, replies:[
        {name:'Huy', avatarColor:'#BFEAD0', text:'Cảm ơn bạn, mình đặt thử xem sao.', time:'20 phút'}
      ]}
    ]}
  ];
  var notifications = [
    {id:1, type:'schedule', title:'Đến giờ tập hôm nay', body:'Ngày 14 · Duy trì đang chờ bạn', time:'8:00', read:false, dayId:14, productId:'neck-plus'},
    {id:2, type:'schedule', title:'Nhắc uống nước', body:'Bạn mới uống 4/8 cốc hôm nay', time:'14:30', read:false},
    {id:3, type:'ad', title:'Ưu đãi TheraBACK PRO', body:'Giảm 15% khi đặt hàng trong tuần này', time:'Hôm qua', read:true},
    {id:4, type:'ad', title:'Ra mắt Gối Công Thái Học mới', body:'Hỗ trợ tư thế ngủ đúng cách', time:'2 ngày trước', read:true},
    {id:5, type:'blog', title:'5 nguyên tắc an toàn khi tập phục hồi tại nhà', body:'Bài viết mới từ TheraHOME', time:'3 ngày trước', read:false},
    {id:6, type:'blog', title:'Ăn gì để hỗ trợ quá trình phục hồi vận động', body:'Bài viết mới từ TheraHOME', time:'5 ngày trước', read:true}
  ];
  var landingOrders = [
    {id:1, phone:'0901234501', email:'minh.tran@gmail.com', product:'TheraNECK+', status:'activated', code:'TH-NECK-1037', orderDate:'01/08/2026'},
    {id:2, phone:'0901234502', email:'lan.pham@gmail.com', product:'TheraBACK+', status:'activated', code:'TH-BACK-1074', orderDate:'28/07/2026'},
    {id:3, phone:'0901234503', email:'huy.nguyen@gmail.com', product:'TheraNECK PRO', status:'pending', code:'TH-NECK-2210', orderDate:'10/08/2026'},
    {id:4, phone:'0901234504', email:'mai.le@gmail.com', product:'TheraBACK PRO', status:'pending', code:'TH-BACK-2381', orderDate:'12/08/2026'}
  ];
  var storeCategories = [
    {id:'neck', title:'Thiết bị hỗ trợ cổ', hasTrial:true, items:[
      {id:'neck-plus', name:'TheraNECK+', desc:'Máy massage nhiệt hỗ trợ vùng cổ gáy', price:'1.490.000₫', accent:'var(--color-primary)', link:'https://therahomeai.com/san-pham/theraneck-plus'},
      {id:'neck-pro', name:'TheraNECK PRO', desc:'Phiên bản cao cấp, điều chỉnh áp lực tự động', price:'2.290.000₫', accent:'var(--color-primary)', link:'https://therahomeai.com/san-pham/theraneck-pro'}
    ]},
    {id:'back', title:'Thiết bị hỗ trợ lưng', hasTrial:true, items:[
      {id:'back-plus', name:'TheraBACK+', desc:'Đai nhiệt hỗ trợ vùng lưng dưới', price:'1.690.000₫', accent:'var(--color-primary)', link:'https://therahomeai.com/san-pham/theraback-plus'},
      {id:'back-pro', name:'TheraBACK PRO', desc:'Phiên bản cao cấp, kéo dãn cột sống', price:'2.590.000₫', accent:'var(--color-primary)', link:'https://therahomeai.com/san-pham/theraback-pro'}
    ]},
    {id:'accessory', title:'Sản phẩm đi kèm', hasTrial:false, items:[
      {id:'patch', name:'Miếng dán thảo dược Vinh Gia', desc:'Giảm đau, kháng viêm tại chỗ', price:'85.000₫', accent:'var(--color-primary)', link:'https://therahomeai.com/san-pham/mieng-dan-vinh-gia'},
      {id:'gel', name:'Gel xung điện', desc:'Dùng kèm thiết bị xung điện', price:'120.000₫', accent:'var(--color-primary)', link:'https://therahomeai.com/san-pham/gel-xung-dien'},
      {id:'pillow', name:'Gối Công Thái Học', desc:'Hỗ trợ tư thế ngủ đúng', price:'450.000₫', accent:'var(--color-primary)', link:'https://therahomeai.com/san-pham/goi-cong-thai-hoc'},
      {id:'chair', name:'Ghế Công Thái Học', desc:'Hỗ trợ tư thế ngối làm việc', price:'3.200.000₫', accent:'var(--color-primary)', link:'https://therahomeai.com/san-pham/ghe-cong-thai-hoc'}
    ]}
  ];
  return {
    questions:questions, products:products, storeCategories:storeCategories, articles:articles, weekAdherence:weekAdherence, communityPosts:communityPosts, notifications:notifications, landingOrders:landingOrders,
    introVideo:'https://www.youtube.com/watch?v=DHuAzpoV0XQ',
    landingPage:'https://therahomeai.com',
    privacyPolicy:'https://therahomeai.com/privacy',
    user:{name:'Minh', streak:4, adherence:86, currentDay:14, waterGoal:8}
  };
})();
