// Серверная игровая логика: клиент присылает только действие, баланс и инвентарь считает сервер.
export class UErr extends Error {}
const need = (c, m) => { if (!c) throw new UErr(m); };
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const D = () => rnd(10);
const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ') + ' ₽';

export const RARN = ['Обычный', 'Редкий', 'Эпик', 'Легенда', 'Мифик', 'Секретный', 'Абсолютный'];
const RAR = [300, 3000, 30000, 5e5, 5e6, 5e7, 2.5e9];
const BETS = [{ p: 1000, m: 1, pm: 1 }, { p: 5000, m: 3, pm: 2 }, { p: 27777, m: 12, pm: 2.7 }];
const REG = Object.fromEntries([['777', 2.3], ['77', 1.6], ['177', 1.6], ['199', 1.6], ['88', 1.2], ['97', 1.5], ['99', 1.5], ['197', 1.5], ['799', 1.5], ['977', 1.2], ['78', 1.4], ['98', 1.2], ['178', 1.4], ['198', 1.2], ['11', 1.3], ['22', 1.3], ['33', 1.3], ['44', 1.3], ['55', 1.3], ['66', 1.3], ['01', 1.2], ['02', 1.2], ['03', 1.2], ['50', 1.2], ['52', 1.2], ['116', 1.4], ['123', 1.4], ['161', 1.2]]);
const TYPES = ['civil', 'taxi', 'police', 'mil', 'dip', 'moto'];
const CTRY = ['RU', 'BY', 'KZ', 'US'];
const L = 'АВЕКМНОРСТУХ';
const LAT = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X' };
const lat = (s) => s.replace(/[А-Я]/g, (m) => LAT[m] || m);
const PM = [1, 1.2, 1.6, 2.5, 5, 12, 40];
const CARS = [[0, 'ВАЗ-2107', '🚗', 800], [0, 'Лада Гранта', '🚙', 1200], [0, 'Kia Rio', '🚕', 2000], [1, 'BMW M5', '🚘', 9000], [1, 'Mercedes E63', '🚖', 15000], [2, 'Porsche 911', '🏎️', 60000], [2, 'Lamborghini Urus', '🛻', 90000], [3, 'Bugatti Chiron', '🏎️', 400000], [3, 'Rolls-Royce Phantom', '🚘', 500000]];
const CONT = [[5e4, [70, 25, 4.5, .5]], [3e5, [30, 45, 20, 5]], [2e6, [0, 30, 50, 20]]];
const QT = [[5, 50000], [1, 100000], [1, 30000]];
const QX = [50, 100, 30], QF = [1, 2, 1];
const ACH = [[(S) => (S.spins || 0) >= 1, 1e4], [(S) => (S.spins || 0) >= 100, 2e5], [(S) => S.inv.some((x) => x.r >= 2), 1e5], [(S) => S.inv.some((x) => x.r >= 3), 1e6], [(S) => S.inv.some((x) => x.r >= 4), 5e6], [(S) => S.lvl >= 160, 3e5]];

export const defaultState = (name) => ({ bal: 5e6, xp: 0, lvl: 1, streak: 1, type: 'civil', country: 'RU', region: null, bet: 0, inv: [], hist: [], daily: '', free: 0, luck: 0, show: [], spins: 0, bp: 0, gc: 0, ach: [], cnt: [], cars: [], as: -1, nick: String(name || '').slice(0, 14) });

function digits3(r) {
  if (r >= 6) return '777'; if (r === 5) return '001';
  if (r >= 3) { const d = D(); return '' + d + d + d; }
  if (r === 2) { const a = 1 + rnd(9); return Math.random() < .5 ? a + '00' : '' + a + 0 + a; }
  if (r === 1) { const a = rnd(8); return Math.random() < .5 ? '' + a + (a + 1) + (a + 2) : '' + a + D() + a; }
  let s; do { s = '' + D() + D() + D(); } while (s[0] === s[1] || s[1] === s[2] || s[0] === s[2]); return s;
}
const letters = (r, n) => (r >= 4 ? pick(L).repeat(n) : Array.from({ length: n }, () => pick(L)).join(''));
export function genPlate(S, r, reg0) {
  const reg = reg0 && S.country === 'RU' ? reg0 : S.region || pick(['77', '78', '50', '52', '116', '161', '23', '63', '02', '199', '177', '197']);
  if (S.country === 'BY') return { num: (r >= 3 ? '7777' : r === 2 ? '0911' : '' + D() + D() + D() + D()) + ' ' + letters(r, 2) + '-' + (1 + rnd(7)), reg: '', cls: 'gen' };
  if (S.country === 'KZ') return { num: (r >= 3 ? '777' : digits3(r)) + ' ' + lat(letters(r, 3)) + ' ' + ('0' + (1 + rnd(17))).slice(-2), reg: '', cls: 'gen' };
  if (S.country === 'US') return { num: lat(letters(r, 3)) + '-' + (r >= 3 ? '7777' : '' + D() + D() + D() + D()), reg: '', cls: 'gen' };
  const l = letters(r, 3), d = digits3(r), t = S.type;
  if (t === 'taxi') return { num: l.slice(0, 2) + d, reg, cls: 'taxi' };
  if (t === 'police') return { num: l[0] + d + D(), reg, cls: 'police' };
  if (t === 'mil') return { num: (r >= 2 ? '0911' : d + D()) + ' ' + l.slice(0, 2), reg, cls: 'mil' };
  if (t === 'dip') return { num: d + ' CD', reg, cls: 'dip' };
  if (t === 'moto') return { num: d.slice(0, 2) + ' ' + d.slice(1) + ' ' + l.slice(0, 2), reg, cls: 'moto' };
  return { num: l[0] + ' ' + d + ' ' + l.slice(1), reg, cls: 'civil' };
}
const val = (S, r) => Math.round(RAR[r] * (r >= 5 ? 1 : BETS[S.bet].m * 0.8 * (S.region ? 1.2 : 1)));
const mkItem = (S, p, r) => ({ num: p.num + (p.reg ? ' ' + p.reg : ''), r, v: val(S, r), cls: p.cls });
function roll(S, now, lm = 1) {
  const b = BETS[S.bet], r = Math.random(), lk = (now < (S.luck || 0) ? 2 : 1) * lm, pm = b.pm * lk, pl = b.pm * (S.bet ? 1.6 : 1) * lk;
  if (r < pm / 2e7) return 6; if (r < pm / 5e5) return 5; if (r < pm / 5e4) return 4; if (r < pm / 5e4 + pl / 5e3) return 3;
  if (r < 0.005 * (S.bet + 1)) return 2; if (r < 0.05 * (S.bet + 1) + 0.01) return Math.random() < .18 ? 2 : 1; return 0;
}
const qd = (S, c) => { if (!S.q || S.q.d !== c.day) S.q = { d: c.day, c: [0, 0, 0], k: [0, 0, 0] }; };
const qa = (S, c, i) => { qd(S, c); S.q.c[i]++; };
const addXp = (S, n) => { S.xp += n; while (S.xp >= 100) { S.xp -= 100; S.lvl++; S.bal += 1000 * S.lvl; } };
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
  const free = S.free > 0 && S.bet === 0 && !S.region;
  const cost = free ? 0 : Math.round(BETS[S.bet].p * (S.region ? REG[S.region] : 1));
  need(S.bal >= cost, 'Не хватает денег');
  if (free) S.free--; S.bal -= cost; S.spins = (S.spins || 0) + 1; qa(S, c, 0);
  let rar = roll(S, c.now, c.lm), taken = null, reg0 = null, left = null;
  if (rar >= 5) { reg0 = S.country === 'RU' ? (S.region || pick(REGKEYS)) : S.country; const k = await c.claim(rar, reg0); if (!k.ok) { taken = { r: rar, n: reg0 }; rar = 4; reg0 = null; } else left = k.left; }
  const pl = genPlate(S, rar, reg0), it = mkItem(S, pl, rar);
  S.hist.unshift({ num: it.num, r: rar }); S.hist = S.hist.slice(0, 12);
  S.cnt = S.cnt || []; S.cnt[rar] = (S.cnt[rar] || 0) + 1;
  let sold = false;
  if (S.as >= 0 && rar <= S.as) { S.bal += it.v; sold = true; } else S.inv.unshift(it);
  S.xp += 10 + rar * 20; if (S.xp >= 100 * (1 + (S.lvl >> 5))) { S.xp = 0; S.lvl++; S.bal += 1000 * S.lvl; }
  if (rar >= 1) qa(S, c, 1);
  const fid = rar >= 5 ? await c.announce(rar, it.num, left) : 0;
  return { r: { p: pl, item: it, rar, sold, taken, val: it.v, fid } };
}
const gift = (S, c, x) => ({ ...x });
export const ACT = {
  spin,
  prefs: (S, p) => { prefs(S, p); if ([-1, 0, 1, 2].includes(p.as)) S.as = p.as; if (typeof p.nick === 'string') S.nick = p.nick.slice(0, 14); if (p.seen) S.seen = 1; },
  sell: (S, p, c) => { const x = item(S, p); S.inv.splice(p.i, 1); S.bal += x.v; qa(S, c, 2); return { msg: 'Продано за ' + fmt(x.v) }; },
  sellc: (S) => { let g = 0; S.inv = S.inv.filter((x) => (x.r === 0 ? (g += x.v, 0) : 1)); return { msg: 'Продано на ' + fmt(g) }; },
  daily: (S, p, c) => { need(S.daily !== c.day, 'Бонус уже получен. Загляни завтра'); S.daily = c.day; S.streak++; const b = 50000 * S.streak; S.bal += b; return { msg: 'Бонус дня: ' + fmt(b) }; },
  roul: (S, p, c) => { need(c.now >= (S.roul || 0) + 108e5, 'Рулетка ещё не готова'); S.roul = c.now; const r = Math.random(); let m; if (r < .5) { S.bal += 5e4; m = '+50 000 ₽'; } else if (r < .8) { S.free = (S.free || 0) + 2; m = '+2 бесплатные крутки'; } else if (r < .95) { S.bal += 25e4; m = '+250 000 ₽'; } else { S.bal += 2e6; m = 'Джекпот +2 000 000 ₽'; } return { msg: m }; },
  wash: (S, p, c) => { need(c.now >= (S.wash || 0) + 6e4, 'Подожди минуту'); S.wash = c.now; S.bal += 5000; return { msg: '+5 000 ₽' }; },
  buy: (S, p, c) => { const pr = { luck: 15e4, free: 6e4, xp: 9e4 }[p.k]; need(pr, 'Нет такого товара'); take(S, pr); if (p.k === 'luck') S.luck = Math.max(c.now, S.luck || 0) + 18e5; if (p.k === 'free') S.free = (S.free || 0) + 5; if (p.k === 'xp') addXp(S, 50); return { msg: 'Куплено' }; },
  bpc: (S) => { const l = Math.min(50, Math.floor(S.lvl / 3)), n = l - (S.bp || 0); need(n > 0, 'Нет новых наград'); S.bp = l; S.bal += n * 2e4; return { msg: 'Получено ' + fmt(n * 2e4) }; },
  evc: (S, p, c) => { need(S.ev !== c.day, 'Уже получено сегодня'); S.ev = c.day; S.free = (S.free || 0) + 3; return { msg: '+3 бесплатные крутки' }; },
  gc: (S) => { const m = Math.floor((S.spins || 0) / 100), n = m - (S.gc || 0); need(n > 0, 'Пока нет наград'); S.gc = m; S.bal += n * 5e5; return { msg: 'Получено ' + fmt(n * 5e5) }; },
  qc: (S, p, c) => { qd(S, c); const i = Number(p.i), q = QT[i]; need(q && !S.q.k[i], 'Уже получено'); need(S.q.c[i] >= q[0], 'Задание не выполнено'); S.q.k[i] = 1; S.bal += q[1]; S.free = (S.free || 0) + QF[i];
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
  cont: (S, p, c) => { const k = CONT[Number(p.i)]; need(k, 'Нет такого контейнера'); take(S, k[0]); const r = Math.random() * 100; let t = 0, rr = 0; for (let j = 0; j < 4; j++) { t += k[1][j]; if (r < t) { rr = j; break; } } const car = pick(CARS.filter((x) => x[0] === rr)); settle(S, c.now); S.cars = S.cars || []; S.cars.unshift({ n: car[1], e: car[2], r: rr, inc: car[3], pl: null }); return { msg: car[2] + ' ' + car[1] + ' · ' + RARN[rr] }; },
  ccol: (S, p, c) => { const v = Math.floor(pend(S, c.now)); need(v >= 1, 'Пока нечего забирать'); S.bal += v; S.cacc = 0; S.cl = c.now; return { msg: '+' + fmt(v) }; },
  plate_on: (S, p, c) => { const car = (S.cars || [])[Number(p.c)]; need(car && !car.pl, 'Машина занята'); const x = item(S, p); settle(S, c.now); car.pl = x; S.inv.splice(p.i, 1); return { msg: 'Номер на ' + car.n }; },
  plate_off: (S, p, c) => { const car = (S.cars || [])[Number(p.c)]; need(car && car.pl, 'Номера нет'); settle(S, c.now); S.inv.unshift(car.pl); car.pl = null; },
  car_sell: (S, p, c) => { const i = Number(p.c), car = (S.cars || [])[i]; need(car, 'Машина не найдена'); settle(S, c.now); if (car.pl) S.inv.unshift(car.pl); S.bal += car.inc * 4; S.cars.splice(i, 1); return { msg: 'Продано за ' + fmt(car.inc * 4) }; },
  pin: (S, p) => { const x = item(S, p); S.show = S.show || []; need(S.show.length < 3, 'Максимум 3'); S.show.push({ num: x.num, r: x.r }); },
  unp: (S, p) => { (S.show || []).splice(Number(p.i), 1); },
  clan_join: async (S, p, c) => { const n = String(p.n || '').trim().slice(0, 16); need(n, 'Введи название'); const ex = await c.clanName(n); if (!ex) take(S, 1e5); S.clan = { n: ex || n, t: 0, d: 0, xp: 0 }; return { msg: ex ? 'Ты в клане ' + ex : 'Клан создан' }; },
  clan_donate: (S) => { need(S.clan, 'Ты не в клане'); take(S, 1e4); S.clan.d = (S.clan.d || 0) + 1e4; S.clan.t = (S.clan.t || 0) + 1e4; S.clan.xp = (S.clan.xp || 0) + 10; },
  clan_leave: (S) => { S.clan = null; },
};
export function summary(S) {
  const hu = [...S.inv.map((x) => x.r), ...(S.cars || []).map((c) => (c.pl ? c.pl.r : 0))].filter((r) => r >= 5);
  return { cap: Math.round(S.bal + S.inv.reduce((a, x) => a + x.v, 0)), ch: Math.round(rate(S)), sp: S.spins || 0, lvl: S.lvl, cnt: S.cnt || [], cl: S.clan ? S.clan.n : '', cd: S.clan ? S.clan.xp || 0 : 0, hu };
}
export const REGKEYS = Object.keys(REG);
export function givePlate(S, r, reg) { S.inv.unshift(mkItem(S, genPlate(S, r, reg), r)); }
export const norm = (S) => { for (const k of ['inv', 'hist', 'cnt', 'cars', 'show', 'ach']) if (!Array.isArray(S[k])) S[k] = []; S.bal = Number(S.bal) || 0; return S; };
