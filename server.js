const express = require("express");
const app = express();

const PORT = process.env.PORT || 8080;
app.use(express.urlencoded({ extended: true }));

function getTimeString() {
  const now = new Date();
  const options = { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false };
  return now.toLocaleString('vi-VN', options).substring(0, 5);
}

// Hàm phân tích thông minh tách dòng máy, đời máy chi tiết
function getDeviceName(userAgentString) {
  if (!userAgentString) return "Thiết bị ẩn danh";
  
  const ua = userAgentString.toLowerCase();

  // 1. NHẬN DIỆN BLACKBERRY (Lấy trực tiếp số đời máy trong chuỗi)
  if (ua.includes("blackberry")) {
    const bbMatch = userAgentString.match(/BlackBerry\s?(\d{4})/i);
    return bbMatch ? `BlackBerry ${bbMatch[1]}` : "BlackBerry";
  }

  // 2. NHẬN DIỆN CÁC DÒNG ANDROID (Xiaomi, Redmi, Samsung, Oppo...)
  if (ua.includes("android")) {
    // Trích xuất mã máy nằm sau chữ "Android...; " và trước chữ "Build"
    const androidMatch = userAgentString.match(/android\s?\d+[^;]*;\s?([^;)]+)\s?build/i);
    if (androidMatch) {
      let model = androidMatch[1].trim();
      
      // Dịch các mã máy phổ biến của Redmi/Xiaomi/Samsung sang tên thương mại
      const modelMap = {
        "21061119dg": "Redmi 10",
        "m2101k7ag": "Redmi Note 10",
        "m2010j19sg": "Redmi 9T",
        "sm-g973f": "Samsung S10",
        "sm-g998b": "Samsung S21 Ultra",
        "sm-a525f": "Samsung A52"
      };
      
      if (modelMap[model.toLowerCase()]) {
        return modelMap[model.toLowerCase()];
      }
      
      // Nếu là tên chữ viết liền, viết hoa chữ cái đầu cho đẹp
      return model.charAt(0).toUpperCase() + model.slice(1);
    }
    return "Thiết bị Android";
  }

  // 3. NHẬN DIỆN IPHONE / IPAD (Apple giấu mã máy rất kỹ, cần map mã phần cứng)
  if (ua.includes("iphone") || ua.includes("ipad")) {
    // Nếu là trình duyệt thông thường trên iOS, UA chỉ ghi "iPhone" hoặc "iPad"
    // Ta bóc tách phiên bản iOS để đoán thế hệ nếu không có mã phần cứng sâu
    if (ua.includes("iphone")) {
      // Bản đồ ánh xạ một số chuỗi định danh đặc biệt từ các ứng dụng/trình duyệt sâu hoặc Opera Mini trên iOS
      if (ua.includes("iphone11,8")) return "iPhone XR";
      if (ua.includes("iphone10,1") || ua.includes("iphone10,4")) return "iPhone 8";
      if (ua.includes("iphone12,1")) return "iPhone 11";
      if (ua.includes("iphone13,2")) return "iPhone 12";
      if (ua.includes("iphone14,5")) return "iPhone 13";
      
      return "iPhone";
    }
    if (ua.includes("ipad")) {
      if (ua.includes("ipad7,11") || ua.includes("ipad7,12")) return "iPad 2019";
      return "iPad";
    }
  }

  // 4. CÁC THIẾT BỊ CỔ KHÁC (Nokia, Windows Phone...)
  if (ua.includes("nokia")) {
    const nokiaMatch = userAgentString.match(/Nokia([^;/\s)]+)/i);
    return nokiaMatch ? `Nokia ${nokiaMatch[1]}` : "Nokia";
  }
  
  if (ua.includes("windows nt")) return "Máy tính PC";
  if (ua.includes("macintosh")) return "Máy tính Mac";

  return "Thiết bị lạ";
}

let messages = [
  {
    device: "Hệ thống",
    text: "Phòng chat HTTP 15s đã sẵn sàng hoạt động!",
    time: getTimeString(), 
  },
];

app.get("/", (req, res) => {
  let msgHTML = "";
  messages.forEach((m, index) => {
    const isLast = index === messages.length - 1 ? 'id="last-msg"' : '';
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
        <div style="background:#fff; border:1px solid #ccc; padding:10px; min-height:150px;">
            ${msgHTML || '<p style="color:#888; text-align:center; font-style:italic;">Chưa có tin nhắn nào...</p>'}
        </div>
        <div id="control-box" style="background:#fff; border:1px solid #ccc; padding:8px; margin-top:10px;">
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

app.post("/send", (req, res) => {
  const msgText = req.body.msg;
  if (msgText && msgText.trim() !== "") {
    const userAgent = req.headers["user-agent"];
    const deviceName = getDeviceName(userAgent);

    messages.push({
      device: deviceName,
      text: msgText,
      time: getTimeString(),
    });
    if (messages.length > 25) messages.shift();
  }
  res.redirect("/#control-box");
});

app.post("/clear", (req, res) => {
  messages = [];
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});
