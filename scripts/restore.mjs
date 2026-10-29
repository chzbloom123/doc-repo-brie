import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { openDatabase } from '../server/db.mjs';
import { createStorage } from '../server/storage.mjs';

const columns = {
  songs: ['id','fingerprint','title','artist','tags','source_name','audio_key','artwork_key','duration','bytes','archived','note_draft','note_published','version','created_at','updated_at'],
  playlists: ['id','name','description','status','version','created_at','updated_at'],
  playlist_songs: ['playlist_id','song_id','position'],
  note_revisions: ['id','song_id','content','created_at'],
  notebooks: ['id','content','version','updated_at'],
  imports: ['name','completed_at'],
};
export async function restore(db, storage, directory) {
  const data = JSON.parse(await fs.readFile(path.join(directory, 'library.json'), 'utf8'));
  if (data.format !== 1 || !data.checksums || !Array.isArray(data.songs)) throw new Error('Unsupported or incomplete backup.');
  for (const table of Object.keys(columns)) if (Number((await db.query(`SELECT COUNT(*) AS n FROM ${table}`))[0].n)) throw new Error('Restore requires a fresh, empty database. Existing content was not changed.');
  const files = [];
  for (const song of data.songs) for (const key of [song.audio_key, song.artwork_key].filter(Boolean)) {
    if (!/^[a-zA-Z0-9-]+\.(mp3|jpg|png|webp)$/.test(key)) throw new Error('Invalid media key in backup.');
    const buffer = await fs.readFile(path.join(directory, 'media', key));
    const hash = createHash('sha256').update(buffer).digest('hex');
    if (hash !== data.checksums[key] || (key === song.audio_key && hash !== song.fingerprint)) throw new Error(`Backup integrity check failed: ${key}`);
    files.push({ key, buffer });
  }
  const written = [];
  try {
    for (const { key, buffer } of files) {
      const mime = key.endsWith('.mp3') ? 'audio/mpeg' : key.endsWith('.jpg') ? 'image/jpeg' : key.endsWith('.webp') ? 'image/webp' : 'image/png';
      await storage.put(key, buffer, mime); written.push(key);
    }
    await db.transaction(async tx => {
      for (const [table, cols] of Object.entries(columns)) {
        const records = data[{ playlist_songs: 'memberships', note_revisions: 'revisions' }[table] || table] || [];
        for (const row of records) await tx.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map(c => row[c] ?? null));
      }
    });
  } catch (e) {
    for (const key of written) await storage.remove(key).catch(() => console.error('Restore left unreferenced media:', key));
    throw e;
  }
  return { songs: data.songs.length, playlists: data.playlists.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  if (!process.argv[2]) throw new Error('Usage: npm run restore -- path/to/backup (fresh database and media store only)');
  const db = await openDatabase();
  try { console.log(await restore(db, createStorage(), path.resolve(process.argv[2]))); } finally { await db.close(); }
}
