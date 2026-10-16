# 🎡 Vòng Quay May Mắn — Lớp 9A1

Website tĩnh (HTML/CSS/JS thuần, không cần build). Mỗi bạn nữ quay vòng quay để biết **3 bạn nam** nào sẽ tặng quà cho mình.
Kết quả có thể **chỉ định trước** cho từng lượt; lượt không chỉ định sẽ quay **ngẫu nhiên**.

## Cấu trúc

```
index.html            trang chính
css/style.css         giao diện
js/logic.js           đọc CSV, chỉ định, chọn người (không phụ thuộc giao diện)
js/wheel.js           vẽ & quay vòng quay (canvas)
js/effects.js         âm thanh + pháo giấy
js/app.js             các trang, lưu trữ localStorage
data/danh-sach.csv    danh sách lớp (STT, Họ tên, Giới tính, Chỉ định)
tests/logic.test.js   kiểm thử logic (node --test tests/logic.test.js)
```

## Các trang

| Địa chỉ | Nội dung |
|---|---|
| `#/` | Chọn bạn nữ |
| `#/quay/<id>` | Vòng quay của một bạn nữ |
| `#/ket-qua` | Bảng kết quả |
| `#/quan-tri` | **Quản trị** (hoặc bấm nhanh 3 lần vào logo) — nhập danh sách, chỉ định, cài đặt, xoá/xuất kết quả |

## Dữ liệu

- Lần đầu mở trang, danh sách được đọc từ `data/danh-sach.csv` rồi **lưu vào localStorage** của trình duyệt.
  Từ đó mọi thứ (danh sách, chỉ định, kết quả, cài đặt) nằm trong trình duyệt của máy đó.
- Kết quả được lưu ngay lúc bấm QUAY, nên tải lại trang giữa chừng cũng không quay lại được.
- Mỗi bạn nam chỉ tặng quà cho tối đa 1 bạn nữ. 13 × 3 = 39 lượt, nên 6 bạn nam sẽ không được gọi tên.

### Định dạng CSV

```
STT,Họ tên,Giới tính,Chỉ định
4,Trần Hà Châu,Nữ,Lê Gia Bảo | * | Đặng Gia Bách
3,Lê Gia Bảo,Nam,
```

- Cột bắt buộc: `Họ tên`, `Giới tính` (`Nam`/`Nữ`). Dùng được dấu `,` hoặc `;`, có thể lưu từ Excel bằng "CSV UTF-8".
- Cột `Chỉ định` (tuỳ chọn, chỉ dành cho bạn nữ): tên bạn nam cho lượt 1 | lượt 2 | lượt 3; `*` hoặc để trống = ngẫu nhiên.

## Chỉ định kết quả

Cách dễ nhất: mở `#/quan-tri` → **Hiện bảng chỉ định** → chọn bạn nam cho từng lượt (mặc định là 🎲 Ngẫu nhiên).

- Lượt có chỉ định: luôn ra đúng bạn đó (trừ khi bạn đó đã bị chọn trước, khi đó lượt này quay ngẫu nhiên).
- Lượt ngẫu nhiên: không bao giờ ra bạn nam đang được chỉ định cho một lượt khác chưa quay.

⚠️ **Đừng ghi chỉ định vào `data/danh-sach.csv` trên GitHub**: repo công khai nên ai cũng đọc được. Có 2 cách an toàn hơn:

1. **Quay trên một máy** (máy chiếu/laptop của lớp): nhập chỉ định trong trang quản trị trên đúng máy đó. Không có gì lên mạng.
2. **Các bạn quay trên máy riêng**: sau khi nhập chỉ định, bấm **Tải file chi-dinh.dat** rồi đặt file vào `data/chi-dinh.dat` và đẩy lên GitHub.
   Trang sẽ tự đọc file này. Nội dung đã bị làm rối nên không đọc lướt được, nhưng người biết lập trình vẫn giải được.

> Lưu ý khi các bạn quay trên máy riêng: mỗi máy có kết quả riêng, các máy không biết nhau.
> Muốn không bị trùng người tặng thì hãy **chỉ định đủ cả 39 lượt**.

## Chạy thử trên máy

Mở trực tiếp `index.html` thì trình duyệt không cho đọc file CSV (sẽ hiện nút chọn file). Nên chạy bằng server nhỏ:

```bash
cd vong-quay-may-man
python3 -m http.server 8000
# mở http://localhost:8000
```

## Đưa lên GitHub Pages

```bash
cd vong-quay-may-man
git add .
git commit -m "Vòng quay may mắn"
git branch -M main
git remote add origin https://github.com/<tài-khoản>/vong-quay-may-man.git
git push -u origin main
```

Sau đó trên GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)` → Save**.
Khoảng 1 phút sau trang chạy ở `https://<tài-khoản>.github.io/vong-quay-may-man/`.

## Trước buổi quay thật

Vào `#/quan-tri` → **Xoá toàn bộ kết quả** để xoá các lượt quay thử.
