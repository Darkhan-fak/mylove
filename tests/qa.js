const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file:///home/user/mylove/index.html';

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const log = (m) => { problems.push(m); console.log('  ⚠ ' + m); };

  async function newPage(vp, tag) {
    const p = await browser.newPage({ viewport: vp });
    p.on('pageerror', e => log(`${tag}: ошибка JS — ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT/.test(m.text())) log(`${tag}: консоль — ${m.text()}`); });
    p.on('requestfailed', r => { if (!/fonts\.|gstatic/.test(r.url())) log(`${tag}: не загрузился ${r.url().split('/').pop()}`); });
    p.on('dialog', d => d.accept());
    return p;
  }
  const overflow = async (p, tag) => {
    const w = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (w > 1) log(`${tag}: горизонтальная прокрутка, лишние ${w}px`);
  };
  // не перекрыт ли элемент чем-то другим
  const clickable = async (p, sel, tag) => {
    const ok = await p.evaluate((s) => {
      const el = document.querySelector(s); if (!el) return 'нет элемента';
      const r = el.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return el.contains(t) || el === t ? true : 'перекрыт: ' + (t && t.className);
    }, sel);
    if (ok !== true) log(`${tag}: «${sel}» ${ok}`);
  };

  for (const [tag, vp] of [['ПК', { width: 1440, height: 900 }], ['ноутбук', { width: 1366, height: 768 }], ['телефон', { width: 390, height: 844 }]]) {
    console.log('\n=== ' + tag + ' ===');
    const p = await newPage(vp, tag);
    await p.goto(URL); await p.waitForTimeout(700);

    // 1. Приветствие
    if (!(await p.locator('h1').textContent()).includes('Привет')) log(`${tag}: нет приветствия`);
    if (!/\d+/.test(await p.locator('.counter').textContent())) log(`${tag}: счётчик дней пуст`);
    await clickable(p, '[data-who="she"]', tag);
    await clickable(p, '[data-who="he"]', tag);
    await overflow(p, tag + '/приветствие');
    await p.click('[data-who="she"]'); await p.waitForTimeout(500);
    if (!p.url().includes('#/menu')) log(`${tag}: выбор «Она» не ведёт в меню`);

    // 2. Меню
    const cards = await p.locator('.menu__item').count();
    if (cards !== 5) log(`${tag}: в меню ${cards} карточек вместо 5`);
    const soon = p.locator('.menu__item.is-soon');
    if (await soon.count() !== 2) log(`${tag}: карточек «скоро» не 2`);
    if (await soon.first().getAttribute('href') !== '#/menu') log(`${tag}: карточка «скоро» куда-то ведёт`);
    await overflow(p, tag + '/меню');
    for (const s of ['.menu__item:nth-child(3)', '.menu__item:nth-child(4)', '.menu__item:nth-child(5)']) {
      await p.locator(s).scrollIntoViewIfNeeded(); await p.waitForTimeout(150); await clickable(p, s, tag);
    }

    // 3. Хотелки
    await p.goto(URL + '#/wishes'); await p.waitForTimeout(400);
    await p.click('[data-add]');
    await p.fill('textarea[name=text]', 'Пикник на закате');
    await p.fill('input[name=link]', 'https://example.com/picnic');
    await p.setInputFiles('.photo-pick input', require('path').join(__dirname, 'test-photo.jpg')); await p.waitForTimeout(600);
    if (!(await p.locator('.photo-pick img').count())) log(`${tag}: превью фото не появилось`);
    await p.click('.form .btn:not(.btn--ghost)'); await p.waitForTimeout(500);
    if (!(await p.locator('.wish img').count())) log(`${tag}: фото не сохранилось в желании`);
    await p.click('[data-add]'); await p.fill('textarea[name=text]', 'Съездить в горы'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    if (!(await p.locator('#modal[hidden]').count())) log(`${tag}: Escape не закрывает окно`);
    if (await p.locator('.wish').count() !== 1) log(`${tag}: отменённое желание всё равно сохранилось`);
    await p.click('[data-add]'); await p.fill('textarea[name=text]', 'Новые духи'); await p.click('.form .btn:not(.btn--ghost)'); await p.waitForTimeout(300);
    // фильтры
    for (const [f, exp] of [['she', 2], ['he', 0], ['done', 0], ['all', 2]]) {
      await p.click(`[data-filter="${f}"]`); await p.waitForTimeout(200);
      const n = await p.locator('.wish').count();
      if (n !== exp) log(`${tag}: фильтр «${f}» показал ${n} вместо ${exp}`);
    }
    await p.click('[data-done]'); await p.waitForTimeout(300);
    if (await p.locator('.wish').count() !== 1) log(`${tag}: исполненное желание не ушло из списка`);
    await p.click('[data-filter="done"]'); await p.waitForTimeout(200);
    if (await p.locator('.wish.is-done').count() !== 1) log(`${tag}: исполненное не попало в свой фильтр`);
    await p.click('[data-filter="all"]'); await p.waitForTimeout(200);
    await p.click('[data-del]'); await p.waitForTimeout(300);
    if (await p.locator('.wish').count() !== 0) log(`${tag}: желание не удалилось`);
    await overflow(p, tag + '/хотелки');
    await p.screenshot({ path: `qa-${tag}-wishes.png`, fullPage: true });

    // 4. Цели
    await p.goto(URL + '#/goals'); await p.waitForTimeout(300);
    for (const [t, d] of [['Поехать к морю', '2027-07-01'], ['Выучить танец', '2025-01-10'], ['Купить дом', '']]) {
      await p.click('[data-add]'); await p.fill('input[name=title]', t);
      if (d) await p.fill('input[name=due]', d);
      await p.click('.form .btn:not(.btn--ghost)'); await p.waitForTimeout(250);
    }
    if (await p.locator('.goal').count() !== 3) log(`${tag}: сохранились не все цели`);
    if (!(await p.locator('.due--late').count())) log(`${tag}: просроченная цель не помечена`);
    if (!(await p.textContent('.goals')).includes('без срока')) log(`${tag}: цель без срока подписана неверно`);
    await p.click('.goal [data-done]'); await p.waitForTimeout(300);
    if (!(await p.locator('.goal.is-done').count())) log(`${tag}: цель не отмечается достигнутой`);
    if (!(await p.textContent('.progress')).includes('1 из 3')) log(`${tag}: прогресс целей считается неверно`);
    await overflow(p, tag + '/цели');
    await p.screenshot({ path: `qa-${tag}-goals.png`, fullPage: true });

    // 5. Календарь
    await p.goto(URL + '#/calendar'); await p.waitForTimeout(400);
    if (await p.locator('.cal__day').count() < 35) log(`${tag}: в календаре мало дней`);
    if (!(await p.locator('.cal__day.is-today').count())) log(`${tag}: сегодняшний день не отмечен`);
    const month = await p.textContent('.cal__month');
    if (/^[a-zа-я]/.test(month)) log(`${tag}: месяц с маленькой буквы — «${month}»`);
    await p.click('[data-nav="1"]'); await p.waitForTimeout(250);
    if (await p.textContent('.cal__month') === month) log(`${tag}: не листается вперёд`);
    await p.click('[data-nav="-1"]'); await p.waitForTimeout(250);
    const days = p.locator('.cal__day:not(.is-other)');
    await days.nth(await days.count() - 2).click(); await p.waitForTimeout(300);
    await p.fill('input[name=title]', 'Ужин и кино'); await p.fill('input[name=time]', '19:30');
    await p.fill('input[name=place]', 'Центр'); await p.click('.form .btn:not(.btn--ghost)'); await p.waitForTimeout(400);
    if (!(await p.locator('.cal__day.has-date').count())) log(`${tag}: день со свиданием не отмечен`);
    const past = (await p.textContent('[data-tab="past"]')).includes('1');
    if (!past && !(await p.locator('.date').count())) log(`${tag}: свидание не попало ни в один список`);
    await p.click('.cal__day.has-date'); await p.waitForTimeout(300);
    if (!(await p.locator('.modal .date').count())) log(`${tag}: свидание не видно в окне дня`);
    await p.click('.modal__x'); await p.waitForTimeout(200);
    await overflow(p, tag + '/календарь');
    await p.screenshot({ path: `qa-${tag}-calendar.png`, fullPage: true });

    // 6. Перезагрузка: данные на месте
    await p.reload(); await p.waitForTimeout(600);
    await p.click('[data-tab="past"]'); await p.waitForTimeout(300);
    const kept = await p.locator('.date').count() + (await p.evaluate(() => document.querySelectorAll('.date').length));
    if (!kept) log(`${tag}: свидание пропало после перезагрузки`);
    await p.goto(URL + '#/goals'); await p.waitForTimeout(400);
    if (await p.locator('.goal').count() !== 3) log(`${tag}: цели пропали после перезагрузки`);

    // 7. Возврат и смена пользователя
    await p.click('.back'); await p.waitForTimeout(400);
    if (!p.url().includes('#/menu')) log(`${tag}: ссылка «меню» не работает`);
    await p.goto(URL + '#/'); await p.waitForTimeout(400);
    if (!(await p.locator('[data-reset]').count())) log(`${tag}: нет кнопки смены пользователя`);
    await p.click('[data-reset]'); await p.waitForTimeout(300);
    if (!(await p.locator('[data-who="he"]').count())) log(`${tag}: смена пользователя не сбрасывает выбор`);
    await p.click('[data-who="he"]'); await p.waitForTimeout(300);
    await p.goto(URL + '#/wishes'); await p.waitForTimeout(300);
    await p.click('[data-add]'); await p.fill('textarea[name=text]', 'Его желание'); await p.click('.form .btn:not(.btn--ghost)'); await p.waitForTimeout(300);
    if (!(await p.textContent('.wish')).includes('Он')) log(`${tag}: желание подписано не тем автором`);

    // 8. Неизвестный адрес
    await p.goto(URL + '#/чтототакое'); await p.waitForTimeout(400);
    if (!(await p.locator('.menu').count())) log(`${tag}: неизвестный адрес не ведёт в меню`);

    await p.close();
  }

  console.log('\n===== ИТОГ: ' + (problems.length ? problems.length + ' замечаний' : 'замечаний нет') + ' =====');
  await browser.close();
})();
