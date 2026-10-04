# Aegis · AoE1 Agent Lab v0.1

Bộ thử nghiệm **quan sát giao diện → xin từng dân → kiểm chứng trong scenario có kiểm soát**. Phần desktop là Python trên **Windows 10/11 + Python 3.11 + cửa sổ AoE1/Rise of Rome**; dashboard Next.js chỉ đọc các artifact mà bạn chủ động nhập. **Đây chưa phải bot tự chơi toàn trận.** Chưa có thử nghiệm trên bản game/cấu hình cụ thể của bạn.

## 1. Cài trên Windows

Cài Python 3.11 và Tesseract OCR với dữ liệu ngôn ngữ `eng`. Tại thư mục dự án:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Không dùng các file game trong repo này. Chạy game ở một cấu hình cửa sổ có thể capture được; không tiếp tục live nếu ảnh bị đen, bị che hoặc không cập nhật. Game và agent nên cùng mức quyền thông thường khi có thể.

Sau khi môi trường hoạt động ổn định, chụp phiên bản thư viện **trên chính máy Windows mục tiêu**:

```powershell
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pip freeze --all |
    Set-Content -Encoding utf8 -Path .\requirements-lock.txt
```

`requirements-lock.txt` là bản chụp package/version, **không có hash** và không bảo đảm tái lập trên mọi hệ điều hành. Không tạo file này từ Linux để giả làm môi trường Windows. Trên máy Windows/Python tương ứng khác, tạo lại `.venv`; không sao chép nguyên thư mục cũ:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-lock.txt
.\.venv\Scripts\python.exe -m pip check
```

## 2. Chuẩn bị scenario

- Một nhà chính, đủ thực và sức chứa, hàng đợi ban đầu rỗng.
- Không có dân/quân khác đang được tạo, giao tranh hoặc hoạt động khiến dân số thay đổi.
- Đọc **giá xin dân trên giao diện** của civilization đang thử; không mặc định mọi trường hợp đều giống nhau.
- Không làm việc khác trên máy trong phiên live. F9 đặt cờ dừng, không ngắt tức thời mọi lời gọi OCR.

## 3. Calibration và chẩn đoán

```powershell
.\.venv\Scripts\python.exe calibrate.py
.\.venv\Scripts\python.exe diagnose.py --count 3
.\.venv\Scripts\python.exe diagnose.py --image .\assets\calibration.png
```

`calibrate.py` ghi `config.json`, `assets/calibration.png`, `assets/tc_marker.png` và `assets/train_villager.png`. Trong 5 giây đầu hãy chuyển sang game, chọn nhà chính, giữ nút xin dân khả dụng và rời con trỏ khỏi nút. Mỗi ROI được chọn trong cửa sổ ảnh bằng chuột rồi Enter. Ghi Tesseract, độ phân giải, Windows scaling, civilization, giá dân và wrapper vào profile.

`diagnose.py` **không gửi input**. Mở `diagnostics/<thời-gian>/sample_000/`: `frame.png`, `annotated.png`, các crop tài nguyên/dân số và hai mẫu UI. Đối chiếu số OCR bằng mắt. Thử lại khi chọn dân, công trình khác, không chọn gì, nút bị vô hiệu và có menu che: ít nhất một UI check phải trượt ngưỡng trong tình huống không hợp lệ. `analysis_finished` chỉ có nghĩa phân tích xong; điểm template không phải xác suất.

Nếu cần phân tích ảnh một phiên **được tạo sau bước lưu assets theo phiên**:

```powershell
$last = Get-ChildItem .\runs -Directory | Sort-Object Name -Descending | Select-Object -First 1
.\.venv\Scripts\python.exe diagnose.py --profile $last.FullName --image (Join-Path $last.FullName '00000.png')
```

Không ghép ảnh mẫu mới vào phiên cũ nếu không chắc cùng calibration.

## 4. Dry run, live và báo cáo

Chạy từng bước và xem kết quả trước khi tiếp tục:

```powershell
.\.venv\Scripts\python.exe run.py --seconds 30
.\.venv\Scripts\python.exe report.py
```

Dry run **không gửi input** và không được có `action_issued`. Sau khi đối chiếu ảnh và scenario:

```powershell
.\.venv\Scripts\python.exe run.py --live --seconds 180
.\.venv\Scripts\python.exe report.py
```

Live kiểm tra focus và không có Ctrl/Shift/Alt/phím Windows/nút chuột đang giữ trước mỗi thao tác; đây vẫn không phải bảo đảm tuyệt đối chống bấm nhầm. Agent chọn nhà chính, chụp kiểm tra hai ROI UI, chỉ click một lần, rồi chờ dân số tăng ổn định; hết hạn thì dừng, **không spam lệnh**. Giữ `PyAutoGUI.FAILSAFE = True`.

Mỗi phiên trong `runs/` lưu bản sao config, ảnh mẫu, `requirements-lock.txt` (nếu có), ảnh quan sát, `events.jsonl`, `exit.txt`; `report.py` tạo `summary.json`. `commands_issued` là số lệnh được ghi đã gửi, không chứng minh game đã nhận. `confirmed_by_policy` vẫn cần đối chiếu ảnh. `unknown_ocr_counts = 0` không chứng minh OCR đúng. `tick_seconds` là thời gian nghỉ cộng thêm, không phải tốc độ quan sát bảo đảm. Bản v0.1 **không tự reset scenario**.

## 5. Dashboard web (tùy chọn)

Dashboard chạy độc lập, không kết nối vào cửa sổ game và không chạy Python từ trình duyệt:

```bash
npm install
npx drizzle-kit push
npm run dev
```

Cấu hình `DATABASE_URL` trong `.env`. Mở trang chủ, chọn **Nhập nhật ký** để tải `events.jsonl` (+ `summary.json`, `exit.txt` nếu có) từ cùng một phiên; chọn **Chẩn đoán** để tải `diagnostics/.../report.json`. Web lưu số liệu và sự kiện đã chuẩn hóa vào PostgreSQL qua Drizzle; ảnh PNG không được tải lên. Có thể xem timeline, lọc phiên, xem điểm UI/giá trị OCR, chọn PNG để đối chiếu ngay trong tab trình duyệt (không upload), xóa bản nhập, đánh dấu checklist và lưu ghi chú môi trường trong trình duyệt. File gốc trên Windows không bị xóa khi xóa bản nhập.

## 6. Giới hạn và phát triển tiếp

- Parser dân số yêu cầu dạng `<đang dùng>/<sức chứa>`; cần sửa theo ảnh thật nếu bản game hiển thị khác.
- Hash chỉ bao phủ EXE và DAT ở các đường dẫn `fingerprint()` kiểm tra. `dat_sha256 = null` nghĩa là chưa tìm thấy file DAT, không phải bản cài đã được xác nhận.
- Ảnh mẫu của UI đúng **phải** được thử với UI sai. Không chỉ hạ ngưỡng để bot chịu bấm.
- `GetAsyncKeyState` và kiểm tra focus có khoảng thời gian đua giữa kiểm tra và gửi input. Không điều khiển máy để làm việc khác khi chạy live.
- Chưa kiểm thử Tesseract trên font game của bạn, đường nhập liệu thật hoặc tương thích mọi bản RoR.
- Kỹ năng tiếp theo hợp lý là `BUILD_HOUSE` trong một scenario cố định: precheck → select → verify selection → issue một lệnh → verify công trình và sức chứa. Sau đó mới mở rộng khai thác, kinh tế, lên đời, quân và bản đồ.

Không đưa file game, `.venv`, `runs/`, `diagnostics/`, ảnh riêng tư hoặc đường dẫn chứa thông tin cá nhân vào Git.
