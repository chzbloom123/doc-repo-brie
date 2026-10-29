import { openDatabase } from './db.mjs';
import { createStorage } from './storage.mjs';
import { createApp } from './app.mjs';
const db = await openDatabase();
const app = createApp({ db, storage: createStorage() });
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => console.log(`WGOB station ready at http://localhost:${port}`));
async function stop() {
  server.close(async () => { app.locals.sessionStore.close(); await db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', stop); process.on('SIGINT', stop);
