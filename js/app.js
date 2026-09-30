(() => {
  const C = window.CONFIG;
  const S = window.Store;
  const app = document.getElementById('app');
  const BLOOM = 'assets/flowers/bloom.svg';

  // ---------- Утилиты ----------
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);
  const fmtDate = (s, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => parseYmd(s).toLocaleDateString('ru-RU', opts);
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  const nameOf = (who) => C.names[who] || '';
  const authorTag = (who) => `<span class="author author--${who}">${esc(nameOf(who))}</span>`;
  const topbar = () => `<div class="topbar"><a class="back" href="#/menu">← меню</a><span class="eyebrow">${esc(nameOf(S.getUser()))}</span></div>`;
  const empty = (text) => `<div class="empty"><img src="${BLOOM}" alt="">${text}</div>`;

  // Сжатие фото перед сохранением: длинная сторона до 1280px, JPEG
  const compress = (file, max = 1280) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k);
      cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

  // ---------- Модальное окно ----------
  const modal = document.getElementById('modal');
  const openModal = (title, html, onMount) => {
    modal.querySelector('.modal__title').textContent = title;
    modal.querySelector('.modal__body').innerHTML = html;
    modal.hidden = false;
    onMount?.(modal.querySelector('.modal__body'));
    modal.querySelector('input, textarea')?.focus();
  };
  const closeModal = () => { modal.hidden = true; };
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // Поле выбора фото с превью; возвращает функцию, которая отдаёт dataURL или ''
  const photoField = (root) => {
    const pick = root.querySelector('.photo-pick');
    const input = pick.querySelector('input');
    let data = '';
    input.addEventListener('change', async () => {
      const f = input.files[0];
      if (!f) return;
      data = await compress(f);
      pick.querySelector('span').innerHTML = `<img src="${data}" alt="">`;
    });
    return () => data;
  };
  const photoPickHtml = `<label class="photo-pick"><span>＋ фото (необязательно)</span><input type="file" accept="image/*"></label>`;

  // ---------- Экран 1: приветствие ----------
  function viewWelcome() {
    const user = S.getUser();
    let counter = '';
    if (C.startDate) {
      const n = daysBetween(parseYmd(C.startDate), today());
      counter = `<div class="counter">мы вместе уже<b>${n}</b>${plural(n, 'день', 'дня', 'дней')}</div>`;
    }
    const who = user
      ? `<a class="btn" href="#/menu">Войти →</a>
         <button class="linkish" data-reset>это не ${esc(nameOf(user).toLowerCase())}?</button>`
      : `<p class="muted" style="margin-top:8px">Кто сейчас здесь?</p>
         <div class="who">
           <button class="btn" data-who="she">${esc(C.names.she)}</button>
           <button class="btn btn--ghost" data-who="he">${esc(C.names.he)}</button>
         </div>`;

    app.innerHTML = `
      <section class="welcome">
        <img class="welcome__sticker" src="assets/flowers/hello.webp" alt="">
        <span class="eyebrow">только для нас двоих</span>
        <h1>${esc(C.greeting)}</h1>
        <p class="muted">${esc(C.subtitle)}</p>
        ${counter}
        ${who}
      </section>`;

    app.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => {
      S.setUser(b.dataset.who);
      location.hash = '#/menu';
    }));
    app.querySelector('[data-reset]')?.addEventListener('click', () => {
      try { localStorage.removeItem('mylove:user'); } catch {}
      viewWelcome();
    });
  }

  // ---------- Экран 2: меню ----------
  const SECTIONS = [
    { href: '#/story', title: 'Наша история', desc: 'Фото, слова и, может быть, видео о том, как всё началось', soon: true },
    { href: '#/gallery', title: 'Галерея', desc: 'Все наши фото: смотреть случайные и добавлять новые', soon: true },
    { href: '#/wishes', title: 'Хотелки', desc: 'Маленькие и большие желания с фото' },
    { href: '#/goals', title: 'Наши цели', desc: 'Чего мы хотим и к какому сроку' },
    { href: '#/calendar', title: 'Календарь', desc: 'Наши свидания: прошедшие и будущие' },
  ];

  function viewMenu() {
    app.innerHTML = `
      <header class="menu-head">
        <span class="eyebrow">наше место</span>
        <h1>Куда пойдём?</h1>
      </header>
      <nav class="menu">
        ${SECTIONS.map((s, i) => `
          <a class="menu__item ${s.soon ? 'is-soon' : ''}" href="${s.soon ? '#/menu' : s.href}" ${s.soon ? 'aria-disabled="true"' : ''}>
            ${s.soon ? '<span class="badge">скоро</span>' : ''}
            <span class="menu__num">0${i + 1}</span>
            <span class="menu__title">${s.title}</span>
            <span class="menu__desc">${s.desc}</span>
          </a>`).join('')}
      </nav>
      <p class="menu-foot"><a class="back" href="#/">← к приветствию</a></p>`;
  }

  // ---------- Экран 3: хотелки ----------
  let wishFilter = 'all';

  async function viewWishes() {
    const all = await S.list('wishes');
    const filters = { all: 'Все', she: 'Её', he: 'Его', done: 'Исполненные' };
    const shown = all.filter((w) =>
      wishFilter === 'all' ? !w.done : wishFilter === 'done' ? w.done : w.author === wishFilter && !w.done);

    app.innerHTML = `
      ${topbar()}
      <div class="page-head">
        <div><h2>Хотелки</h2><p class="muted">Всё, чего хочется: от кофе до путешествий.</p></div>
        <button class="btn" data-add>＋ Желание</button>
      </div>
      <div class="chips">
        ${Object.entries(filters).map(([k, v]) => `<button class="chip ${wishFilter === k ? 'is-active' : ''}" data-filter="${k}">${v}</button>`).join('')}
      </div>
      ${shown.length ? `<div class="wishes">${shown.map((w) => `
        <article class="card wish ${w.done ? 'is-done' : ''}">
          ${w.photo ? `<img src="${w.photo}" alt="">` : ''}
          <div class="card__body">
            <p class="wish__text">${esc(w.text)}</p>
            ${w.link ? `<a class="wish__link" href="${esc(w.link)}" target="_blank" rel="noopener">${esc(w.link.replace(/^https?:\/\//, '').slice(0, 40))}</a>` : ''}
            <div class="card__meta">
              ${authorTag(w.author)}
              <div class="card__actions">
                <button class="icon-btn" data-done="${w.id}" title="${w.done ? 'Вернуть' : 'Исполнено'}">${w.done ? '↺' : '✓ исполнено'}</button>
                <button class="icon-btn" data-del="${w.id}" title="Удалить">✕</button>
              </div>
            </div>
          </div>
        </article>`).join('')}</div>`
        : empty(wishFilter === 'done' ? 'Пока ничего не исполнено, но это ненадолго.' : 'Здесь пока пусто. Напиши первое желание.')}`;

    app.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { wishFilter = b.dataset.filter; viewWishes(); }));
    app.querySelector('[data-add]').addEventListener('click', addWish);
    app.querySelectorAll('[data-done]').forEach((b) => b.addEventListener('click', async () => {
      const w = all.find((x) => x.id === b.dataset.done);
      await S.update('wishes', w.id, { done: !w.done });
      viewWishes();
    }));
    app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Удалить это желание?')) return;
      await S.remove('wishes', b.dataset.del);
      viewWishes();
    }));
  }

  function addWish() {
    openModal('Новое желание', `
      <form class="form">
        <label class="field">Чего хочется?<textarea name="text" required placeholder="Например: пикник на закате"></textarea></label>
        <label class="field">Ссылка<input name="link" type="url" placeholder="https://… (необязательно)"></label>
        ${photoPickHtml}
        <div class="form__actions"><button type="button" class="btn btn--ghost" data-close>Отмена</button><button class="btn">Сохранить</button></div>
      </form>`, (root) => {
      const getPhoto = photoField(root);
      root.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await S.add('wishes', { text: f.text.value.trim(), link: f.link.value.trim(), photo: getPhoto(), author: S.getUser(), done: false });
        closeModal();
        viewWishes();
      });
    });
  }

  // ---------- Экран 4: цели ----------
  async function viewGoals() {
    const all = await S.list('goals');
    const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999');
    const active = all.filter((g) => !g.done).sort(byDue);
    const done = all.filter((g) => g.done).sort(byDue);
    const pct = all.length ? Math.round((done.length / all.length) * 100) : 0;

    const dueTag = (g) => {
      if (!g.due) return '';
      if (g.done) return `<span class="due">${fmtDate(g.due)}</span>`;
      const n = daysBetween(today(), parseYmd(g.due));
      if (n < 0) return `<span class="due due--late">срок прошёл</span>`;
      if (n === 0) return `<span class="due due--soon">сегодня</span>`;
      return `<span class="due ${n <= 14 ? 'due--soon' : ''}" title="${fmtDate(g.due)}">через ${n} ${plural(n, 'день', 'дня', 'дней')}</span>`;
    };
    const goalCard = (g) => `
      <article class="card goal ${g.done ? 'is-done' : ''}">
        <button class="goal__check" data-done="${g.id}" aria-label="Отметить">${g.done ? '✓' : ''}</button>
        <div class="goal__main">
          <div class="goal__title">${esc(g.title)}</div>
          ${g.desc ? `<p class="goal__desc">${esc(g.desc)}</p>` : ''}
          <div class="card__meta">
            <span>${g.due ? `до ${fmtDate(g.due)}` : 'без срока'} · ${authorTag(g.author)}</span>
            <div class="card__actions">${dueTag(g)}<button class="icon-btn" data-del="${g.id}" title="Удалить">✕</button></div>
          </div>
        </div>
      </article>`;

    app.innerHTML = `
      ${topbar()}
      <div class="page-head">
        <div><h2>Наши цели</h2><p class="muted">Чего мы хотим и когда это сделаем.</p></div>
        <button class="btn" data-add>＋ Цель</button>
      </div>
      ${all.length ? `
        <div class="progress">
          <span class="eyebrow">достигли ${done.length} из ${all.length}</span>
          <div class="progress__bar"><span style="width:${pct}%"></span></div>
        </div>
        <div class="goals">${active.map(goalCard).join('') || empty('Все цели достигнуты! Время мечтать дальше.')}</div>
        ${done.length ? `<p class="eyebrow section-label">достигли</p><div class="goals">${done.map(goalCard).join('')}</div>` : ''}`
        : empty('Целей пока нет. С чего начнём?')}`;

    app.querySelector('[data-add]').addEventListener('click', addGoal);
    app.querySelectorAll('[data-done]').forEach((b) => b.addEventListener('click', async () => {
      const g = all.find((x) => x.id === b.dataset.done);
      await S.update('goals', g.id, { done: !g.done });
      viewGoals();
    }));
    app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Удалить эту цель?')) return;
      await S.remove('goals', b.dataset.del);
      viewGoals();
    }));
  }

  function addGoal() {
    openModal('Новая цель', `
      <form class="form">
        <label class="field">Цель<input name="title" required placeholder="Например: поехать к морю"></label>
        <label class="field">Что и как будем делать<textarea name="desc" placeholder="Необязательно"></textarea></label>
        <label class="field">Срок<input name="due" type="date"></label>
        <div class="form__actions"><button type="button" class="btn btn--ghost" data-close>Отмена</button><button class="btn">Сохранить</button></div>
      </form>`, (root) => {
      root.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await S.add('goals', { title: f.title.value.trim(), desc: f.desc.value.trim(), due: f.due.value, author: S.getUser(), done: false });
        closeModal();
        viewGoals();
      });
    });
  }

  // ---------- Экран 5: календарь ----------
  let calMonth = (() => { const d = today(); d.setDate(1); return d; })();

  async function viewCalendar() {
    const dates = await S.list('dates');
    const byDay = {};
    dates.forEach((d) => (byDay[d.day] ||= []).push(d));

    const first = new Date(calMonth);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7)); // понедельник первой недели
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
      if (i >= 34 && d.getMonth() !== first.getMonth()) break;
    }
    const todayKey = ymd(today());
    const upcoming = dates.filter((d) => d.day >= todayKey).sort((a, b) => (a.day + (a.time || '')).localeCompare(b.day + (b.time || '')));
    const pastCount = dates.length - upcoming.length;

    app.innerHTML = `
      ${topbar()}
      <div class="page-head">
        <div><h2>Календарь</h2><p class="muted">Нажми на день, чтобы отметить свидание.</p></div>
      </div>
      <div class="card cal">
        <div class="cal__nav">
          <button class="icon-btn" data-nav="-1" aria-label="Предыдущий месяц">←</button>
          <span class="cal__month">${monthTitle(first)}</span>
          <button class="icon-btn" data-nav="1" aria-label="Следующий месяц">→</button>
        </div>
        <div class="cal__grid">
          ${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<span class="cal__dow">${d}</span>`).join('')}
          ${cells.map((d) => {
            const k = ymd(d);
            const cls = [d.getMonth() !== first.getMonth() && 'is-other', k === todayKey && 'is-today', byDay[k] && 'has-date'].filter(Boolean).join(' ');
            return `<button class="cal__day ${cls}" data-day="${k}">${d.getDate()}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="eyebrow section-label">ближайшие свидания${pastCount ? ` · уже было ${pastCount}` : ''}</p>
      ${upcoming.length ? `<div class="dates">${upcoming.slice(0, 8).map(dateCard).join('')}</div>` : empty('Ближайших свиданий пока нет. Самое время позвать.')}`;

    app.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
      calMonth.setMonth(calMonth.getMonth() + Number(b.dataset.nav));
      viewCalendar();
    }));
    app.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => openDay(b.dataset.day, byDay[b.dataset.day] || [])));
    bindDateDeletes(app);
  }

  const monthTitle = (d) => {
    const m = d.toLocaleDateString('ru-RU', { month: 'long' });
    return `${m[0].toUpperCase()}${m.slice(1)} ${d.getFullYear()}`;
  };

  function dateCard(d) {
    const dt = parseYmd(d.day);
    return `
      <article class="card date">
        <div class="date__day"><b>${dt.getDate()}</b><span>${dt.toLocaleDateString('ru-RU', { month: 'short' })}</span></div>
        <div class="date__main">
          <div class="date__title">${esc(d.title)}</div>
          <div class="date__info">${[d.time, d.place].filter(Boolean).map(esc).join(' · ')}${d.note ? `<br>${esc(d.note)}` : ''}</div>
        </div>
        <button class="icon-btn" data-del-date="${d.id}" title="Удалить">✕</button>
      </article>`;
  }

  function bindDateDeletes(root) {
    root.querySelectorAll('[data-del-date]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Удалить это свидание?')) return;
      await S.remove('dates', b.dataset.delDate);
      closeModal();
      viewCalendar();
    }));
  }

  function openDay(day, items) {
    openModal(fmtDate(day, { day: 'numeric', month: 'long', weekday: 'long' }), `
      ${items.length ? `<div class="day-list">${items.map(dateCard).join('')}</div>` : ''}
      <form class="form">
        <label class="field">Что делаем?<input name="title" required placeholder="Например: ужин и кино"></label>
        <div class="row">
          <label class="field">Время<input name="time" type="time"></label>
          <label class="field">Где<input name="place" placeholder="Место"></label>
        </div>
        <label class="field">Заметка<textarea name="note" placeholder="Необязательно"></textarea></label>
        <div class="form__actions"><button type="button" class="btn btn--ghost" data-close>Отмена</button><button class="btn">Добавить свидание</button></div>
      </form>`, (root) => {
      bindDateDeletes(root);
      root.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await S.add('dates', { day, title: f.title.value.trim(), time: f.time.value, place: f.place.value.trim(), note: f.note.value.trim(), author: S.getUser() });
        closeModal();
        viewCalendar();
      });
    });
  }

  // Подпись на фото клумбы
  document.querySelector('.garden__note').textContent = C.gardenNote || '';

  // ---------- Наклейки по бокам ----------
  // Каждая наклейка — отдельная картинка со своим покачиванием; скорость и фаза разные,
  // чтобы они не двигались синхронно.
  ['left', 'right'].forEach((side, s) => {
    const names = C.stickers?.[side] || [];
    if (!names.length) return;
    const el = document.querySelector(`.side--${side}`);
    el.classList.add('custom');
    el.innerHTML = names.map((n, i) => {
      const odd = (i + s) % 2;
      // Все наклейки умещаются выше клумбы: последняя начинается не ниже 45% высоты экрана.
      const top = -5 + i * (50 / Math.max(names.length - 1, 1));
      const dur = 5 + ((i * 3 + s * 2) % 4) * 0.8;    // 5–7.4 с
      return `<img class="sticker" src="assets/stickers/${n}.webp" alt="" style="top:${top}%;` +
        `--x:${odd ? 14 : -10}%;--r:${odd ? 4 : -4}deg;` +
        `animation-duration:${dur}s;animation-delay:-${(i * 1.9 + s * 1.1).toFixed(1)}s">`;
    }).join('');
  });

  // ---------- Роутер ----------
  const routes = { '': viewWelcome, menu: viewMenu, wishes: viewWishes, goals: viewGoals, calendar: viewCalendar };

  function render() {
    closeModal();
    const key = location.hash.replace(/^#\/?/, '');
    // Без выбранного «кто я» пускаем только на приветствие
    const view = !S.getUser() ? viewWelcome : routes[key] || viewMenu;
    document.body.classList.toggle('is-welcome', view === viewWelcome);
    app.style.animation = 'none';
    void app.offsetWidth; // перезапуск анимации появления
    app.style.animation = '';
    view();
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', render);
  render();
})();
