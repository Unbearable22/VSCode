'use strict';
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const KEY = 'lad.prototype.v1';
  const demos = [
    { id: 'midnight', title: 'Полночный свет', style: 'Электроника', color: '', mark: '≈', file: 'assets/midnight.wav' },
    { id: 'warm', title: 'Тёплый воздух', style: 'Мягкий синтез', color: 'amber', mark: '✳', file: 'assets/warm.wav' },
    { id: 'tide', title: 'Тихая вода', style: 'Эмбиент', color: 'blue', mark: '⌁', file: 'assets/tide.wav' }
  ];
  const defaults = () => ({ version: 1, drafts: [], favorites: [], name: '', working: { prompt: '', title: '', mode: 'idea', style: 'Инди-поп', mood: 'Мечтательное', vocal: 'Женский', instrumental: false, tempo: 100, language: 'Русский' } });
  let state = defaults();
  let storageWarning = false;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (stored && stored.version === 1) {
      state.name = typeof stored.name === 'string' ? stored.name.slice(0, 40) : '';
      state.drafts = Array.isArray(stored.drafts) ? stored.drafts.filter(d => d && typeof d.id === 'string' && typeof d.title === 'string' && typeof d.prompt === 'string' && d.type === 'draft').slice(0, 100) : [];
      state.favorites = Array.isArray(stored.favorites) ? stored.favorites.filter(id => typeof id === 'string') : [];
      if (stored.working && typeof stored.working === 'object') {
        for (const key of Object.keys(state.working)) {
          if (typeof stored.working[key] === typeof state.working[key]) state.working[key] = stored.working[key];
        }
      }
    }
  } catch { storageWarning = true; }
  let page = 'studio', filter = 'all', editingId = null, currentTrack = null, toastTimer;
  const audio = $('#audio');
  audio.volume = .65;
  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch { if (!storageWarning) toast('Хранилище недоступно. Данные останутся только до закрытия страницы.'); storageWarning = true; return false; }
  }
  function escapeHTML(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  function notice(title, text, eyebrow = 'ИНТЕГРАЦИЯ НЕ ПОДКЛЮЧЕНА', confirm = null) {
    $('#dialogTitle').textContent = title;
    $('#dialogBody').replaceChildren();
    const p = document.createElement('p'); p.textContent = text; $('#dialogBody').append(p);
    $('#dialogEyebrow').textContent = eyebrow;
    $('#dialogOk').textContent = confirm ? 'Очистить данные' : 'Понятно';
    $('#dialogOk').onclick = () => { $('#noticeDialog').close(); if (confirm) confirm(); };
    $('#noticeDialog').showModal();
  }
  const reasons = {
    ai: ['Здесь пока тишина', 'Музыкальный API и сервер очереди не подключены. Форма сохраняет параметры локально, но не отправляет запросы и не создаёт песню. Выбор модели, условия использования и права на результат предстоит согласовать.'],
    payment: ['Оплата пока недоступна', 'Платёжный провайдер, аккаунты и серверный журнал баланса не подключены. Покупки, начисления и списания в этом прототипе не выполняются.'],
    auth: ['Аккаунты ещё не подключены', 'Для безопасного входа нужны сервер авторизации и защищённая сессия. Гостевое имя и черновики в браузере не являются аккаунтом и не дают прав администратора.']
  };
  function unavailable(type) { notice(...reasons[type]); }
  function showPage(target, updateHash = true) {
    if (!['studio', 'library', 'balance', 'account', 'admin'].includes(target)) target = 'studio';
    page = target;
    $$('.page').forEach(el => { el.hidden = el.id !== `page-${target}`; });
    $$('.nav-item[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === target));
    $('#pageCrumb').textContent = { studio: 'Создание музыки', library: 'Библиотека', balance: 'Мои генерации', account: 'Гостевой кабинет', admin: 'Управление · демо' }[target];
    if (updateHash && location.hash !== `#${target}`) location.hash = target;
    if (target === 'library') renderLibrary();
    $('#adminDraftCount').textContent = state.drafts.length;
  }
  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-page]');
    if (nav) { showPage(nav.dataset.page); window.scrollTo({ top: 0, behavior: 'instant' }); }
    const blocked = e.target.closest('[data-unavailable]');
    if (blocked) unavailable(blocked.dataset.unavailable);
  });
  window.addEventListener('hashchange', () => showPage(location.hash.slice(1), false));
  $('#closeDialog').onclick = () => $('#noticeDialog').close();
  $('#noticeDialog').addEventListener('click', e => { if (e.target === $('#noticeDialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
  $('#generateButton').onclick = () => unavailable('ai');
  function setMode(mode) {
    state.working.mode = mode === 'lyrics' ? 'lyrics' : 'idea';
    $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === state.working.mode)));
    const lyrics = state.working.mode === 'lyrics';
    $('#promptLabel').textContent = lyrics ? 'Ваш текст песни' : 'О чём будет ваша песня?';
    $('#prompt').placeholder = lyrics ? '[Куплет]\nНапишите первые строки…\n\n[Припев]\nЗдесь начинается ваша история.' : 'Ночной город, пустые улицы и чувство, что всё только начинается…';
    $('#promptHint').textContent = lyrics ? 'До 1200 символов. Текст сохраняется локально, без обработки ИИ.' : 'Опишите историю и настроение — это основа вашего черновика.';
    $('#ideaButton').hidden = lyrics;
  }
  function setStyle(style) {
    const valid = $$('[data-style]').some(b => b.dataset.style === style);
    state.working.style = valid ? style : 'Инди-поп';
    $$('[data-style]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.style === state.working.style)));
  }
  function updateCount() { $('#charCount').textContent = `${$('#prompt').value.length} / 1200`; }
  function markSaved() { $('#saveStatus').textContent = persist() ? 'Сохранено в браузере' : 'Только в памяти вкладки'; }
  function collectWorking() {
    for (const key of ['prompt', 'title', 'mood', 'vocal', 'language']) state.working[key] = $(`#${key}`).value;
    state.working.instrumental = $('#instrumental').checked;
    state.working.tempo = Number($('#tempo').value);
    markSaved();
    updateCount();
  }
  function syncVocal() {
    $('#vocal').disabled = $('#instrumental').checked;
    $('#vocal').title = $('#instrumental').checked ? 'Инструментал: вокал не используется' : '';
  }
  function restoreWorking() {
    for (const key of ['prompt', 'title', 'mood', 'vocal', 'language']) {
      $(`#${key}`).value = state.working[key];
      if ($(`#${key}`).tagName === 'SELECT' && !$(`#${key}`).value) { $(`#${key}`).selectedIndex = 0; state.working[key] = $(`#${key}`).value; }
    }
    $('#prompt').value = $('#prompt').value.slice(0, 1200);
    $('#instrumental').checked = state.working.instrumental;
    $('#tempo').value = state.working.tempo;
    $('#tempoValue').value = $('#tempo').value;
    setMode(state.working.mode); setStyle(state.working.style); syncVocal(); updateCount();
  }
  $$('[data-mode]').forEach(b => b.onclick = () => { setMode(b.dataset.mode); collectWorking(); });
  $$('[data-style]').forEach(b => b.onclick = () => { setStyle(b.dataset.style); collectWorking(); });
  $('#trackForm').addEventListener('input', e => {
    if (e.target.id === 'tempo') $('#tempoValue').value = e.target.value;
    if (e.target.id === 'prompt') { $('#promptError').hidden = true; $('#prompt').removeAttribute('aria-invalid'); }
    syncVocal(); collectWorking();
  });
  $('#trackForm').addEventListener('change', () => { syncVocal(); collectWorking(); });
  const ideas = [
    'Ночной поезд уносит из большого города. За окном огни, а впереди — встреча, которую так долго ждали. Мягкий пульс и ощущение нового начала.',
    'Ощущение пятницы: открытые окна, тёплый ветер и дорога к морю. Лёгкость, солнце и предвкушение маленького приключения.',
    'Письмо себе из будущего: не бойся менять маршрут. Спокойная уверенность, осенний парк и свет в окнах старого дома.'
  ];
  let ideaIndex = 0;
  function applyIdea(text) {
    const apply = () => { setMode('idea'); $('#prompt').value = text; $('#promptError').hidden = true; $('#prompt').removeAttribute('aria-invalid'); collectWorking(); $('#prompt').focus(); toast('Идея добавлена в черновик'); };
    if ($('#prompt').value.trim()) notice('Заменить текущий текст?', 'Текущий текст в форме будет заменён готовой идеей. Сохранённые черновики останутся в библиотеке.', 'ПОДТВЕРЖДЕНИЕ', apply);
    else apply();
    if ($('#noticeDialog').open) $('#dialogOk').textContent = 'Заменить текст';
  }
  $('#ideaButton').onclick = () => applyIdea(ideas[ideaIndex++ % ideas.length]);
  $('#applyTip').onclick = () => { selectTool('song'); applyIdea(ideas[1]); };
  function newId() { return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
  $('#trackForm').onsubmit = e => {
    e.preventDefault();
    const text = $('#prompt').value.trim();
    if (text.length < 10) {
      $('#promptError').textContent = 'Добавьте хотя бы 10 символов, чтобы сохранить содержательную идею.';
      $('#promptError').hidden = false; $('#prompt').setAttribute('aria-invalid', 'true'); $('#prompt').focus(); return;
    }
    collectWorking();
    const draft = { ...state.working, prompt: text, title: $('#title').value.trim() || text.slice(0, 38) + (text.length > 38 ? '…' : ''), id: editingId || newId(), type: 'draft', updatedAt: new Date().toISOString() };
    const index = state.drafts.findIndex(d => d.id === draft.id);
    if (index >= 0) state.drafts[index] = draft;
    else { if (state.drafts.length >= 100) { toast('Лимит прототипа: 100 черновиков. Экспортируйте или удалите старые.'); return; } state.drafts.unshift(draft); }
    editingId = draft.id;
    const saved = persist(); renderAll();
    toast(saved ? 'Черновик сохранён в библиотеке. Аудио не создавалось.' : 'Черновик добавлен в память вкладки. Экспортируйте копию.');
  };
  const toolCopy = {
    cover: ['Каверы — следующий инструмент', 'Преобразование аудио и работа с голосом требуют отдельного API, сервера загрузки и согласования прав на исходные записи. В прототипе загрузка и обработка недоступны.'],
    lyrics: ['Текст начинается с вас', 'Генератор текста через ИИ не подключён. Вы можете написать собственный текст во вкладке «Песня → Свой текст» и сохранить его в библиотеку.'],
    sound: ['Лаборатория звуков', 'Создание звуков по описанию требует аудиомодели и сервера. Пока исследуйте три локальных демофрагмента в библиотеке — они синтезированы программно.']
  };
  function selectTool(tool) {
    $('#trackForm').setAttribute('aria-labelledby', `tab-${tool}`);
    $$('[data-tool]').forEach(b => { const active = b.dataset.tool === tool; b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1; });
    $('#songFields').hidden = tool !== 'song'; $('#formActions').hidden = tool !== 'song'; $('#unavailableTool').hidden = tool === 'song';
    if (toolCopy[tool]) { $('#toolTitle').textContent = toolCopy[tool][0]; $('#toolDescription').textContent = toolCopy[tool][1]; }
  }
  $$('[data-tool]').forEach(b => b.onclick = () => selectTool(b.dataset.tool));
  $('.tool-tabs').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); const tabs = $$('[data-tool]'); const index = tabs.indexOf(document.activeElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTool(tabs[next].dataset.tool); tabs[next].focus();
  });
  $('#toolBack').onclick = () => selectTool('song');
  function renderRecent() {
    $('#recentTracks').innerHTML = demos.map(t => `<article class="track-card"><div class="cover-mini ${t.color}" aria-hidden="true">${t.mark}</div><div class="track-meta"><strong>${t.title}</strong><small>${t.style} · ДЕМО · 0:12</small></div><button class="icon-button" data-play="${t.id}" aria-label="Слушать ${t.title}">${currentTrack === t.id && !audio.paused ? 'Ⅱ' : '▶'}</button></article>`).join('');
  }
  function renderLibrary() {
    const query = $('#search').value.trim().toLocaleLowerCase('ru');
    const items = [...state.drafts, ...demos.map(t => ({ ...t, type: 'demo' }))].filter(t => (!query || `${t.title} ${t.style}`.toLocaleLowerCase('ru').includes(query)) && (filter === 'all' || filter === t.type || (filter === 'favorite' && state.favorites.includes(t.id))));
    $('#libraryList').innerHTML = items.length ? items.map(t => {
      const favorite = state.favorites.includes(t.id);
      const safeId = escapeHTML(t.id);
      return `<article class="panel library-item"><div class="cover-mini ${t.type === 'demo' ? t.color : ''}" aria-hidden="true">${t.type === 'demo' ? t.mark : '↗'}</div><div class="track-meta"><h3>${escapeHTML(t.title)}<span class="demo-badge">${t.type === 'demo' ? 'ДЕМО · БЕЗ ИИ' : 'ЧЕРНОВИК · БЕЗ АУДИО'}</span></h3><p>${escapeHTML(t.style)} · ${t.type === 'demo' ? 'Инструментал · 12 секунд' : escapeHTML(t.instrumental ? 'Без вокала' : t.vocal) + ' · ' + formatDate(t.updatedAt)}</p></div><div class="track-actions">${t.type === 'demo' ? `<button class="secondary-button" data-play="${safeId}">${currentTrack === t.id && !audio.paused ? 'Ⅱ Пауза' : '▶ Слушать'}</button><a class="icon-button" href="${t.file}" download="lad-demo-${t.id}.wav" aria-label="Скачать ${escapeHTML(t.title)} WAV">${icon('down')}</a>` : `<button class="secondary-button" data-edit="${safeId}">Редактировать ↗</button><button class="icon-button" data-delete="${safeId}" aria-label="Удалить ${escapeHTML(t.title)}">×</button>`}<button class="icon-button" data-favorite="${safeId}" aria-pressed="${favorite}" aria-label="${favorite ? 'Убрать из избранного' : 'В избранное'}: ${escapeHTML(t.title)}">${icon('heart')}</button></div></article>`;
    }).join('') : `<div class="panel empty-state">${icon('music')}<h3>${query ? 'Ничего не нашлось' : 'Здесь пока тихо'}</h3><p>${query ? 'Попробуйте другое название или измените фильтр.' : 'Сохраните первую идею в студии или добавьте демофрагмент в избранное.'}</p></div>`;
  }
  function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'локальный черновик' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }
  function renderAll() { renderRecent(); renderLibrary(); $('#libraryCount').textContent = state.drafts.length + demos.length; $('#adminDraftCount').textContent = state.drafts.length; }
  $$('[data-filter]').forEach(b => b.onclick = () => { filter = b.dataset.filter; $$('[data-filter]').forEach(el => el.setAttribute('aria-pressed', String(el === b))); renderLibrary(); });
  $('#search').oninput = renderLibrary;
  document.addEventListener('click', e => {
    const play = e.target.closest('[data-play]'); if (play) playTrack(play.dataset.play);
    const favorite = e.target.closest('[data-favorite]');
    if (favorite) { const id = favorite.dataset.favorite; state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : [...state.favorites, id]; persist(); renderLibrary(); }
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      const draft = state.drafts.find(d => d.id === edit.dataset.edit); if (!draft) return;
      editingId = draft.id;
      state.working = { ...defaults().working, ...draft };
      restoreWorking(); selectTool('song'); showPage('studio'); markSaved(); window.scrollTo({ top: 0, behavior: 'instant' }); toast('Черновик открыт. Сохранение обновит эту запись.');
    }
    const remove = e.target.closest('[data-delete]');
    if (remove) {
      const id = remove.dataset.delete;
      notice('Удалить черновик?', 'Он будет удалён из локальной библиотеки. Эта операция не затрагивает настоящие серверные данные.', 'ЛОКАЛЬНАЯ БИБЛИОТЕКА', () => {
        state.drafts = state.drafts.filter(d => d.id !== id); state.favorites = state.favorites.filter(x => x !== id); if (editingId === id) editingId = null; persist(); renderAll(); toast('Черновик удалён');
      });
      $('#dialogOk').textContent = 'Удалить черновик';
    }
  });
  $('#newDraftButton').onclick = () => {
    const start = () => {
      editingId = null; state.working = defaults().working; restoreWorking(); selectTool('song');
      $('#promptError').hidden = true; $('#prompt').removeAttribute('aria-invalid');
      markSaved(); showPage('studio'); window.scrollTo({ top: 0, behavior: 'instant' }); $('#prompt').focus();
    };
    if ($('#prompt').value.trim()) {
      notice('Начать новый черновик?', 'Форма будет очищена. Сохранённые записи останутся в библиотеке. Если текущая идея ещё не сохранена в библиотеку, сначала сохраните её.', 'НОВАЯ ИДЕЯ', start);
      $('#dialogOk').textContent = 'Начать новый';
    } else start();
  };
  async function playTrack(id) {
    const track = demos.find(t => t.id === id); if (!track) return;
    if (currentTrack === id && !audio.paused) { audio.pause(); return; }
    if (currentTrack !== id) { currentTrack = id; audio.src = track.file; $('#playerTitle').textContent = track.title; $('#playerCover').className = `cover-mini ${track.color}`; $('#playerCover').textContent = track.mark; $('#playerDownload').href = track.file; $('#playerDownload').download = `lad-demo-${id}.wav`; $('#seek').value = 0; }
    $('#player').hidden = false; document.body.classList.add('has-player');
    try { await audio.play(); } catch { toast('Не удалось воспроизвести WAV. Откройте сайт через локальный HTTP-сервер.'); }
    syncPlayback();
  }
  function syncPlayback() {
    const playing = !audio.paused;
    $('#playerToggle').textContent = playing ? 'Ⅱ' : '▶'; $('#playerToggle').setAttribute('aria-label', playing ? 'Пауза' : 'Продолжить воспроизведение');
    const featuredPlaying = currentTrack === 'midnight' && playing;
    $('#featuredPlay').textContent = featuredPlaying ? 'Ⅱ' : '▶'; $('#featuredPlay').setAttribute('aria-label', featuredPlaying ? 'Пауза: Полночный свет' : 'Слушать Полночный свет');
    renderRecent(); if (page === 'library') renderLibrary(); drawWave();
  }
  $('#featuredPlay').onclick = () => playTrack('midnight');
  $('#playerToggle').onclick = () => { if (currentTrack) playTrack(currentTrack); };
  function adjacent(offset) { const index = demos.findIndex(t => t.id === currentTrack); playTrack(demos[(index + offset + demos.length) % demos.length].id); }
  $('#previousTrack').onclick = () => adjacent(-1); $('#nextTrack').onclick = () => adjacent(1);
  $('#closePlayer').onclick = () => { audio.pause(); $('#player').hidden = true; document.body.classList.remove('has-player'); };
  audio.addEventListener('play', syncPlayback); audio.addEventListener('pause', syncPlayback); audio.addEventListener('ended', syncPlayback);
  audio.addEventListener('error', () => { toast('Аудиофайл недоступен. Проверьте папку assets и локальный сервер.'); syncPlayback(); });
  audio.addEventListener('timeupdate', () => { $('#seek').value = audio.currentTime; $('#elapsed').textContent = `0:${String(Math.floor(audio.currentTime)).padStart(2, '0')}`; drawWave(); });
  audio.addEventListener('loadedmetadata', () => { $('#seek').max = Number.isFinite(audio.duration) ? audio.duration : 12; });
  $('#seek').oninput = e => { if (audio.readyState > 0) audio.currentTime = Number(e.target.value); };
  $('#volume').oninput = e => { audio.volume = Number(e.target.value); };
  let wavePeaks = [];
  function drawWave() {
    const canvas = $('#previewWave'); const rect = canvas.getBoundingClientRect(); if (!rect.width) return;
    const ratio = window.devicePixelRatio || 1; canvas.width = Math.round(rect.width * ratio); canvas.height = 46 * ratio;
    const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.scale(ratio, ratio);
    const count = Math.floor(rect.width / 4); const progress = currentTrack === 'midnight' ? audio.currentTime / 12 : 0;
    for (let i = 0; i < count; i++) {
      const peak = wavePeaks.length ? wavePeaks[Math.floor(i / count * wavePeaks.length)] : .16;
      const h = Math.max(3, peak * 43); ctx.fillStyle = i / count < progress ? '#6d4a88' : '#b59cc9'; ctx.fillRect(i * 4, (46 - h) / 2, 2, h);
    }
  }
  // Peaks are generated from the local WAV; no microphone or network API is used.
  async function loadWave() {
    try {
      // The peaks are a local JS asset generated from the exact PCM samples.
      wavePeaks = window.LAD_WAVE_PEAKS || []; drawWave();
    } catch { drawWave(); }
  }
  window.addEventListener('resize', drawWave);
  function syncName() { const name = state.name || 'Гостевая студия'; $('.profile>span:nth-child(2)').firstChild.textContent = name; $$('.avatar').forEach(el => el.textContent = (state.name || 'Г')[0].toUpperCase()); $('#displayName').value = state.name; }
  $('#profileForm').onsubmit = e => { e.preventDefault(); const name = $('#displayName').value.trim(); if (!name) { $('#displayName').setCustomValidity('Введите имя'); $('#displayName').reportValidity(); return; } state.name = name; const saved = persist(); syncName(); toast(saved ? 'Имя сохранено только в этом браузере' : 'Имя изменено только в памяти вкладки'); };
  $('#displayName').oninput = () => $('#displayName').setCustomValidity('');
  $('#exportDrafts').onclick = () => {
    const data = { format: 'lad-drafts', version: 1, exportedAt: new Date().toISOString(), drafts: state.drafts, working: state.working };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'lad-local-drafts.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); toast('Экспортированы локальные черновики');
  };
  $('#clearData').onclick = () => notice('Очистить эту студию?', 'Будут удалены локальные черновики, избранное и гостевое имя. Сначала экспортируйте данные, если хотите их сохранить. Демофрагменты останутся доступны.', 'ОЧИСТКА ДАННЫХ БРАУЗЕРА', () => {
    state = defaults(); editingId = null;
    let removed = true;
    try { localStorage.removeItem(KEY); } catch { removed = false; }
    restoreWorking(); syncName(); renderAll(); $('#saveStatus').textContent = 'Черновик не сохранён';
    toast(removed ? 'Данные прототипа очищены' : 'Вкладка очищена. Хранилище недоступно: старые данные могли остаться в браузере.');
  });
  restoreWorking(); syncName(); renderAll(); selectTool('song'); showPage(location.hash.slice(1) || 'studio', false); loadWave();
  if (state.working.prompt) $('#saveStatus').textContent = storageWarning ? 'Только в памяти вкладки' : 'Восстановлено из браузера';
  if (storageWarning) toast('Локальное хранилище недоступно или повреждено. Используйте экспорт для сохранения.');
})();
