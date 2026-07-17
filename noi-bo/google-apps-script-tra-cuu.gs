/**
 * ============================================================
 * CZT - Apps Script "cổng API" tra cứu tình trạng hồ sơ Nenkin
 * ============================================================
 *
 * CÁCH DÙNG (làm 1 lần):
 * 1. Tạo Google Sheet với đúng 2 cột, dòng đầu là tiêu đề:
 *      ma_ho_so | trang_thai
 *    Cột trang_thai phải gõ đúng 1 trong các giá trị (xem danh sách
 *    NENKIN_STATUS_STEPS trong js/script.js của web).
 *
 * 2. Trong Google Sheet: Extensions (Tiện ích mở rộng) → Apps Script.
 *
 * 3. Xoá hết code mẫu, dán toàn bộ nội dung file này vào.
 *
 * 4. Bấm Deploy (Triển khai) → New deployment (Triển khai mới):
 *      - Type: Web app
 *      - Execute as: Me (tài khoản của bạn)
 *      - Who has access: Anyone (Bất kỳ ai) — bắt buộc để web gọi được
 *    Bấm Deploy, cấp quyền khi được hỏi (Authorize access).
 *
 * 5. Copy đường link "Web app URL" (dạng
 *    https://script.google.com/macros/s/xxxxx/exec), dán vào biến
 *    NENKIN_LOOKUP_API_URL trong file js/script.js của website.
 *
 * AN TOÀN HƠN CÁCH "Publish to web" CSV: script này CHỈ trả về đúng
 * 1 dòng khớp mã hồ sơ được hỏi, không bao giờ trả về toàn bộ bảng.
 * ============================================================
 */

const SHEET_NAME = 'Sheet1'; // đổi lại nếu tên sheet của bạn khác

function doGet(e) {
  const output = { found: false };
  const code = ((e.parameter.ma_ho_so || '') + '').trim().toUpperCase();

  if (code) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const header = data[0].map((h) => String(h).trim().toLowerCase());
    const codeIdx = header.indexOf('ma_ho_so');
    const statusIdx = header.indexOf('trang_thai');

    for (let i = 1; i < data.length; i++) {
      const rowCode = String(data[i][codeIdx] || '').trim().toUpperCase();
      if (rowCode === code) {
        output.found = true;
        output.trang_thai = String(data[i][statusIdx] || '').trim();
        break;
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}
