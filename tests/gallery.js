const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { start, withoutCloud } = require('./serve');
const path = require('path');
(async () => {
  const site = await start(withoutCloud);
  const b = await chromium.launch();
  const problems = [];
  for (const [tag, vp] of [['ПК', {width:1440,height:900}], ['телефон', {width:390,height:844}]]) {
    const p = await b.newPage({ viewport: vp });
    p.on('pageerror', e => problems.push(tag + ' ошибка JS: ' + e.message));
    p.on('dialog', async d => { if (d.type() === 'prompt') await d.accept('Наш закат'); else await d.accept(); });
    await p.goto(site.url + 'index.html'); await p.waitForTimeout(600);
    await p.click('[data-who="she"]'); await p.waitForTimeout(400);

    // галерея больше не «скоро»
    const soon = await p.locator('.menu__item:nth-child(2)').getAttribute('class');
    if (soon.includes('is-soon')) problems.push(tag + ': галерея всё ещё помечена «скоро»');
    await p.click('.menu__item:nth-child(2)'); await p.waitForTimeout(500);
    if (!p.url().includes('#/gallery')) problems.push(tag + ': карточка не ведёт в галерею');

    // загрузка сразу трёх снимков
    await p.setInputFiles('[data-upload]', [1,2,3].map(i => path.join(__dirname, `fixtures/shot${i}.jpg`)));
    await p.waitForTimeout(3500);
    const cells = await p.locator('.grid__cell').count();
    if (cells !== 3) problems.push(`${tag}: в сетке ${cells} снимков вместо 3`);
    const withSrc = await p.locator('.grid__cell img[src^="data:"]').count();
    if (withSrc !== 3) problems.push(`${tag}: показались не все миниатюры (${withSrc} из 3)`);
    await p.screenshot({ path: path.join(__dirname, `screens/gal-${tag}-grid.png`), fullPage: true });

    // просмотр
    await p.click('.grid__cell'); await p.waitForTimeout(800);
    if (await p.locator('.viewer[hidden]').count()) problems.push(tag + ': просмотр не открылся');
    const meta = (await p.textContent('.viewer__meta')).trim();
    if (!meta.includes('Аида')) problems.push(tag + ': в просмотре не тот автор — «' + meta + '»');
    await p.screenshot({ path: path.join(__dirname, `screens/gal-${tag}-viewer.png`) });

    // листание
    await p.click('[data-step="1"]'); await p.waitForTimeout(600);
    // подпись
    await p.click('[data-caption]'); await p.waitForTimeout(600);
    if ((await p.textContent('.viewer__caption')).trim() !== 'Наш закат') problems.push(tag + ': подпись не сохранилась');
    // удаление
    await p.click('[data-remove]'); await p.waitForTimeout(900);
    if (!(await p.locator('.viewer[hidden]').count())) problems.push(tag + ': после удаления просмотр не закрылся');
    const left = await p.locator('.grid__cell').count();
    if (left !== 2) problems.push(`${tag}: после удаления осталось ${left} вместо 2`);

    // случайное + сохранность после перезагрузки
    await p.click('[data-random]'); await p.waitForTimeout(700);
    if (await p.locator('.viewer[hidden]').count()) problems.push(tag + ': «Случайное» не открыло снимок');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.reload(); await p.waitForTimeout(900);
    if (await p.locator('.grid__cell').count() !== 2) problems.push(tag + ': снимки пропали после перезагрузки');

    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) problems.push(`${tag}: горизонтальная прокрутка ${over}px`);
    await p.close();
  }
  console.log(problems.length ? problems.map(m => '  ⚠ ' + m).join('\n') : '  галерея: замечаний нет');
  await b.close(); site.stop();
  process.exitCode = problems.length ? 1 : 0;
})();
