// Filtro por categoría y paginación (10 por página) de la portada del blog.
// Las tarjetas vienen en el HTML; este script solo las muestra u oculta.
const PAGE_SIZE = 10;

function initBlogCatalog() {
  const catalog = document.querySelector('[data-blog-catalog]');
  const select = catalog?.querySelector('#blog-category');
  if (!catalog || !select) return;

  const cards = [...catalog.querySelectorAll('.blog-feature[data-category]')];
  const grid = catalog.querySelector('.blog-card-grid');
  const summary = catalog.querySelector('.blog-catalog-summary');

  const empty = document.createElement('div');
  empty.className = 'blog-catalog-empty';
  empty.hidden = true;
  empty.innerHTML =
    '<h3>Aún no hay artículos en esta categoría.</h3><p>Puedes explorar las otras áreas de formación.</p><button class="blog-button" type="button">Ver todos los artículos</button>';
  grid.after(empty);

  const pager = document.createElement('nav');
  pager.className = 'blog-pagination';
  pager.setAttribute('aria-label', 'Páginas de artículos');
  pager.innerHTML = '<button type="button">Anterior</button><span aria-live="polite"></span><button type="button">Siguiente</button>';
  empty.after(pager);
  const [previous, status, next] = pager.children;

  let page = 1;

  function render() {
    const matches = cards.filter((card) => select.value === 'all' || card.dataset.category === select.value);
    const pages = Math.ceil(matches.length / PAGE_SIZE);
    cards.forEach((card) => (card.hidden = true));
    matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).forEach((card) => (card.hidden = false));
    grid.hidden = !matches.length;
    empty.hidden = !!matches.length;
    summary.children[0].textContent = select.value === 'all' ? 'Todos los artículos' : select.selectedOptions[0].textContent;
    summary.children[1].textContent = `${matches.length} ${matches.length === 1 ? 'artículo' : 'artículos'}`;
    pager.hidden = pages <= 1;
    previous.disabled = page <= 1;
    next.disabled = page >= pages;
    status.textContent = `Página ${page} de ${pages}`;
  }

  select.addEventListener('change', () => {
    page = 1;
    render();
  });
  empty.querySelector('button').addEventListener('click', () => {
    select.value = 'all';
    page = 1;
    render();
  });
  previous.addEventListener('click', () => {
    page--;
    render();
  });
  next.addEventListener('click', () => {
    page++;
    render();
  });
  render();
}

initBlogCatalog();
