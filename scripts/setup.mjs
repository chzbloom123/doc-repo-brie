import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../server/auth.mjs';
import { config } from 'dotenv';
if (process.env.NODE_ENV === 'production') throw new Error('Local setup is for development only. Configure production environment variables instead.');
try { await fs.access('.env'); console.log('Keeping existing .env.'); }
catch {
  const password = randomBytes(18).toString('base64url');
  const hash = await hashPassword(password);
  await fs.writeFile('.env', `PORT=3001\nPUBLIC_URL=http://localhost:5173\nSESSION_SECRET=${randomBytes(48).toString('hex')}\nEDITOR_USERNAME=brie\nEDITOR_PASSWORD_HASH=${hash}\nDATA_DIR=./data\n`, { flag: 'wx', mode: 0o600 });
  await fs.writeFile('.local-access.txt', `WGOB LOCAL WRITING ROOM\n\nURL: http://localhost:5173/#studio\nUsername: brie\nPassword: ${password}\n\nLocal development only. This file and .env are ignored by Git.\nKeep them private. Use separate credentials for production.\n`, { flag: 'wx', mode: 0o600 });
  console.log('Created local configuration. Your private login is in .local-access.txt.');
}
config({ quiet: true });
const { openDatabase } = await import('../server/db.mjs');
const { createStorage } = await import('../server/storage.mjs');
const { importStarter } = await import('../server/library.mjs');
const db = await openDatabase();
try {
  await fs.mkdir('starter-songs', { recursive: true });
  console.log(await importStarter(db, createStorage(), 'starter-songs'));
}
finally { await db.close(); }
