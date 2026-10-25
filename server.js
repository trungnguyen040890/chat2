
  
const express = require("express");
const multer = require("multer");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

const MAX_MESSAGES = 25;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_TOTAL_MESSAGE_BYTES = 12 * 1024 * 1024; // 12 MB

// Đọc dữ liệu form thông thường
app.use(express.urlencoded({
  extended: true,
  limit: "10kb"
}));

// Không lưu dữ liệu upload vào ổ đĩa.
// Giới hạn kích thước ảnh để hạn chế tiêu thụ RAM.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
    fields: 0,
    parts: 1
  }
});

// ==================================================
// 1. HÀM TIỆN ÍCH
// ==================================================

function getTimeString() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date());
}

// Mã hóa HTML để chống chèn mã XSS
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[char];
  });
}

// Nhận diện tên thiết bị từ User-Agent.
// Lưu ý: User-Agent có thể bị giả mạo và thường
// không cung cấp chính xác mã phần cứng iPhone.
function getDeviceName(userAgentString) {
  if (!userAgentString) return "Thiết bị ẩn danh";

  const ua = userAgentString.toLowerCase();

  if (ua.includes("blackberry")) {
    const match = userAgentString.match(/BlackBerry\s?(\d{4})/i);
    return match ? `BlackBerry ${match[1]}` : "BlackBerry";
  }

  if (ua.includes("android")) {
    const match = userAgentString.match(
      /Android\s[\d.]+;\s*([^;)]+)/i
    );

    if (match) {
      const model = match[1]
        .replace(/\s+Build\/.*$/i, "")
        .trim();

      const modelMap = {
        "21061119dg": "Redmi 10",
        "m2101k7ag": "Redmi Note 10",
        "m2010j19sg": "Redmi 9T",
        "sm-g973f": "Samsung S10"
      };

      const mapped = modelMap[model.toLowerCase()];

      if (mapped) return mapped;

      // Bỏ qua các tên chung thay vì coi chúng là mã máy
      if (/^(?:wv|k|mobile|unknown)$/i.test(model)) {
        return "Thiết bị Android";
      }

      return model || "Thiết bị Android";
    }

    return "Thiết bị Android";
  }

  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("windows nt")) return "Máy tính Windows";
  if (ua.includes("macintosh")) return "Máy tính Mac";
  if (ua.includes("linux")) return "Máy tính Linux";

  return "Thiết bị khác";
}

// Kiểm tra định dạng ảnh bằng chữ ký tệp thực tế.
// Không cho phép SVG vì SVG có thể chứa mã HTML/JavaScript.
function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;

  // PNG
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return "image/png";
  }

  // JPEG
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // GIF
  if (
    buffer.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(
      buffer.subarray(0, 6).toString("ascii")
    )
  ) {
    return "image/gif";
  }

  // WebP
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

// ==================================================
// 2. QUẢN LÝ TIN NHẮN TRONG RAM
// ==================================================

let messages = [
  {
    device: "Hệ thống",
    text: "Phòng chat đã sẵn sàng hoạt động!",
    time: getTimeString(),
    isImage: false
  }
];

// Giới hạn cả số lượng tin nhắn và tổng dung lượng
// nội dung lưu trong RAM.
function addMessage(message) {
  messages.push(message);

  while (
    messages.length > MAX_MESSAGES ||
    (
      messages.length > 1 &&
      messages.reduce((total, item) => {
        return total + Buffer.byteLength(item.text, "utf8");
      }, 0) > MAX_TOTAL_MESSAGE_BYTES
    )
  ) {
    messages.shift();
  }
}

// ==================================================
// 3. GIAO DIỆN PHÒNG CHAT
// ==================================================

app.get("/", (req, res) => {
  res.set({
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'none'; " +
      "img-src data:; " +
      "style-src 'unsafe-inline'; " +
      "form-action 'self'; " +
      "base-uri 'none'; " +
      "frame-ancestors 'none'"
  });

  let msgHTML = "";

  messages.forEach((m, index) => {
    const isLast =
      index === messages.length - 1 ? 'id="last-msg"' : "";

    let contentHTML;

    if (m.isImage) {
      // m.text là Data URL được tạo từ ảnh đã kiểm tra.
      const safeImage = escapeHtml(m.text);
      const safeTime = escapeHtml(m.time);

      contentHTML = `
        <br>
        <a href="${safeImage}"
           download="chat_image_${safeTime.replace(":", "-")}"
           title="Nhấn để tải ảnh về">
          <img
            src="${safeImage}"
            alt="Hình ảnh"
            loading="lazy"
            style="max-width:100%;height:auto;margin-top:5px;
                   border:1px solid #ddd;padding:2px;background:#fff;"
          >
        </a>
      `;
    } else {
      // Chỉ cho phép nội dung văn bản, không thực thi HTML.
      contentHTML = escapeHtml(m.text).replace(/\r?\n/g, "<br>");
    }

    msgHTML += `
      <p ${isLast}
         style="margin:8px 0;font-size:14px;line-height:1.4;
                border-bottom:1px dashed #eee;padding-bottom:5px;
                overflow-wrap:anywhere;">
        [${escapeHtml(m.time)}]
        <span style="color:#e67e22;font-weight:bold;">
          &lt;${escapeHtml(m.device)}&gt;
        </span>:
        ${contentHTML}
      </p>
    `;
  });

  // Chỉ hiển thị các thông báo cố định do máy chủ định nghĩa.
  const errorMessages = {
    upload: "Ảnh tải lên không hợp lệ hoặc vượt quá 5 MB.",
    format: "Định dạng ảnh không được hỗ trợ. Hãy dùng PNG, JPEG, GIF hoặc WebP.",
    admin: "Chưa cấu hình mật khẩu quản trị ADMIN_PASSWORD trên máy chủ.",
    denied: "Mật khẩu quản trị không chính xác."
  };

  const errorKey =
    typeof req.query.error === "string" ? req.query.error : "";

  const errorHTML = errorMessages[errorKey]
    ? `<p role="alert" style="color:#c0392b;font-size:13px;">
         ${escapeHtml(errorMessages[errorKey])}
       </p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="refresh" content="90;url=/#control-box">
      <title>HTTP Chat 90s</title>
    </head>

    <body style="font-family:sans-serif;max-width:500px;margin:0 auto;
                 padding:10px;background:#fafafa;">

      <h3 style="text-align:center;color:#0055a5;margin:5px 0 10px 0;">
        CHÚC MỘT NGÀY TỐT LÀNH
      </h3>

      <div style="background:#fff;border:1px solid #ccc;
                  padding:10px;min-height:150px;">
        ${msgHTML || `
          <p style="color:#888;text-align:center;font-style:italic;">
            Chưa có tin nhắn nào...
          </p>
        `}
      </div>

      <div id="control-box"
           style="background:#fff;border:1px solid #ccc;
                  padding:8px;margin-top:10px;">

        ${errorHTML}

        <!-- Gửi tin nhắn văn bản -->
        <form action="/send" method="POST"
              style="margin-bottom:12px;border-bottom:1px solid #eee;
                     padding-bottom:10px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <input
                  type="text"
                  name="msg"
                  maxlength="${MAX_MESSAGE_LENGTH}"
                  placeholder="Soạn tin nhắn..."
                  autocomplete="off"
                  required
                  style="width:95%;padding:6px;font-size:13px;"
                >
              </td>
              <td width="20%">
                <button type="submit"
                        style="padding:6px 10px;font-weight:bold;width:100%;
                               background:#0055a5;color:#fff;
                               border:1px solid #004488;">
                  Gửi
                </button>
              </td>
            </tr>
          </table>
        </form>

        <!-- Gửi ảnh -->
        <form action="/send-file" method="POST"
              enctype="multipart/form-data"
              style="margin-bottom:12px;border-bottom:1px solid #eee;
                     padding-bottom:10px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <input type="file" name="image"
                       accept="image/png,image/jpeg,image/gif,image/webp"
                       required
                       style="font-size:12px;width:95%;">
                <div style="font-size:11px;color:#888;margin-top:4px;">
                  PNG, JPEG, GIF hoặc WebP — tối đa 5 MB
                </div>
              </td>
              <td width="20%">
                <button type="submit"
                        style="padding:6px 10px;font-weight:bold;width:100%;
                               background:#27ae60;color:#fff;
                               border:1px solid #219653;">
                  Gửi ảnh
                </button>
              </td>
            </tr>
          </table>
        </form>

        <!-- Xóa tin nhắn: yêu cầu mật khẩu quản trị -->
        <form action="/clear" method="POST"
              onsubmit="return confirm('Bạn có chắc chắn muốn xóa hết tin nhắn không?');"
              style="margin:0;">
          <input
            type="password"
            name="adminPassword"
            placeholder="Mật khẩu quản trị"
            autocomplete="current-password"
            required
            style="box-sizing:border-box;width:100%;padding:7px;
                   margin-bottom:6px;"
          >
          <button type="submit"
                  style="width:100%;padding:5px;font-size:12px;
                         background:#cc0000;color:#fff;
                         border:1px solid #aa0000;font-weight:bold;
                         cursor:pointer;">
            XÓA TOÀN BỘ TIN NHẮN
          </button>
        </form>
      </div>

      <div style="font-size:11px;color:#888;text-align:center;
                  margin-top:10px;padding-bottom:20px;">
        Trang web tự động cập nhật tin mới sau mỗi 90 giây...
      </div>
    </body>
    </html>
  `;

  res.type("html").send(html);
});

// ==================================================
// 4. XỬ LÝ GỬI TIN NHẮN
// ==================================================

app.post("/send", (req, res) => {
  if (typeof req.body.msg !== "string") {
    return res.redirect("/#control-box");
  }

  const msgText = req.body.msg.trim();

  if (msgText && msgText.length <= MAX_MESSAGE_LENGTH) {
    addMessage({
      device: getDeviceName(req.headers["user-agent"]),
      text: msgText,
      time: getTimeString(),
      isImage: false
    });
  }

  return res.redirect("/#control-box");
});

// ==================================================
// 5. XỬ LÝ GỬI ẢNH
// ==================================================

app.post("/send-file", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      // Không hiển thị chi tiết lỗi nội bộ cho người dùng.
      return res.redirect("/?error=upload#control-box");
    }

    next();
  });
}, (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.redirect("/?error=upload#control-box");
  }

  // Không tin MIME type do trình duyệt gửi lên.
  const mimeType = detectImageType(req.file.buffer);

  if (!mimeType) {
    return res.redirect("/?error=format#control-box");
  }

  const base64Data = req.file.buffer.toString("base64");

  addMessage({
    device: getDeviceName(req.headers["user-agent"]),
    text: `data:${mimeType};base64,${base64Data}`,
    time: getTimeString(),
    isImage: true
  });

  return res.redirect("/#control-box");
});

// ==================================================
// 6. XÓA TIN NHẮN — CHỈ QUẢN TRỊ VIÊN
// ==================================================

function checkAdminPassword(inputPassword) {
  const configuredPassword = process.env.ADMIN_PASSWORD;

  // Không cho phép xóa nếu chưa cấu hình mật khẩu.
  if (
    typeof configuredPassword !== "string" ||
    configuredPassword.length === 0 ||
    typeof inputPassword !== "string"
  ) {
    return false;
  }

  const expected = Buffer.from(configuredPassword, "utf8");
  const actual = Buffer.from(inputPassword, "utf8");

  // timingSafeEqual yêu cầu hai buffer có cùng độ dài.
  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}

app.post("/clear", (req, res) => {
  if (!process.env.ADMIN_PASSWORD) {
    return res.redirect("/?error=admin#control-box");
  }

  if (!checkAdminPassword(req.body.adminPassword)) {
    return res.redirect("/?error=denied#control-box");
  }

  messages = [];
  return res.redirect("/#control-box");
});

// ==================================================
// 7. XỬ LÝ LỖI CHUNG
// ==================================================

app.use((err, req, res, next) => {
  console.error("Lỗi máy chủ:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).send("Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.");
});

// ==================================================
// 8. KHỞI ĐỘNG MÁY CHỦ
// ==================================================

app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});
