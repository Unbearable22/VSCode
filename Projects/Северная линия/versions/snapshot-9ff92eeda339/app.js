'use strict';
// Entire prototype is local. No network requests or external services.
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const projects = [...document.querySelectorAll('[data-category]')];
function applyFilter(value) {
  if (!filterButtons.some(button => button.dataset.filter === value)) value = 'all';
  filterButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === value)));
  let count = 0;
  projects.forEach(project => {
    const visible = value === 'all' || project.dataset.category === value;
    project.hidden = !visible;
    if (visible) count++;
  });
  const counter = document.getElementById('result-count');
  if (counter) counter.textContent = `Показано: ${count}`;
  const empty = document.getElementById('empty-state');
  if (empty) empty.hidden = count !== 0;
}
if (filterButtons.length) {
  const initial = new URLSearchParams(location.search).get('filter') || 'all';
  applyFilter(initial);
  filterButtons.forEach(button => button.addEventListener('click', () => {
    applyFilter(button.dataset.filter);
    try {
      const url = new URL(location.href);
      if (button.dataset.filter === 'all') url.searchParams.delete('filter');
      else url.searchParams.set('filter', button.dataset.filter);
      history.replaceState(null, '', url);
    } catch (_) { /* Filtering remains available when history is restricted. */ }
  }));
}
document.querySelectorAll('.project details').forEach(details => {
  const summary = details.querySelector('summary');
  details.addEventListener('toggle', () => summary.setAttribute('aria-expanded', String(details.open)));
  details.querySelector('.close-details').addEventListener('click', () => {
    details.open = false;
    summary.setAttribute('aria-expanded', 'false');
    summary.focus();
  });
});
const form = document.getElementById('contact-form');
if (form) {
  const key = 'severnaya-line-demo-draft-v1';
  const fields = ['name', 'email', 'message'];
  const status = document.getElementById('form-status');
  const draftStatus = document.getElementById('draft-status');
  const controls = fields.map(name => form.elements.namedItem(name));
  // Custom messages supplement the browser's email validity rules.
  form.noValidate = true;
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = false;
  function errorFor(field) {
    if (!field.value.trim()) return field.name === 'message' ? 'Расскажите хотя бы кратко о задаче.' : field.name === 'name' ? 'Укажите ваше имя.' : 'Укажите электронную почту.';
    if (field.type === 'email' && !field.validity.valid) return 'Введите корректный email, например name@example.com.';
    if (field.value.length > field.maxLength) return 'Сократите текст до допустимой длины.';
    return '';
  }
  function showError(field) {
    const error = errorFor(field);
    document.getElementById(`${field.name}-error`).textContent = error;
    field.setAttribute('aria-invalid', String(Boolean(error)));
    return error;
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const draft = JSON.parse(raw);
      if (!draft || draft.version !== 1 || !fields.every(name => typeof draft[name] === 'string')) throw new Error('Invalid draft');
      controls.forEach(field => { field.value = draft[field.name].slice(0, field.maxLength); });
      draftStatus.textContent = 'Локальный черновик восстановлен. Данные не отправлялись.';
    }
  } catch (_) {
    draftStatus.textContent = 'Не удалось прочитать черновик. Хранилище недоступно или данные повреждены. Форма работает без сохранения.';
  }
  controls.forEach(field => {
    field.addEventListener('input', () => {
      status.textContent = '';
      if (field.getAttribute('aria-invalid') === 'true') showError(field);
      draftStatus.textContent = 'Есть изменения. Чтобы сохранить их в этом браузере, нажмите «Сохранить черновик».';
    });
    field.addEventListener('blur', () => { if (field.value || field.getAttribute('aria-invalid') === 'true') showError(field); });
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const invalid = controls.filter(field => showError(field));
    if (invalid.length) {
      status.textContent = 'Проверьте отмеченные поля. Данные не отправлены.';
      invalid[0].focus();
      return;
    }
    status.textContent = 'Демо-заявка прошла проверку. Ничего не отправлено: сервер не подключён. При желании сохраните локальный черновик.';
  });
  document.getElementById('save-draft').addEventListener('click', () => {
    const draft = {version: 1};
    controls.forEach(field => { draft[field.name] = field.value; });
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      draftStatus.textContent = 'Черновик сохранён в этом браузере. Он восстановится после перезагрузки страницы.';
    } catch (_) {
      draftStatus.textContent = 'Не удалось сохранить: локальное хранилище недоступно или заполнено. Введённый текст остаётся в форме.';
    }
  });
  document.getElementById('clear-draft').addEventListener('click', () => {
    try {
      localStorage.removeItem(key);
      form.reset();
      controls.forEach(field => {
        field.removeAttribute('aria-invalid');
        document.getElementById(`${field.name}-error`).textContent = '';
      });
      status.textContent = '';
      draftStatus.textContent = 'Локальный черновик удалён. Поля очищены.';
    } catch (_) {
      draftStatus.textContent = 'Не удалось удалить черновик: хранилище недоступно. Сохранённые данные могли остаться в браузере.';
    }
  });
} else {
  // Without JavaScript a form must never submit to a real endpoint.
}
