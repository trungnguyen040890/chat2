const express = require("express");
const app = express();

// Sử dụng cổng do Render cấp phát hoặc 8080 nếu chạy ở máy cục bộ
const PORT = process.env.PORT || 8080;

// Cấu hình đọc dữ liệu Form POST chuẩn HTTP
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "5mb" }));

// Đối tượng lưu trữ trạng thái hoạt động của các IP nhằm tính số người Online
let onlineUsers = {};

// 1. Hàm lấy thời gian hiện tại (Giờ:Phút) theo múi giờ Việt Nam (GMT+7)
function getTimeString() {
  const now = new Date();
  const options = { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false };
  return now.toLocaleString('vi-VN', options).substring(0, 5);
}

// 2. Hàm phân tích chuỗi User-Agent để nhận diện chi tiết tên thiết bị
function getDeviceName(userAgentString) {
  if (!userAgentString) return "Thiết bị ẩn danh";
  const ua = userAgentString.toLowerCase();

  if (ua.includes("blackberry")) {
    const bbMatch = userAgentString.match(/BlackBerry\s?(\d{4})/i);
    return bbMatch ? `BlackBerry ${bbMatch}` : "BlackBerry";
  }
  if (ua.includes("android")) {
    const androidMatch = userAgentString.match(/android\s?\d+[^;]*;\s?([^;)]+)\s?build/i);
    if (androidMatch) {
      let model = androidMatch.trim();
      const modelMap = { "21061119dg": "Redmi 10", "m2101k7ag": "Redmi Note 10" };
      if (modelMap[model.toLowerCase()]) return modelMap[model.toLowerCase()];
      return model.charAt(0).toUpperCase() + model.slice(1);
    }
    return "Thiết bị Android";
  }
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("windows nt")) return "Máy tính PC";
  return "Thiết bị lạ";
}

// 3. Hàm cập nhật IP và tính toán tổng số người đang Online thực tế
function updateAndGetOnlineCount(req) {
  // Lấy IP của thiết bị (hỗ trợ đọc qua proxy của Render)
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  
  // Lưu hoặc cập nhật mốc thời gian hoạt động mới nhất của IP này
  if (ip) {
    onlineUsers[ip] = now;
  }

  // Quét danh sách, loại bỏ các IP đã quá 100 giây không tương tác (90s refresh + 10s bù hao trừ lag)
  for (const userIP in onlineUsers) {
    if (now - onlineUsers[userIP] > 100000) { 
      delete onlineUsers[userIP];
    }
  }

  // Trả về tổng số lượng IP còn hoạt động
  return Object.keys(onlineUsers).length;
}

// 4. Mảng lưu trữ tin nhắn động trên thanh RAM của Server
let messages = [
  {
    device: "Hệ thống",
    text: "Phòng chat HTTP 90s đã sẵn sàng hoạt động!",
    time: getTimeString(),
    isImage: false
  },
];

// 5. TRANG 1: XEM TIN NHẮN (Hiển thị số người online - Tự động tải lại sau 90 giây)
app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  
  // Gọi hàm đếm số người Online
  const onlineCount = updateAndGetOnlineCount(req);

  let msgHTML = "";
  messages.forEach((m, index) => {
    const isLast = index === messages.length - 1 ? 'id="last-msg"' : '';
    let contentHTML = m.text;
    
    if (m.isImage) {
      contentHTML = `<br><a href="${m.text}" download="chat_image_${m.time}.png">
        <img src="${m.text}" alt="Hình ảnh" style="max-width:100%; height:auto; margin-top:5px; border:1px solid #ddd; padding:2px; background:#fff;" />
      </a>`;
    }

    msgHTML += `<p ${isLast} style="margin:8px 0; font-size:14px; line-height:1.4; border-bottom:1px dashed #eee; padding-bottom:5px;">
      [${m.time}] <span style="color:#e67e22; font-weight:bold;">&lt;${m.device}&gt;</span>: ${contentHTML}
    </p>`;
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="90;url=/#last-msg">
        <title>HTTP Chat 90s</title>
    </head>
    <body style="font-family:sans-serif; max-width:500px; margin:0 auto; padding:10px; background:#fafafa;">
        
        <h3 style="text-align:center; color:#0055a5; margin:5px 0 2px 0;">HTTP Chat Box</h3>
        
        <!-- Bộ đếm số người đang xem trực tuyến hiển thị nổi bật ngay trên khung chat -->
        <div style="text-align:center; font-size:12px; color:#27ae60; font-weight:bold; margin-bottom:10px;">
            🟢 Có ${onlineCount} người đang xem phòng chat này
        </div>
        
        <!-- Khung hiển thị danh sách tin nhắn -->
        <div style="background:#fff; border:1px solid #ccc; padding:10px; min-height:200px;">
            ${msgHTML || '<p style="color:#888; text-align:center; font-style:italic;">Chưa có tin nhắn nào...</p>'}
        </div>
        
        <div style="margin-top: 15px; text-align: center;">
            <a href="/write" style="display: block; background: #0055a5; color: #fff; padding: 10px; font-weight: bold; text-decoration: none; border: 1px solid #004488; border-radius: 4px;">
                ✍️ BẤM VÀO ĐÂY ĐỂ VIẾT TIN / GỬI ẢNH
            </a>
        </div>
        
        <div style="font-size:11px; color:#888; text-align:center; margin-top:15px;">
            Trang xem tin tự động cập nhật sau mỗi 90 giây...
        </div>
    </body>
    </html>
    `;
  res.send(html);
});

// 6. TRANG 2: KHU VỰC NHẬP LIỆU (Cập nhật hoạt động, KHÔNG tự động tải lại)
app.get("/write", (req, res) => {
  // Cập nhật mốc thời gian để khi đang gõ, bộ đếm vẫn tính người này đang online
  updateAndGetOnlineCount(req);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Viết tin nhắn mới</title>
    </head>
    <body style="font-family:sans-serif; max-width:500px; margin:0 auto; padding:10px; background:#fafafa;">
        
        <h3 style="text-align:center; color:#27ae60; margin:5px 0 15px 0;">Soạn Tin Nhắn Mới</h3>
        
        <div style="background:#fff; border:1px solid #ccc; padding:12px;">
            <form action="/send" method="POST" style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 5px;">Nội dung tin nhắn:</label>
                <input type="text" name="msg" placeholder="Nhập chữ tại đây..." style="width:96%; padding:8px; font-size:14px; margin-bottom:8px;" autofocus required>
                <button type="submit" style="width:100%; padding:8px; font-weight:bold; background:#0055a5; color:#fff; border:1px solid #004488;">Gửi tin</button>
            </form>

            <form action="/send-file" method="POST" enctype="multipart/form-data" style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 5px;">Chọn hình ảnh từ thiết bị:</label>
                <input type="file" name="image" accept="image/*" style="font-size:13px; width:96%; margin-bottom:8px;" required>
                <button type="submit" style="width:100%; padding:8px; font-weight:bold; background:#27ae60; color:#fff; border:1px solid #219653;">Gửi ảnh này</button>
            </form>

            <form action="/clear" method="POST" onsubmit="return confirm('Xóa hết chat?');" style="margin:0;">
                <button type="submit" style="width:100%; padding:6px; font-size:12px; background:#cc0000; color:#fff; border:1px solid #aa0000;">❌ XÓA TOÀN BỘ PHÒNG CHAT</button>
            </form>
        </div>

        <div style="text-align: center; margin-top: 15px;">
            <a href="/" style="font-size: 13px; color: #555; text-decoration: underline;">⇽ Quay lại khung chat mà không gửi</a>
        </div>
    </body>
    </html>
    `;
  res.send(html);
});

// 7. XỬ LÝ GỬI CHỮ
app.post("/send", (req, res) => {
  const msgText = req.body.msg;
  if (msgText && msgText.trim() !== "") {
    const userAgent = req.headers["user-agent"];
    messages.push({
      device: getDeviceName(userAgent),
      text: msgText.trim(),
      time: getTimeString(),
      isImage: false
    });
    if (messages.length > 25) messages.shift();
  }
  updateAndGetOnlineCount(req); // Cập nhật hoạt động
  res.redirect("/#last-msg");
});

// 8. XỬ LÝ GỬI FILE ẢNH
app.post("/send-file", (req, res) => {
  let chunks = [];
  req.on('data', (chunk) => { chunks.push(chunk); });
  req.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const bodyStr = buffer.toString('binary');
    const fileStartIdx = bodyStr.indexOf('\r\n\r\n') + 4;
    const fileEndIdx = bodyStr.lastIndexOf('\r\n--');
    
    if (fileStartIdx > 4 && fileEndIdx > fileStartIdx) {
      const fileContent = bodyStr.substring(fileStartIdx, fileEndIdx);
      const base64Data = Buffer.from(fileContent, 'binary').toString('base64');
      
      if (base64Data.length > 100) {
        const userAgent = req.headers["user-agent"];
        messages.push({
          device: getDeviceName(userAgent),
          text: `data:image/png;base64,${base64Data}`,
          time: getTimeString(),
          isImage: true
        });
        if (messages.length > 25) messages.shift();
      }
    }
    updateAndGetOnlineCount(req); // Cập nhật hoạt động
    res.redirect("/#last-msg");
  });
});

// 9. XỬ LÝ XÓA
app.post("/clear", (req, res) => {
  messages = [];
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});
