# Tháng Mười Một

Website tri ân Ngày Nhà giáo Việt Nam 20/11 có ba cảnh Lịch sử, Vườn thơ và Lưu bút.

## Chạy trên máy

Cần Node.js 24 trở lên. Dự án dùng thư viện có sẵn trong Node.js.

```sh
git clone https://github.com/buide03/20-11_Website.git
cd 20-11_Website
npm start
```

Mở [http://127.0.0.1:4173](http://127.0.0.1:4173). Lời nhắn được lưu trong `data/guestbook.sqlite` và còn sau khi khởi động lại. Nhấn `Ctrl+C` để dừng máy chủ.

## Tạo HTML demo

Tải tệp [demo.html](demo.html) trong kho mã và mở bằng trình duyệt. Phông chữ tiếng Việt, ảnh và hiệu ứng đã được nhúng trong tệp.

Sau khi chỉnh sửa mã nguồn, tạo lại tệp demo bằng lệnh sau.

```sh
npm run demo
```

Mở tệp `demo.html` trong trình duyệt. Tệp đã nhúng ảnh, mã định dạng và hiệu ứng. Lưu bút của bản demo dùng bộ nhớ cục bộ của trình duyệt.

## Deploy trên Render

Repo có sẵn `render.yaml` cho gói Web Service miễn phí. [Mở cấu hình triển khai trên Render](https://dashboard.render.com/blueprint/new?repo=https%3A%2F%2Fgithub.com%2Fbuide03%2F20-11_Website), kết nối GitHub nếu được yêu cầu, rồi chọn Apply để tạo dịch vụ.

Trong bản miễn phí, SQLite dùng filesystem tạm của Render. Những lời nhắn mới có thể mất sau khi dịch vụ khởi động lại hoặc deploy lại. 14 trang lưu bút và ảnh đi kèm được giữ trong repo.

Tạo Web Service từ repo này với các giá trị sau.

- Name dùng `baotuong-from-9a18-with-love`.
- Branch dùng `main`, runtime dùng Node và region dùng Singapore.
- Build Command dùng `node build.mjs`.
- Start Command dùng `node server.mjs`.
- Environment Variable `NODE_VERSION` dùng `24`.
- Health Check Path dùng `/api/luu-but`.

Máy chủ tự nhận `PORT` và `RENDER_EXTERNAL_URL` do Render cung cấp. Nếu gắn tên miền riêng, đặt `APP_ORIGIN` thành địa chỉ HTTPS chính của trang để nhận lời nhắn.

Để giữ lời nhắn SQLite sau các lần deploy và khởi động lại, gắn persistent disk vào `/var/data` và đặt `DATA_DIR=/var/data`. Persistent disk cần Web Service trả phí. Nếu chạy bằng filesystem tạm của Render, lời nhắn mới sẽ mất khi dịch vụ được tạo lại.

## Tệp nguồn

- `public/` chứa nội dung, ảnh, CSS và JavaScript của trang.
- `server.mjs` chạy máy chủ local và kết nối SQLite.
- `worker.mjs` xử lý yêu cầu của trang và lưu bút.
