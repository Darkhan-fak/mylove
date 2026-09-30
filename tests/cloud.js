// Проверка облачного режима: библиотека Supabase лежит рядом с сайтом, клиент создаётся,
// на приветствии появляется вход по почте. Сами запросы к Supabase здесь не проверяются —
// для этого нужен настоящий вход по письму.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { start } = require('./serve');

(async () => {
  const site = await start();
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const problems = [];
  p.on('pageerror', (e) => problems.push('ошибка JS: ' + e.message));

  await p.goto(site.url + 'index.html');
  await p.waitForFunction(() => window.Store && document.querySelector('h1'), null, { timeout: 15000 })
    .catch(() => problems.push('сайт не поднялся за 15 секунд'));
  await p.waitForTimeout(500);

  const state = await p.evaluate(() => ({
    lib: typeof window.supabase?.createClient === 'function',
    cloud: window.Store.cloud,
    signedIn: window.Store.signedIn(),
  }));
  if (!state.cloud) problems.push('облачный режим не включился — проверь url и anonKey в config.js');
  if (!state.lib) problems.push('не загрузилась библиотека js/vendor/supabase.js');
  if (state.signedIn) problems.push('кто-то уже вошёл, хотя сессии быть не должно');
  if (!(await p.locator('.login input[name=email]').count())) problems.push('нет формы входа по почте');

  console.log(problems.length ? problems.map((m) => '  ⚠ ' + m).join('\n') : '  режим облака, вход по почте — всё на месте');
  await browser.close();
  site.stop();
  process.exitCode = problems.length ? 1 : 0;
})();
