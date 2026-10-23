const express = require("express");
const app = express();

// Sử dụng cổng do Render cấp phát hoặc 8080 nếu chạy ở máy cục bộ
const PORT = process.env.PORT || 8080;

// Cấu hình đọc dữ liệu Form POST chuẩn HTTP
app.use(express.urlencoded({ extended: true }));

// Cấu hình Express xử lý dữ liệu tải tệp tin (Multipart Form) dung lượng dưới 5MB để tránh tràn RAM
app.use(express.json({ limit: "5mb" }));

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
    return bbMatch ? `BlackBerry ${bbMatch[1]}` : "BlackBerry";
  }
  if (ua.includes("android")) {
    const androidMatch = userAgentString.match(/android\s?\d+[^;]*;\s?([^;)]+)\s?build/i);
    if (androidMatch) {
      let model = androidMatch[1].trim();
      const modelMap = {
        "21061119dg": "Redmi 10",
        "m2101k7ag": "Redmi Note 10",
        "m2010j19sg": "Redmi 9T",
        "sm-g973f": "Samsung S10"
      };
      if (modelMap[model.toLowerCase()]) return modelMap[model.toLowerCase()];
      return model.charAt(0).toUpperCase() + model.slice(1);
    }
    return "Thiết bị Android";
  }
  if (ua.includes("iphone") || ua.includes("ipad")) {
    if (ua.includes("iphone")) {
      if (ua.includes("iphone11,8")) return "iPhone XR";
      if (ua.includes("iphone12,1")) return "iPhone 11";
      return "iPhone";
    }
    return "iPad";
  }
  if (ua.includes("windows nt")) return "Máy tính PC";
  return "Thiết bị lạ";
}

// 3. Mảng lưu trữ tin nhắn động trên thanh RAM của Server
let messages = [
  {
    device: "Hệ thống",
    text: "Phòng chat HTTP 15s đã sẵn sàng hoạt động!",
    time: getTimeString(),
    isImage: false
  },
];

// 4. GIAO DIỆN CHAT (HTTP GET)
app.get("/", (req, res) => {
  let msgHTML = "";

  messages.forEach((m, index) => {
    const isLast = index === messages.length - 1 ? 'id="last-msg"' : '';
    let contentHTML = m.text;
    
    // Nếu là tin nhắn ảnh, bọc trong thẻ <a> để người dùng nhấn vào là tải về được luôn
    if (m.isImage) {
      contentHTML = `<br><a href="${m.text}" download="chat_image_${m.time}.png" title="Nhấn để tải ảnh về">
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
        <meta http-equiv="refresh" content="15;url=/#control-box">
        <title>HTTP Chat 15s</title>
    </head>
    <body style="font-family:sans-serif; max-width:500px; margin:0 auto; padding:10px; background:#fafafa;">
        
        <h3 style="text-align:center; color:#0055a5; margin:5px 0 10px 0;">HTTP Chat Box</h3>
        
        <!-- [NẰM TRÊN] Khung hiển thị danh sách tin nhắn -->
        <div style="background:#fff; border:1px solid #ccc; padding:10px; min-height:150px;">
            ${msgHTML || '<p style="color:#888; text-align:center; font-style:italic;">Chưa có tin nhắn nào...</p>'}
        </div>
        
        <!-- [NẰM DƯỚI] Khu vực chứa các nút chức năng và ô nhập liệu -->
        <div id="control-box" style="background:#fff; border:1px solid #ccc; padding:8px; margin-top:10px;">
            
            <!-- 1. KHU VỰC GỬI TIN NHẮN CHỮ -->
            <form action="/send" method="POST" style="margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td>
                            <input type="text" name="msg" placeholder="Nhập chữ tại đây..." style="width:95%; padding:6px; font-size:13px;" autofocus required>
                        </td>
                        <td width="20%">
                            <button type="submit" style="padding:6px 10px; font-weight:bold; width:100%; background:#0055a5; color:#fff; border:1px solid #004488;">Gửi</button>
                        </td>
                    </tr>
                </table>
            </form>

            <!-- 2. KHU VỰC CHỌN VÀ GỬI ẢNH RIÊNG BIỆT (Chuẩn Multipart tương thích máy cổ) -->
            <form action="/send-file" method="POST" enctype="multipart/form-data" style="margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td>
                            <input type="file" name="image" accept="image/*" style="font-size:12px; width:95%;" required>
                        </td>
                        <td width="20%">
                            <button type="submit" style="padding:6px 10px; font-weight:bold; width:100%; background:#27ae60; color:#fff; border:1px solid #219653;">Gửi ảnh</button>
                        </td>
                    </tr>
                </table>
            </form>

            <!-- 3. NÚT XÓA TOÀN BỘ PHÒNG CHAT -->
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

// 5. XỬ LÝ GỬI TIN NHẮN VĂN BẢN (HTTP POST)
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
  res.redirect("/#control-box");
});

// 6. XỬ LÝ NHẬN VÀ CHUYỂN ĐỔI FILE ẢNH (Dùng luồng dữ liệu raw để tương thích Opera Mini)
const multiparty = require('crypto'); // Tận dụng thư viện lõi không cần cài thêm npm ngoài express
app.post("/send-file", (req, res) => {
  let chunks = [];
  
  req.on('data', (chunk) => { chunks.push(chunk); });
  req.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const bodyStr = buffer.toString('binary');
    
    // Tìm kiếm vị trí dữ liệu file ảnh trong chuỗi Multipart raw
    const fileStartIdx = bodyStr.indexOf('\r\n\r\n') + 4;
    const fileEndIdx = bodyStr.lastIndexOf('\r\n--');
    
    if (fileStartIdx > 4 && fileEndIdx > fileStartIdx) {
      const fileContent = bodyStr.substring(fileStartIdx, fileEndIdx);
      const base64Data = Buffer.from(fileContent, 'binary').toString('base64');
      
      // Chỉ xử lý nếu tệp tin tải lên có dữ liệu thực tế
      if (base64Data.length > 100) {
        const userAgent = req.headers["user-agent"];
        messages.push({
          device: getDeviceName(userAgent),
          text: `data:image/png;base64,${base64Data}`, // Lưu chuỗi Base64 trực tiếp vào mảng chữ
          time: getTimeString(),
          isImage: true
        });
        if (messages.length > 25) messages.shift();
      }
    }
    res.redirect("/#control-box");
  });
});

// 7. XỬ LÝ XÓA SẠCH TIN NHẮN
app.post("/clear", (req, res) => {
  messages = [];
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});
