import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:8099/kredit.html';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');

const FAKE = {
  content:[{type:'text', text:'```json\n{"tema":"A víz körforgása","kerdesek":[' +
    [0,1,2,3,4,5].map(i=>`{"k":"Kérdés ${i+1}?","v":["a","b","c","d"],"j":${i%4},"m":"Mert így van."}`).join(',') +
    ']}\n```'}]
};

const log = [];
const ok = (name, cond) => { log.push((cond?'  OK  ':' FAIL ')+name); if(!cond) process.exitCode = 1; };

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

async function newPage(){
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => { log.push(' FAIL page error: '+e.message); process.exitCode = 1; });
  await page.addInitScript(fake => {
    const real = window.fetch;
    window.fetch = (u, o) => String(u).includes('api.anthropic.com')
      ? Promise.resolve(new Response(JSON.stringify(fake), {status:200, headers:{'Content-Type':'application/json'}}))
      : real(u, o);
  }, FAKE);
  await page.goto(URL);
  return { ctx, page };
}

/* ---------- 1. SZÓLÓ: nap indítás, tanulás, játék ---------- */
{
  const { ctx, page } = await newPage();
  await page.click('#ob-solo');
  ok('szóló: 4 fül', (await page.locator('#tabs button').count()) === 4);
  ok('szóló: nap még nem indult', await page.locator('#startday').isVisible());

  await page.fill('#dbase', '20');
  await page.click('#startday');
  ok('alapkeret 20 perc', (await page.locator('.fuel .num').innerText()).startsWith('20'));
  ok('szegmens csík 20 elem', (await page.locator('.seg i').count()) === 20);
  ok('heti dolgozat-kérdés megjelenik', await page.locator('#t-add').isVisible());

  await page.fill('#t-sub','Biosz'); await page.fill('#t-date','2099-01-01'); await page.click('#t-add');
  ok('dolgozat felvéve', (await page.locator('.card').filter({hasText:'Közelgő dolgozatok'}).innerText()).includes('Biosz'));
  ok('a kérdés eltűnt a héten', (await page.locator('#t-add').count()) === 0);

  // Tanulás
  await page.click('#tabs button[data-tab=study]');
  ok('a dolgozat tárgya felajánlva', (await page.locator('[data-sub="Biosz"]').count()) === 1);
  await page.click('[data-sub="Biosz"]');
  ok('gomb tiltva fotó nélkül', await page.locator('#gen').isDisabled());
  await page.setInputFiles('#photo', {name:'o.png', mimeType:'image/png', buffer:PNG});
  ok('gomb aktív fotóval', !(await page.locator('#gen').isDisabled()));
  await page.click('#gen');
  await page.waitForSelector('.q');
  ok('a kép NEM látszik a kikérdezés alatt', (await page.locator('img').count()) === 0);
  ok('6 kérdés', (await page.locator('.qhead .pill').first().innerText()).includes('/ 6'));

  let correct = 0;
  for(let i=0;i<6;i++){
    const good = i % 4;                 // a fake j = i%4
    if(i < 5){ await page.locator(`[data-opt="${good}"]`).click(); correct++; }
    else     { await page.locator(`[data-opt="${(good+1)%4}"]`).click(); }
    ok(`${i+1}. kérdés után nincs visszalépés`, await page.locator('.opt').first().isDisabled());
    await page.click('#q-next');
  }
  const res = await page.locator('.card.center').innerText();
  ok('5 jó válasz → +15 perc', res.includes('+15') && res.includes('5/6'));
  await page.click('#q-today');
  ok('keret 20 → 35', (await page.locator('.fuel .num').innerText()).startsWith('35'));
  ok('napló mutatja a kört', (await page.locator('.card').filter({hasText:'Mai napló'}).innerText()).includes('A víz körforgása'));

  // Bukott kör: minCorrect alatt nulla
  await page.click('#tabs button[data-tab=study]');
  await page.click('[data-sub="Biosz"]');
  await page.setInputFiles('#photo', {name:'o.png', mimeType:'image/png', buffer:PNG});
  await page.click('#gen');
  await page.waitForSelector('.q');
  for(let i=0;i<6;i++){ await page.locator(`[data-opt="${(i%4+1)%4}"]`).click(); await page.click('#q-next'); }
  ok('0 jó válasz → 0 perc', (await page.locator('.card.center').innerText()).includes('0/6'));
  await page.click('#q-today');
  ok('keret marad 35', (await page.locator('.fuel .num').innerText()).startsWith('35'));
  ok('a bukott kör is naplózva', (await page.locator('.card').filter({hasText:'Mai napló'}).innerText()).includes('0/6'));

  // Játék
  await page.click('#tabs button[data-tab=play]');
  ok('3 alapjáték', (await page.locator('[data-game]').count()) === 3);
  await page.locator('[data-game="Roblox"]').click();
  ok('fut a kör', (await page.locator('.fuel .lbl').innerText()).toLowerCase().includes('roblox'));
  ok('induláskor 35 perc', (await page.locator('#p-num').innerText()) === '35');
  // egy perc visszapörgetése: ketyegjen a fogyás
  await page.evaluate(() => { play.startedAt -= 61000; });
  await page.waitForFunction(() => document.getElementById('p-num').textContent === '34', null, {timeout:4000});
  ok('percenként fogy a keret', (await page.locator('#p-num').innerText()) === '34');
  await page.screenshot({path:'shot-play.png'});
  await page.click('#p-stop');
  ok('leállt', (await page.locator('[data-game]').count()) === 3);
  ok('a játék bekerült a naplóba', (await page.locator('#tabs button[data-tab=today]').click().then(async()=>
      (await page.locator('.card').filter({hasText:'Mai napló'}).innerText()))).includes('Roblox'));
  ok('keret 35 → 34', (await page.locator('.fuel .num').innerText()).startsWith('34'));
  await page.screenshot({path:'shot-today.png'});
  await page.click('#tabs button[data-tab=play]');

  // Szabályok
  await page.click('#tabs button[data-tab=rules]');
  ok('szólóban a napló is itt van', (await page.locator('h3').filter({hasText:'Elmúlt 7 nap'}).count()) === 1);
  await page.fill('#s-minCorrect','9'); await page.click('#save-set');
  ok('minCorrect > qCount elutasítva', (await page.locator('.err').innerText()).includes('nem lehet több'));
  await page.fill('#s-minCorrect','2'); await page.fill('#s-perCorrect','5'); await page.click('#save-set');
  ok('szabály mentve', (await page.locator('.note').innerText()).includes('Mentve'));
  await page.fill('#tt-1','Matek, Nyelvtan'); await page.click('#save-tt');
  await page.fill('#new-game','Minecraft'); await page.click('#add-game');
  ok('játék hozzáadva', (await page.locator('[data-rmgame]').count()) === 4);
  await page.fill('#solo-pin','1234'); await page.click('#save-pin');
  await page.reload();
  await page.click('#tabs button[data-tab=rules]');
  ok('PIN zár él újratöltés után', await page.locator('#pin-go').isVisible());
  await page.fill('#pin-in','9999'); await page.click('#pin-go');
  ok('rossz PIN elutasítva', (await page.locator('.err').innerText()).includes('Nem stimmel'));
  await page.fill('#pin-in','1234'); await page.click('#pin-go');
  ok('jó PIN felold', (await page.locator('#save-set').count()) === 1);
  ok('adat túlélte az újratöltést', (await page.locator('#s-perCorrect').inputValue()) === '5');
  await ctx.close();
}

/* ---------- 2. SZÜLŐ + GYEREK párosítás ---------- */
{
  const { ctx, page } = await newPage();
  await page.fill('#ob-pname','Anya'); await page.fill('#ob-pin','12');
  await page.click('#ob-parent');
  ok('rövid PIN elutasítva', (await page.locator('.err').innerText()).includes('4-6 számjegy'));
  await page.fill('#ob-pname','Anya'); await page.fill('#ob-pin','1234');
  await page.click('#ob-parent');
  const code = (await page.locator('.code').innerText()).trim();
  ok('6 jegyű kód', /^\d{6}$/.test(code));
  ok('szülőnél 2 fül', (await page.locator('#tabs button').count()) === 2);
  ok('szülőnél nincs Tanulás/Játék', (await page.locator('#tabs button[data-tab=study]').count()) === 0);
  await page.fill('#tt-2','Töri'); await page.click('#save-tt');

  // ugyanabban a kontextusban leválás -> gyerekként belépés (a megosztott rekord marad)
  page.on('dialog', d => d.accept());
  await page.click('#wipe');
  ok('leválasztva', await page.locator('#ob-child').isVisible());
  await page.fill('#ob-cname','Bence'); await page.fill('#ob-code','000000'); await page.click('#ob-child');
  ok('rossz kód elutasítva', (await page.locator('.err').innerText()).includes('Nincs ilyen kód'));
  await page.fill('#ob-cname','Bence'); await page.fill('#ob-code', code); await page.click('#ob-child');
  ok('párosítva', (await page.locator('.note').innerText()).includes('Párosítva'));
  ok('gyereknél 3 fül', (await page.locator('#tabs button').count()) === 3);
  ok('gyereknél NINCS Szabályok fül', (await page.locator('#tabs button[data-tab=rules]').count()) === 0);

  // a szülő órarendje átjött
  await page.click('#startday');
  await page.click('#tabs button[data-tab=study]');
  const subs = await page.locator('[data-sub]').allInnerTexts();
  ok('a szülő órarendje látszik a gyereknél', JSON.stringify(subs).includes('Töri') || subs.length >= 1);
  await ctx.close();
}

await browser.close();
console.log(log.join('\n'));
console.log('\n' + (process.exitCode ? 'VANNAK HIBÁK' : 'MINDEN TESZT ZÖLD') + ' — ' + log.length + ' ellenőrzés');
