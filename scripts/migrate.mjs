import { openDatabase } from '../server/db.mjs';
const db = await openDatabase();
console.log(`Migrations applied (${db.kind}).`);
await db.close();
