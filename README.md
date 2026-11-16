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

```sh
npm run demo
```

Mở tệp `demo.html` trong trình duyệt. Tệp đã nhúng ảnh, mã định dạng và hiệu ứng. Lưu bút của bản demo dùng bộ nhớ cục bộ của trình duyệt.

## Tệp nguồn

- `public/` chứa nội dung, ảnh, CSS và JavaScript của trang.
- `server.mjs` chạy máy chủ local và kết nối SQLite.
- `worker.mjs` xử lý yêu cầu của trang và lưu bút.
