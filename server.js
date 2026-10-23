
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
    const isLast = index === messages.length - 1 ? 'id="last-msg"' : '';
    msgHTML += `<p ${isLast} style="margin:5px 0; font-size:14px; line-height:1.4;">[${m.time}] ${m.text}</p>`;
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="15;url=/#last-msg">
        <title>HTTP Chat 15s</title>
    </head>
    <body style="font-family:sans-serif; max-width:500px; margin:10px auto; padding:10px; background:#fafafa;">
        <h3 style="text-align:center; color:#0055a5; margin-top:0; margin-bottom:10px;">HTTP Chat Box</h3>
        <div style="border:1px solid #ccc; background:#fff; height:280px; overflow-y:scroll; padding:10px; margin-bottom:10px;">
            ${msgHTML}
        </div>
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

  res.redirect("/#last-msg");
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});
