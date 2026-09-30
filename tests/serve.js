// Маленький сервер для проверок. Отдаёт сайт как есть, но config.js может подменить:
// так проверки гоняют сайт в режиме браузера, не трогая настоящие настройки.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

// patchConfig — функция, которой отдают текст config.js и которая возвращает изменённый
function start(patchConfig) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('нет такого файла');
      return;
    }
    let body = fs.readFileSync(file);
    if (patchConfig && rel === 'js/config.js') body = Buffer.from(patchConfig(body.toString()));
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}/`, stop: () => server.close() });
    });
  });
}

// Настройки без Supabase: записи живут в браузере, вход не нужен
const withoutCloud = (src) => src.replace(/url: '[^']*'/, "url: ''").replace(/anonKey: '[^']*'/, "anonKey: ''");

module.exports = { start, withoutCloud };
