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
  if (!(await p.locator('.login input[name=email]').count())) problems.push('нет поля для почты');
  if (!(await p.locator('.login input[name=password]').count())) problems.push('нет поля для пароля');

  // Неверный вход должен приводить к сообщению, а не к молчанию. Каким именно оно будет,
  // зависит от среды: без доступа к Supabase это будет жалоба на сеть, с доступом —
  // «Не подходит почта или пароль».
  let said = '';
  p.on('dialog', async (d) => { said = d.message(); await d.accept(); });
  await p.fill('.login input[name=email]', 'net-takogo@example.com');
  await p.fill('.login input[name=password]', 'zavedomo-nevernyj');
  await p.click('.login .btn');
  await p.waitForTimeout(6000);
  if (!said) problems.push('при неверном пароле сайт ничего не сказал');
  else console.log('  при неверном пароле: «' + said + '»');

  console.log(problems.length ? problems.map((m) => '  ⚠ ' + m).join('\n') : '  режим облака, вход по паролю — всё на месте');
  await browser.close();
  site.stop();
  process.exitCode = problems.length ? 1 : 0;
})();
