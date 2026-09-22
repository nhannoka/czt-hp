/* ============================================================
   Công cụ nội bộ CZT — Tạo hồ sơ hoàn thuế Nenkin (L1 + L2)
   Chạy hoàn toàn client-side: không gửi dữ liệu lên server nào.

   L1 (.xlsx): mở thẳng file mẫu bằng JSZip và chỉ thay giá trị trong từng ô,
   nên định dạng, ô gộp, hình vẽ của mẫu được giữ nguyên.
   L2 (.pdf): đặt chữ đúng toạ độ đã đo từ hồ sơ mẫu điền tay
   (baseline = mép trên ô chữ − 0.75 × cỡ chữ).
   ============================================================ */

const { PDFDocument, rgb, StandardFonts } = PDFLib;

const FONT_URLS = {
  caladea: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/caladea/Caladea-Regular.ttf',
  mplus: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/mplus1p/MPLUS1p-Regular.ttf',
};

/* ---------- Tiện ích ---------- */
const pad2 = (n) => String(n).padStart(2, '0');
const onlyDigits = (s) => String(s).replace(/\D/g, '');
const commas = (n) => Number(n).toLocaleString('en-US');

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
  return { letter, eraYear: y - startYear + 1, month: m, day: d };
}

/* 退職所得控除額 */
function calcRetirementDeduction(years) {
  if (years <= 20) return Math.max(800000, years * 400000);
  return 8000000 + (years - 20) * 700000;
}

/* ============================================================
   Kiểm tra dữ liệu nhập
   ============================================================ */
const LATIN_RE = /^[\x20-\x7E]*$/;               // chỉ ký tự ASCII: tiếng Việt KHÔNG dấu
const KATAKANA_RE = /^[゠-ヿ　 ]+$/;  // Katakana + khoảng trắng

const RULES = {
  fullName:     { latin: true, required: true },
  nationality:  { latin: true, required: true },
  addrStreet:   { latin: true, required: true },
  addrCity:     { latin: true, required: true },
  addrProvince: { latin: true, required: true },
  addrZip:      { latin: true },
  addrCountry:  { latin: true, required: true },
  bankName:     { latin: true, required: true },
  bankBranch:   { latin: true, required: true },
  bankAddress:  { latin: true, required: true },
  bankCity:     { latin: true, required: true },
  bankCountry:  { latin: true, required: true },
  accountName:  { latin: true, required: true },
  furigana: {
    required: true,
    test: (v) => KATAKANA_RE.test(v),
    msg: 'Chỉ nhập chữ Katakana (ví dụ: グエン　バン　アー).',
  },
  pensionNo: {
    required: true,
    test: (v) => /^\d{10}$/.test(onlyDigits(v)) && /^[\d\s-]+$/.test(v),
    msg: 'Số lương hưu cơ bản gồm đúng 10 chữ số.',
  },
  swift: {
    required: true,
    test: (v) => /^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/.test(v),
    msg: 'Mã SWIFT/BIC gồm 8 hoặc 11 ký tự chữ và số, không dấu cách.',
  },
  accountNo: {
    required: true,
    test: (v) => /^[A-Za-z0-9 -]+$/.test(v),
    msg: 'Số tài khoản chỉ gồm chữ số (hoặc chữ cái với mã IBAN).',
  },
  postalSymbol: {
    test: (v) => /^[\d\s-]*$/.test(v),
    msg: 'Số hiệu bưu điện chỉ gồm chữ số và dấu gạch ngang.',
  },
};

function validateField(id) {
  const el = document.getElementById(id);
  const rule = RULES[id];
  if (!el || !rule) return true;
  const v = el.value.trim();
  let err = '';
  if (!v) {
    if (rule.required) err = 'Vui lòng nhập trường này.';
  } else if (rule.latin && !LATIN_RE.test(v)) {
    err = 'Chỉ nhập tiếng Việt KHÔNG dấu (ví dụ: NGUYEN VAN A, không phải NGUYỄN VĂN A).';
  } else if (rule.test && !rule.test(v)) {
    err = rule.msg;
  }
  const field = el.closest('.field');
  const msgEl = field && field.querySelector('.field__err');
  if (field) field.classList.toggle('is-invalid', Boolean(err));
  if (msgEl) msgEl.textContent = err;
  return !err;
}

function validateAll() {
  let firstBad = null;
  Object.keys(RULES).forEach((id) => {
    if (!validateField(id) && !firstBad) firstBad = document.getElementById(id);
  });
  ['dob', 'fileDate', 'years', 'incomeAmount'].forEach((id) => {
    const el = document.getElementById(id);
    const ok = el.checkValidity() && el.value !== '';
    const field = el.closest('.field');
    if (field) {
      field.classList.toggle('is-invalid', !ok);
      const msgEl = field.querySelector('.field__err');
      if (msgEl) msgEl.textContent = ok ? '' : 'Vui lòng nhập trường này.';
    }
    if (!ok && !firstBad) firstBad = el;
  });
  return firstBad;
}

/* ---------- Thu thập dữ liệu ---------- */
function collectFormData() {
  const val = (id) => document.getElementById(id).value.trim();
  const up = (id) => val(id).toUpperCase();
  const dob = new Date(val('dob') + 'T00:00:00');
  const fileDate = new Date(val('fileDate') + 'T00:00:00');
  const years = parseInt(val('years'), 10) || 0;
  const income = parseInt(val('incomeAmount'), 10) || 0;
  const withholdingRaw = val('withholdingTax');
  const withholding = withholdingRaw ? parseInt(withholdingRaw, 10) : Math.round(income * 0.2042);
  const deduction = calcRetirementDeduction(years);
  const taxableIncome = Math.max(0, income - deduction);
  const refund = taxableIncome === 0 ? withholding : null; // null = cần chuyên viên tính tay

  return {
    fullName: up('fullName'),
    furiganaWords: val('furigana').split(/[\s　]+/).filter(Boolean),
    dob, dobEra: toJapaneseEra(dob),
    nationality: up('nationality'),
    addrStreet: up('addrStreet'),
    addrCity: up('addrCity'),
    addrProvince: up('addrProvince'),
    addrZip: up('addrZip'),
    addrCountry: up('addrCountry'),
    // định dạng như hồ sơ mẫu: "BINH THUAN- BUON HO- DAK LAK- VIET NAM"
    fullAddressLine: [up('addrStreet'), up('addrCity'), up('addrProvince'), up('addrCountry')].filter(Boolean).join('- '),
    pensionNo: onlyDigits(val('pensionNo')),
    years, fileDate,
    bankName: up('bankName'),
    bankBranch: up('bankBranch'),
    bankAddress: up('bankAddress'),
    bankCity: up('bankCity'),
    bankCountry: up('bankCountry'),
    swift: up('swift'),
    accountNo: val('accountNo').replace(/\s+/g, '').toUpperCase(),
    accountName: up('accountName'),
    postalSymbol: val('postalSymbol'),
    income, withholding, deduction, taxableIncome, refund,
  };
}

/* ============================================================
   1. L1 (.xlsx) — thay giá trị trực tiếp trong XML của mẫu
   ============================================================ */
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

async function buildXlsx(data) {
  const buf = await (await fetch('assets/mau-L1.xlsx')).arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const SHEET = 'xl/worksheets/sheet1.xml';
  const doc = new DOMParser().parseFromString(await zip.file(SHEET).async('string'), 'application/xml');

  const cellsByRef = {};
  const all = doc.getElementsByTagNameNS(NS_MAIN, 'c');
  for (let i = 0; i < all.length; i++) cellsByRef[all[i].getAttribute('r')] = all[i];

  const setCell = (ref, value) => {
    const c = cellsByRef[ref];
    if (!c) throw new Error('Mẫu L1 thiếu ô ' + ref);
    while (c.firstChild) c.removeChild(c.firstChild);
    c.removeAttribute('t');
    if (value === '' || value === null || value === undefined) return;
    if (typeof value === 'number') {
      const v = doc.createElementNS(NS_MAIN, 'v');
      v.textContent = String(value);
      c.appendChild(v);
    } else {
      c.setAttribute('t', 'inlineStr');
      const is = doc.createElementNS(NS_MAIN, 'is');
      const t = doc.createElementNS(NS_MAIN, 't');
      t.setAttribute('xml:space', 'preserve');
      t.textContent = String(value);
      is.appendChild(t);
      c.appendChild(is);
    }
  };

  // 1. Ngày điền
  setCell('A11', data.fileDate.getFullYear());
  setCell('F11', data.fileDate.getMonth() + 1);
  setCell('J11', data.fileDate.getDate());

  // 4. Họ tên, ngày sinh, quốc tịch, địa chỉ
  setCell('E41', data.fullName);
  setCell('E45', data.dob.getFullYear());
  setCell('J45', data.dob.getMonth() + 1);
  setCell('M45', data.dob.getDate());
  setCell('S44', data.nationality);
  setCell('E49', data.addrStreet);
  setCell('E55', data.addrCity);
  setCell('E58', data.addrProvince);
  setCell('E61', data.addrZip);
  setCell('E64', data.addrCountry);

  // 5. Mã SWIFT/BIC — mỗi ký tự 1 ô (ô thừa để trống)
  const swiftCells = ['F85', 'G85', 'H85', 'I85', 'J85', 'K85', 'L85', 'M85', 'N85', 'O85', 'P85'];
  swiftCells.forEach((ref, i) => setCell(ref, data.swift[i] || ''));

  setCell('F88', data.bankName);
  setCell('F91', data.bankBranch);
  setCell('F94', data.bankAddress);
  setCell('H100', data.bankCity);
  setCell('H103', data.bankCountry);
  setCell('F106', data.accountNo);          // giữ dạng chữ để không mất số 0 đầu
  setCell('I109', data.accountName);

  // 6. Số lương hưu cơ bản: 4 số + ô "－" cố định (Q118) + 6 số
  const pensionCells = ['M118', 'N118', 'O118', 'P118', 'R118', 'S118', 'T118', 'U118', 'V118', 'W118'];
  pensionCells.forEach((ref, i) => setCell(ref, Number(data.pensionNo[i])));

  zip.file(SHEET, new XMLSerializer().serializeToString(doc), { createFolders: false });
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/* ============================================================
   2. L2 (.pdf) — toạ độ đo từ hồ sơ mẫu (đơn vị pt, gốc góc dưới trái)
   ============================================================ */
const L2 = {
  p1: {
    addr:  { x: 93.50, y: 729.75, size: 8 },
    era:   { x: 424.79, y: 749.07, size: 16 },
    eraY:  { x: 447.22, y: 748.43, size: 16 },
    eraM:  { x: 482.47, y: 749.07, size: 16 },
    eraD:  { x: 516.44, y: 747.79, size: 16 },
    name:  { x: 351.71, y: 710.32, size: 13 },
    // フリガナ: mỗi từ đặt riêng, trên đúng từ La-tinh tương ứng của họ tên
    furiganaY: 733.5, furiganaSize: 8, furiganaXs: [346.21, 403.38, 443.91, 488.6],
    // 3 dòng thuế (源泉徴収税額 / 申告納税額 / 還付される税金): chữ số theo từng ô
    taxRows: [
      { x: 463.88, y: 430.99 },
      { x: 463.25, y: 414.33 },
      { x: 462.60, y: 364.98 },
    ],
    taxPattern: '2  1  2  3  5   1',
    postal: { x: 351.72, y: 93.24 },
    postalPattern: '1  7  7  9  0   -  1   9  0  3  8   3  8  1',
    boxSize: 12,
  },
  p2: {
    addr:     { x: 98.57, y: 685.10, size: 8 },
    furigana: { x: 100.49, y: 663.88, size: 9 },
    name:     { x: 99.85, y: 649.32, size: 9 },
    income:   { x: 203.04, y: 555.10, size: 9 },
    withheld: { x: 255.59, y: 555.10, size: 9 },
  },
  p3: {
    addr:       { x: 99.50, y: 693.65, size: 8 },
    furigana:   { x: 109.77, y: 672.85, size: 9 },
    name:       { x: 111.04, y: 657.00, size: 9 },
    incomeBox:  { x: 198.19, y: 440.12 },
    incomeBoxPattern: '1  0  3  9  9  1  7',
    income:     { x: 371.24, y: 162.62, size: 12 },
    deduction:  { x: 470.58, y: 161.33, size: 12 },
  },
};

let fontCache = null;
async function loadFontBytes() {
  if (!fontCache) {
    fontCache = Promise.all([FONT_URLS.caladea, FONT_URLS.mplus].map(async (u) => {
      const r = await fetch(u);
      if (!r.ok) throw new Error('Không tải được font ' + u);
      return r.arrayBuffer();
    }));
  }
  return fontCache;
}

/* Vị trí (offset x) của từng ký tự khác khoảng trắng trong chuỗi mẫu,
   để đặt chữ số mới vào đúng từng ô kẻ sẵn trên đơn. */
function slotOffsets(pattern, font, size) {
  const out = [];
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== ' ') out.push(font.widthOfTextAtSize(pattern.slice(0, i), size));
  }
  return out;
}

async function buildPdf(data) {
  const bytes = await (await fetch('assets/mau-L2.pdf')).arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  pdfDoc.registerFontkit(fontkit);
  const [caladeaBytes, mplusBytes] = await loadFontBytes();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const caladea = await pdfDoc.embedFont(caladeaBytes, { subset: true });
  // không subset: fontkit cắt gọn font M+ bị lỗi (chỉ còn 1 glyph hiển thị)
  const mplus = await pdfDoc.embedFont(mplusBytes, { subset: false });
  const black = rgb(0, 0, 0);
  const [pg1, pg2, pg3] = pdfDoc.getPages();

  const draw = (page, text, x, y, size, font = helv) => {
    if (text === '' || text === null || text === undefined) return;
    page.drawText(String(text), { x, y, size, font, color: black });
  };

  /* Chữ số vào ô kẻ sẵn, căn phải theo ô cuối của mẫu; thiếu ô thì lùi sang trái theo bước ô */
  const drawBoxedDigits = (page, digits, at, pattern, size) => {
    const slots = slotOffsets(pattern, helv, size);
    const pitch = slots.length > 1 ? slots[1] - slots[0] : size;
    const chars = String(digits).split('');
    const needExtra = Math.max(0, chars.length - slots.length);
    const all = [...Array.from({ length: needExtra }, (_, k) => slots[0] - pitch * (needExtra - k)), ...slots];
    const use = all.slice(all.length - chars.length);
    chars.forEach((ch, i) => draw(page, ch, at.x + use[i], at.y, size));
  };

  const P1 = L2.p1, P2 = L2.p2, P3 = L2.p3;
  const era = data.dobEra;
  const spaced = (n) => pad2(n).split('').join(' ');   // "13" -> "1 3" như mẫu

  // ----- Trang 1 (第一表) -----
  draw(pg1, data.fullAddressLine, P1.addr.x, P1.addr.y, P1.addr.size);
  draw(pg1, era.letter, P1.era.x, P1.era.y, P1.era.size, caladea);
  draw(pg1, spaced(era.eraYear), P1.eraY.x, P1.eraY.y, P1.eraY.size, caladea);
  draw(pg1, spaced(era.month), P1.eraM.x, P1.eraM.y, P1.eraM.size, caladea);
  draw(pg1, spaced(era.day), P1.eraD.x, P1.eraD.y, P1.eraD.size, caladea);
  draw(pg1, data.fullName, P1.name.x, P1.name.y, P1.name.size, caladea);

  // フリガナ trang 1: mỗi từ đặt trên từ La-tinh tương ứng, các ký tự cách bằng khoảng trắng toàn góc
  const nameWords = data.fullName.split(/\s+/).filter(Boolean);
  const wordXs = nameWords.map((_, i) =>
    P1.name.x + caladea.widthOfTextAtSize(nameWords.slice(0, i).join(' ') + (i ? ' ' : ''), P1.name.size) - 5.5);
  data.furiganaWords.forEach((w, i) => {
    const x = i < wordXs.length ? wordXs[i] : (P1.furiganaXs[i] ?? wordXs[wordXs.length - 1] + 40 * (i - wordXs.length + 1));
    draw(pg1, w.split('').join('　'), x, P1.furiganaY, P1.furiganaSize, mplus);
  });

  if (data.refund !== null) {
    const digits = String(data.withholding);
    P1.taxRows.forEach((row) => drawBoxedDigits(pg1, digits, row, P1.taxPattern, P1.boxSize));
  }

  if (data.postalSymbol) {
    const chars = data.postalSymbol.replace(/\s+/g, '').split('');
    const slots = slotOffsets(P1.postalPattern, helv, P1.boxSize);
    if (chars.length === slots.length) {
      chars.forEach((ch, i) => draw(pg1, ch, P1.postal.x + slots[i], P1.postal.y, P1.boxSize));
    } else {
      draw(pg1, chars.join('  '), P1.postal.x, P1.postal.y, P1.boxSize);
    }
  }

  // ----- Trang 2 (第二表) -----
  const furiganaLine = data.furiganaWords.join('　');
  draw(pg2, data.fullAddressLine, P2.addr.x, P2.addr.y, P2.addr.size);
  draw(pg2, furiganaLine, P2.furigana.x, P2.furigana.y, P2.furigana.size, mplus);
  draw(pg2, data.fullName, P2.name.x, P2.name.y, P2.name.size);
  draw(pg2, commas(data.income), P2.income.x, P2.income.y, P2.income.size);
  draw(pg2, commas(data.withholding), P2.withheld.x, P2.withheld.y, P2.withheld.size);

  // ----- Trang 3 (第三表) -----
  draw(pg3, data.fullAddressLine, P3.addr.x, P3.addr.y, P3.addr.size);
  draw(pg3, furiganaLine, P3.furigana.x, P3.furigana.y, P3.furigana.size, mplus);
  draw(pg3, data.fullName, P3.name.x, P3.name.y, P3.name.size);
  drawBoxedDigits(pg3, String(data.income), P3.incomeBox, P3.incomeBoxPattern, 12);
  draw(pg3, commas(data.income), P3.income.x, P3.income.y, P3.income.size);
  draw(pg3, commas(data.deduction), P3.deduction.x, P3.deduction.y, P3.deduction.size);

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/* ---------- Tải file ---------- */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- Gắn sự kiện ---------- */
const form = document.getElementById('nenkinForm');

Object.keys(RULES).forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('blur', () => validateField(id));
  el.addEventListener('input', () => {
    if (el.closest('.field').classList.contains('is-invalid')) validateField(id);
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const noteEl = document.getElementById('resultNote');
  const btn = document.getElementById('submitBtn');
  noteEl.className = 'result';

  const firstBad = validateAll();
  if (firstBad) {
    noteEl.textContent = '❌ Còn trường chưa hợp lệ (đánh dấu đỏ). Vui lòng sửa rồi xuất lại.';
    noteEl.className = 'result result--error';
    firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstBad.focus({ preventScroll: true });
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Đang tạo file...';
  try {
    const data = collectFormData();
    const safeName = data.fullName.replace(/[^A-Za-z0-9]+/g, '_') || 'ho-so';
    const [xlsxBlob, pdfBlob] = await Promise.all([buildXlsx(data), buildPdf(data)]);
    window.__lastExport = { xlsxBlob, pdfBlob };
    downloadBlob(xlsxBlob, `L1_${safeName}.xlsx`);
    downloadBlob(pdfBlob, `L2_${safeName}.pdf`);

    let msg = '✅ Đã xuất xong 2 file. Vui lòng mở lại và kiểm tra trước khi nộp.';
    if (data.refund === null) {
      msg += ' ⚠️ Thu nhập vượt mức khấu trừ miễn thuế: 3 dòng số thuế ở trang 1 của L2 KHÔNG được tự điền, cần chuyên viên tính tay theo biểu thuế lũy tiến.';
    }
    noteEl.textContent = msg;
    noteEl.className = 'result result--success';
  } catch (err) {
    console.error(err);
    noteEl.textContent = '❌ Có lỗi khi tạo file: ' + err.message;
    noteEl.className = 'result result--error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Xuất file L1 (.xlsx) & L2 (.pdf)';
  }
});

document.getElementById('fileDate').valueAsDate = new Date();
