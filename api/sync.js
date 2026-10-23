import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';
import { ACT, UErr, defaultState, summary, givePlate, REGKEYS, norm } from '../lib/engine.js';

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
  return o;
}
const pub = (c) => ({ msg: c.msg || '', off: !!c.off, season: c.season });
const setCfg = (k, v) => sql`insert into cfg (key, val) values (${k}, ${JSON.stringify(v)}::jsonb) on conflict (key) do update set val = excluded.val`;

async function persist(id, user, S, ver, isNew) {
  const m = summary(S), now = Math.max(Date.now(), ver + 1);
  const name = String(S.nick || user.first_name || 'Игрок').slice(0, 14), raw = JSON.stringify(S), cnt = JSON.stringify(m.cnt);
  if (isNew) {
    const g = await sql`insert into players (tg_id, name, save, cap, sp, lvl, cnt, ch, cl, cd, updated_at) values (${id}, ${name}, ${raw}::jsonb, ${m.cap}, ${m.sp}, ${m.lvl}, ${cnt}::jsonb, ${m.ch}, ${m.cl}, ${m.cd}, ${now}) on conflict (tg_id) do nothing returning tg_id`;
    return g.length ? now : 0;
  }
  const g = await sql`update players set name = ${name}, save = ${raw}::jsonb, cap = ${m.cap}, sp = ${m.sp}, lvl = ${m.lvl}, cnt = ${cnt}::jsonb, ch = ${m.ch}, cl = ${m.cl}, cd = ${m.cd}, updated_at = ${now} where tg_id = ${id} and updated_at = ${ver} returning tg_id`;
  return g.length ? now : 0;
}

async function runAct(id, user, name, p) {
  const cfg = await getCfg();
  if (cfg.off && !isAdmin(id) && name !== 'prefs') throw new UErr('Технические работы на сервере');
  let claimed = null, lot = null, duelNew = null, out = {};
  for (let t = 0; t < 4; t++) {
    const [row] = await sql`select save, updated_at from players where tg_id = ${id}`;
    const S = norm(row ? row.save : defaultState(user.first_name)), ver = row ? num(row.updated_at) : 0;
    const c = {
      now: Date.now(), day: new Date().toISOString().slice(0, 10), lm: num(cfg.lm, 1) || 1,
      claim: async (r, region) => {
        const kind = r === 6 ? 'absolute' : 'secret';
        const cap = r === 6 ? num(cfg.capA, 5) : (cfg.capS != null ? num(cfg.capS) : 15 + Math.floor(Math.random() * 6));
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
      S.bal += Math.round(num(claimed.price) * 0.95); out = { msg: 'Деньги получены' };
    } else if (name === 'm_cancel') {
      if (!claimed) { const g = await sql`delete from market where id = ${num(p.id)} and seller = ${id} and sold = false returning plate`; need(g.length, 'Лот уже продан'); claimed = g[0]; }
      S.inv.unshift(claimed.plate); out = { msg: 'Лот снят' };
    } else if (name === 'd_create') {
      const st = num(p.stake);
      need([1e4, 1e5, 1e6, 1e7].includes(st), 'Неверная ставка'); need(S.bal >= st, 'Не хватает денег');
      const [n] = await sql`select count(*)::int as n from duels where creator = ${id} and status = 'open'`;
      need(n.n < 3, 'Лимит: 3 открытых вызова');
      S.bal -= st; duelNew = st; out = { msg: 'Вызов создан, ставка заморожена' };
    } else if (name === 'd_join') {
      if (!claimed) {
        const [d] = await sql`select stake from duels where id = ${num(p.id)} and status = 'open' and creator <> ${id}`;
        need(d, 'Вызов уже принят'); need(S.bal >= num(d.stake), 'Не хватает денег');
        const jw = Math.random() < 0.5, nm = String(S.nick || user.first_name || 'Игрок').slice(0, 14);
        const g = await sql`update duels set status = 'done', opponent = ${id}, opp_name = ${nm}, winner = case when ${jw}::boolean then ${id}::bigint else creator end where id = ${num(p.id)} and status = 'open' and creator <> ${id} returning stake, winner`;
        need(g.length, 'Вызов уже принят'); claimed = g[0];
      }
      const stake = num(claimed.stake), won = String(claimed.winner) === String(id);
      S.bal -= stake; if (won) S.bal += Math.floor(stake * 1.9);
      out = { msg: won ? 'Победа! +' + Math.floor(stake * 0.9) + ' ₽' : 'Поражение: −' + stake + ' ₽' };
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
    const saved = await persist(id, user, S, ver, !row);
    if (!saved) continue;
    if (duelNew) await sql`insert into duels (creator, creator_name, stake, created_at) values (${id}, ${String(S.nick || user.first_name || 'Игрок').slice(0, 14)}, ${duelNew}, ${Date.now()})`;
    if (lot) await sql`insert into market (seller, seller_name, plate, r, price, created_at) values (${id}, ${String(S.nick || user.first_name || 'Игрок').slice(0, 14)}, ${JSON.stringify(lot.plate)}::jsonb, ${lot.plate.r}, ${lot.price}, ${Date.now()})`;
    return { ok: true, s: S, updatedAt: saved, msg: out.msg, r: out.r };
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
  const kind = p.op === 'capA' ? 'absolute' : 'secret';
  switch (p.op) {
    case 'money': await mutate(tg, (S) => { S.bal += n; }); msg = 'Выдано ' + n + ' ₽'; break;
    case 'level': await mutate(tg, (S) => { S.lvl = Math.max(1, n); }); break;
    case 'free': await mutate(tg, (S) => { S.free = (S.free || 0) + n; }); break;
    case 'plate': await mutate(tg, (S) => givePlate(S, Math.min(6, Math.max(0, num(p.r))), REGKEYS.includes(p.reg) ? p.reg : undefined)); msg = 'Номер выдан'; break;
    case 'msg': await setCfg('msg', String(p.msg || '').slice(0, 120)); break;
    case 'maint': { const c = await getCfg(); await setCfg('off', !c.off); msg = !c.off ? 'Тех. работы включены' : 'Тех. работы выключены'; break; }
    case 'lm': await setCfg('lm', Math.max(1, n || 1)); break;
    case 'capS': case 'capA':
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
    case 'season':
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
        return res.json({ s: norm(r ? r.save : defaultState(user.first_name)), updatedAt: r ? num(r.updated_at) : 0, admin: isAdmin(id), cfg: pub(cfg) });
      }
      if (action === 'top') {
        const rows = await sql`select tg_id, name, cap, sp, lvl, cnt, ch, cl, cd from players order by cap desc limit 500`;
        return res.json({ top: rows.map((r) => ({ id: String(r.tg_id), n: r.name, cap: num(r.cap), sp: r.sp, lvl: r.lvl, cnt: r.cnt, ch: num(r.ch), cl: r.cl, cd: num(r.cd) })) });
      }
      if (action === 'feed') {
        const [r] = await sql`select ev from feed where id = 1`;
        const cfg = await getCfg();
        return res.json({ feed: r ? r.ev : null, cfg: pub(cfg) });
      }
      if (action === 'duels') {
        const open = await sql`select id, creator_name, stake from duels where status = 'open' and creator <> ${id} order by created_at desc limit 30`;
        const mine = await sql`select id, stake, status, winner, opp_name from duels where creator = ${id} order by created_at desc limit 20`;
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
