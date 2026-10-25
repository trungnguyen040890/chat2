
  
const express = require("express");
const session = require("express-session");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 8080;

// Mật khẩu phòng chat riêng
const PRIVATE_PASSWORD = "0408";

// Cấu hình phiên đăng nhập
app.use(
  session({
    name: "httpchat.sid",
    secret:
      process.env.SESSION_SECRET ||
      "change-this-secret-before-deploying",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "5mb" }));

// Xử lý tải ảnh, tối đa 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Chỉ chấp nhận ảnh JPEG, PNG, GIF hoặc WebP."));
    }

    cb(null, true);
  },
});

// Lấy giờ Việt Nam
function getTimeString() {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

// Mã hóa nội dung trước khi hiển thị trong HTML
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
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
      /android\s?\d+[^;]*;\s?([^;)]+?)\s*(?:build\/[^;)]+)?\s*\)/i
    );

    if (match) {
      const model = match[1].trim();
      const modelMap = {
        "21061119dg": "Redmi 10",
        "m2101k7ag": "Redmi Note 10",
        "m2010j19sg": "Redmi 9T",
        "sm-g973f": "Samsung S10",
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

// Hai phòng có dữ liệu riêng biệt
const mainMessages = [
  {
    device: "Hệ thống",
    text: "Phòng chat HTTP 90s đã sẵn sàng hoạt động!",
    time: getTimeString(),
    isImage: false,
  },
];

const privateMessages = [
  {
    device: "Hệ thống",
    text: "Chào mừng đến với phòng chat riêng!",
    time: getTimeString(),
    isImage: false,
  },
];

function addMessage(list, req, text, isImage = false) {
  list.push({
    device: getDeviceName(req.headers["user-agent"]),
    text,
    time: getTimeString(),
    isImage,
  });

  if (list.length > 25) list.shift();
}

// Kiểm tra đăng nhập phòng riêng
function requirePrivateLogin(req, res, next) {
  if (req.session && req.session.privateLoggedIn === true) {
    return next();
  }

  return res.redirect("/private");
}

// Giao diện đăng nhập phòng riêng
function renderLogin(error = "") {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Đăng nhập phòng chat riêng</title>
</head>
<body style="font-family:sans-serif; max-width:500px; margin:0 auto;
padding:10px; background:#fafafa;">
  <h3 style="text-align:center; color:#0055a5;">HTTP Chat Box</h3>

  <div style="background:#fff; border:1px solid #ccc; padding:15px;">
    <h4 style="text-align:center;">PHÒNG CHAT RIÊNG</h4>
    <p style="text-align:center;">Nhập mật khẩu để tiếp tục</p>

    ${error ? `<p style="color:#cc0000;text-align:center;">${escapeHTML(error)}</p>` : ""}

    <form action="/private/login" method="POST">
      <input type="password" name="password"
        placeholder="Nhập mật khẩu..."
        autocomplete="current-password"
        required
        style="box-sizing:border-box;width:100%;padding:10px;margin-bottom:10px;">

      <button type="submit"
        style="width:100%;padding:9px;background:#0055a5;color:#fff;
        border:1px solid #004488;font-weight:bold;">
        VÀO PHÒNG CHAT
      </button>
    </form>

    <p style="text-align:center;margin-top:15px;">
      <a href="/">← Quay về phòng chat chính</a>
    </p>
  </div>
</body>
</html>`;
}

// Giao diện dùng chung cho cả hai phòng
function renderChat(messages, isPrivate) {
  let msgHTML = "";

  messages.forEach((m, index) => {
    const lastAttr =
      index === messages.length - 1 ? 'id="last-msg"' : "";

    const device = escapeHTML(m.device);
    const time = escapeHTML(m.time);

    let contentHTML;

    if (m.isImage) {
      // URL ảnh do server tạo từ file upload đã được kiểm tra loại MIME
      const safeImage = /^data:image\/(?:jpeg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(m.text)
        ? m.text
        : "";

      contentHTML = safeImage
        ? `<br><a href="${safeImage}" download="chat_image.png"
             title="Nhấn để tải ảnh về">
             <img src="${safeImage}" alt="Hình ảnh"
               style="max-width:100%;height:auto;margin-top:5px;
               border:1px solid #ddd;padding:2px;background:#fff;">
           </a>`
        : "[Ảnh không hợp lệ]";
    } else {
      contentHTML = escapeHTML(m.text);
    }

    msgHTML += `<p ${lastAttr}
      style="margin:8px 0;font-size:14px;line-height:1.4;
      border-bottom:1px dashed #eee;padding-bottom:5px;">
      [${time}] <span style="color:#e67e22;font-weight:bold;">
      &lt;${device}&gt;</span>: ${contentHTML}
    </p>`;
  });

  const prefix = isPrivate ? "/private" : "";
  const title = isPrivate
    ? "HTTP Chat Box - Phòng riêng"
    : "HTTP Chat Box";

  const roomLabel = isPrivate
    ? "PHÒNG CHAT RIÊNG"
    : "PHÒNG CHAT CHÍNH";

  const roomLink = isPrivate
    ? `<a href="/" style="color:#0055a5;">← Phòng chat chính</a>
       &nbsp; | &nbsp;
       <form action="/private/logout" method="POST"
         style="display:inline;margin:0;">
         <button type="submit" style="border:0;background:none;
         color:#cc0000;text-decoration:underline;cursor:pointer;">
         Thoát phòng riêng
         </button>
       </form>`
    : `<a href="/private" style="color:#0055a5;">
       🔒 Vào phòng chat riêng</a>`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="90;url=${prefix || ""}/#control-box">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <title>${title}</title>
</head>
<body style="font-family:sans-serif;max-width:500px;margin:0 auto;
padding:10px;background:#fafafa;">

  <h3 style="text-align:center;color:#0055a5;margin:5px 0 10px;">
    HTTP Chat Box
  </h3>

  <p style="text-align:center;font-size:12px;color:#666;">
    ${roomLabel}
  </p>

  <div style="background:#fff;border:1px solid #ccc;padding:10px;
  min-height:150px;">
    ${msgHTML || '<p style="color:#888;text-align:center;">Chưa có tin nhắn nào...</p>'}
  </div>

  <div id="control-box" style="background:#fff;border:1px solid #ccc;
  padding:8px;margin-top:10px;">

    <form action="${prefix}/send" method="POST"
      style="margin-bottom:12px;border-bottom:1px solid #eee;padding-bottom:10px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <input type="text" name="msg" placeholder="Nhập chữ tại đây..."
              style="box-sizing:border-box;width:95%;padding:6px;font-size:13px;"
              maxlength="2000" required>
          </td>
          <td width="20%">
            <button type="submit"
              style="padding:6px 10px;font-weight:bold;width:100%;
              background:#0055a5;color:#fff;border:1px solid #004488;">
              Gửi
            </button>
          </td>
        </tr>
      </table>
    </form>

    <form action="${prefix}/send-file" method="POST"
      enctype="multipart/form-data"
      style="margin-bottom:12px;border-bottom:1px solid #eee;padding-bottom:10px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <input type="file" name="image"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style="font-size:12px;width:95%;" required>
          </td>
          <td width="20%">
            <button type="submit"
              style="padding:6px 10px;font-weight:bold;width:100%;
              background:#27ae60;color:#fff;border:1px solid #219653;">
              Gửi ảnh
            </button>
          </td>
        </tr>
      </table>
    </form>

    <form action="${prefix}/clear" method="POST"
      onsubmit="return confirm('Bạn có chắc chắn muốn xóa hết tin nhắn trong phòng này không?');"
      style="margin:0;">
      <button type="submit"
        style="width:100%;padding:5px;font-size:12px;
        background:#cc0000;color:#fff;border:1px solid #aa0000;
        font-weight:bold;cursor:pointer;">
        ❌ XÓA TOÀN BỘ TIN NHẮN
      </button>
    </form>
  </div>

  <div style="font-size:11px;color:#888;text-align:center;
  margin-top:10px;padding-bottom:10px;">
    Trang web tự động cập nhật tin mới sau mỗi 90 giây...
  </div>

  <div style="font-size:12px;text-align:center;margin-top:5px;">
    ${roomLink}
  </div>
</body>
</html>`;
}

// ==============================
// PHÒNG CHAT CHÍNH - KHÔNG MẬT KHẨU
// ==============================

app.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.send(renderChat(mainMessages, false));
});

app.post("/send", (req, res) => {
  const text = typeof req.body.msg === "string"
    ? req.body.msg.trim()
    : "";

  if (text) addMessage(mainMessages, req, text);

  res.redirect("/#control-box");
});

app.post("/send-file", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("Vui lòng chọn một tệp ảnh hợp lệ.");
  }

  const base64 = req.file.buffer.toString("base64");
  const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

  addMessage(mainMessages, req, dataUrl, true);
  res.redirect("/#control-box");
});

app.post("/clear", (req, res) => {
  mainMessages.length = 0;
  res.redirect("/");
});

// ==============================
// PHÒNG CHAT RIÊNG - CẦN MẬT KHẨU
// ==============================

// Hiển thị trang đăng nhập hoặc phòng chat riêng
app.get("/private", (req, res) => {
  res.set("Cache-Control", "no-store");

  if (req.session.privateLoggedIn !== true) {
    const error = req.session.loginError || "";
    delete req.session.loginError;
    return res.send(renderLogin(error));
  }

  res.send(renderChat(privateMessages, true));
});

// Xác minh mật khẩu
app.post("/private/login", (req, res, next) => {
  const password = typeof req.body.password === "string"
    ? req.body.password
    : "";

  if (password !== PRIVATE_PASSWORD) {
    req.session.loginError = "Mật khẩu không đúng. Vui lòng thử lại.";
    return req.session.save((err) => {
      if (err) return next(err);
      res.redirect("/private");
    });
  }

  // Tạo session mới sau khi đăng nhập để giảm nguy cơ session fixation
  req.session.regenerate((err) => {
    if (err) return next(err);

    req.session.privateLoggedIn = true;

    req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      res.redirect("/private#control-box");
    });
  });
});

// Tất cả thao tác trong phòng riêng đều cần đăng nhập
app.post("/private/send", requirePrivateLogin, (req, res) => {
  const text = typeof req.body.msg === "string"
    ? req.body.msg.trim()
    : "";

  if (text) addMessage(privateMessages, req, text);

  res.redirect("/private#control-box");
});

app.post(
  "/private/send-file",
  requirePrivateLogin,
  upload.single("image"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).send("Vui lòng chọn một tệp ảnh hợp lệ.");
    }

    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    addMessage(privateMessages, req, dataUrl, true);
    res.redirect("/private#control-box");
  }
);

app.post("/private/clear", requirePrivateLogin, (req, res) => {
  privateMessages.length = 0;
  res.redirect("/private");
});

// Đăng xuất phòng riêng
app.post("/private/logout", requirePrivateLogin, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);

    res.clearCookie("httpchat.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.redirect("/private");
  });
});

// Xử lý lỗi tải tệp
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).send("Ảnh vượt quá giới hạn 5 MB.");
    }

    return res.status(400).send("Không thể tải ảnh lên.");
  }

  if (err) {
    console.error(err);
    return res.status(400).send(
      err.message || "Đã xảy ra lỗi khi xử lý yêu cầu."
    );
  }

  next();
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});
