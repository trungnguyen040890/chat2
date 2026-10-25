

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

// Cấu hình đọc dữ liệu form
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "5mb" }));

// Nhận ảnh và lưu tạm trong RAM
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file hình ảnh."));
    }
  }
});

// Định dạng thời gian Việt Nam
function getTimeString() {
  const now = new Date();

  return now.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).substring(0, 5);
}

// Nhận diện thiết bị
function getDeviceName(userAgentString) {
  if (!userAgentString) return "Thiết bị ẩn danh";

  const ua = userAgentString.toLowerCase();

  if (ua.includes("blackberry")) {
    const match = userAgentString.match(/BlackBerry\s?(\d{4})/i);
    return match ? `BlackBerry ${match[1]}` : "BlackBerry";
  }

  if (ua.includes("android")) {
    const match = userAgentString.match(
      /android\s?\d+[^;]*;\s?([^;)]+?)(?:\s+build\/[^;)]+)?\s*\)/i
    );

    if (match) {
      const model = match[1].trim();

      const modelMap = {
        "21061119dg": "Redmi 10",
        "m2101k7ag": "Redmi Note 10",
        "m2010j19sg": "Redmi 9T",
        "sm-g973f": "Samsung S10"
      };

      return modelMap[model.toLowerCase()] ||
        model.charAt(0).toUpperCase() + model.slice(1);
    }

    return "Thiết bị Android";
  }

  if (ua.includes("iphone")) {
    if (ua.includes("iphone11,8")) return "iPhone XR";
    if (ua.includes("iphone12,1")) return "iPhone 11";
    return "iPhone";
  }

  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("windows nt")) return "Máy tính PC";

  return "Thiết bị lạ";
}

// Chống chèn HTML vào tin nhắn
function escapeHTML(value) {
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

// Danh sách tin nhắn
let messages = [
  {
    device: "Hệ thống",
    text: "Xin chào!",
    time: getTimeString(),
    isImage: false
  }
];

// Chỉ lưu tối đa 25 tin nhắn
function addMessage(message) {
  messages.push(message);

  if (messages.length > 25) {
    messages.shift();
  }
}

// Bảng định dạng ảnh được hỗ trợ
const allowedTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/avif": "avif"
};

// Phân tích dữ liệu ảnh Base64
function getImageBuffer(message) {
  if (!message || !message.isImage || !message.text) {
    return null;
  }

  const match = message.text.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/
  );

  if (!match || !allowedTypes[match[1]]) {
    return null;
  }

  return {
    mimeType: match[1],
    extension: allowedTypes[match[1]],
    buffer: Buffer.from(match[2], "base64")
  };
}

// 1. URL HIỂN THỊ VÀ TẢI ẢNH
app.get("/image/:id", (req, res) => {
  const message = messages.find(
    (m) => m.isImage && m.id === req.params.id
  );

  if (!message) {
    return res.status(404).send("Ảnh không tồn tại hoặc đã bị xóa.");
  }

  const image = getImageBuffer(message);

  if (!image) {
    return res.status(400).send("Dữ liệu ảnh không hợp lệ.");
  }

  res.setHeader("Content-Type", image.mimeType);
  res.setHeader("Content-Length", image.buffer.length);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");

  // Có ?download=1 thì yêu cầu tải file
  if (req.query.download === "1") {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="chat_image_${message.id}.${image.extension}"`
    );
  } else {
    res.setHeader("Content-Disposition", "inline");
  }

  res.end(image.buffer);
});

// 2. GIAO DIỆN PHÒNG CHAT
app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  let msgHTML = "";

  messages.forEach((m, index) => {
    const isLast =
      index === messages.length - 1 ? 'id="last-msg"' : "";

    let contentHTML = escapeHTML(m.text);

    if (m.isImage && m.id) {
      const imageURL = `/image/${encodeURIComponent(m.id)}`;
      const downloadURL = `${imageURL}?download=1`;

      contentHTML = `
        <br>
        <a href="${imageURL}" target="_blank">
          <img
            src="${imageURL}"
            alt="Hình ảnh"
            style="max-width:100%;height:auto;margin-top:5px;border:1px solid #ddd;padding:2px;background:#fff;"
          >
        </a>
        <br>
        <a href="${downloadURL}">
          [Tải ảnh về điện thoại]
        </a>
      `;
    }

    msgHTML += `
      <p ${isLast} style="
        margin:8px 0;
        font-size:14px;
        line-height:1.4;
        border-bottom:1px dashed #eee;
        padding-bottom:5px;
        overflow-wrap:anywhere;
      ">
        [${escapeHTML(m.time)}]
        <span style="color:#e67e22;font-weight:bold;">
          &lt;${escapeHTML(m.device)}&gt;
        </span>:
        ${contentHTML}
      </p>
    `;
  });

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="refresh" content="90;url=/#control-box">
      <title>HTTP Chat 90s</title>
    </head>

    <body style="
      font-family:sans-serif;
      max-width:500px;
      margin:0 auto;
      padding:10px;
      background:#fafafa;
    ">
      <h3 style="
        text-align:center;
        color:#0055a5;
        margin:5px 0 10px;
      ">
        CHÚC MỘT NGÀY TỐT LÀNH
      </h3>

      <div style="
        background:#fff;
        border:1px solid #ccc;
        padding:10px;
        min-height:150px;
      ">
        ${
          msgHTML ||
          '<p style="color:#888;text-align:center;">Chưa có tin nhắn nào...</p>'
        }
      </div>

      <div id="control-box" style="
        background:#fff;
        border:1px solid #ccc;
        padding:8px;
        margin-top:10px;
      ">
        <form action="/send" method="POST" style="
          margin-bottom:12px;
          border-bottom:1px solid #eee;
          padding-bottom:10px;
        ">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <input
                  type="text"
                  name="msg"
                  placeholder="Soạn tin nhắn..."
                  style="width:95%;padding:6px;font-size:13px;"
                  required
                >
              </td>
              <td width="20%">
                <button type="submit" style="
                  padding:6px 10px;
                  font-weight:bold;
                  width:100%;
                  background:#0055a5;
                  color:#fff;
                  border:1px solid #004488;
                ">Gửi</button>
              </td>
            </tr>
          </table>
        </form>

        <form action="/send-file" method="POST"
          enctype="multipart/form-data"
          style="margin-bottom:12px;border-bottom:1px solid #eee;padding-bottom:10px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  style="font-size:12px;width:95%;"
                  required
                >
              </td>
              <td width="20%">
                <button type="submit" style="
                  padding:6px 10px;
                  font-weight:bold;
                  width:100%;
                  background:#27ae60;
                  color:#fff;
                  border:1px solid #219653;
                ">Gửi ảnh</button>
              </td>
            </tr>
          </table>
        </form>

        <form action="/clear" method="POST"
          onsubmit="return confirm('Bạn có chắc chắn muốn xóa hết tin nhắn không?');"
          style="margin:0;">
          <button type="submit" style="
            width:100%;
            padding:5px;
            font-size:12px;
            background:#cc0000;
            color:#fff;
            border:1px solid #aa0000;
            font-weight:bold;
            cursor:pointer;
          ">
            XÓA TOÀN BỘ TIN NHẮN
          </button>
        </form>
      </div>

      <div style="
        font-size:11px;
        color:#888;
        text-align:center;
        margin-top:10px;
        padding-bottom:20px;
      ">
        Trang web tự động cập nhật tin mới sau mỗi 90 giây...
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// 3. GỬI TIN NHẮN VĂN BẢN
app.post("/send", (req, res) => {
  const msgText = req.body.msg;

  if (msgText && msgText.trim() !== "") {
    addMessage({
      device: getDeviceName(req.headers["user-agent"]),
      text: msgText.trim(),
      time: getTimeString(),
      isImage: false
    });
  }

  res.redirect("/#control-box");
});

// 4. GỬI ẢNH
app.post("/send-file", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError &&
          err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).send(
          "Ảnh vượt quá 5 MB. Vui lòng chọn ảnh nhỏ hơn."
        );
      }

      return res.status(400).send(
        escapeHTML(err.message || "Không thể tải ảnh lên.")
      );
    }

    if (!req.file) {
      return res.status(400).send("Vui lòng chọn ảnh trước khi gửi.");
    }

    if (!allowedTypes[req.file.mimetype]) {
      return res.status(400).send(
        "Định dạng chưa hỗ trợ. Hãy chọn JPG, PNG, GIF, WEBP, BMP hoặc AVIF."
      );
    }

    const base64Data = req.file.buffer.toString("base64");
    const imageDataURL =
      `data:${req.file.mimetype};base64,${base64Data}`;

    addMessage({
      id: crypto.randomBytes(12).toString("hex"),
      device: getDeviceName(req.headers["user-agent"]),
      text: imageDataURL,
      time: getTimeString(),
      isImage: true
    });

    res.redirect("/#control-box");
  });
});

// 5. XÓA TIN NHẮN
app.post("/clear", (req, res) => {
  messages = [];
  res.redirect("/");
});

// 6. XỬ LÝ LỖI
app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).send("Đã xảy ra lỗi trên máy chủ.");
});

// 7. KHỞI ĐỘNG SERVER
app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});
