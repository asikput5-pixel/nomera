import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

const sql = neon(process.env.DATABASE_URL);
const PM = [1, 1.2, 1.6, 2.5, 5, 12, 40];
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

// Проверка подписи Telegram initData
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
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = verify(req.headers['x-init-data'] || '');
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const id = String(user.id);
  const action = req.query.action;

  // Server-side allowlist: client-side PINs/localStorage are not trusted.
  if (action === 'admin_check') {
    const adminId = String(process.env.ADMIN_TG_ID || '');
    const allowed = Boolean(adminId && id === adminId);
    return res.status(allowed ? 200 : 403).json({ admin: allowed });
  }

  try {
    if (req.method === 'GET') {
      if (action === 'load') {
        const [r] = await sql`select save, updated_at from players where tg_id = ${id}`;
        return res.json(r ? { save: r.save, updatedAt: num(r.updated_at) } : { save: null });
      }
      if (action === 'top') {
        const rows = await sql`select tg_id, name, cap, sp, lvl, cnt, ch, cl, cd from players order by cap desc limit 500`;
        return res.json({
          top: rows.map((r) => ({ id: String(r.tg_id), n: r.name, cap: num(r.cap), sp: r.sp, lvl: r.lvl, cnt: r.cnt, ch: num(r.ch), cl: r.cl, cd: num(r.cd) })),
        });
      }
      if (action === 'feed') {
        const [r] = await sql`select ev from feed where id = 1`;
        return res.json({ feed: r ? r.ev : null });
      }
      if (action === 'market') {
        const rows = await sql`select id, seller, seller_name, plate, r, price, sold from market where sold = false or seller = ${id} order by created_at desc limit 100`;
        return res.json({ lots: rows.map((l) => ({ id: String(l.id), n: l.seller_name, num: l.plate.num, r: l.r, v: num(l.plate.v), cls: l.plate.cls, pr: num(l.price), sold: l.sold, mine: String(l.seller) === String(id) })) });
      }
      return res.status(400).json({ error: 'bad action' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    const b = req.body || {};

    if (action === 'save') {
      const s = b.save;
      if (!s || typeof s !== 'object') return res.status(400).json({ error: 'bad save' });
      const raw = JSON.stringify(s);
      if (raw.length > 300000) return res.status(413).json({ error: 'too big' });
      const inv = Array.isArray(s.inv) ? s.inv : [];
      const cars = Array.isArray(s.cars) ? s.cars : [];
      const cap = Math.round(num(s.bal) + inv.reduce((a, x) => a + num(x && x.v), 0));
      const ch = Math.round(cars.reduce((a, c) => a + num(c && c.inc) * (c && c.pl ? PM[num(c.pl.r)] || 1 : 1), 0));
      const hu = [...inv.map((x) => num(x && x.r)), ...cars.map((c) => (c && c.pl ? num(c.pl.r) : 0))].filter((r) => r >= 5);
      const listed = await sql`select r from market where seller = ${id} and sold = false and r >= 5`;
      listed.forEach((l) => hu.push(l.r));
      const name = String(s.nick || user.first_name || 'Игрок').slice(0, 14);
      const cl = String((s.clan && s.clan.n) || '').slice(0, 16);
      const cd = num(s.clan && s.clan.d);
      const ts = num(s.ts, Date.now());
      await sql`
        insert into players (tg_id, name, save, cap, sp, lvl, cnt, ch, cl, cd, hu, updated_at)
        values (${id}, ${name}, ${raw}::jsonb, ${cap}, ${num(s.spins)}, ${num(s.lvl, 1)}, ${JSON.stringify(s.cnt || [])}::jsonb, ${ch}, ${cl}, ${cd}, ${JSON.stringify(hu)}::jsonb, ${ts})
        on conflict (tg_id) do update set name = excluded.name, save = excluded.save, cap = excluded.cap, sp = excluded.sp,
          lvl = excluded.lvl, cnt = excluded.cnt, ch = excluded.ch, cl = excluded.cl, cd = excluded.cd, hu = excluded.hu, updated_at = excluded.updated_at`;
      return res.json({ ok: true });
    }

    if (action === 'claim') {
      const r = num(b.r);
      if (![5, 6].includes(r)) return res.status(400).json({ error: 'bad rarity' });
      const kind = r === 6 ? 'absolute' : 'secret';
      const now = Date.now();
      const [u] = await sql`select holder, name, ts from uniques where kind = ${kind}`;
      if (u) {
        const mine = String(u.holder) === String(id);
        const [h] = await sql`select hu from players where tg_id = ${u.holder}`;
        const holds = h && Array.isArray(h.hu) && h.hu.includes(r);
        if (mine && holds) return res.json({ ok: false, holder: 'ты' });
        if (!mine && (now - num(u.ts) < 60000 || holds)) return res.json({ ok: false, holder: u.name });
      }
      const name = String(user.first_name || 'Игрок').slice(0, 14);
      const got = await sql`
        insert into uniques (kind, holder, name, num, ts) values (${kind}, ${id}, ${name}, '', ${now})
        on conflict (kind) do update set holder = ${id}, name = ${name}, num = '', ts = ${now}
        where uniques.holder is not distinct from ${u ? u.holder : null}::bigint
        returning kind`;
      return res.json(got.length ? { ok: true } : { ok: false, holder: 'другого игрока' });
    }

    if (action === 'announce') {
      const r = num(b.r);
      if (![5, 6].includes(r)) return res.status(400).json({ error: 'bad rarity' });
      const kind = r === 6 ? 'absolute' : 'secret';
      const [own] = await sql`select 1 as ok from uniques where kind = ${kind} and holder = ${id}`;
      if (!own) return res.status(403).json({ error: 'not holder' });
      const numStr = String(b.num || '').slice(0, 20);
      const name = String(user.first_name || 'Игрок').slice(0, 14);
      const ev = { id: num(b.id, Date.now()), r, n: name, num: numStr };
      await sql`update uniques set num = ${numStr}, ts = ${Date.now()} where kind = ${kind}`;
      await sql`insert into feed (id, ev) values (1, ${JSON.stringify(ev)}::jsonb) on conflict (id) do update set ev = excluded.ev`;
      return res.json({ ok: true });
    }

    if (action === 'list') {
      const p = b.plate || {};
      const r = num(p.r, -1);
      const price = Math.round(num(b.price));
      if (r < 0 || r > 6 || price < 1 || price > 1e11 || !p.num) return res.status(400).json({ error: 'bad lot' });
      const [c] = await sql`select count(*)::int as n from market where seller = ${id} and sold = false`;
      if (c.n >= 20) return res.status(400).json({ error: 'limit' });
      const plate = { num: String(p.num).slice(0, 20), r, v: Math.max(0, num(p.v)), cls: String(p.cls || 'civil').slice(0, 10) };
      await sql`insert into market (seller, seller_name, plate, r, price, created_at) values (${id}, ${String(user.first_name || 'Игрок').slice(0, 14)}, ${JSON.stringify(plate)}::jsonb, ${r}, ${price}, ${Date.now()})`;
      return res.json({ ok: true });
    }

    if (action === 'buy') {
      const got = await sql`update market set sold = true, buyer = ${id} where id = ${num(b.id)} and sold = false and seller <> ${id} returning plate, r`;
      if (!got.length) return res.json({ ok: false });
      const l = got[0];
      if (l.r >= 5) {
        const kind = l.r === 6 ? 'absolute' : 'secret';
        await sql`update uniques set holder = ${id}, name = ${String(user.first_name || 'Игрок').slice(0, 14)}, ts = ${Date.now()} where kind = ${kind}`;
      }
      return res.json({ ok: true, plate: l.plate });
    }

    if (action === 'claim_sold') {
      const got = await sql`delete from market where id = ${num(b.id)} and seller = ${id} and sold = true returning price`;
      return res.json(got.length ? { ok: true, price: num(got[0].price) } : { ok: false });
    }

    if (action === 'cancel') {
      const got = await sql`delete from market where id = ${num(b.id)} and seller = ${id} and sold = false returning plate`;
      return res.json(got.length ? { ok: true, plate: got[0].plate } : { ok: false });
    }

    return res.status(400).json({ error: 'bad action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
}
