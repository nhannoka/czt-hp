document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Sticky header shadow ---------- */
  const header = document.getElementById('header');
  const onScroll = () => {
    if (window.scrollY > 10) header.classList.add('is-scrolled');
    else header.classList.remove('is-scrolled');

    const backToTop = document.getElementById('backToTop');
    if (backToTop) {
      if (window.scrollY > 500) backToTop.classList.add('is-visible');
      else backToTop.classList.remove('is-visible');
    }
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav toggle ---------- */
  const navToggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      nav.classList.toggle('is-open');
      navToggle.classList.toggle('is-active');
    });

    // Toggle dropdown submenu on mobile tap
    document.querySelectorAll('.has-dropdown > a').forEach((link) => {
      link.addEventListener('click', (e) => {
        if (window.innerWidth <= 860) {
          e.preventDefault();
          link.parentElement.classList.toggle('is-open');
        }
      });
    });

    // Close mobile nav after clicking a real link (skip dropdown toggle links)
    nav.querySelectorAll('a').forEach((link) => {
      if (link.parentElement.classList.contains('has-dropdown')) return;
      link.addEventListener('click', () => {
        if (window.innerWidth <= 860) {
          nav.classList.remove('is-open');
          navToggle.classList.remove('is-active');
        }
      });
    });
  }

  /* ---------- Back to top ---------- */
  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.accordion__item').forEach((item) => {
    const head = item.querySelector('.accordion__head');
    head.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      item.closest('.accordion').querySelectorAll('.accordion__item').forEach((el) => el.classList.remove('is-open'));
      if (!isOpen) item.classList.add('is-open');
    });
  });

  /* ---------- Testimonials slider ---------- */
  const track = document.getElementById('testimonials-track');
  const prevBtn = document.getElementById('testiPrev');
  const nextBtn = document.getElementById('testiNext');
  if (track && prevBtn && nextBtn) {
    const scrollByCard = (dir) => {
      const card = track.querySelector('.testimonial');
      if (!card) return;
      const gap = 24;
      const distance = card.offsetWidth + gap;
      track.scrollBy({ left: dir * distance, behavior: 'smooth' });
    };
    prevBtn.addEventListener('click', () => scrollByCard(-1));
    nextBtn.addEventListener('click', () => scrollByCard(1));
  }

  /* ---------- Booking form ---------- */
  const bookingForm = document.getElementById('bookingForm');
  const formNote = document.getElementById('formNote');
  if (bookingForm && formNote) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const data = new FormData(bookingForm);
      const fullname = (data.get('fullname') || '').toString().trim();
      const phone = (data.get('phone') || '').toString().trim();

      if (!fullname || !phone) {
        formNote.textContent = 'Vui lòng nhập đầy đủ Họ tên và Số điện thoại.';
        formNote.className = 'form-note error';
        return;
      }

      const phonePattern = /^[0-9+()\s-]{8,15}$/;
      if (!phonePattern.test(phone)) {
        formNote.textContent = 'Số điện thoại không hợp lệ, vui lòng kiểm tra lại.';
        formNote.className = 'form-note error';
        return;
      }

      // NOTE: Chưa có backend nhận dữ liệu.
      // Có thể tích hợp Formspree, Google Apps Script, hoặc API riêng tại đây.
      // Ví dụ: fetch('https://formspree.io/f/xxxxxx', { method: 'POST', body: data });

      formNote.textContent = 'Cảm ơn bạn! CZT đã nhận thông tin và sẽ liên hệ trong vòng 24h.';
      formNote.className = 'form-note success';
      bookingForm.reset();
    });
  }

  /* ---------- Close mobile dropdown on outside click ---------- */
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.has-dropdown.is-open').forEach((el) => {
      if (!el.contains(e.target)) el.classList.remove('is-open');
    });
  });

  /* ---------- Nenkin: tính số tiền dự kiến ---------- */
  const nkCalcBtn = document.getElementById('nkCalcBtn');
  if (nkCalcBtn) {
    nkCalcBtn.addEventListener('click', () => {
      const yearStart = parseInt(document.getElementById('nkYearStart').value, 10);
      const yearEnd = parseInt(document.getElementById('nkYearEnd').value, 10);
      const salary = parseInt(document.getElementById('nkSalary').value, 10);
      const resultEl = document.getElementById('nkResult');

      if (!yearStart || !yearEnd || !salary || yearEnd <= yearStart) {
        alert('Vui lòng nhập đầy đủ và đúng: Năm kết thúc phải lớn hơn Năm bắt đầu.');
        return;
      }

      // Công thức ước tính đơn giản hoá (KHÔNG phải công thức chính thức của Cơ quan Nenkin):
      // Số tháng tham gia (tối đa 60 tháng theo quy định hiện hành) x 5% mức lương trung bình.
      // CZT có thể điều chỉnh hệ số 0.05 này khi có bảng tỷ lệ chính xác hơn.
      const months = Math.min((yearEnd - yearStart) * 12, 60);
      const nenkin1 = Math.round(salary * 0.05 * months);
      const tax = Math.round(nenkin1 * 0.2042);
      const total = nenkin1 - tax;

      const fmt = (n) => n.toLocaleString('ja-JP') + ' 円';
      document.getElementById('nkOut1').textContent = fmt(nenkin1);
      document.getElementById('nkOut2').textContent = '- ' + fmt(tax);
      document.getElementById('nkOut3').textContent = fmt(total);
      resultEl.hidden = false;
    });
  }

  /* ---------- Nenkin: tra cứu tình trạng hồ sơ ---------- */
  // Cách thiết lập (an toàn hơn CSV công khai — xem noi-bo/google-apps-script-tra-cuu.gs):
  // 1. Tạo Google Sheet với 2 cột "ma_ho_so" và "trang_thai".
  // 2. Dán code trong file noi-bo/google-apps-script-tra-cuu.gs vào Apps Script của sheet đó.
  // 3. Deploy dạng Web app (Execute as: Me, Who has access: Anyone).
  // 4. Dán link "Web app URL" vào biến NENKIN_LOOKUP_API_URL bên dưới.
  // Apps Script chỉ trả về đúng 1 dòng khớp mã hồ sơ được hỏi, không lộ toàn bộ danh sách khách hàng.
  const NENKIN_LOOKUP_API_URL = 'https://script.google.com/macros/s/AKfycbxOuDzHPn0_SP5lqu-QXlfamWIP4Cvi7yvVG37Gf3Wud1ZwuLlPECgPHGQEsXGDfWfRFg/exec'; // TODO: dán link Apps Script Web app URL vào đây

  const NENKIN_STATUS_STEPS = [
    'Đã tiếp nhận hồ sơ',
    'Đã gửi Cơ quan Nenkin',
    'Đang xét duyệt',
    'Có kết quả lần 1',
    'Đang xử lý lần 2',
    'Đã nộp lần 2',
    'Đang bổ sung giấy tờ',
    'Hoàn thành 2 lần',
  ];

  const nkLookupBtn = document.getElementById('nkLookupBtn');
  if (nkLookupBtn) {
    nkLookupBtn.addEventListener('click', async () => {
      const code = document.getElementById('nkLookupCode').value.trim();
      const msgEl = document.getElementById('nkLookupMsg');
      const listEl = document.getElementById('nkStatusList');
      msgEl.hidden = false; listEl.hidden = true;

      if (!code) {
        msgEl.textContent = 'Vui lòng nhập mã hồ sơ.';
        return;
      }
      if (!NENKIN_LOOKUP_API_URL) {
        msgEl.textContent = 'Chức năng tra cứu đang được thiết lập. Vui lòng liên hệ CZT qua Zalo/Messenger để biết tình trạng hồ sơ.';
        return;
      }

      msgEl.textContent = 'Đang tra cứu...';
      try {
        const url = NENKIN_LOOKUP_API_URL + '?ma_ho_so=' + encodeURIComponent(code) + '&_=' + Date.now();
        const res = await fetch(url);
        const data = await res.json();

        if (!data.found) {
          msgEl.textContent = 'Không tìm thấy hồ sơ với mã này. Vui lòng kiểm tra lại hoặc liên hệ CZT.';
          return;
        }

        const currentStatus = data.trang_thai;
        const currentIdx = NENKIN_STATUS_STEPS.indexOf(currentStatus);

        listEl.innerHTML = NENKIN_STATUS_STEPS.map((step, i) => {
          let cls = '';
          if (currentIdx >= 0 && i < currentIdx) cls = 'is-done';
          else if (i === currentIdx) cls = 'is-current';
          return `<li class="${cls}">${step}</li>`;
        }).join('');

        msgEl.textContent = `Kết quả cho mã hồ sơ ${code}:`;
        listEl.hidden = false;
      } catch (err) {
        msgEl.textContent = 'Có lỗi khi tra cứu. Vui lòng thử lại sau hoặc liên hệ CZT.';
      }
    });
  }

});
