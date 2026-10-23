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

// 2. Hàm phân tích chuỗi User-Agent để nhận diện tên thiết bị/trình duyệt
function getDeviceName(userAgentString) {
  if (!userAgentString) return "Thiết bị ẩn danh";
  
  const ua = userAgentString.toLowerCase();
  
  // Nhận diện các trình duyệt và hệ điều hành phổ biến (Đặc biệt là máy cổ)
  if (ua.includes("opera mini")) return "Opera Mini";
  if (ua.includes("opera mabi") || ua.includes("opera mobi")) return "Opera Mobile";
  if (ua.includes("blackberry") || ua.includes("bb10")) return "BlackBerry";
  if (ua.includes("nokia") || ua.includes("symbian") || ua.includes("series60")) return "Nokia Symbian";
  if (ua.includes("iemobile") || ua.includes("windows phone")) return "Windows Phone";
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return "Android";
  if (ua.includes("windows")) return "Máy tính Windows";
  if (ua.includes("macintosh") || ua.includes("mac os")) return "Máy tính Mac";
  if (ua.includes("linux")) return "Máy tính Linux";
  
  return "Thiết bị lạ";
}

// 3. Mảng lưu trữ tin nhắn động trên RAM (Bổ sung thêm trường device)
let messages = [
  {
    device: "Hệ thống",
    text: "Phòng chat HTTP 15s đã sẵn sàng hoạt động!",
    time: getTimeString(), 
  },
];

// 4. GIAO DIỆN CHAT (HTTP GET)
app.get("/", (req, res) => {
  let msgHTML = "";

  messages.forEach((m, index) => {
    const isLast = index === messages.length - 1 ? 'id="last-msg"' : '';
    
    // Hiển thị tên thiết bị trong ngoặc nhọn <...> và tô màu cam nổi bật
    msgHTML += `<p ${isLast} style="margin:8px 0; font-size:14px; line-height:1.4; border-bottom:1px dashed #eee; padding-bottom:5px;">
      [${m.time}] <span style="color:#e67e22; font-weight:bold;">&lt;${m.device}&gt;</span>: ${m.text}
    </p>`;
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="15;url=/#control-box">
        <title>HTTP Chat 15s</title>
    </head>
    <body style="font-family:sans-serif; max-width:500px; margin:0 auto; padding:10px; background:#fafafa;">
        
        <h3 style="text-align:center; color:#0055a5; margin:5px 0 10px 0;">HTTP Chat Box</h3>
        
        <!-- [NẰM TRÊN] Danh sách hiển thị tin nhắn -->
        <div style="background:#fff; border:1px solid #ccc; padding:10px; min-height:150px;">
            ${msgHTML || '<p style="color:#888; text-align:center; font-style:italic;">Chưa có tin nhắn nào...</p>'}
        </div>
        
        <!-- [NẰM DƯỚI] Khu vực điều khiển -->
        <div id="control-box" style="background:#fff; border:1px solid #ccc; padding:8px; margin-top:10px;">
            <!-- 1. Form gửi tin nhắn (Đã sửa placeholder gọn gàng hơn vì tên thiết bị tự nhận diện) -->
            <form action="/send" method="POST" style="margin-bottom: 8px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td>
                            <input type="text" name="msg" placeholder="Nhập nội dung chat tại đây..." style="width:95%; padding:6px; font-size:13px;" autofocus required>
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

// 5. XỬ LÝ GỬI TIN (HTTP POST)
app.post("/send", (req, res) => {
  const msgText = req.body.msg;

  if (msgText && msgText.trim() !== "") {
    // Đọc chuỗi User-Agent từ Header của yêu cầu gửi lên
    const userAgent = req.headers["user-agent"];
    
    // Chuyển đổi chuỗi đó thành tên thiết bị ngắn gọn
    const deviceName = getDeviceName(userAgent);

    messages.push({
      device: deviceName, // Lưu tên thiết bị vào cấu trúc tin nhắn
      text: msgText,
      time: getTimeString(),
    });

    if (messages.length > 25) messages.shift();
  }

  res.redirect("/#control-box");
});

// 6. XỬ LÝ XÓA TOÀN BỘ TIN NHẮN (HTTP POST)
app.post("/clear", (req, res) => {
  messages = [];
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});

