/* ============================================================
   Công cụ nội bộ CZT — Tạo hồ sơ hoàn thuế Nenkin (L1 + L2)
   Chạy hoàn toàn client-side: không gửi dữ liệu lên server nào.
   ============================================================ */

const { PDFDocument, rgb, StandardFonts } = PDFLib;

/* ---------- Chuyển đổi niên hiệu Nhật Bản ---------- */
function toJapaneseEra(dateObj) {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  const cmp = y * 10000 + m * 100 + d;
  let letter, startYear;
  if (cmp >= 20190501) { letter = 'R'; startYear = 2019; }
  else if (cmp >= 19890108) { letter = 'H'; startYear = 1989; }
  else if (cmp >= 19261225) { letter = 'S'; startYear = 1926; }
  else if (cmp >= 19120730) { letter = 'T'; startYear = 1912; }
  else { letter = 'M'; startYear = 1868; }
  const eraYear = y - startYear + 1;
  return { letter, eraYear, month: m, day: d };
}

const pad2 = (n) => String(n).padStart(2, '0');

/* ---------- Tính khoản khấu trừ thu nhập nghỉ việc (退職所得控除額) ---------- */
function calcRetirementDeduction(years) {
  if (years <= 20) return Math.max(800000, years * 400000);
  return 8000000 + (years - 20) * 700000;
}

/* ---------- Thu thập dữ liệu từ form ---------- */
function collectFormData() {
  const val = (id) => document.getElementById(id).value.trim();
  const dob = new Date(val('dob') + 'T00:00:00');
  const fileDate = new Date(val('fileDate') + 'T00:00:00');
  const years = parseInt(val('years'), 10) || 0;
  const income = parseInt(val('incomeAmount'), 10) || 0;
  const withholdingRaw = val('withholdingTax');
  const withholding = withholdingRaw ? parseInt(withholdingRaw, 10) : Math.round(income * 0.2042);
  const deduction = calcRetirementDeduction(years);
  const taxableIncome = Math.max(0, income - deduction);
  const refund = taxableIncome === 0 ? withholding : null; // null = cần chuyên viên tính tay (vượt mức miễn)

  return {
    fullName: val('fullName'),
    furigana: val('furigana'),
    dob, dobEra: toJapaneseEra(dob),
    nationality: val('nationality'),
    addrStreet: val('addrStreet'),
    addrCity: val('addrCity'),
    addrProvince: val('addrProvince'),
    addrZip: val('addrZip'),
    addrCountry: val('addrCountry'),
    fullAddressLine: [val('addrStreet'), val('addrCity'), val('addrProvince'), val('addrCountry')].filter(Boolean).join('- ').toUpperCase(),
    pensionNo: val('pensionNo'),
    years, fileDate,
    bankName: val('bankName'),
    bankBranch: val('bankBranch'),
    bankAddress: val('bankAddress'),
    swift: val('swift').toUpperCase(),
    accountNo: val('accountNo'),
    accountName: val('accountName'),
    postalSymbol: val('postalSymbol'),
    income, withholding, deduction, taxableIncome, refund,
  };
}

/* ---------- 1. Tạo file L1 (.xlsx) ---------- */
async function buildXlsx(data) {
  const resp = await fetch('assets/mau-L1.xlsx');
  const buf = await resp.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellStyles: true, bookVBA: false });
  const ws = wb.Sheets['VIETTIN'];

  const setCell = (addr, value, type) => {
    if (!ws[addr]) ws[addr] = {};
    ws[addr].v = value;
    ws[addr].t = type || (typeof value === 'number' ? 'n' : 's');
    delete ws[addr].f;
  };

  // 1. Ngày điền
  setCell('A11', data.fileDate.getFullYear(), 'n');
  setCell('F11', data.fileDate.getMonth() + 1, 'n');
  setCell('J11', data.fileDate.getDate(), 'n');

  // 4. Họ tên, ngày sinh, quốc tịch, địa chỉ
  setCell('E41', data.fullName);
  setCell('E45', data.dob.getFullYear(), 'n');
  setCell('J45', data.dob.getMonth() + 1, 'n');
  setCell('M45', data.dob.getDate(), 'n');
  setCell('S44', data.nationality);
  setCell('E49', data.addrStreet);
  setCell('E55', data.addrCity);
  setCell('E58', data.addrProvince);
  if (data.addrZip) setCell('E61', data.addrZip);
  setCell('E64', data.addrCountry);

  // 5. Tài khoản nhận tiền — mã SWIFT/BIC theo từng ô
  const swiftCells = ['F85','G85','H85','I85','J85','K85','L85','M85','N85','O85','P85'];
  const swiftChars = data.swift.padEnd(11, ' ').split('');
  swiftCells.forEach((cell, i) => { if (swiftChars[i] && swiftChars[i] !== ' ') setCell(cell, swiftChars[i]); });

  setCell('F88', data.bankName);
  setCell('F91', data.bankBranch);
  setCell('F94', data.bankAddress);
  setCell('H100', data.addrCity !== '' ? data.bankAddress.split(',').pop().trim() : '');
  setCell('H103', 'JAPAN');
  setCell('F106', data.accountNo);
  setCell('I109', data.accountName);

  // 6. Số lương hưu cơ bản (10 chữ số, mỗi ô 1 số, ô Q118 là dấu '－' cố định)
  const pensionCells = ['M118','N118','O118','P118','R118','S118','T118','U118','V118','W118'];
  const pensionDigits = data.pensionNo.padEnd(10, ' ').split('');
  pensionCells.forEach((cell, i) => { if (pensionDigits[i] && pensionDigits[i] !== ' ') setCell(cell, Number(pensionDigits[i]), 'n'); });

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ---------- 2. Tạo file L2 (.pdf) ---------- */
async function buildPdf(data) {
  const resp = await fetch('assets/mau-L2.pdf');
  const bytes = await resp.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);

  const draw = (pageIdx, text, x, y, size = 9) => {
    pdfDoc.getPage(pageIdx).drawText(String(text), { x, y, size, font, color: black });
  };

  const era = data.dobEra;
  const addr = data.fullAddressLine;
  const incomeStr = data.income.toLocaleString('en-US');
  const withholdingStr = data.withholding.toLocaleString('en-US');
  const refundStr = data.refund !== null ? data.refund.toLocaleString('en-US') : '';
  const postal = data.postalSymbol;

  // ----- Trang 1 (第一表) -----
  draw(0, addr, 93.5, 725.6, 8);
  draw(0, era.letter, 424.8, 741.8, 10);
  draw(0, pad2(era.eraYear), 447.2, 741.4, 10);
  draw(0, pad2(era.month), 482.5, 742.1, 10);
  draw(0, pad2(era.day), 516.4, 740.8, 10);
  draw(0, data.fullName, 351.7, 704.1, 9);
  if (postal) draw(0, postal.split('').join('  '), 351.7, 88.2, 8);
  if (data.refund !== null) {
    draw(0, withholdingStr, 463.9, 426.0, 9);
    draw(0, withholdingStr, 463.3, 409.3, 9);
    draw(0, refundStr, 462.6, 360.0, 9);
  }

  // ----- Trang 2 (第二表) -----
  draw(1, addr, 98.6, 681.0, 8);
  draw(1, data.fullName, 99.85, 645.0, 9);
  draw(1, incomeStr, 203.0, 550.75, 9);
  draw(1, withholdingStr, 255.6, 550.75, 9);

  // ----- Trang 3 (第三表) -----
  draw(2, addr, 99.5, 689.55, 8);
  draw(2, data.fullName, 111.0, 652.65, 9);
  draw(2, incomeStr, 371.2, 157.5, 9);
  draw(2, data.deduction.toLocaleString('en-US'), 470.6, 156.2, 9);

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/* ---------- Trigger download ---------- */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- Submit handler ---------- */
document.getElementById('nenkinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const noteEl = document.getElementById('resultNote');
  const btn = document.getElementById('submitBtn');
  noteEl.className = ''; noteEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Đang tạo file...';

  try {
    const data = collectFormData();
    const safeName = (data.fullName || 'ho-so').replace(/[^A-Za-z0-9]+/g, '_');

    const [xlsxBlob, pdfBlob] = await Promise.all([buildXlsx(data), buildPdf(data)]);
    downloadBlob(xlsxBlob, `L1_${safeName}.xlsx`);
    downloadBlob(pdfBlob, `L2_${safeName}.pdf`);

    let msg = '✅ Đã xuất xong 2 file. Vui lòng mở lại và kiểm tra trước khi nộp.';
    if (data.refund === null) {
      msg += ' ⚠️ Thu nhập vượt mức khấu trừ miễn thuế — số thuế hoàn KHÔNG được tự động điền, cần chuyên viên tính tay theo biểu thuế lũy tiến.';
    }
    msg += ' Lưu ý: mục Phiên âm Katakana (フリガナ) chưa được tự động điền vào PDF do giới hạn font — vui lòng bổ sung tay.';
    noteEl.textContent = msg;
    noteEl.className = 'success';
  } catch (err) {
    console.error(err);
    noteEl.textContent = '❌ Có lỗi khi tạo file: ' + err.message;
    noteEl.className = 'error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Xuất file L1 (.xlsx) & L2 (.pdf)';
    noteEl.style.display = 'block';
  }
});

/* Mặc định ngày điền đơn = hôm nay */
document.getElementById('fileDate').valueAsDate = new Date();
