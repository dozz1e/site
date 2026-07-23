function initMobileMenu() {
  const button = document.querySelector('.mobile-menu-button');
  const layer = document.querySelector('.mobile-menu-layer');
  const backdrop = document.querySelector('.mobile-menu-backdrop');
  const closeButton = document.querySelector('.mobile-menu-close');
  if (!button || !layer) return;

  function setOpen(open) {
    layer.classList.toggle('open', open);
    layer.setAttribute('aria-hidden', String(!open));
    button.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('mobile-menu-open', open);
  }

  button.addEventListener('click', () => setOpen(true));
  backdrop?.addEventListener('click', () => setOpen(false));
  closeButton?.addEventListener('click', () => setOpen(false));
  layer.querySelectorAll('nav a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}

initMobileMenu();
