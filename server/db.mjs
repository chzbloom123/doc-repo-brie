import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function openDatabase({ url = process.env.DATABASE_URL, directory = process.env.DATA_DIR || './data' } = {}) {
  let pool, sqlite;
  if (url) {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: url, max: 8 });
  } else {
    await fs.mkdir(directory, { recursive: true });
    const { DatabaseSync } = await import('node:sqlite');
    sqlite = new DatabaseSync(path.resolve(directory, 'radio.sqlite'));
    sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  }
  const raw = async (sql, params = [], client = pool) => {
    if (client) {
      let i = 0;
      return (await client.query(sql.replace(/\?/g, () => `$${++i}`), params)).rows;
    }
    const stmt = sqlite.prepare(sql);
    if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql)) return stmt.all(...params);
    stmt.run(...params);
    return [];
  };
  // All SQLite work shares this gate, including reads, so no request observes another's partial transaction.
  let tail = Promise.resolve();
  const gate = fn => { const result = tail.then(fn); tail = result.catch(() => {}); return result; };
  const db = {
    kind: pool ? 'postgres' : 'sqlite',
    query: (sql, params) => pool ? raw(sql, params) : gate(() => raw(sql, params)),
    async transaction(fn) {
      const execute = async () => {
        const client = pool ? await pool.connect() : null;
        const tx = { query: (sql, params) => raw(sql, params, client) };
        try {
          await raw('BEGIN', [], client);
          const result = await fn(tx);
          await raw('COMMIT', [], client);
          return result;
        } catch (e) {
          await raw('ROLLBACK', [], client);
          throw e;
        } finally { client?.release(); }
      };
      return pool ? execute() : gate(execute);
    },
    async close() { if (pool) await pool.end(); else { await tail; sqlite.close(); } },
  };
  await db.query('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const migrations = fileURLToPath(new URL('./migrations/', import.meta.url));
  for (const name of (await fs.readdir(migrations)).filter(n => n.endsWith('.sql')).sort()) {
    await db.transaction(async tx => {
      if (pool) await tx.query('SELECT pg_advisory_xact_lock(71824821)');
      if ((await tx.query('SELECT name FROM migrations WHERE name = ?', [name])).length) return;
      const sql = await fs.readFile(path.join(migrations, name), 'utf8');
      for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await tx.query(statement);
      await tx.query('INSERT INTO migrations (name, applied_at) VALUES (?, ?)', [name, new Date().toISOString()]);
    });
  }
  return db;
}
