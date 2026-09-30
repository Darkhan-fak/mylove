// Хранилище данных. Две реализации с одинаковым набором методов:
//   • облако  — Supabase, если в config.js заполнены url и anonKey: записи общие для двоих;
//   • браузер — localStorage, если ключей нет: сайт работает, но каждый видит только своё.
// Экраны в app.js про это не знают и работают с любым из вариантов.
window.Store = (() => {
  const CFG = window.CONFIG.supabase || {};
  const CLOUD = Boolean(CFG.url && CFG.anonKey);
  const COLS = { wishes: 'wishes', goals: 'goals', dates: 'dates' };

  // ---------- Общее: сжатие фотографии перед сохранением ----------
  const compress = (file, max = 1280) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k);
      cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error('не удалось сжать фото'))), 'image/jpeg', 0.8);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  // ---------- Вариант 1: браузер ----------
  const local = (() => {
    const KEY = 'mylove:';
    const read = (col) => {
      try { return JSON.parse(localStorage.getItem(KEY + col)) || []; }
      catch { return []; }
    };
    const write = (col, items) => {
      try { localStorage.setItem(KEY + col, JSON.stringify(items)); }
      catch (e) { alert('Не получилось сохранить: в браузере закончилось место.'); throw e; }
    };
    const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    let who = null;
    try { who = localStorage.getItem(KEY + 'user'); } catch {}

    return {
      cloud: false,
      async init() {},
      me: () => who,
      signedIn: () => Boolean(who),
      setMe(w) { who = w; try { localStorage.setItem(KEY + 'user', w); } catch {} },
      signOut() { who = null; try { localStorage.removeItem(KEY + 'user'); } catch {} },

      async list(col) { return read(col); },
      async add(col, data) {
        const item = { id: id(), createdAt: new Date().toISOString(), author: who, ...data };
        write(col, [item, ...read(col)]);
        return item;
      },
      async update(col, itemId, patch) {
        write(col, read(col).map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
      },
      async remove(col, itemId) {
        write(col, read(col).filter((it) => it.id !== itemId));
      },

      async savePhoto(file) { return blobToDataUrl(await compress(file)); },
      async photoUrl(v) { return v; },          // уже готовая строка data:
    };
  })();

  // ---------- Вариант 2: облако ----------
  const cloud = (() => {
    let sb = null;          // клиент Supabase
    let userId = null;
    let who = null;         // 'he' | 'she'
    let members = {};       // id пользователя -> 'he' | 'she'

    const load = (src) => new Promise((ok, err) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => err(new Error('не загрузилась библиотека Supabase'));
      document.head.appendChild(s);
    });

    // Сервер хранит автора как идентификатор пользователя, а экранам нужно «он» или «она».
    const toApp = (row) => ({
      ...row,
      author: members[row.author] || null,
      desc: row.descr ?? undefined,
      createdAt: row.created_at,
    });
    const toDb = (data) => {
      const { desc, createdAt, author, id, ...rest } = data;
      return desc === undefined ? rest : { ...rest, descr: desc };
    };

    async function readMembers() {
      const { data } = await sb.from('members').select('user_id, who');
      members = Object.fromEntries((data || []).map((m) => [m.user_id, m.who]));
      who = members[userId] || null;
    }

    return {
      cloud: true,
      async init() {
        await load('js/vendor/supabase.js?v=20260930a');   // библиотека лежит рядом, без обращения к чужому CDN
        sb = window.supabase.createClient(CFG.url, CFG.anonKey);
        const { data } = await sb.auth.getSession();
        userId = data.session?.user?.id || null;
        if (userId) await readMembers();
      },
      me: () => who,
      signedIn: () => Boolean(userId),
      setMe() {},                                // в облаке это решает вход, а не кнопка
      // who — кто входит ('he' или 'she'); birthday — день рождения ДРУГОГО, вида 2002-07-03
      async signIn(who, birthday) {
        const email = (window.CONFIG.login || {})[who];
        if (!email) throw new Error('В настройках не указана учётная запись для входа.');
        const { data, error } = await sb.auth.signInWithPassword({ email, password: birthday });
        if (error) {
          throw new Error(/invalid login/i.test(error.message)
            ? 'Дата не подошла. Проверь день, месяц и год.'
            : error.message);
        }
        userId = data.user.id;
        await readMembers();
      },
      async signOut() {
        await sb.auth.signOut();
        userId = null; who = null;
      },

      async list(col) {
        const { data, error } = await sb.from(COLS[col]).select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(toApp);
      },
      async add(col, data) {
        const { data: row, error } = await sb.from(COLS[col]).insert(toDb(data)).select().single();
        if (error) throw error;
        return toApp(row);
      },
      async update(col, id, patch) {
        const { error } = await sb.from(COLS[col]).update(toDb(patch)).eq('id', id);
        if (error) throw error;
      },
      async remove(col, id) {
        const { error } = await sb.from(COLS[col]).delete().eq('id', id);
        if (error) throw error;
      },

      async savePhoto(file) {
        const blob = await compress(file);
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        return path;
      },
      async photoUrl(path) {
        if (!path) return '';
        const { data } = await sb.storage.from('photos').createSignedUrl(path, 3600);
        return data?.signedUrl || '';
      },
    };
  })();

  return CLOUD ? cloud : local;
})();
