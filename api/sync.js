import crypto from 'node:crypto';
import pg from 'pg';
const { Pool } = pg;

let pool;
function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
  return pool;
}

function verifyTelegramInitData(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || typeof initData !== 'string' || initData.length > 10000) return null;
  const params = new URLSearchParams(initData);
  const suppliedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const userRaw = params.get('user');
  if (!suppliedHash || !/^[a-f0-9]{64}$/i.test(suppliedHash) || !authDate || !userRaw) return null;
  // Reject old launch data; the app should be reopened from Telegram to refresh it.
  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > 86400) return null;
  params.delete('hash');
  params.delete('signature');
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest();
  const actual = Buffer.from(suppliedHash, 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const user = JSON.parse(userRaw);
    if (!user.id || !Number.isSafeInteger(Number(user.id))) return null;
    return { id: String(user.id), username: typeof user.username === 'string' ? user.username.slice(0, 64) : null,
      displayName: [user.first_name, user.last_name].filter(x => typeof x === 'string').join(' ').slice(0, 80) || 'Игрок' };
  } catch { return null; }
}

function cleanSave(input) {
  if (!input || typeof input !== 'object') return null;
  const nick = typeof input.nick === 'string' ? input.nick.trim().slice(0, 14) : '';
  const inv = Array.isArray(input.inv) ? input.inv.slice(0, 500).map(x => ({
    num: typeof x?.num === 'string' ? x.num.slice(0, 24) : '',
    r: Number.isInteger(x?.r) && x.r >= 0 && x.r <= 6 ? x.r : 0,
    cls: typeof x?.cls === 'string' ? x.cls.slice(0, 24) : 'civil'
  })).filter(x => x.num) : [];
  const hist = Array.isArray(input.hist) ? input.hist.slice(0, 12).map(x => ({
    num: typeof x?.num === 'string' ? x.num.slice(0, 24) : '',
    r: Number.isInteger(x?.r) && x.r >= 0 && x.r <= 6 ? x.r : 0
  })).filter(x => x.num) : [];
  return { nick, inv, hist, spins: Math.max(0, Math.min(100000000, Number.isFinite(Number(input.spins)) ? Math.floor(Number(input.spins)) : 0)),
    xp: Math.max(0, Math.min(100000000, Number.isFinite(Number(input.xp)) ? Math.floor(Number(input.xp)) : 0)),
    lvl: Math.max(1, Math.min(100000, Number.isFinite(Number(input.lvl)) ? Math.floor(Number(input.lvl)) : 1)) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const initData = req.method === 'GET' ? req.query?.initData : req.body?.initData;
  const user = verifyTelegramInitData(initData);
  if (!user) return res.status(401).json({ error: 'Telegram authorization failed. Open the app from Telegram again.' });
  try {
    const pool = db();
    if (req.method === 'GET' && req.query?.action === 'top') {
      const q = await pool.query(`SELECT display_name AS name, points, (SELECT COUNT(*)::int FROM collection_items c WHERE c.telegram_id=p.telegram_id) AS collection_count FROM players p ORDER BY points DESC, last_seen_at DESC LIMIT 50`);
      return res.status(200).json({ top: q.rows });
    }
    if (req.method === 'GET') {
      const q = await pool.query('SELECT data, updated_at FROM player_saves WHERE telegram_id=$1', [user.id]);
      return res.status(200).json({ save: q.rows[0]?.data ?? null, updatedAt: q.rows[0]?.updated_at ? new Date(q.rows[0].updated_at).getTime() : 0 });
    }
    const save = cleanSave(req.body?.save);
    if (!save) return res.status(400).json({ error: 'Invalid save data' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO players (telegram_id, username, display_name, points, created_at, last_seen_at)
        VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (telegram_id) DO UPDATE SET username=EXCLUDED.username, display_name=EXCLUDED.display_name, points=EXCLUDED.points, last_seen_at=NOW()`,
        [user.id, user.username, save.nick || user.displayName, save.spins + save.inv.length]);
      await client.query(`INSERT INTO player_saves (telegram_id, data, updated_at) VALUES ($1,$2::jsonb,NOW())
        ON CONFLICT (telegram_id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()`, [user.id, JSON.stringify(save)]);
      await client.query('DELETE FROM collection_items WHERE telegram_id=$1', [user.id]);
      for (const item of save.inv) await client.query('INSERT INTO collection_items (telegram_id, plate_number, country, rarity) VALUES ($1,$2,$3,$4)', [user.id, item.num, 'RU', ['common','rare','epic','legend','mythic','secret','absolute'][item.r]]);
      await client.query('DELETE FROM spin_history WHERE telegram_id=$1', [user.id]);
      for (const item of save.hist) await client.query('INSERT INTO spin_history (telegram_id, result_number) VALUES ($1,$2)', [user.id, item.num]);
      await client.query('COMMIT');
      return res.status(200).json({ ok: true, updatedAt: Date.now() });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  } catch (e) {
    console.error('Neon sync error:', e?.message || e);
    return res.status(500).json({ error: 'Server storage error. Check database schema and environment variables.' });
  }
}
