import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:8099/kredit.html';
const SHOT = process.env.SHOT_DIR || '.';

const TEXT1 = 'A Nap energiája a tengerek és óceánok felszínéről elpárologtatja a vizet. '+
 'A felszálló vízpára a magasban lehűl, és apró cseppekké sűrűsödik, így keletkeznek a felhők. '+
 'Amikor a cseppek elég nagyra nőnek, csapadék formájában hullanak vissza a földre. '+
 'A talajba szivárgó víz a mélyben rétegvizet táplál, a többi patakokban és folyókban jut vissza a tengerbe. '+
 'Ezt a soha véget nem érő utat nevezzük a víz körforgásának. '+
 'A körforgás motorja a napsugárzás, amely naponta hatalmas mennyiségű vizet mozgat meg. '+
 'A párolgás mértéke a hőmérséklettől és a szél erősségétől is függ.';

const TEXT2 = 'Az 1848-as forradalom március 15-én tört ki Pesten a Pilvax kávéházból indulva. '+
 'A tizenkét pont követeléseit Irinyi József fogalmazta meg a sajtószabadság élén. '+
 'Petőfi Sándor a Nemzeti dalt szavalta el a Nemzeti Múzeum lépcsőjén az összegyűlt tömegnek. '+
 'A forradalmárok kiszabadították Táncsics Mihályt a budai börtönéből még aznap este. '+
 'Az uralkodó áprilisban szentesítette a független magyar kormány megalakulását. '+
 'A miniszterelnök Batthyány Lajos lett, a pénzügyeket Kossuth Lajos irányította.';

const log = [];
const ok = (name, cond) => { log.push((cond?'  OK  ':' FAIL ')+name); if(!cond) process.exitCode = 1; };

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
async function newPage(){
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => { log.push(' FAIL page error: '+e.message); process.exitCode = 1; });
  return { ctx, page };
}
async function answerAll(page, right){
  const n = await page.evaluate(() => quiz.qs.length);
  for(let i=0;i<n;i++){
    const j = await page.evaluate(() => quiz.qs[quiz.i].j);
    await page.locator(`[data-opt="${right ? j : (j+1)%4}"]`).click();
    await page.click('#q-next');
  }
}
async function studyRound(page, subject, text, right){
  await page.click('#tabs button[data-tab=study]');
  await page.click('[data-sub="__other"]');
  await page.fill('#sub-custom', subject);
  await page.fill('#note', text);
  await page.dispatchEvent('#note','input');
  await page.click('#gen');
  await page.waitForSelector('.q');
  await answerAll(page, right);
}

/* ---------- 1. A generátor önmagában ---------- */
{
  const { ctx, page } = await newPage();
  await page.goto(URL);
  const g = await page.evaluate(([t]) => {
    const out = generateQuestions(t, 6);
    return {
      topic: out.topic,
      n: out.qs.length,
      allFour: out.qs.every(q => q.v.length === 4),
      distinct: out.qs.every(q => new Set(q.v.map(x=>x.toLowerCase())).size === 4),
      validJ: out.qs.every(q => Number.isInteger(q.j) && q.j >= 0 && q.j < 4),
      hasBlank: out.qs.some(q => q.k.includes('_____')),
      hasSentencePick: out.qs.some(q => q.k.includes('Melyik mondat')),
      fromText: out.qs.filter(q => q.k.includes('_____')).every(q => t.includes(q.v[q.j])),
      spread: out.qs.filter(q => q.k.includes('_____')).map(q => t.indexOf(q.v[q.j]))
    };
  }, [TEXT1]);
  ok('generátor: 6 kérdés', g.n === 6);
  ok('generátor: mindenhol 4 válasz', g.allFour);
  ok('generátor: a válaszok különböznek', g.distinct);
  ok('generátor: érvényes jó-index', g.validJ);
  ok('generátor: van kiegészítős kérdés', g.hasBlank);
  ok('generátor: van mondatválasztós kérdés', g.hasSentencePick);
  ok('generátor: a jó válasz a szövegből jön', g.fromText);
  ok('generátor: a szöveg egészét lefedi', Math.max(...g.spread) > TEXT1.length/2);
  ok('generátor: van témamegnevezés', typeof g.topic === 'string' && g.topic.length > 3);
  const leak = await page.evaluate(([t]) => {
    for(let run=0; run<40; run++){
      const out = generateQuestions(t, 6);
      for(const q of out.qs){
        if(!q.k.includes('_____')) continue;
        const visible = q.k.toLowerCase();
        for(let i=0;i<4;i++){
          if(i === q.j) continue;
          if(visible.includes(q.v[i].toLowerCase())) return q.v[i];
        }
      }
    }
    return null;
  }, [TEXT1]);
  ok('generátor: a zavaró válasz nem látszik a mondatban', leak === null, leak);
  const short = await page.evaluate(() => { try{ generateQuestions('Rövid. Semmi.', 6); return 'nem dobott'; }catch(e){ return e.message; } });
  ok('generátor: kevés szövegre hibát dob', short === 'short');
  await ctx.close();
}

/* ---------- 2. SZÓLÓ teljes kör ---------- */
{
  const { ctx, page } = await newPage();
  await page.goto(URL);
  await page.click('#ob-solo');
  ok('szóló: 4 fül', (await page.locator('#tabs button').count()) === 4);
  await page.fill('#dbase','20'); await page.click('#startday');
  ok('alapkeret 20 perc', (await page.locator('.fuel .num').innerText()).startsWith('20'));
  ok('szegmens csík 20 elem', (await page.locator('.seg i').count()) === 20);
  await page.fill('#t-sub','Töri'); await page.fill('#t-date','2099-01-01'); await page.click('#t-add');
  ok('dolgozat felvéve', (await page.locator('.card').filter({hasText:'Közelgő'}).innerText()).includes('Töri'));

  await page.click('#tabs button[data-tab=study]');
  ok('gomb tiltva szöveg nélkül', await page.locator('#gen').isDisabled());
  await page.click('[data-sub="Töri"]');
  await page.fill('#note', TEXT1.slice(0,120));
  await page.dispatchEvent('#note','input');
  ok('rövid szövegnél tiltva marad', await page.locator('#gen').isDisabled());
  ok('mutatja mennyi hiányzik', (await page.locator('#cpill').innerText()).includes('még kell'));
  await page.fill('#note', TEXT1);
  await page.dispatchEvent('#note','input');
  ok('elég szövegnél aktív', !(await page.locator('#gen').isDisabled()));
  await page.click('#gen');
  await page.waitForSelector('.q');
  ok('a szöveg NEM látszik a kikérdezés alatt', (await page.locator('#note').count()) === 0);
  await page.screenshot({path:SHOT+'/shot-quiz.png'});
  await answerAll(page, true);
  const res = await page.locator('.card.center').innerText();
  ok('6/6 jó válasz → +18 perc', res.includes('+18') && res.includes('6/6'));
  await page.click('#q-today');
  ok('keret 20 → 38', (await page.locator('.fuel .num').innerText()).startsWith('38'));
  ok('a napló mutatja a karakterszámot', (await page.locator('.card').filter({hasText:'Mai napló'}).innerText()).includes('karakter'));

  // ugyanaz a szöveg másodszor nem fizet
  await page.click('#tabs button[data-tab=study]');
  await page.click('[data-sub="Töri"]');
  await page.fill('#note', TEXT1);
  await page.dispatchEvent('#note','input');
  await page.click('#gen');
  ok('ugyanaz a szöveg ma már nem megy', (await page.locator('.err').innerText()).includes('ma már kikérdeztem'));

  // másik szöveg, csupa rossz válasz
  await studyRound(page, 'Töri', TEXT2, false);
  ok('0 jó válasz → 0 perc', (await page.locator('.card.center').innerText()).includes('0/6'));
  await page.click('#q-today');
  ok('keret marad 38', (await page.locator('.fuel .num').innerText()).startsWith('38'));
  ok('a bukott kör is naplózva', (await page.locator('.card').filter({hasText:'Mai napló'}).innerText()).includes('0/6'));

  // Játék
  await page.click('#tabs button[data-tab=play]');
  await page.locator('[data-game="Roblox"]').click();
  ok('fut a kör', (await page.locator('.fuel .lbl').innerText()).toLowerCase().includes('roblox'));
  await page.evaluate(() => { play.startedAt -= 61000; });
  await page.waitForFunction(() => document.getElementById('p-num').textContent === '37', null, {timeout:4000});
  ok('percenként fogy a keret', true);
  await page.click('#p-stop');
  await page.click('#tabs button[data-tab=today]');
  ok('a játék naplózva', (await page.locator('.card').filter({hasText:'Mai napló'}).innerText()).includes('Roblox'));

  // Szabályok
  await page.click('#tabs button[data-tab=rules]');
  ok('szólóban a napló is itt van', (await page.locator('h3').filter({hasText:'Elmúlt 7 nap'}).count()) === 1);
  ok('a naplóban ott a szövegrészlet', (await page.locator('.card').filter({hasText:'ma'}).first().innerText()).includes('A Nap energiája'));
  await page.screenshot({path:SHOT+'/shot-log.png', fullPage:true});
  await page.fill('#s-minCorrect','9'); await page.click('#save-set');
  ok('minCorrect > qCount elutasítva', (await page.locator('.err').innerText()).includes('nem lehet több'));
  await page.fill('#s-minCorrect','2'); await page.fill('#s-perCorrect','5'); await page.click('#save-set');
  await page.fill('#tt-1','Matek, Nyelvtan'); await page.click('#save-tt');
  await page.fill('#new-game','Minecraft'); await page.click('#add-game');
  ok('játék hozzáadva', (await page.locator('[data-rmgame]').count()) === 4);
  await page.fill('#solo-pin','1234'); await page.click('#save-pin');
  await page.reload();
  await page.click('#tabs button[data-tab=rules]');
  ok('PIN zár él újratöltés után', await page.locator('#pin-go').isVisible());
  await page.fill('#pin-in','1234'); await page.click('#pin-go');
  ok('adat túlélte az újratöltést', (await page.locator('#s-perCorrect').inputValue()) === '5');
  await ctx.close();
}

/* ---------- 3. SZÜLŐ + GYEREK ---------- */
{
  const { ctx, page } = await newPage();
  await page.goto(URL);
  await page.fill('#ob-pname','Anya'); await page.fill('#ob-pin','12'); await page.click('#ob-parent');
  ok('rövid PIN elutasítva', (await page.locator('.err').innerText()).includes('4-6 számjegy'));
  await page.fill('#ob-pname','Anya'); await page.fill('#ob-pin','1234'); await page.click('#ob-parent');
  const code = (await page.locator('.code').innerText()).trim();
  ok('6 jegyű kód', /^\d{6}$/.test(code));
  ok('szülőnél 2 fül', (await page.locator('#tabs button').count()) === 2);
  ok('szülőnél nincs Tanulás/Játék', (await page.locator('#tabs button[data-tab=study]').count()) === 0);
  await page.fill('#tt-2','Töri'); await page.click('#save-tt');
  await page.click('#wipe');
  ok('leválasztás megerősítést kér', await page.locator('#wipe-yes').isVisible());
  await page.click('#wipe-no');
  ok('a Mégse visszalép', (await page.locator('#wipe-yes').count()) === 0);
  await page.click('#wipe');
  await page.click('#wipe-yes');
  await page.fill('#ob-cname','Bence'); await page.fill('#ob-code','000000'); await page.click('#ob-child');
  ok('rossz kód elutasítva', (await page.locator('.err').innerText()).includes('Nincs ilyen kód'));
  await page.fill('#ob-cname','Bence'); await page.fill('#ob-code', code); await page.click('#ob-child');
  ok('párosítva', (await page.locator('.note').innerText()).includes('Párosítva'));
  ok('gyereknél 3 fül', (await page.locator('#tabs button').count()) === 3);
  ok('gyereknél NINCS Szabályok fül', (await page.locator('#tabs button[data-tab=rules]').count()) === 0);
  await page.click('#startday');
  await studyRound(page, 'Töri', TEXT1, true);
  await page.click('#q-today');
  ok('a gyerek köre elszámolódott', (await page.locator('.fuel .num').innerText()).startsWith('48'));
  await ctx.close();
}

/* ---------- 4. TELJESEN HÁLÓZAT NÉLKÜL ---------- */
{
  const { ctx, page } = await newPage();
  const blocked = [];
  await page.route('**/*', route => {
    const u = route.request().url();
    if(u.startsWith(URL.slice(0, URL.lastIndexOf('/')))) return route.continue();
    blocked.push(u); return route.abort();
  });
  await page.goto(URL);
  await page.click('#ob-solo');
  await page.click('#startday');
  await studyRound(page, 'Biosz', TEXT1, true);
  const res = await page.locator('.card.center').innerText();
  ok('hálózat nélkül is végigmegy a kör', res.includes('6/6') && res.includes('+18'));
  const hosts = Array.from(new Set(blocked.map(u => new global.URL(u).host)));
  ok('semmilyen API-hívás nem indult', !blocked.some(u => u.includes('anthropic')));
  ok('a blokkolt kérések csak a betűtípusok', hosts.every(h => h === 'fonts.googleapis.com' || h === 'fonts.gstatic.com'), hosts);
  log.push('        (külső kérés összesen: '+hosts.join(', ')+')');
  await page.click('#q-today');
  ok('hálózat nélkül is jóváíródik', (await page.locator('.fuel .num').innerText()).startsWith('48'));
  await ctx.close();
}

await browser.close();
console.log(log.join('\n'));
console.log('\n' + (process.exitCode ? 'VANNAK HIBÁK' : 'MINDEN TESZT ZÖLD') + ' — ' + log.length + ' ellenőrzés');
