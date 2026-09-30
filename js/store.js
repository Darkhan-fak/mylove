// Хранилище данных. Сейчас используется localStorage, то есть данные живут только в этом браузере.
// На этапе 2 этот файл заменяется на Supabase с тем же API, и экраны менять не придётся.
window.Store = (() => {
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

  return {
    async list(col) { return read(col); },
    async add(col, data) {
      const item = { id: id(), createdAt: new Date().toISOString(), ...data };
      write(col, [item, ...read(col)]);
      return item;
    },
    async update(col, itemId, patch) {
      write(col, read(col).map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
    },
    async remove(col, itemId) {
      write(col, read(col).filter((it) => it.id !== itemId));
    },

    // Кто сейчас пользуется сайтом: 'he' или 'she'
    getUser() { try { return localStorage.getItem(KEY + 'user'); } catch { return null; } },
    setUser(u) { try { localStorage.setItem(KEY + 'user', u); } catch {} },
  };
})();
