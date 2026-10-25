import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';
import { ACT, UErr, defaultState, summary, givePlate, REGKEYS, norm, pmArr, weekId, grantWar, bt, seasonReset, auctionPlate } from '../lib/engine.js';

const sql = neon(process.env.DATABASE_URL);
const ADMINS = (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const isAdmin = (id) => ADMINS.includes(String(id));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const need = (c, m) => { if (!c) throw new UErr(m); };

function verify(initData) {
  try {
    if (!initData || !process.env.BOT_TOKEN) return null;
    const p = new URLSearchParams(initData);
    const hash = p.get('hash');
    if (!hash) return null;
    p.delete('hash');
    const data = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
    const h = crypto.createHmac('sha256', secret).update(data).digest('hex');
    if (h.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash))) return null;
    if (Date.now() / 1000 - num(p.get('auth_date')) > 86400) return null;
    return JSON.parse(p.get('user'));
  } catch { return null; }
}

const clanLvl = (t) => [5e6, 25e6, 1e8, 5e8].filter((x) => t >= x).length;
async function finalizeSeason(o) {
  const top = await sql`select tg_id, name from players order by cap desc limit 3`;
  const sh = [...(o.seasonHist || []), { name: o.season.name, top: top.map((x) => ({ id: String(x.tg_id), n: x.name })) }].slice(-20);
  await setCfg('seasonHist', sh); await setCfg('seasonDone', o.season.name); o.seasonHist = sh; o.seasonDone = o.season.name;
}
async function getCfg() {
  const o = {};
  (await sql`select key, val from cfg`).forEach((r) => { o[r.key] = r.val; });
  if (!o.season) {
    // первый запуск: сезон BETA-1, до конца 2 дня 9 часов
    const def = { name: 'BETA-1', end: Date.now() + (2 * 24 + 9) * 3600 * 1000 };
    await sql`insert into cfg (key, val) values ('season', ${JSON.stringify(def)}::jsonb) on conflict (key) do nothing`;
    const [r] = await sql`select val from cfg where key = 'season'`;
    o.season = r ? r.val : def;
  }
  if (o.season.end < Date.now() && o.seasonDone !== o.season.name) await finalizeSeason(o);
  const prev = weekId(Date.now() - 7 * 864e5);
  if (o.warSettled !== prev) {
    const top3 = await sql`select clan, pts from cw where week = ${prev} order by pts desc limit 3`;
    const top = top3[0];
    let hist = o.warHist || [];
    if (top && top.pts > 0 && !hist.some((h) => h.week === prev)) { hist = [...hist, { week: prev, clan: top.clan, pts: top.pts, top: top3.map((x) => ({ clan: x.clan, pts: num(x.pts) })) }].slice(-30); await setCfg('warHist', hist); o.warHist = hist; }
    await setCfg('warSettled', prev); o.warSettled = prev;
  }
  return o;
}
const pub = (c) => ({ msg: c.msg || '', off: !!c.off, season: c.season, perk: c.perk || { c: 'BY', m: 2 }, hist: c.warHist || [] });
const setCfg = (k, v) => sql`insert into cfg (key, val) values (${k}, ${JSON.stringify(v)}::jsonb) on conflict (key) do update set val = excluded.val`;

async function persist(id, user, S, ver, isNew) {
  const m = summary(S), now = Math.max(Date.now(), ver + 1), un = user && user.username ? String(user.username).toLowerCase() : null;
  const name = String(S.nick || user.first_name || 'Игрок').slice(0, 14), raw = JSON.stringify(S), cnt = JSON.stringify(m.cnt);
  if (isNew) {
    const g = await sql`insert into players (tg_id, name, save, cap, sp, lvl, cnt, ch, cl, cd, updated_at, uname) values (${id}, ${name}, ${raw}::jsonb, ${m.cap}, ${m.sp}, ${m.lvl}, ${cnt}::jsonb, ${m.ch}, ${m.cl}, ${m.cd}, ${now}, ${un}) on conflict (tg_id) do nothing returning tg_id`;
    return g.length ? now : 0;
  }
  const g = await sql`update players set name = ${name}, save = ${raw}::jsonb, cap = ${m.cap}, sp = ${m.sp}, lvl = ${m.lvl}, cnt = ${cnt}::jsonb, ch = ${m.ch}, cl = ${m.cl}, cd = ${m.cd}, updated_at = ${now}, uname = coalesce(${un}, uname) where tg_id = ${id} and updated_at = ${ver} returning tg_id`;
  return g.length ? now : 0;
}

const MS3 = 3 * 36e5;
function aucWindow(now) { const wk = weekId(now), start = Date.parse(wk) - MS3 + 5 * 864e5; return { wk, start, end: start + 2 * 864e5 }; }
async function settleAuctions() {
  const done = await sql`update auction set status = 'done' where status = 'open' and endt < ${Date.now()} returning id, plate, cur, leader`;
  for (const a of done) {
    if (!a.leader) continue;
    const pl = { ...a.plate, v: Math.round(num(a.cur) * 0.5) };
    try { await mutate(num(a.leader), (S) => { S.inv.unshift(pl); S.note = { t: Date.now(), text: 'Ты выиграл аукцион! Номер ' + pl.num + ' в инвентаре' }; }); } catch (e) { console.error(e); }
  }
}
async function ensureAuction() {
  const now = Date.now(), w = aucWindow(now);
  await settleAuctions();
  if (now >= w.start && now < w.end) await sql`insert into auction (id, plate, startp, endt) values (${w.wk}, ${JSON.stringify(auctionPlate())}::jsonb, 5000000, ${w.end}) on conflict (id) do nothing`;
  return w;
}
async function runAct(id, user, name, p) {
  const cfg = await getCfg();
  if (cfg.off && !isAdmin(id) && name !== 'prefs') throw new UErr('Технические работы на сервере');
  let claimed = null, lot = null, duelNew = null, out = {}, refN = null, post = null;
  for (let t = 0; t < 4; t++) {
    const [row] = await sql`select save, updated_at from players where tg_id = ${id}`;
    const S = norm(row ? row.save : defaultState(user.first_name)), ver = row ? num(row.updated_at) : 0;
    let clb = 1;
    if (S.clan) { const [cr] = await sql`select treasury from clans where name = ${S.clan.n}`; if (cr) clb = 1 + 0.03 * clanLvl(num(cr.treasury)); }
    let play = 0;
    if (name === 'prestige') { const [pr] = await sql`select play from players where tg_id = ${id}`; play = pr ? num(pr.play) : 0; }
    const wk0 = weekId(Date.now());
    const msk = new Date(Date.now() + 3 * 36e5), wm = msk.getUTCDay() === 6 && msk.getUTCHours() >= 19 && msk.getUTCHours() < 21 ? 3 : 1;
    const c = {
      clb, play, wm,
      goalTarget: async () => num(cfg.goalT, 100000),
      goalTotal: async () => { const [g] = await sql`select total from goal where week = ${wk0}`; return g ? num(g.total) : 0; },
      goalAdd: async () => { await sql`insert into goal (week, total) values (${wk0}, 1) on conflict (week) do update set total = goal.total + 1`; },
      week: weekId(Date.now()), season: (cfg.season && cfg.season.name) || '', dc: (cfg.perk || { c: 'BY' }).c, dm: num((cfg.perk || { m: 2 }).m, 2),
      warAdd: async (cl, pts) => { await sql`insert into cw (week, clan, pts) values (${weekId(Date.now())}, ${cl}, ${pts}) on conflict (week, clan) do update set pts = cw.pts + ${pts}`; },
      now: Date.now(), day: new Date().toISOString().slice(0, 10), lm: num(cfg.lm, 1) || 1,
      claim: async (r, region) => {
        const kind = r === 7 ? 'president' : r === 6 ? 'absolute' : 'secret';
        const cap = r === 7 ? num(cfg.capP, 3) : r === 6 ? num(cfg.capA, 5) : (cfg.capS != null ? num(cfg.capS) : 15 + Math.floor(Math.random() * 6));
        await sql`insert into supply (kind, region, cap) values (${kind}, ${region}, ${cap}) on conflict do nothing`;
        const g = await sql`update supply set taken = taken + 1 where kind = ${kind} and region = ${region} and taken < cap returning cap, taken`;
        return g.length ? { ok: true, left: g[0].cap - g[0].taken } : { ok: false };
      },
      announce: async (r, numb, left) => {
        const evId = Date.now();
        await sql`insert into feed (id, ev) values (1, ${JSON.stringify({ id: evId, r, n: S.nick || user.first_name || 'Игрок', num: numb, left })}::jsonb) on conflict (id) do update set ev = excluded.ev`;
        return evId;
      },
      clanName: async (n) => { const [r] = await sql`select cl from players where lower(cl) = lower(${n}) and cl <> '' limit 1`; return r ? r.cl : null; },
    };
    if (name === 'm_list') {
      const x = S.inv[num(p.i)], price = Math.round(num(p.price));
      need(x && x.num === p.num, 'Номер не найден'); need(price >= 1 && price <= 1e11, 'Неверная цена');
      const [n] = await sql`select count(*)::int as n from market where seller = ${id} and sold = false`;
      need(n.n < 20, 'Лимит: 20 лотов');
      S.inv.splice(num(p.i), 1); lot = { plate: { num: x.num, r: x.r, v: x.v, cls: x.cls }, price }; out = { msg: 'Выставлено на рынок' };
    } else if (name === 'm_buy') {
      if (!claimed) {
        const [l] = await sql`select price from market where id = ${num(p.id)} and sold = false and seller <> ${id}`;
        need(l, 'Лот уже куплен'); need(S.bal >= num(l.price), 'Не хватает денег');
        const g = await sql`update market set sold = true, buyer = ${id} where id = ${num(p.id)} and sold = false and seller <> ${id} returning plate, price`;
        need(g.length, 'Лот уже куплен'); claimed = g[0];
      }
      S.bal -= num(claimed.price); S.inv.unshift(claimed.plate); out = { msg: 'Куплено' };
    } else if (name === 'm_claim') {
      if (!claimed) { const g = await sql`delete from market where id = ${num(p.id)} and seller = ${id} and sold = true returning price`; need(g.length, 'Нет денег для получения'); claimed = g[0]; }
      S.bal += Math.round(num(claimed.price) * 0.85); out = { msg: 'Деньги получены (комиссия 15%)' };
    } else if (name === 'm_cancel') {
      if (!claimed) { const g = await sql`delete from market where id = ${num(p.id)} and seller = ${id} and sold = false returning plate`; need(g.length, 'Лот уже продан'); claimed = g[0]; }
      S.inv.unshift(claimed.plate); out = { msg: 'Лот снят' };
    } else if (name === 'transfer') {
      const amt = Math.round(num(p.amount)), to = String(p.to || '').replace('@', '').trim().toLowerCase();
      need(to.length >= 3, 'Введи юзернейм'); need(amt >= 1000 && amt <= 1e12, 'Минимальный перевод 1 000 ₽'); need(S.bal >= amt, 'Не хватает денег');
      const [rc] = await sql`select tg_id from players where uname = ${to}`;
      need(rc, 'Игрок с таким юзернеймом не найден'); need(String(rc.tg_id) !== String(id), 'Нельзя переводить себе');
      S.bal -= amt;
      post = async () => { try { await mutate(num(rc.tg_id), (R) => { R.bal += amt; R.note = { t: Date.now(), text: 'Перевод от @' + (user.username || 'игрока') + ': +' + amt + ' ₽' }; }); } catch (e) { await mutate(id, (X) => { X.bal += amt; }); } };
      out = { msg: 'Переведено ' + amt + ' ₽ игроку @' + to };
    } else if (name === 'clan_dep') {
      const amt = num(p.amount);
      need(S.clan, 'Ты не в клане'); need([1e5, 1e6, 1e7, 1e8].includes(amt), 'Неверная сумма'); need(S.bal >= amt, 'Не хватает денег');
      const cn = S.clan.n; S.bal -= amt; S.clan.xp = (S.clan.xp || 0) + Math.round(amt / 1e5);
      post = async () => { await sql`insert into clans (name, treasury) values (${cn}, ${amt}) on conflict (name) do update set treasury = clans.treasury + ${amt}`; };
      out = { msg: 'Казна клана пополнена: +' + amt + ' ₽' };
    } else if (name === 'auc_bid') {
      if (!claimed) {
        const amt = Math.round(num(p.amount)), nm = String(S.nick || user.first_name || 'Игрок').slice(0, 14);
        await settleAuctions();
        const [a] = await sql`select id, cur, startp, leader, leader_name from auction where status = 'open' and endt > ${Date.now()} order by endt desc limit 1`;
        need(a, 'Сейчас нет аукциона. Торги в субботу и воскресенье');
        const cur = num(a.cur), min = cur > 0 ? Math.ceil(cur * 1.05) : num(a.startp);
        need(amt >= min, 'Минимальная ставка: ' + min + ' ₽');
        const self = String(a.leader) === String(id), pay = self ? amt - cur : amt;
        need(S.bal >= pay, 'Не хватает денег');
        const g = await sql`update auction set cur = ${amt}, leader = ${id}, leader_name = ${nm}, bids = bids + 1 where id = ${a.id} and cur = ${cur} returning id`;
        need(g.length, 'Ставку только что перебили. Попробуй ещё раз');
        await sql`insert into bids (auction, bidder, name, amount, ts) values (${a.id}, ${id}, ${nm}, ${amt}, ${Date.now()})`;
        claimed = { pay, amt, prev: self ? null : a.leader, cur };
      }
      S.bal -= claimed.pay;
      if (claimed.prev) post = async () => { await mutate(num(claimed.prev), (R) => { R.bal += claimed.cur; R.note = { t: Date.now(), text: 'Твою ставку на аукционе перебили, деньги вернулись: +' + claimed.cur + ' ₽' }; }); };
      out = { msg: 'Ставка принята: ' + claimed.amt + ' ₽' };
    } else if (name === 'd_create') {
      const st = num(p.stake);
      need(Number.isInteger(st) && st >= 1e4 && st <= 1e12, 'Ставка от 10 000 до 1 000 000 000 000 ₽'); need(S.bal >= st, 'Не хватает денег');
      const [n] = await sql`select count(*)::int as n from duels where creator = ${id} and status = 'open'`;
      need(n.n < 3, 'Лимит: 3 открытых вызова');
      S.bal -= st; duelNew = st; out = { msg: 'Вызов создан, ставка заморожена' };
    } else if (name === 'd_join') {
      if (!claimed) {
        const [d] = await sql`select stake from duels where id = ${num(p.id)} and status = 'open' and creator <> ${id}`;
        need(d, 'Вызов уже принят'); need(S.bal >= num(d.stake), 'Не хватает денег');
        const jw = Math.random() < 0.5;
        const g = await sql`delete from duels where id = ${num(p.id)} and status = 'open' and creator <> ${id} returning stake, creator`;
        need(g.length, 'Вызов уже принят'); claimed = { stake: num(g[0].stake), creator: g[0].creator, jw };
      }
      const st = claimed.stake, won = claimed.jw;
      S.bal -= st; bt(S, c, 3); if (won) S.bal += Math.floor(st * 1.9);
      post = async () => { await mutate(num(claimed.creator), (R) => { if (!won) R.bal += Math.floor(st * 1.9); R.note = { t: Date.now(), text: won ? 'Дуэль проиграна: −' + st + ' ₽' : 'Дуэль выиграна: +' + Math.floor(st * 0.9) + ' ₽' }; }); };
      out = { msg: won ? 'Победа! +' + Math.floor(st * 0.9) + ' ₽' : 'Поражение: −' + st + ' ₽' };
    } else if (name === 'd_cancel') {
      if (!claimed) { const g = await sql`delete from duels where id = ${num(p.id)} and creator = ${id} and status = 'open' returning stake`; need(g.length, 'Вызов уже принят'); claimed = g[0]; }
      S.bal += num(claimed.stake); out = { msg: 'Вызов отменён, ставка возвращена' };
    } else if (name === 'd_claim') {
      if (!claimed) { const g = await sql`delete from duels where id = ${num(p.id)} and creator = ${id} and status = 'done' returning stake, winner`; need(g.length, 'Уже получено'); claimed = g[0]; }
      const won = String(claimed.winner) === String(id);
      if (won) S.bal += Math.floor(num(claimed.stake) * 1.9);
      out = { msg: won ? 'Победа! +' + Math.floor(num(claimed.stake) * 0.9) + ' ₽' : 'Поражение: −' + num(claimed.stake) + ' ₽' };
    } else {
      need(ACT[name], 'Неизвестное действие');
      out = (await ACT[name](S, p || {}, c)) || {};
    }
    if (row && cfg.epoch && S.epoch !== cfg.epoch) seasonReset(S, cfg.epoch, (cfg.season && cfg.season.name) || '');
    if (!row && cfg.epoch) S.epoch = cfg.epoch;
    const bonus = grantWar(S, cfg.warHist, Date.now());
    S.medalSeen = S.medalSeen || [];
    for (const h of cfg.seasonHist || []) {
      if (S.medalSeen.includes(h.name)) continue;
      S.medalSeen.push(h.name);
      const pl = h.top.findIndex((x) => x.id === String(id));
      if (pl >= 0) S.badges = [...(S.badges || []), { k: 'medal', p: pl + 1, s: h.name }];
    }
    if (refN === null) { const g = await sql`update refs set paid = true where inviter = ${id} and paid = false returning invitee`; refN = g.length; }
    if (refN) { S.bal += refN * 200000; S.free = (S.free || 0) + refN * 20; }
    S.pm = pmArr(Date.now());
    const saved = await persist(id, user, S, ver, !row);
    if (!saved) continue;
    if (post) await post();
    if (duelNew) await sql`insert into duels (creator, creator_name, stake, created_at) values (${id}, ${String(S.nick || user.first_name || 'Игрок').slice(0, 14)}, ${duelNew}, ${Date.now()})`;
    if (lot) await sql`insert into market (seller, seller_name, plate, r, price, created_at) values (${id}, ${String(S.nick || user.first_name || 'Игрок').slice(0, 14)}, ${JSON.stringify(lot.plate)}::jsonb, ${lot.plate.r}, ${lot.price}, ${Date.now()})`;
    return { ok: true, s: S, updatedAt: saved, msg: out.msg, r: out.r, bonus: [bonus, refN ? 'Друзья пришли по твоей ссылке: +' + refN * 200000 + ' ₽ и +' + refN * 20 + ' круток' : null].filter(Boolean).join('\n') || null };
  }
  throw new UErr('Сервер занят, попробуй ещё раз');
}

async function mutate(tg, fn) {
  for (let t = 0; t < 4; t++) {
    const [row] = await sql`select save, updated_at from players where tg_id = ${tg}`;
    need(row, 'Игрок не найден');
    const S = norm(row.save); fn(S);
    if (await persist(tg, {}, S, num(row.updated_at), false)) return;
  }
  throw new UErr('Занято, повтори');
}

async function adminOp(id, p) {
  need(isAdmin(id), 'Нет доступа');
  const tg = p.tg ? num(p.tg) : id, n = num(p.n);
  let msg = 'Готово';
  const kind = p.op === 'capA' ? 'absolute' : p.op === 'capP' ? 'president' : 'secret';
  switch (p.op) {
    case 'money': await mutate(tg, (S) => { S.bal += n; }); msg = 'Выдано ' + n + ' ₽'; break;
    case 'level': await mutate(tg, (S) => { S.lvl = Math.max(1, n); }); break;
    case 'free': await mutate(tg, (S) => { S.free = (S.free || 0) + n; }); break;
    case 'plate': await mutate(tg, (S) => givePlate(S, Math.min(6, Math.max(0, num(p.r))), REGKEYS.includes(p.reg) ? p.reg : undefined)); msg = 'Номер выдан'; break;
    case 'msg': await setCfg('msg', String(p.msg || '').slice(0, 120)); break;
    case 'maint': { const c = await getCfg(); await setCfg('off', !c.off); msg = !c.off ? 'Тех. работы включены' : 'Тех. работы выключены'; break; }
    case 'lm': await setCfg('lm', Math.max(1, n || 1)); break;
    case 'perk': await setCfg('perk', { c: String(p.reg || '').toUpperCase().slice(0, 2), m: Math.max(1, n || 1) }); msg = 'Страна дня обновлена'; break;
    case 'capS': case 'capA': case 'capP':
      if (p.reg) await sql`insert into supply (kind, region, cap) values (${kind}, ${String(p.reg).slice(0, 6)}, ${n}) on conflict (kind, region) do update set cap = ${n}`;
      else { await setCfg(p.op, n); await sql`update supply set cap = ${n} where kind = ${kind}`; }
      msg = 'Тираж обновлён'; break;
    case 'wipe': {
      const w = num(p.tg);
      need(w, 'Введи Telegram ID игрока');
      await sql`delete from market where seller = ${w}`;
      await sql`delete from duels where creator = ${w}`;
      await sql`delete from players where tg_id = ${w}`;
      msg = 'Игрок ' + w + ' обнулён';
      break;
    }
    case 'wipeall':
      need(p.confirm === 'WIPE', 'Нужно подтверждение');
      await sql`delete from market`;
      await sql`delete from duels`;
      await sql`delete from players`;
      await sql`update supply set taken = 0`;
      await sql`update feed set ev = null`;
      msg = 'Все игроки обнулены';
      break;
    case 'prestige': await mutate(tg, (S) => { S.pr = Math.min(10, Math.max(0, n)); }); break;
    case 'car': await mutate(tg, (S) => { S.cars = S.cars || []; S.cars.unshift({ n: 'Koenigsegg Jesko', e: '🏎️', r: 3, inc: 900000, pl: null }); }); break;
    case 'frame': await mutate(tg, (S) => { S.frames = [...new Set([...(S.frames || []), Math.min(5, Math.max(0, n))])]; }); break;
    case 'goalT': await setCfg('goalT', Math.max(1000, n)); break;
    case 'seasonReset': {
      const c0 = await getCfg();
      if (c0.seasonDone !== c0.season.name) await finalizeSeason(c0);
      await sql`update players set cap = 0, sp = 0, lvl = 1, cnt = '[]'::jsonb, ch = 0, cd = 0`;
      await sql`delete from market`; await sql`delete from duels`; await sql`delete from cw`; await sql`delete from goal`;
      await sql`delete from auction`; await sql`delete from bids`;
      await sql`update supply set taken = 0`; await sql`update feed set ev = null`;
      await setCfg('epoch', String(Date.now()));
      await setCfg('season', { name: String(p.msg || '').trim().slice(0, 20) || 'НОВЫЙ СЕЗОН', end: Date.now() + Math.max(1, n || 168) * 3600 * 1000 });
      msg = 'Сезон сброшен и запущен заново';
      break;
    }
    case 'season':
      { const c0 = await getCfg(); if (c0.seasonDone !== c0.season.name) await finalizeSeason(c0); }
      await setCfg('season', { name: String(p.msg || '').trim().slice(0, 20) || 'BETA-1', end: Date.now() + Math.max(1, n) * 3600 * 1000 });
      msg = 'Сезон запущен';
      break;
    case 'supply': return { ok: true, rows: await sql`select kind, region, cap, taken from supply order by kind, region` };
    default: throw new UErr('Неизвестная операция');
  }
  const [r] = await sql`select save, updated_at from players where tg_id = ${id}`;
  return { ok: true, msg, s: norm(r ? r.save : defaultState('')), updatedAt: r ? num(r.updated_at) : 0 };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = verify(req.headers['x-init-data'] || '');
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const id = user.id, action = req.query.action;
  try {
    if (req.method === 'GET') {
      if (action === 'load') {
        const [r] = await sql`select save, updated_at from players where tg_id = ${id}`;
        const cfg = await getCfg();
        const ref = num(req.query.ref);
        const S = norm(r ? r.save : defaultState(user.first_name));
        let ver = r ? num(r.updated_at) : 0;
        if (!r && ref && ref !== id) {
          const [inv] = await sql`select tg_id from players where tg_id = ${ref}`;
          if (inv) {
            S.free += 100; S.bal += 300000;
            const ok = await persist(id, user, S, 0, true);
            if (ok) { ver = ok; await sql`insert into refs (invitee, inviter, created_at) values (${id}, ${ref}, ${Date.now()}) on conflict do nothing`; }
          }
        }
        const [cnt] = await sql`select count(*)::int as n from refs where inviter = ${id}`;
        return res.json({ s: { ...S, pm: pmArr(Date.now()) }, updatedAt: ver, admin: isAdmin(id), cfg: pub(cfg), refBase: process.env.BOT_LINK || '', refs: cnt.n });
      }
      if (action === 'auction') {
        const w = await ensureAuction();
        const [lot] = await sql`select id, plate, startp, cur, leader_name, bids, endt from auction where status = 'open' order by endt desc limit 1`;
        const bidsR = lot ? await sql`select name, amount from bids where auction = ${lot.id} order by amount desc limit 12` : [];
        const past = await sql`select plate, leader_name, cur from auction where status = 'done' and leader is not null order by endt desc limit 8`;
        return res.json({ lot: lot ? { plate: lot.plate, startp: num(lot.startp), cur: num(lot.cur), leader: lot.leader_name, n: lot.bids, end: num(lot.endt) } : null, bids: bidsR.map((b) => ({ name: b.name, amount: num(b.amount) })), past: past.map((x) => ({ plate: x.plate, name: x.leader_name, cur: num(x.cur) })), next: w.start });
      }
      if (action === 'me') {
        const [pr] = await sql`select play from players where tg_id = ${id}`;
        return res.json({ play: pr ? num(pr.play) : 0 });
      }
      if (action === 'goal') {
        const cfg = await getCfg(), wk = weekId(Date.now());
        const [g] = await sql`select total from goal where week = ${wk}`;
        return res.json({ week: wk, total: g ? num(g.total) : 0, target: num(cfg.goalT, 100000) });
      }
      if (action === 'claninfo') {
        const [r] = await sql`select treasury from clans where name = ${String(req.query.name || '')}`;
        return res.json({ treasury: r ? num(r.treasury) : 0 });
      }
      if (action === 'reftop') {
        const rows = await sql`select r.inviter, count(*)::int as c, max(p.name) as name from refs r left join players p on p.tg_id = r.inviter group by r.inviter order by c desc limit 20`;
        return res.json({ top: rows.map((x) => ({ id: String(x.inviter), n: x.name || 'Игрок', c: x.c })) });
      }
      if (action === 'uniq') {
        const cfg = await getCfg(), keys = [...REGKEYS, 'BY', 'KZ', 'US', 'UA', 'DE', 'AM', 'IT', 'CN', 'AE'];
        const [cn] = await sql`select count(*)::int as n from supply`;
        if (cn.n < keys.length * 3) {
          const list = [];
          for (const k of keys) {
            list.push({ kind: 'secret', region: k, cap: cfg.capS != null ? num(cfg.capS) : 15 + Math.floor(Math.random() * 6) });
            list.push({ kind: 'absolute', region: k, cap: num(cfg.capA, 5) });
            list.push({ kind: 'president', region: k, cap: num(cfg.capP, 3) });
          }
          await sql`insert into supply (kind, region, cap) select kind, region, cap from jsonb_to_recordset(${JSON.stringify(list)}::jsonb) as t(kind text, region text, cap int) on conflict do nothing`;
        }
        const rows = await sql`select kind, region, cap, taken from supply order by region, kind`;
        return res.json({ rows });
      }
      if (action === 'top') {
        const rows = await sql`select tg_id, name, cap, sp, lvl, cnt, ch, cl, cd from players order by cap desc limit 500`;
        return res.json({ top: rows.map((r) => ({ id: String(r.tg_id), n: r.name, cap: num(r.cap), sp: r.sp, lvl: r.lvl, cnt: r.cnt, ch: num(r.ch), cl: r.cl, cd: num(r.cd) })) });
      }
      if (action === 'feed') {
        const [r] = await sql`select ev from feed where id = 1`;
        const cfg = await getCfg();
        const [on] = await sql`select count(*)::int as n from players where seen > ${Date.now() - 120000}`;
        return res.json({ feed: r ? r.ev : null, cfg: pub(cfg), online: on.n });
      }
      if (action === 'war') {
        const wk = weekId(Date.now()), cfg = await getCfg();
        const rows = await sql`select clan, pts from cw where week = ${wk} order by pts desc limit 20`;
        return res.json({ week: wk, end: Date.parse(wk) - 3 * 36e5 + 7 * 864e5, rows: rows.map((x) => ({ clan: x.clan, pts: num(x.pts) })), hist: (cfg.warHist || []).slice(-5).reverse() });
      }
      if (action === 'duels') {
        const open = await sql`select id, creator_name, stake from duels where status = 'open' and creator <> ${id} order by created_at desc limit 30`;
        const mine = await sql`select id, stake, status, winner, opp_name from duels where creator = ${id} and status = 'open' order by created_at desc limit 20`;
        return res.json({ open: open.map((d) => ({ id: String(d.id), n: d.creator_name, stake: num(d.stake) })), mine: mine.map((d) => ({ id: String(d.id), stake: num(d.stake), status: d.status, win: String(d.winner) === String(id), opp: d.opp_name })) });
      }
      if (action === 'market') {
        const rows = await sql`select id, seller, seller_name, plate, r, price, sold from market where sold = false or seller = ${id} order by created_at desc limit 100`;
        return res.json({ lots: rows.map((l) => ({ id: String(l.id), n: l.seller_name, num: l.plate.num, r: l.r, v: num(l.plate.v), cls: l.plate.cls, pr: num(l.price), sold: l.sold, mine: String(l.seller) === String(id) })) });
      }
      return res.status(400).json({ error: 'bad action' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    const b = req.body || {};
    if (action === 'act') {
      if (b.name === 'adm') return res.json(await adminOp(id, b.p || {}));
      return res.json(await runAct(id, user, String(b.name), b.p || {}));
    }
    if (action === 'beat') {
      const now = Date.now();
      await sql`update players set play = play + case when seen > ${now - 90000} then ${now} - seen else 0 end, seen = ${now} where tg_id = ${id}`;
      return res.json({ ok: true });
    }
    if (action === 'reset') {
      await sql`delete from market where seller = ${id} and sold = false`;
      await sql`delete from duels where creator = ${id} and status = 'open'`;
      await sql`delete from players where tg_id = ${id}`;
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'bad action' });
  } catch (e) {
    if (e instanceof UErr) return res.json({ ok: false, err: e.message });
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
}
