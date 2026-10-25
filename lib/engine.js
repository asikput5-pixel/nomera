// Серверная игровая логика: клиент присылает только действие, баланс и инвентарь считает сервер.
export class UErr extends Error {}
const need = (c, m) => { if (!c) throw new UErr(m); };
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const D = () => rnd(10);
const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ') + ' ₽';

export const RARN = ['Обычный', 'Редкий', 'Эпик', 'Легенда', 'Мифик', 'Секретный', 'Абсолютный', 'Президентский'];
const RAR = [300, 3000, 30000, 5e5, 5e6, 5e7, 2.5e9, 7.5e9];
const CW = [1, 4, 15, 40, 100, 175, 300, 500];
const BETS = [{ p: 1000, m: 1, pm: 1 }, { p: 5000, m: 3, pm: 2 }, { p: 27777, m: 12, pm: 2.7 }];
const REG = Object.fromEntries([['777', 2.3], ['77', 1.6], ['177', 1.6], ['199', 1.6], ['88', 1.2], ['97', 1.5], ['99', 1.5], ['197', 1.5], ['799', 1.5], ['977', 1.2], ['78', 1.4], ['98', 1.2], ['178', 1.4], ['198', 1.2], ['11', 1.3], ['22', 1.3], ['33', 1.3], ['44', 1.3], ['55', 1.3], ['66', 1.3], ['01', 1.2], ['02', 1.2], ['03', 1.2], ['50', 1.2], ['52', 1.2], ['116', 1.4], ['123', 1.4], ['161', 1.2]]);
const TYPES = ['civil', 'taxi', 'police', 'mil', 'dip', 'moto'];
for (const k of ['04','05','06','07','08','09','10','12','13','14','15','16','17','18','19','20','21','23','24','25','26','27','28','29','30','31','32','34','35','36','37','38','39','40']) REG[k] = 1;
const CTRY = ['RU', 'BY', 'KZ', 'US', 'UA', 'DE', 'AM', 'IT', 'CN', 'AE'];
const L = 'АВЕКМНОРСТУХ';
const LAT = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X' };
const lat = (s) => s.replace(/[А-Я]/g, (m) => LAT[m] || m);
const PM = [1, 1.2, 1.6, 2.5, 5, 12, 40, 100];
const CARS = [[0, 'ВАЗ-2107', '🚗', 800], [0, 'Лада Гранта', '🚙', 1200], [0, 'Kia Rio', '🚕', 2000], [1, 'BMW M5', '🚘', 9000], [1, 'Mercedes E63', '🚖', 15000], [2, 'Porsche 911', '🏎️', 60000], [2, 'Lamborghini Urus', '🛻', 90000], [3, 'Bugatti Chiron', '🏎️', 400000], [3, 'Rolls-Royce Phantom', '🚘', 500000], [1, 'Audi RS6', '🚙', 11000], [1, 'Tesla Model S', '🚘', 13000], [2, 'Ferrari 488', '🏎️', 110000], [2, 'Mercedes G63', '🛻', 130000], [2, 'McLaren 720S', '🏎️', 150000], [3, 'Lamborghini Aventador', '🏎️', 650000], [3, 'Bentley Bentayga', '🚘', 700000], [3, 'Koenigsegg Jesko', '🏎️', 900000]];
const CONT = [[5e4, [70, 25, 4.5, .5]], [3e5, [30, 45, 20, 5]], [2e6, [0, 30, 50, 20]]];
const QT = [[5, 50000], [1, 100000], [1, 30000]];
const QX = [50, 100, 30], QF = [1, 2, 1];
const ACH = [[(S) => (S.spins || 0) >= 1, 1e4], [(S) => (S.spins || 0) >= 100, 2e5], [(S) => S.inv.some((x) => x.r >= 2), 1e5], [(S) => S.inv.some((x) => x.r >= 3), 1e6], [(S) => S.inv.some((x) => x.r >= 4), 5e6], [(S) => S.lvl >= 160, 3e5]];

export const defaultState = (name) => ({ bal: 5e6, xp: 0, lvl: 1, streak: 1, type: 'civil', country: 'RU', region: null, bet: 0, inv: [], hist: [], daily: '', free: 0, luck: 0, show: [], spins: 0, bp: 0, gc: 0, ach: [], cnt: [], cars: [], as: -1, nick: String(name || '').slice(0, 14) });

function digits3(r) {
  if (r >= 7) return '001'; if (r === 6) return '777'; if (r === 5) return '001';
  if (r >= 3) { const d = D(); return '' + d + d + d; }
  if (r === 2) { const a = 1 + rnd(9); return Math.random() < .5 ? a + '00' : '' + a + 0 + a; }
  if (r === 1) { const a = rnd(8); return Math.random() < .5 ? '' + a + (a + 1) + (a + 2) : '' + a + D() + a; }
  let s; do { s = '' + D() + D() + D(); } while (s[0] === s[1] || s[1] === s[2] || s[0] === s[2]); return s;
}
const letters = (r, n) => (r >= 4 ? pick(L).repeat(n) : Array.from({ length: n }, () => pick(L)).join(''));
const LL = 'ABCEHKMOPTXY';
const lt = (r, n) => (r >= 4 ? pick(LL).repeat(n) : Array.from({ length: n }, () => pick(LL)).join(''));
const d4 = (r) => (r >= 5 ? '0001' : r >= 3 ? '7777' : r === 2 ? '0911' : '' + D() + D() + D() + D());
const d3 = (r) => (r >= 3 ? '777' : '' + D() + D() + D());
const NAT = {
  UA: (r) => ({ num: lt(r, 2) + ' ' + d4(r) + ' ' + lt(r, 2), reg: '', cls: 'ua' }),
  DE: (r) => ({ num: lt(r, 1) + ' ' + lt(r, 2) + ' ' + d4(r), reg: '', cls: 'de' }),
  AM: (r) => ({ num: '' + D() + D() + ' ' + lt(r, 2) + ' ' + d3(r), reg: '', cls: 'am' }),
  IT: (r) => ({ num: lt(r, 2) + ' ' + d3(r) + ' ' + lt(r, 2), reg: '', cls: 'it' }),
  CN: (r) => ({ num: pick(['京', '沪', '粤', '浙', '苏']) + lt(r, 1) + '·' + (r >= 3 ? '88888' : '' + D() + D() + D() + D() + D()), reg: '', cls: 'cn' }),
  AE: (r) => ({ num: lt(r, 1) + ' ' + (r >= 3 ? '77777' : '' + D() + D() + D() + D() + D()), reg: '', cls: 'ae' }),
};
export function genPlate(S, r, reg0) {
  const reg = reg0 && S.country === 'RU' ? reg0 : S.region || pick(['77', '78', '50', '52', '116', '161', '23', '63', '02', '199', '177', '197']);
  if (r >= 7) return { num: 'А 001 АА', reg: S.country === 'RU' ? reg : '', cls: 'pres' };
  if (NAT[S.country]) return NAT[S.country](r >= 7 ? 6 : r);
  if (S.country === 'BY') return { num: (r >= 3 ? '7777' : r === 2 ? '0911' : '' + D() + D() + D() + D()) + ' ' + letters(r, 2) + '-' + (1 + rnd(7)), reg: '', cls: 'by' };
  if (S.country === 'KZ') return { num: (r >= 3 ? '777' : digits3(r)) + ' ' + lat(letters(r, 3)) + ' ' + ('0' + (1 + rnd(17))).slice(-2), reg: '', cls: 'kz' };
  if (S.country === 'US') return { num: lat(letters(r, 3)) + '-' + (r >= 3 ? '7777' : '' + D() + D() + D() + D()), reg: '', cls: 'us' };
  const l = letters(r, 3), d = digits3(r), t = S.type;
  if (t === 'taxi') return { num: l.slice(0, 2) + d, reg, cls: 'taxi' };
  if (t === 'police') return { num: l[0] + d + D(), reg, cls: 'police' };
  if (t === 'mil') return { num: (r >= 2 ? '0911' : d + D()) + ' ' + l.slice(0, 2), reg, cls: 'mil' };
  if (t === 'dip') return { num: d + ' CD', reg, cls: 'dip' };
  if (t === 'moto') return { num: d.slice(0, 2) + ' ' + d.slice(1) + ' ' + l.slice(0, 2), reg, cls: 'moto' };
  return { num: l[0] + ' ' + d + ' ' + l.slice(1), reg, cls: 'civil' };
}
const val = (S, r) => Math.round(RAR[r] * (r >= 5 ? 1 : BETS[S.bet].m * 0.8 * (S.region ? 1.2 : 1)));
const mkItem = (S, p, r) => ({ num: p.num + (p.reg ? ' ' + p.reg : ''), r, v: r >= 7 ? Math.round(5e9 + Math.random() * 5e9) : val(S, r), cls: p.cls });
function roll(S, now, lm = 1, pk = 1) {
  const B = 2.4, b = BETS[S.bet], r = Math.random(), lk = (now < (S.luck || 0) ? 2 : 1) * lm;
  const k = b.pm * lk * B * pk, kl = b.pm * (S.bet ? 1.6 : 1) * lk * B;
  if (r < k / 4e6) return 7; if (r < k / 1e6) return 6; if (r < k / 1.5e5) return 5; if (r < k / 2.5e4) return 4;
  if (r < k / 2.5e4 + kl / 3e3) return 3;
  if (r < 0.005 * (S.bet + 1) * B) return 2; if (r < (0.05 * (S.bet + 1) + 0.01) * B) return Math.random() < .18 ? 2 : 1; return 0;
}
const qd = (S, c) => { if (!S.q || S.q.d !== c.day) S.q = { d: c.day, c: [0, 0, 0], k: [0, 0, 0] }; };
const qa = (S, c, i) => { qd(S, c); S.q.c[i]++; };
const BTQ = [[20, 40], [3, 40], [5, 30], [1, 50], [100, 30], [1, 30]];
export const btd = (S, c) => { if (!S.bt || S.bt.d !== c.day) S.bt = { d: c.day, c: [], k: [] }; };
export const bt = (S, c, i, n = 1) => { btd(S, c); S.bt.c[i] = (S.bt.c[i] || 0) + n; };
const nx = (l) => 150 + l * 60;
const addXp = (S, n) => { S.xp += n; while (S.xp >= nx(S.lvl)) { S.xp -= nx(S.lvl); S.lvl++; S.bal += 1000 * S.lvl; } };
const item = (S, p) => { const x = S.inv[p.i]; need(x && x.num === p.num, 'Номер не найден'); return x; };
const rate = (S) => (S.cars || []).reduce((a, c) => a + c.inc * (c.pl ? PM[c.pl.r] || 1 : 1), 0);
const pend = (S, now) => (S.cacc || 0) + rate(S) * Math.min(12, (now - (S.cl || now)) / 36e5);
const settle = (S, now) => { S.cacc = pend(S, now); S.cl = now; };
const take = (S, n) => { need(S.bal >= n, 'Не хватает денег'); S.bal -= n; };

function prefs(S, p) {
  if (TYPES.includes(p.type)) S.type = p.type;
  if (CTRY.includes(p.country)) S.country = p.country;
  if ('bet' in p && [0, 1, 2].includes(Number(p.bet))) S.bet = Number(p.bet);
  if ('region' in p) S.region = p.region && REG[p.region] && S.country === 'RU' ? p.region : null;
  if (S.country !== 'RU') S.region = null;
}
async function spin(S, p, c) {
  prefs(S, p);
  const free = p.free === true;
  if (free) need(S.free > 0, 'Нет бесплатных круток');
  need(free || S.bet === 0 || (S.bet === 1 && S.lvl >= 5) || (S.bet === 2 && S.lvl >= 10), 'Премиум крутка доступна с 5 уровня, элитная с 10');
  const sb = S.bet, sr = S.region;
  if (free) { S.bet = 0; S.region = null; }
  const cost = free ? 0 : Math.round(BETS[S.bet].p * (S.region ? REG[S.region] : 1));
  need(S.bal >= cost, 'Не хватает денег');
  if (free) S.free--; S.bal -= cost; S.spins = (S.spins || 0) + 1; S.bpx = (S.bpx || 0) + 2; qa(S, c, 0); await c.goalAdd();
  let rar = roll(S, c.now, c.lm, c.dc && S.country === c.dc ? c.dm || 1 : 1), taken = null, reg0 = null, left = null;
  if (rar >= 5) { reg0 = S.country === 'RU' ? (S.region || pick(REGKEYS)) : S.country; const k = await c.claim(rar, reg0); if (!k.ok) { taken = { r: rar, n: reg0 }; rar = 4; reg0 = null; } else left = k.left; }
  const pl = genPlate(S, rar, reg0), it = mkItem(S, pl, rar);
  S.hist.unshift({ num: it.num, r: rar }); S.hist = S.hist.slice(0, 12);
  S.cnt = S.cnt || []; S.cnt[rar] = (S.cnt[rar] || 0) + 1;
  const price = Math.round(it.v * pmult(rar, c.now) * 0.85 * (c.clb || 1));
  if (!S.bestP || S.bestSeason !== c.season || it.v > S.bestP.v) { S.bestP = { num: it.num, r: rar, v: it.v }; S.bestSeason = c.season; }
  if (S.clan) { if (!S.war || S.war.w !== c.week) S.war = { w: c.week, c: S.clan.n, p: 0 }; S.war.c = S.clan.n; const wm = c.wm || 1; S.war.p += CW[rar] * wm; await c.warAdd(S.clan.n, CW[rar] * wm); }
  let sold = false;
  if (S.as >= 0 && rar <= S.as) { S.bal += price; sold = true; } else S.inv.unshift(it);
  addXp(S, 4 + rar * 12);
  if (rar >= 1) qa(S, c, 1);
  bt(S, c, 0); if (rar >= 1) bt(S, c, 1);
  const fid = rar >= 5 ? await c.announce(rar, it.num, left) : 0;
  if (free) { S.bet = sb; S.region = sr; }
  return { r: { p: pl, item: it, rar, sold, taken, val: price, fid } };
}
const gift = (S, c, x) => ({ ...x });
export const ACT = {
  spin,
  prefs: (S, p) => { prefs(S, p); if ([-1, 0, 1, 2].includes(p.as)) S.as = p.as; if (typeof p.nick === 'string') S.nick = p.nick.slice(0, 14); if (p.seen) S.seen = 1; },
  sell: (S, p, c) => { const x = item(S, p), pr = Math.round(x.v * pmult(x.r, c.now) * 0.85 * (c.clb || 1)); S.inv.splice(p.i, 1); S.bal += pr; qa(S, c, 2); bt(S, c, 2); return { msg: 'Продано за ' + fmt(pr) }; },
  sellc: (S, p, c) => { let g = 0, nSold = 0; S.inv = S.inv.filter((x) => (x.r === 0 ? (g += Math.round(x.v * pmult(0, c.now) * 0.85 * (c.clb || 1)), nSold++, 0) : 1)); bt(S, c, 2, nSold); return { msg: 'Продано на ' + fmt(g) }; },
  daily: (S, p, c) => { need(S.daily !== c.day, 'Бонус уже получен. Загляни завтра'); S.daily = c.day; S.streak++; const b = Math.round(50000 * S.streak * (c.clb || 1)); S.bpx = (S.bpx || 0) + 10; S.bal += b; return { msg: 'Бонус дня: ' + fmt(b) }; },
  roul: (S, p, c) => { need(c.now >= (S.roul || 0) + 108e5, 'Рулетка ещё не готова'); S.roul = c.now; let r = Math.random() * 100, idx = 0; for (let i = 0; i < ROUL.length; i++) { r -= ROUL[i][0]; if (r < 0) { idx = i; break; } } const [, k, v] = ROUL[idx]; if (k === 'bal') S.bal += v; else if (k === 'free') S.free = (S.free || 0) + v; else S.luck = Math.max(c.now, S.luck || 0) + v; return { r: { idx }, msg: 'Выпало: ' + ROUL_L[idx] }; },
  polish: (S, p, c) => { const n = Math.floor(Number(p.n)); need(n >= 1 && n <= 40, 'Неверное число'); S.pol = S.pol || { n: 0, t: 0, l: 0 }; if (S.pol.n >= 300) { need(c.now >= S.pol.l + 36e5, 'Полировка отдыхает: подожди час'); S.pol = { n: 0, t: 0, l: 0 }; } need(c.now - (S.pol.t || 0) >= n * 45, 'Слишком быстро'); const k = Math.min(n, 300 - S.pol.n); S.pol.n += k; S.pol.t = c.now; if (S.pol.n >= 300) S.pol.l = c.now; S.bal += k * 3000; bt(S, c, 4, k); return { msg: '+' + fmt(k * 3000) }; },
  buy: (S, p, c) => { const pr = { luck: 6e5, free: 25e4, xp: 4e5 }[p.k]; need(pr, 'Нет такого товара'); take(S, pr); if (p.k === 'luck') S.luck = Math.max(c.now, S.luck || 0) + 18e5; if (p.k === 'free') S.free = (S.free || 0) + 5; if (p.k === 'xp') addXp(S, 300); return { msg: 'Куплено' }; },
  bpc: (S) => { const l = Math.min(50, Math.floor(S.lvl / 3)), n = l - (S.bp || 0); need(n > 0, 'Нет новых наград'); S.bp = l; S.bal += n * 2e4; return { msg: 'Получено ' + fmt(n * 2e4) }; },
  evc: (S, p, c) => { need(S.ev !== c.day, 'Уже получено сегодня'); S.ev = c.day; S.free = (S.free || 0) + 3; return { msg: '+3 бесплатные крутки' }; },
  gc: (S) => { const m = Math.floor((S.spins || 0) / 100), n = m - (S.gc || 0); need(n > 0, 'Пока нет наград'); S.gc = m; S.bal += n * 5e5; return { msg: 'Получено ' + fmt(n * 5e5) }; },
  qc: (S, p, c) => { qd(S, c); const i = Number(p.i), q = QT[i]; need(q && !S.q.k[i], 'Уже получено'); need(S.q.c[i] >= q[0], 'Задание не выполнено'); S.q.k[i] = 1; S.bal += q[1]; S.bpx = (S.bpx || 0) + 25; S.free = (S.free || 0) + QF[i];
    let xp = QX[i], m = '+' + fmt(q[1]) + ' · +' + QF[i] + ' крутка';
    if (S.q.k.every(Boolean) && !S.q.b) { S.q.b = 1; S.bal += 250000; xp += 100; m += ' · бонус за все задания +250 000 ₽'; }
    if (S.clan) { S.clan.xp = (S.clan.xp || 0) + xp; m += ' · +' + xp + ' очков клана'; } else m += ' (вступи в клан, чтобы получать очки)';
    return { msg: m }; },
  ac: (S, p) => { const i = Number(p.i), a = ACH[i]; S.ach = S.ach || []; need(a && a[0](S) && !S.ach.includes(i), 'Недоступно'); S.ach.push(i); S.bal += a[1]; return { msg: '+' + fmt(a[1]) }; },
  cc: (S) => { need(!S.cc && TYPES.every((t) => S.inv.some((x) => x.cls === t)), 'Коллекция не собрана'); S.cc = 1; S.bal += 1e6; return { msg: '+1 000 000 ₽' }; },
  dd: (S, p) => { const b = Number(p.b); need([1e4, 1e5, 1e6].includes(b), 'Неверная ставка'); need(S.inv.length, 'Нужен хотя бы один номер'); take(S, b); const w = Math.random() < .48; if (w) S.bal += 2 * b; return { msg: w ? 'Победа! +' + fmt(b) : 'Поражение' }; },
  auc_new: (S) => { const r = 2 + rnd(2), it = mkItem(S, genPlate(S, r), r); S.au = { ...it, v: RAR[r], pr: Math.round(RAR[r] * .9) }; },
  ab: (S) => { const a = S.au; need(a, 'Лот не найден'); need(S.bal >= a.pr, 'Не хватает денег'); S.au = null; if (Math.random() < .5) { S.bal -= a.pr; S.inv.unshift({ num: a.num, r: a.r, v: a.v, cls: a.cls }); return { msg: 'Выиграл торги!' }; } S.bal -= Math.round(a.pr * .1); return { msg: 'Перебили ставку. Комиссия 10%' }; },
  upg: (S, p) => { const m = Number(p.m); need([2, 5, 10].includes(m), 'Неверный множитель'); const x = item(S, p); need(x.r < 5, 'Секретные и абсолютные номера не улучшаются'); const chance = 0.95 / m, roll = Math.random(), win = roll < chance; if (win) { x.v = Math.min(1e10, Math.round(x.v * m)); x.up = (x.up || 1) * m; } else S.inv.splice(p.i, 1); return { r: { win, roll, chance, m } }; },
  sw: (S, p) => { const r = Number(p.r); need(r >= 0 && r <= 3, 'Нельзя'); need(S.inv.filter((x) => x.r === r).length >= 5, 'Нужно 5 номеров'); let n = 0; S.inv = S.inv.filter((x) => (x.r === r && n < 5 ? (n++, 0) : 1)); S.inv.unshift(mkItem(S, genPlate(S, r + 1), r + 1)); return { msg: 'Получен: ' + RARN[r + 1] }; },
  ub: (S, p) => { const n = String(p.un || '').trim().toUpperCase(); need(/^[A-ZА-Я0-9 \-]{1,12}$/.test(n), 'Только буквы, цифры, пробел и дефис'); take(S, 5e5); S.inv.unshift({ num: n, r: 4, v: 4e5, cls: 'civil' }); return { msg: 'Номер создан' }; },
  cont: (S, p, c) => { const k = CONT[Number(p.i)]; need(k, 'Нет такого контейнера'); need((S.cars || []).length < 10, 'Гараж полон: максимум 10 машин'); take(S, k[0]); const r = Math.random() * 100; let t = 0, rr = 0; for (let j = 0; j < 4; j++) { t += k[1][j]; if (r < t) { rr = j; break; } } const car = pick(CARS.filter((x) => x[0] === rr)); settle(S, c.now); bt(S, c, 5); S.cars = S.cars || []; S.cars.unshift({ n: car[1], e: car[2], r: rr, inc: car[3], pl: null }); return { msg: car[2] + ' ' + car[1] + ' · ' + RARN[rr] }; },
  ccol: (S, p, c) => { const v = Math.floor(pend(S, c.now)); need(v >= 1, 'Пока нечего забирать'); S.bal += v; S.cacc = 0; S.cl = c.now; return { msg: '+' + fmt(v) }; },
  plate_on: (S, p, c) => { const car = (S.cars || [])[Number(p.c)]; need(car && !car.pl, 'Машина занята'); const x = item(S, p); settle(S, c.now); car.pl = x; S.inv.splice(p.i, 1); return { msg: 'Номер на ' + car.n }; },
  plate_off: (S, p, c) => { const car = (S.cars || [])[Number(p.c)]; need(car && car.pl, 'Номера нет'); settle(S, c.now); S.inv.unshift(car.pl); car.pl = null; },
  car_sell: (S, p, c) => { const i = Number(p.c), car = (S.cars || [])[i]; need(car, 'Машина не найдена'); settle(S, c.now); if (car.pl) S.inv.unshift(car.pl); S.bal += car.inc * 4; S.cars.splice(i, 1); return { msg: 'Продано за ' + fmt(car.inc * 4) }; },
  pin: (S, p) => { const x = item(S, p); S.show = S.show || []; need(S.show.length < 3, 'Максимум 3'); S.show.push({ num: x.num, r: x.r }); },
  unp: (S, p) => { (S.show || []).splice(Number(p.i), 1); },
  clan_join: async (S, p, c) => { need(S.lvl >= 10, 'Кланы открываются с 10 уровня'); const n = String(p.n || '').trim().slice(0, 16); need(n, 'Введи название'); const ex = await c.clanName(n); if (!ex) take(S, 1e5); S.clan = { n: ex || n, t: 0, d: 0, xp: 0 }; return { msg: ex ? 'Ты в клане ' + ex : 'Клан создан' }; },
  clan_donate: (S) => { need(S.clan, 'Ты не в клане'); take(S, 1e4); S.clan.d = (S.clan.d || 0) + 1e4; S.clan.t = (S.clan.t || 0) + 1e4; S.clan.xp = (S.clan.xp || 0) + 10; },
  clan_leave: (S) => { S.clan = null; },
};
export function summary(S) {
  const hu = [...S.inv.map((x) => x.r), ...(S.cars || []).map((c) => (c.pl ? c.pl.r : 0))].filter((r) => r >= 5);
  return { cap: Math.round(S.bal + S.inv.reduce((a, x) => a + x.v, 0)), ch: Math.round(rate(S)), sp: S.spins || 0, lvl: S.lvl, cnt: S.cnt || [], cl: S.clan ? S.clan.n : '', cd: S.clan ? S.clan.xp || 0 : 0, hu };
}
const ROUL = [[30, 'bal', 5e4], [22, 'free', 2], [18, 'bal', 1e5], [12, 'free', 5], [9, 'bal', 25e4], [6, 'luck', 36e5], [2.5, 'bal', 1e6], [.5, 'bal', 5e6]];
const ROUL_L = ['+50 000 ₽', '+2 крутки', '+100 000 ₽', '+5 круток', '+250 000 ₽', 'Удача ×2 на 1 час', '+1 000 000 ₽', '+5 000 000 ₽'];
const PRS = [[300, 60], [1000, 180], [2500, 420], [5000, 900], [9000, 1800], [15000, 3000], [24000, 4800], [36000, 7200], [52000, 10000], [75000, 15000]];
const PRS_R = [5e5, 15e5, 4e6, 1e7, 25e6, 6e7, 15e7, 4e8, 1e9, 3e9];
const FR = [1e7, 3e7, 8e7, 2e8, 5e8, 12e8];
const GOAL_R = [5e5, 1e6, 25e5, 5e6];
const bpr = (l, t) => (t ? { bal: 300000 * l, luck: l % 5 === 0 ? 36e5 : 0 } : l % 2 ? { bal: 100000 * l } : { free: 3 });
Object.assign(ACT, {
  bt_claim: (S, p, c) => { const i = Number(p.i); btd(S, c); need(BTQ[i], 'Нет задания'); need(!S.bt.k[i], 'Уже получено'); need((S.bt.c[i] || 0) >= BTQ[i][0], 'Задание не выполнено'); S.bt.k[i] = 1; S.bpx = (S.bpx || 0) + BTQ[i][1]; return { msg: '+' + BTQ[i][1] + ' опыта батл пасса' }; },
  prestige: (S, p, c) => { const n = S.pr || 0; need(n < 10, 'Максимальный престиж'); need((S.spins || 0) >= PRS[n][0], 'Нужно круток: ' + PRS[n][0]); need((c.play || 0) >= PRS[n][1] * 6e4, 'Нужно больше времени в игре'); S.pr = n + 1; S.bal += PRS_R[n]; return { msg: 'Престиж ' + S.pr + '! +' + fmt(PRS_R[n]) }; },
  frame_buy: (S, p) => { const i = Number(p.i); need(FR[i], 'Нет такой рамки'); S.frames = S.frames || []; need(!S.frames.includes(i), 'Уже куплено'); take(S, FR[i]); S.frames.push(i); S.frame = i; return { msg: 'Рамка куплена и надета' }; },
  frame_set: (S, p) => { const i = Number(p.i); need(i === -1 || (S.frames || []).includes(i), 'Нет такой рамки'); S.frame = i; },
  bp_buy: (S) => { need(!S.bpp, 'Уже куплен'); take(S, 2e7); S.bpp = 1; return { msg: 'Премиум батл пасс активирован' }; },
  bp_claim: (S, p, c) => { const l = Number(p.l), t = Number(p.t) ? 1 : 0; need(l >= 1 && l <= 30 && Math.floor((S.bpx || 0) / 100) >= l, 'Уровень не достигнут'); need(!t || S.bpp, 'Нужен премиум'); const key = t ? 'bq' : 'bf'; S[key] = S[key] || []; need(!S[key].includes(l), 'Уже получено'); S[key].push(l); const r = bpr(l, t); if (r.bal) S.bal += r.bal; if (r.free) S.free = (S.free || 0) + r.free; if (r.luck) S.luck = Math.max(c.now, S.luck || 0) + r.luck; return { msg: 'Награда получена' }; },
  goal_claim: async (S, p, c) => { const i = Number(p.i); need(GOAL_R[i], 'Нет награды'); const tot = await c.goalTotal(), tg = await c.goalTarget(); need(tot >= tg * [.25, .5, .75, 1][i], 'Цель ещё не достигнута'); if (!S.goal || S.goal.w !== c.week) S.goal = { w: c.week, c: [0, 0, 0, 0] }; need(!S.goal.c[i], 'Уже получено'); S.goal.c[i] = 1; S.bal += GOAL_R[i]; return { msg: '+' + fmt(GOAL_R[i]) }; },
});
export const REGKEYS = Object.keys(REG);
export function givePlate(S, r, reg) { S.inv.unshift(mkItem(S, genPlate(S, r, reg), r)); }
export const norm = (S) => { for (const k of ['inv', 'hist', 'cnt', 'cars', 'show', 'ach', 'badges', 'frames', 'bf', 'bq']) if (!Array.isArray(S[k])) S[k] = []; S.bal = Number(S.bal) || 0; return S; };
export const pmult = (r, now) => { const h = Math.sin((Math.floor(now / 36e5) + 1) * 12.9898 + (r + 1) * 78.233) * 43758.5453, f = h - Math.floor(h); return r >= 5 ? 0.9 + f * 0.2 : 0.7 + f * 0.7; };
export const pmArr = (now) => RAR.map((_, r) => Math.round(pmult(r, now) * 100) / 100);
export function weekId(ts) { const d = new Date(ts + 3 * 36e5); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); d.setUTCHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); }
export function grantWar(S, hist, now) {
  if (!S.war || !S.war.p) return null;
  const h = (hist || []).find((x) => x.week === S.war.w);
  if (!h || S.warDone === h.week) return null;
  const pl = (h.top || [{ clan: h.clan }]).findIndex((x) => x.clan === S.war.c);
  if (pl < 0 || pl > 2) return null;
  const R = [[1e8, 24], [75e6, 10], [45e6, 5]][pl];
  S.warDone = h.week; S.bal += R[0]; S.luck = Math.max(now, S.luck || 0) + R[1] * 36e5;
  if (pl === 0) S.badges = [...(S.badges || []), { k: 'war', w: h.week, c: h.clan }];
  return 'Клановая война: твой клан занял ' + (pl + 1) + ' место! +' + fmt(R[0]) + ', удача ×2 на ' + R[1] + ' ч' + (pl === 0 ? ' и значок победителя' : '');
}
export function seasonReset(S, epoch, name) {
  const keep = { badges: S.badges || [], pr: S.pr || 0, medalSeen: S.medalSeen || [], nick: S.nick, seen: S.seen, snd: S.snd };
  const clan = S.clan ? { n: S.clan.n, t: 0, d: 0, xp: 0 } : null;
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, defaultState(keep.nick), keep, { clan, epoch, nsNote: { e: epoch, name } });
}
export function auctionPlate() { const S0 = defaultState(''); const r = pick(REGKEYS); const pl = genPlate(S0, 4, r); return { num: pl.num + (pl.reg ? ' ' + pl.reg : ''), r: 4, cls: pl.cls }; }
