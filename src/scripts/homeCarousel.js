function initHomeCarousel() {
  const root = document.querySelector('.home-hero-visual');
  if (!root) return;

  const slides = Array.from(root.querySelectorAll('.hero-slide'));
  const dots = Array.from(root.querySelectorAll('.hero-carousel-dots button'));
  const prevBtn = root.querySelector('.hero-carousel-arrow.previous');
  const nextBtn = root.querySelector('.hero-carousel-arrow.next');
  let current = 0;

  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === current);
      slide.setAttribute('aria-hidden', String(i !== current));
    });
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  }

  function startAutoplay() {
    window.setInterval(() => show(current + 1), 6000);
  }

  prevBtn?.addEventListener('click', () => show(current - 1));
  nextBtn?.addEventListener('click', () => show(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));

  window.setTimeout(startAutoplay, 9000);
}

initHomeCarousel();
