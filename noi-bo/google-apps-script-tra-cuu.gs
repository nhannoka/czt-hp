/**
 * ============================================================
 * CZT - Apps Script "cổng API" tra cứu tình trạng hồ sơ Nenkin
 * Đọc sheet "DANG XU LY" (file ★NENKIN), trả về trạng thái + ngày của từng bước.
 * ============================================================
 *
 * CÁCH CÀI (làm 1 lần, hoặc mỗi khi sửa file này):
 * 1. Mở Google Sheet ★NENKIN → Extensions (Tiện ích mở rộng) → Apps Script.
 * 2. Xoá hết code cũ, dán toàn bộ nội dung file này vào, bấm Save (Lưu).
 * 3. Kiểm tra phần CẤU HÌNH bên dưới có khớp với sheet không
 *    (tên sheet, dòng tiêu đề, tên các cột).
 * 4. Chạy thử: chọn hàm testTraCuu ở thanh trên → Run → xem Execution log.
 * 5. Deploy (Triển khai):
 *      - Lần đầu: Deploy → New deployment → Type: Web app
 *          Execute as: Me | Who has access: Anyone → Deploy → copy "Web app URL"
 *          rồi dán vào NENKIN_LOOKUP_API_URL trong js/script.js của website.
 *      - Đã deploy rồi, chỉ sửa code: Deploy → Manage deployments → ✏️ Edit
 *          → Version: New version → Deploy. (Giữ nguyên URL, không phải sửa web.)
 *
 * AN TOÀN: script CHỈ trả về trạng thái + ngày của đúng 1 mã hồ sơ được hỏi.
 * Không trả về tên khách, phí, ghi chú, link FB hay bất kỳ dòng nào khác.
 * ============================================================
 */

// ======================= CẤU HÌNH =======================
const SHEET_NAME = 'DANG XU LY';   // tên tab trong file
const HEADER_ROW = 6;              // dòng chứa tiêu đề cột (dữ liệu bắt đầu từ dòng 7)
const TIMEZONE   = 'Asia/Tokyo';
const DATE_FMT   = 'dd/MM/yyyy';

// Tên cột y như dòng tiêu đề (không phân biệt hoa/thường; xuống dòng và
// khoảng trắng thừa trong ô tiêu đề được bỏ qua). Đổi tên cột trong sheet
// thì sửa ở đây cho khớp.
const COL_MA_HO_SO  = 'MÃ KH';
const COL_TRANG_THAI = 'Cập nhật trên web';

// Ngày cập nhật của từng trạng thái — đúng thứ tự 6 bước trên website.
// Để '' nếu bước đó chưa có cột ngày.
const COL_NGAY = [
  'NGÀY NỘP L1',               // 1. Đã nộp hồ sơ
  'NgàyĐang xét duyệt lần 1',  // 2. Đang xét duyệt lần 1
  'Ngàycó kq l1',              // 3. Có kết quả lần 1
  'Ngày đang xét Lần 2',       // 4. Đang xét duyệt lần 2
  'Có KQ L2',      // 5. Có kết quả lần 2
  'Hoàn tất HS',               // 6. Hoàn tất hồ sơ
];

// 6 trạng thái hợp lệ trong cột "Cập nhật trên web" (giống js/script.js).
const STATUS_STEPS = [
  'Đã nộp hồ sơ',
  'Đang xét duyệt lần 1',
  'Có kết quả lần 1',
  'Đang xét duyệt lần 2',
  'Có kết quả lần 2',
  'Hoàn tất hồ sơ',
];
// =========================================================

/** Chuẩn hoá chữ để so khớp: bỏ emoji/ký tự lạ, gộp khoảng trắng, chữ thường. */
function norm_(v) {
  return String(v == null ? '' : v)
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} ()]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Ô ngày -> "dd/MM/yyyy".
 * - Nhận ô kiểu Ngày, hoặc ô chữ gõ dạng "2/10/2026", "02/10/2026", "2026-10-02".
 * - Bỏ ô trống và ngày rác năm 1899/1900 (do công thức kiểu =J172+4 khi ô J còn trống).
 */
function fmtDate_(v) {
  if (typeof v === 'string') {
    const t = v.trim();
    let m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (m) v = new Date(+m[3], +m[2] - 1, +m[1]);
    else if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) v = new Date(+m[1], +m[2] - 1, +m[3]);
  }
  if (!(v instanceof Date) || isNaN(v)) return '';
  if (v.getFullYear() < 2000) return '';
  return Utilities.formatDate(v, TIMEZONE, DATE_FMT);
}

function lookup_(code) {
  const out = { found: false };
  code = norm_(code).replace(/\s/g, '');
  if (!code) return out;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return { found: false, error: 'Không tìm thấy sheet ' + SHEET_NAME };

  const values = sheet.getDataRange().getValues();
  const header = values[HEADER_ROW - 1].map(norm_);
  const col = (name) => (name ? header.indexOf(norm_(name)) : -1);

  const codeIdx = col(COL_MA_HO_SO);
  const statusIdx = col(COL_TRANG_THAI);
  if (codeIdx < 0 || statusIdx < 0) {
    return { found: false, error: 'Sai tên cột mã hồ sơ / trạng thái trong CẤU HÌNH' };
  }
  const dateIdx = COL_NGAY.map(col);

  for (let i = HEADER_ROW; i < values.length; i++) {
    const row = values[i];
    if (norm_(row[codeIdx]).replace(/\s/g, '') !== code) continue;

    const status = String(row[statusIdx] || '').trim();
    const step = STATUS_STEPS.findIndex((s) => norm_(s) === norm_(status)); // -1 nếu chưa đúng 6 trạng thái
    out.found = true;
    out.trang_thai = status;
    // Chỉ trả ngày của các bước đã tới (cột tự cộng ngày như =I+3 có thể có sẵn ngày tương lai).
    out.ngay = dateIdx.map((idx, k) => (idx >= 0 && k <= step ? fmtDate_(row[idx]) : ''));
    break;
  }
  return out;
}

function doGet(e) {
  const code = (e && e.parameter && e.parameter.ma_ho_so) || '';
  return ContentService.createTextOutput(JSON.stringify(lookup_(code)))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Chạy thử trong trình soạn Apps Script (đổi mã cho đúng 1 mã có trong sheet). */
function testTraCuu() {
  Logger.log(JSON.stringify(lookup_('NK442')));
}
