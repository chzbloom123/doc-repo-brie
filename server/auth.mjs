import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import session from 'express-session';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [algorithm, salt, expected] = (stored || '').split(':');
  if (algorithm !== 'scrypt' || !salt || expected?.length !== 128) return false;
  const hash = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(hash, Buffer.from(expected, 'hex'));
}
export class DatabaseSessionStore extends session.Store {
  constructor(db) {
    super(); this.db = db;
    this.timer = setInterval(() => db.query('DELETE FROM sessions WHERE expires < ?', [Date.now()]).catch(console.error), 60 * 60 * 1000);
    this.timer.unref();
  }
  get(sid, callback) {
    this.db.query('SELECT data FROM sessions WHERE sid = ? AND expires > ?', [sid, Date.now()])
      .then(rows => callback(null, rows[0] ? JSON.parse(rows[0].data) : null)).catch(callback);
  }
  set(sid, value, callback) {
    const expires = new Date(value.cookie.expires || Date.now() + 12 * 60 * 60 * 1000).getTime();
    this.db.query('INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?) ON CONFLICT (sid) DO UPDATE SET data = excluded.data, expires = excluded.expires', [sid, JSON.stringify(value), expires]).then(() => callback?.()).catch(callback);
  }
  destroy(sid, callback) { this.db.query('DELETE FROM sessions WHERE sid = ?', [sid]).then(() => callback?.()).catch(callback); }
  touch(sid, value, callback) { this.set(sid, value, callback); }
  close() { clearInterval(this.timer); }
}
export const requireEditor = (req, res, next) => req.session?.editor ? next() : res.status(401).json({ error: 'Please sign in to the writing room.' });
export function csrfProtection(req, res, next) {
  const token = req.headers['x-csrf-token'];
  if (typeof token !== 'string' || token !== req.session.csrf) return res.status(403).json({ error: 'Your session changed. Refresh this page and try again.' });
  next();
}
