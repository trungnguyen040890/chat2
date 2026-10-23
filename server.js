
  const express = require("express");
const app = express();

// Sử dụng cổng do Render cấp phát hoặc 8080 nếu chạy ở máy cục bộ
const PORT = process.env.PORT || 8080;

// Cấu hình để đọc dữ liệu từ Form POST chuẩn HTTP
app.use(express.urlencoded({ extended: true }));

// Mảng lưu trữ thông tin thời gian hoạt động của các IP để tính số người Online
let onlineUsers = {};

// Mảng lưu trữ tin nhắn động trực tiếp trên thanh RAM của Server
let messages = [];

// Hàm lấy thời gian hiện tại (Giờ:Phút) theo múi giờ Việt Nam (GMT+7)
function getTimeString() {
  const now = new Date();
  const options = { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false };
  return now.toLocaleString('vi-VN', options).substring(0, 5);
}

// Khởi tạo tin nhắn hệ thống đầu tiên với thời gian thực tế lúc chạy Server
messages.push({
  text: "[Hệ thống]: Phòng chat HTTP 90s đã sẵn sàng hoạt động!",
  time: getTimeString(),
});

// Hàm cập nhật trạng thái hoạt động của IP và đếm số người Online
function updateAndGetOnlineCount(req) {
  // Lấy IP thật của thiết bị (hỗ trợ bóc tách qua proxy ẩn của Render)
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  
  if (ip) {
    onlineUsers[ip] = now;
  }

  // Quét danh sách, loại bỏ các IP đã quá 100 giây không tương tác (90s refresh + 10s bù hao lag)
  for (const userIP in onlineUsers) {
    if (now - onlineUsers[userIP] > 100000) { 
      delete onlineUsers[userIP];
    }
  }

  // Trả về tổng số thiết bị đang xem trực tuyến
  return Object.keys(onlineUsers).length;
}

// 1. GIAO DIỆN CHAT (HTTP GET): Tự động sinh HTML tĩnh kèm dữ liệu động
app.get("/", (req, res) => {
  // Ép trình duyệt không lưu bộ nhớ đệm để số liệu người xem luôn chính xác khi tải lại
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  
  // Gọi hàm đếm số người xem hiện tại
  const onlineCount = updateAndGetOnlineCount(req);
  let msgHTML = "";

  // Đọc danh sách tin nhắn từ RAM và chuyển thành các dòng chữ HTML
  messages.forEach((m) => {
    msgHTML += `<p style="margin:5px 0; font-size:14px; line-height:1.4;">[${m.time}] ${m.text}</p>`;
  });

  // Nội dung trang Web tối giản nhất, không dùng Javascript
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        
        <!-- THỜI GIAN CẬP NHẬT: Đã tăng lên 90 giây theo yêu cầu của bạn -->
        <meta http-equiv="refresh" content="90;url=/">
        
        <title>HTTP Chat 90s</title>
    </head>
    <body style="font-family:sans-serif; max-width:500px; margin:10px auto; padding:10px; background:#fafafa;">
        
        <!-- ĐÚNG YÊU CẦU: Số người đang xem hiển thị ở đầu trang, thay thế hoàn toàn chữ HTTP Chat Box cũ -->
        <h3 style="text-align:center; color:#27ae60; margin-top:0; margin-bottom:15px; font-size: 16px;">
            🟢 Có ${onlineCount} người đang xem phòng chat
        </h3>
        
        <!-- Khung hiển thị nội dung chat -->
        <div style="border:1px solid #ccc; background:#fff; height:280px; overflow-y:scroll; padding:10px; margin-bottom:10px;">
            ${msgHTML}
        </div>
        
        <!-- Form gửi tin nhắn -->
        <form action="/send" method="POST" style="background:#fff; border:1px solid #ccc; padding:10px;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td>
                        <input type="text" name="msg" placeholder="Nhập tên và nội dung chat tại đây..." style="width:96%; padding:6px; font-size:13px;" autofocus required>
                    </td>
                    <td width="15%">
                        <button type="submit" style="padding:6px 12px; font-weight:bold; width:100%;">Gửi</button>
                    </td>
                </tr>
            </table>
        </form>
        
        <div style="font-size:11px; color:#888; text-align:center; margin-top:10px;">
            Trang web tự động cập nhật tin mới và số người xem sau mỗi 90 giây...
        </div>
        
    </body>
    </html>
    `;

  res.send(html);
});

// 2. XỬ LÝ GỬI TIN (HTTP POST): Tiếp nhận nội dung chat mới và lưu vào RAM
app.post("/send", (req, res) => {
  const msgText = req.body.msg;

  if (msgText && msgText.trim() !== "") {
    messages.push({
      text: msgText,
      time: getTimeString(),
    });

    // Giới hạn giữ lại 25 tin gần nhất để tối ưu bộ nhớ cho Opera Mini trên BBOS 6
    if (messages.length > 25) messages.shift();
  }

  // Cập nhật hoạt động cho IP người gửi trước khi chuyển hướng
  updateAndGetOnlineCount(req);

  // Sau khi lưu xong, ép trình duyệt quay về trang chủ ngay lập tức để hiện tin mới
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});
