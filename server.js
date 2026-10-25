
const express = require("express");
const multer = require("multer");

const app = express();

// Sử dụng cổng do Render cấp phát hoặc 8080 nếu chạy cục bộ
const PORT = process.env.PORT || 8080;

// Cấu hình đọc dữ liệu Form POST chuẩn HTTP
app.use(express.urlencoded({ extended: true }));

// Giới hạn dữ liệu JSON
app.use(express.json({ limit: "5mb" }));

// Cấu hình nhận file ảnh, lưu tạm trong RAM
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // Tối đa 5 MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file hình ảnh."));
    }
  }
});

// 1. Lấy thời gian hiện tại theo múi giờ Việt Nam
function getTimeString() {
  const now = new Date();

  const options = {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  };

  return now.toLocaleString("vi-VN", options).substring(0, 5);
}

// 2. Nhận diện thiết bị từ User-Agent
function getDeviceName(userAgentString) {
  if (!userAgentString) return "Thiết bị ẩn danh";

  const ua = userAgentString.toLowerCase();

  if (ua.includes("blackberry")) {
    const bbMatch = userAgentString.match(/BlackBerry\s?(\d{4})/i);
    return bbMatch ? `BlackBerry ${bbMatch[1]}` : "BlackBerry";
  }

  if (ua.includes("android")) {
    const androidMatch = userAgentString.match(
      /android\s?\d+[^;]*;\s?([^;)]+?)\s?(?:build\/[^;)]+)?\s*\)/i
    );

    if (androidMatch) {
      const model = androidMatch[1].trim();

      const modelMap = {
        "21061119dg": "Redmi 10",
        "m2101k7ag": "Redmi Note 10",
        "m2010j19sg": "Redmi 9T",
        "sm-g973f": "Samsung S10"
      };

      if (modelMap[model.toLowerCase()]) {
        return modelMap[model.toLowerCase()];
      }

      return model.charAt(0).toUpperCase() + model.slice(1);
    }

    return "Thiết bị Android";
  }

  if (ua.includes("iphone") || ua.includes("ipad")) {
    if (ua.includes("iphone11,8")) return "iPhone XR";
    if (ua.includes("iphone12,1")) return "iPhone 11";
    if (ua.includes("iphone")) return "iPhone";

    return "iPad";
  }

  if (ua.includes("windows nt")) return "Máy tính PC";

  return "Thiết bị lạ";
}

// 3. Danh sách tin nhắn lưu trong RAM
let messages = [
  {
    device: "Hệ thống",
    text: "Phòng chat đã sẵn sàng hoạt động!",
    time: getTimeString(),
    isImage: false
  }
];

// Hàm giới hạn tối đa 25 tin nhắn
function addMessage(message) {
  messages.push(message);

  if (messages.length > 25) {
    messages.shift();
  }
}

// Hàm chống chèn HTML khi hiển thị tin nhắn văn bản
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

// 4. GIAO DIỆN PHÒNG CHAT
app.get("/", (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-cache, no-store, must-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  let msgHTML = "";

  messages.forEach((m, index) => {
    const isLast =
      index === messages.length - 1 ? 'id="last-msg"' : "";

    let contentHTML = escapeHTML(m.text);

    if (m.isImage) {
      // Ảnh mở trong tab mới khi nhấn vào
      const imageURL = escapeHTML(m.text);

      contentHTML = `
        <br>
        <a
          href="${imageURL}"
          target="_blank"
          rel="noopener noreferrer"
          title="Nhấn để mở ảnh trong tab mới"
          style="display:inline-block;"
        >
          <img
            src="${imageURL}"
            alt="Hình ảnh"
            style="
              max-width:100%;
              height:auto;
              margin-top:5px;
              border:1px solid #ddd;
              padding:2px;
              background:#fff;
              cursor:pointer;
            "
          >
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

      <!-- KHU VỰC HIỂN THỊ TIN NHẮN -->
      <div style="
        background:#fff;
        border:1px solid #ccc;
        padding:10px;
        min-height:150px;
      ">
        ${
          msgHTML ||
          '<p style="color:#888;text-align:center;font-style:italic;">Chưa có tin nhắn nào...</p>'
        }
      </div>

      <!-- KHU VỰC CHỨC NĂNG -->
      <div
        id="control-box"
        style="
          background:#fff;
          border:1px solid #ccc;
          padding:8px;
          margin-top:10px;
        "
      >

        <!-- GỬI TIN NHẮN VĂN BẢN -->
        <form
          action="/send"
          method="POST"
          style="
            margin-bottom:12px;
            border-bottom:1px solid #eee;
            padding-bottom:10px;
          "
        >
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
                <button
                  type="submit"
                  style="
                    padding:6px 10px;
                    font-weight:bold;
                    width:100%;
                    background:#0055a5;
                    color:#fff;
                    border:1px solid #004488;
                  "
                >
                  Gửi
                </button>
              </td>
            </tr>
          </table>
        </form>

        <!-- GỬI ẢNH -->
        <form
          action="/send-file"
          method="POST"
          enctype="multipart/form-data"
          style="
            margin-bottom:12px;
            border-bottom:1px solid #eee;
            padding-bottom:10px;
          "
        >
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
                <button
                  type="submit"
                  style="
                    padding:6px 10px;
                    font-weight:bold;
                    width:100%;
                    background:#27ae60;
                    color:#fff;
                    border:1px solid #219653;
                  "
                >
                  Gửi ảnh
                </button>
              </td>
            </tr>
          </table>
        </form>

        <!-- XÓA TOÀN BỘ TIN NHẮN -->
        <form
          action="/clear"
          method="POST"
          onsubmit="return confirm('Bạn có chắc chắn muốn xóa hết tin nhắn không?');"
          style="margin:0;"
        >
          <button
            type="submit"
            style="
              width:100%;
              padding:5px;
              font-size:12px;
              background:#cc0000;
              color:#fff;
              border:1px solid #aa0000;
              font-weight:bold;
              cursor:pointer;
            "
          >
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

// 5. XỬ LÝ GỬI TIN NHẮN VĂN BẢN
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

// 6. XỬ LÝ GỬI ẢNH
app.post("/send-file", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).send(
          "Ảnh vượt quá dung lượng cho phép 5 MB. Vui lòng chọn ảnh nhỏ hơn."
        );
      }

      return res.status(400).send(
        escapeHTML(err.message || "Không thể tải ảnh lên.")
      );
    }

    if (!req.file) {
      return res.status(400).send("Vui lòng chọn ảnh trước khi gửi.");
    }

    // Chỉ nhận những MIME type hình ảnh thông dụng
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/avif"
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).send("Định dạng ảnh này chưa được hỗ trợ.");
    }

    const base64Data = req.file.buffer.toString("base64");
    const imageDataURL =
      `data:${req.file.mimetype};base64,${base64Data}`;

    addMessage({
      device: getDeviceName(req.headers["user-agent"]),
      text: imageDataURL,
      time: getTimeString(),
      isImage: true
    });

    res.redirect("/#control-box");
  });
});

// 7. XÓA TOÀN BỘ TIN NHẮN
app.post("/clear", (req, res) => {
  messages = [];
  res.redirect("/");
});

// 8. XỬ LÝ LỖI KHÔNG DỰ KIẾN
app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).send("Đã xảy ra lỗi trên máy chủ.");
});

// 9. KHỞI ĐỘNG SERVER
app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});
