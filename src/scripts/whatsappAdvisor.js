const AREAS = ['Diplomado 2026', 'Cursos de Masoterapia', 'Cursos para profesionales de la salud', 'Emprendimiento y marketing', 'Formaciones online'];

const COURSES_BY_AREA = {
  'Diplomado 2026': ['Diplomado Intensivo en Masoterapia 2026', 'Diplomado en Masoterapia Semipresencial Agosto 2026'],
  'Cursos de Masoterapia': ['Masaje relajante y descontracturante', 'Masaje deportivo y ventosas', 'Masaje cráneo facial', 'Masaje reductivo y anticelulítico', 'Masaje tailandés', 'Otro curso de masoterapia'],
  'Cursos para profesionales de la salud': ['RCP y desfibrilador externo', 'Drenaje linfático postoperatorio', 'Punción seca y electropunción', 'Skin Care', 'Otro curso de salud'],
  'Emprendimiento y marketing': ['Redes sociales y Google Ads', 'Marketing digital', 'Otro curso de emprendimiento'],
  'Formaciones online': ['Drenaje linfático manual online', 'Anatomía humana muscular online', 'Anatomía linfática online', 'Masaje relajante online', 'Diplomado online en Masoterapia'],
};

const QUESTIONS = ['Precio y formas de pago', 'Fechas y horarios', 'Dirección', 'Duración y modalidad', 'Contenidos del curso', 'Requisitos y certificación', 'Quiero inscribirme', 'Otra consulta'];

const GOALS = ['Aprender masoterapia desde cero', 'Especializarme en una técnica', 'Complementar mi profesión de salud', 'Aprender a emprender', 'Estudiar online'];
const EXPERIENCE = ['Sin experiencia', 'Conocimientos básicos', 'Profesional de la salud', 'Ya realizo masajes'];
const MODALITIES = ['Presencial', 'Semipresencial', 'Online', 'Me da igual'];
const TIMING = ['Ahora', 'Este mes', 'Más adelante', 'Solo estoy evaluando'];

const state = { step: 'start', area: '', course: '', question: '', goal: '', experience: '', modality: '', timing: '', name: '', city: '' };

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  });
  children.forEach((child) => node.appendChild(child));
  return node;
}

function selectField(labelText, options, value, onChange) {
  const label = el('label', { text: labelText });
  const select = el('select');
  select.appendChild(el('option', { value: '', text: 'Selecciona una opción' }));
  options.forEach((option) => {
    const optionEl = el('option', { text: option });
    if (option === value) optionEl.selected = true;
    select.appendChild(optionEl);
  });
  select.addEventListener('change', (event) => onChange(event.target.value));
  label.appendChild(select);
  return label;
}

function buildWhatsAppUrl() {
  const lines = state.course
    ? [
        'Hola, necesito orientación en Cenakin.',
        `Nombre: ${state.name || 'No indicado'}`,
        `Ciudad: ${state.city || 'No indicada'}`,
        `Área: ${state.area}`,
        `Formación: ${state.course}`,
        `Consulta: ${state.question || 'Información general'}`,
      ]
    : [
        'Hola, necesito orientación para elegir una formación en Cenakin.',
        `Nombre: ${state.name || 'No indicado'}`,
        `Ciudad: ${state.city || 'No indicada'}`,
        `Objetivo: ${state.goal}`,
        `Experiencia: ${state.experience}`,
        `Modalidad: ${state.modality}`,
        `Cuándo quiero comenzar: ${state.timing}`,
      ];
  return `https://wa.me/56944871048?text=${encodeURIComponent(lines.join('\n'))}`;
}

function buildNameCityRow() {
  const row = el('div', { class: 'advisor-fields' });
  const nameLabel = el('label', { text: 'Nombre (opcional)' });
  const nameInput = el('input', { placeholder: 'Tu nombre' });
  nameInput.value = state.name;
  nameInput.addEventListener('input', (event) => (state.name = event.target.value));
  nameLabel.appendChild(nameInput);

  const cityLabel = el('label', { text: 'Ciudad (opcional)' });
  const cityInput = el('input', { placeholder: 'Tu ciudad' });
  cityInput.value = state.city;
  cityInput.addEventListener('input', (event) => (state.city = event.target.value));
  cityLabel.appendChild(cityInput);

  row.appendChild(nameLabel);
  row.appendChild(cityLabel);
  return row;
}

function renderCourseFlow(body, footer) {
  body.appendChild(
    selectField('Área de formación', AREAS, state.area, (value) => {
      state.area = value;
      state.course = '';
      state.question = '';
      render();
    }),
  );

  if (state.area) {
    body.appendChild(
      selectField('Curso o formación', COURSES_BY_AREA[state.area] || [], state.course, (value) => {
        state.course = value;
        state.question = '';
        render();
      }),
    );
  }

  if (state.course) {
    body.appendChild(
      selectField('¿Qué información necesitas?', QUESTIONS, state.question, (value) => {
        state.question = value;
        render();
      }),
    );
  }

  if (state.question) {
    const answer = el('div', { class: 'advisor-answer' });
    answer.appendChild(el('small', { text: 'INFORMACIÓN' }));
    answer.appendChild(el('p', { text: 'Prepararemos tu consulta para que una orientadora pueda responderte con la información actualizada.' }));
    body.appendChild(answer);
    body.appendChild(buildNameCityRow());

    const submit = el('button', { class: 'advisor-submit', type: 'button', text: 'Continuar por WhatsApp →' });
    submit.addEventListener('click', () => window.open(buildWhatsAppUrl(), '_blank', 'noopener,noreferrer'));
    body.appendChild(submit);
    footer.hidden = false;
  }
}

function renderOrientationFlow(body, footer) {
  body.appendChild(
    selectField('¿Qué te gustaría lograr?', GOALS, state.goal, (value) => {
      state.goal = value;
      state.experience = '';
      render();
    }),
  );

  if (state.goal) {
    body.appendChild(
      selectField('Experiencia previa', EXPERIENCE, state.experience, (value) => {
        state.experience = value;
        state.modality = '';
        render();
      }),
    );
  }

  if (state.experience) {
    body.appendChild(
      selectField('Modalidad preferida', MODALITIES, state.modality, (value) => {
        state.modality = value;
        state.timing = '';
        render();
      }),
    );
  }

  if (state.modality) {
    body.appendChild(
      selectField('¿Cuándo te gustaría comenzar?', TIMING, state.timing, (value) => {
        state.timing = value;
        render();
      }),
    );
  }

  if (state.timing) {
    body.appendChild(buildNameCityRow());
    const submit = el('button', { class: 'advisor-submit', type: 'button', text: 'Recibir orientación por WhatsApp →' });
    submit.addEventListener('click', () => window.open(buildWhatsAppUrl(), '_blank', 'noopener,noreferrer'));
    body.appendChild(submit);
    footer.hidden = false;
  }
}

function render() {
  const body = document.querySelector('.advisor-body');
  const footer = document.querySelector('.advisor footer');
  if (!body || !footer) return;
  body.innerHTML = '';
  footer.hidden = state.step === 'start';

  if (state.step === 'start') {
    const routes = el('div', { class: 'advisor-routes' });

    const courseBtn = el('button', { type: 'button' });
    courseBtn.innerHTML = '<span class="advisor-route-icon"><img src="/images/logo-otec-cenakin-hq-780.webp" alt="" loading="lazy" decoding="async" /></span><span><strong>Información de cursos</strong><small>Precio, fechas, horarios y ubicación</small></span><b>›</b>';
    courseBtn.addEventListener('click', () => {
      state.step = 'course';
      render();
    });

    const orientationBtn = el('button', { type: 'button' });
    orientationBtn.innerHTML = '<span class="advisor-route-icon"><img src="/images/logo-cenakin.png" alt="" /></span><span><strong>Orientación para elegir</strong><small>Te ayudamos a encontrar una formación</small></span><b>›</b>';
    orientationBtn.addEventListener('click', () => {
      state.step = 'orientation';
      render();
    });

    const enrollBtn = el('button', { type: 'button' });
    enrollBtn.innerHTML = '<span class="advisor-route-icon"><img src="/images/logo-otec-cenakin-hq-780.webp" alt="" loading="lazy" decoding="async" /></span><span><strong>Inscripciones y formas de pago</strong><small>Cupos, matrícula y medios de pago</small></span><b>›</b>';
    enrollBtn.addEventListener('click', () => {
      state.question = 'Quiero inscribirme';
      state.step = 'course';
      render();
    });

    routes.appendChild(courseBtn);
    routes.appendChild(orientationBtn);
    routes.appendChild(enrollBtn);
    body.appendChild(routes);

    const direct = el('button', { class: 'advisor-direct', type: 'button', text: 'Hablar directamente por WhatsApp' });
    direct.addEventListener('click', () => window.open('https://wa.me/56944871048', '_blank'));
    body.appendChild(direct);
  } else if (state.step === 'course') {
    renderCourseFlow(body, footer);
  } else if (state.step === 'orientation') {
    renderOrientationFlow(body, footer);
  }
}

function resetState() {
  state.step = 'start';
  state.area = '';
  state.course = '';
  state.question = '';
  state.goal = '';
  state.experience = '';
  state.modality = '';
  state.timing = '';
}

function initAdvisor() {
  const launch = document.querySelector('.advisor-launch');
  const overlay = document.querySelector('.advisor-overlay');
  const closeBtn = document.querySelector('.advisor-close');
  const backBtn = document.querySelector('.advisor-back');
  if (!launch || !overlay) return;

  function open() {
    overlay.hidden = false;
    launch.setAttribute('aria-expanded', 'true');
    render();
  }

  function close() {
    overlay.hidden = true;
    launch.setAttribute('aria-expanded', 'false');
    window.setTimeout(resetState, 250);
  }

  launch.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  backBtn?.addEventListener('click', () => {
    state.step = 'start';
    render();
  });
  window.addEventListener('cenakin:advisor', open);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) close();
  });
}

initAdvisor();
