(() => {
  const data = [
    {
      title: "Diplomado Anual en Masoterapia 2027",
      meta: "150 horas · Presencial · Viña del Mar",
      href: "https://cenakin.cl/cursos/diplomado-masoterapia/",
    },
    {
      title: "Curso de Masaje Relajante y Descontracturante",
      meta: "20 horas · Presencial · Curso certificado",
      href: "https://cenakin.cl/cursos/masaje-relajante-descontracturante/",
    },
    {
      title: "Curso de Punción Seca y Electropunción",
      meta: "Formación para profesionales de la salud",
      href: "https://cenakin.cl/cursos/curso-de-puncion-seca/",
    },
    {
      title: "Curso de Drenaje Linfático Manual Postoperatorio",
      meta: "Formación especializada",
      href: "https://cenakin.cl/cursos/curso-de-drenaje-linfatico-manual/",
    },
  ];
  document.querySelectorAll("[data-ck-carousel]").forEach((root) => {
    const slides = [...root.querySelectorAll(".ck-carousel__slide")];
    const thumbs = [...root.querySelectorAll(".ck-carousel__thumb")];
    const caption = root.querySelector(".ck-carousel__caption-link");
    const pause = root.querySelector(".ck-carousel__pause");
    let current = 0,
      paused = false,
      timer;
    const render = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        const active = i === current;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", String(!active));
        slide.tabIndex = active ? 0 : -1;
      });
      thumbs.forEach((thumb, i) =>
        thumb.classList.toggle("is-active", i === current),
      );
      caption.href = data[current].href;
      caption.querySelector("strong").textContent = data[current].title;
      caption.querySelector("span").textContent = data[current].meta;
    };
    const start = () => {
      clearInterval(timer);
      if (!paused) timer = setInterval(() => render(current + 1), 6500);
    };
    root
      .querySelector(".ck-carousel__arrow--previous")
      .addEventListener("click", () => {
        render(current - 1);
        start();
      });
    root
      .querySelector(".ck-carousel__arrow--next")
      .addEventListener("click", () => {
        render(current + 1);
        start();
      });
    thumbs.forEach((thumb, i) =>
      thumb.addEventListener("click", () => {
        render(i);
        start();
      }),
    );
    pause.addEventListener("click", () => {
      paused = !paused;
      pause.classList.toggle("is-paused", paused);
      pause.setAttribute(
        "aria-label",
        paused ? "Reanudar carrusel" : "Pausar carrusel",
      );
      start();
    });
    root.addEventListener("mouseenter", () => clearInterval(timer));
    root.addEventListener("mouseleave", start);
    start();
  });
})();
