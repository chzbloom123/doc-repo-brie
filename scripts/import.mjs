import { openDatabase } from '../server/db.mjs';
import { createStorage } from '../server/storage.mjs';
import { importStarter } from '../server/library.mjs';
const db = await openDatabase();
try { console.log(await importStarter(db, createStorage(), process.argv[2] || 'starter-songs')); }
finally { await db.close(); }
