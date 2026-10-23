
const express = require("express");
const app = express();

// Sử dụng cổng do Render cấp phát hoặc 8080 nếu chạy ở máy cục bộ
const PORT = process.env.PORT || 8080;

// Cấu hình để đọc dữ liệu từ Form POST chuẩn HTTP
app.use(express.urlencoded({ extended: true }));

// 1. Hàm lấy thời gian hiện tại (Giờ:Phút) theo múi giờ Việt Nam (GMT+7)
function getTimeString() {
  const now = new Date();
  const options = { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false };
  return now.toLocaleString('vi-VN', options).substring(0, 5);
}

// 2. Mảng lưu trữ tin nhắn động trực tiếp trên thanh RAM của Server
let messages = [
  {
    text: "[Hệ thống]: Phòng chat HTTP 15s đã sẵn sàng hoạt động!",
    time: getTimeString(), 
  },
];

// 3. GIAO DIỆN CHAT (HTTP GET)
app.get("/", (req, res) => {
  let msgHTML = "";

  messages.forEach((m, index) => {
    // Nếu là tin nhắn cuối cùng, đặt id="last-msg" để màn hình tự cuộn xuống đáy
    const isLast = index === messages.length - 1 ? 'id="last-msg"' : '';
    msgHTML += `<p ${isLast} style="margin:8px 0; font-size:14px; line-height:1.4; border-bottom:1px dashed #eee; padding-bottom:5px;">[${m.time}] ${m.text}</p>`;
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        
        <!-- Tự động làm mới và nhảy xuống thẻ neo #last-msg hoặc #control-box ở đáy trang -->
        <meta http-equiv="refresh" content="15;url=/#control-box">
        
        <title>HTTP Chat 15s</title>
    </head>
    <body style="font-family:sans-serif; max-width:500px; margin:0 auto; padding:10px; background:#fafafa;">
        
        <h3 style="text-align:center; color:#0055a5; margin:5px 0 10px 0;">HTTP Chat Box</h3>
        
        <!-- [NẰM TRÊN] Danh sách hiển thị tin nhắn -->
        <div style="background:#fff; border:1px solid #ccc; padding:10px; min-height:150px;">
            ${msgHTML || '<p style="color:#888; text-align:center; font-style:italic;">Chưa có tin nhắn nào...</p>'}
        </div>
        
        <!-- [NẰM DƯỚI] Khu vực điều khiển, nhập liệu và xóa tin nhắn -->
        <div id="control-box" style="background:#fff; border:1px solid #ccc; padding:8px; margin-top:10px;">
            <!-- 1. Form gửi tin nhắn -->
            <form action="/send" method="POST" style="margin-bottom: 8px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td>
                            <input type="text" name="msg" placeholder="Nhập tên và nội dung tại đây..." style="width:95%; padding:6px; font-size:13px;" autofocus required>
                        </td>
                        <td width="20%">
                            <button type="submit" style="padding:6px 10px; font-weight:bold; width:100%; background:#0055a5; color:#fff; border:1px solid #004488;">Gửi</button>
                        </td>
                    </tr>
                </table>
            </form>

            <!-- 2. Form xóa tin nhắn -->
            <form action="/clear" method="POST" onsubmit="return confirm('Bạn có chắc chắn muốn xóa hết tin nhắn không?');" style="margin:0;">
                <button type="submit" style="width:100%; padding:5px; font-size:12px; background:#cc0000; color:#fff; border:1px solid #aa0000; font-weight:bold; cursor:pointer;">
                    ❌ XÓA TOÀN BỘ TIN NHẮN
                </button>
            </form>
        </div>
        
        <div style="font-size:11px; color:#888; text-align:center; margin-top:10px; padding-bottom:20px;">
            Trang web tự động cập nhật tin mới sau mỗi 15 giây...
        </div>
        
    </body>
    </html>
    `;

  res.send(html);
});

// 4. XỬ LÝ GỬI TIN (HTTP POST)
app.post("/send", (req, res) => {
  const msgText = req.body.msg;

  if (msgText && msgText.trim() !== "") {
    messages.push({
      text: msgText,
      time: getTimeString(),
    });

    if (messages.length > 25) messages.shift();
  }

  // Chuyển hướng và tập trung màn hình vào khu vực điều khiển ở đáy
  res.redirect("/#control-box");
});

// 5. XỬ LÝ XÓA TOÀN BỘ TIN NHẮN (HTTP POST)
app.post("/clear", (req, res) => {
  messages = [];
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});
