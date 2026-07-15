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

});
