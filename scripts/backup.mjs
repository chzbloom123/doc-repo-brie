import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { openDatabase } from '../server/db.mjs';
import { createStorage } from '../server/storage.mjs';
import { exportLibrary } from '../server/export.mjs';
export async function backup(db, storage, directory) {
  await fs.mkdir(directory, { recursive: false });
  await fs.mkdir(path.join(directory, 'media'));
  const data = await exportLibrary(db), checksums = {};
  for (const song of data.songs) for (const key of [song.audio_key, song.artwork_key].filter(Boolean)) {
    const bytes = await storage.read(key);
    await fs.writeFile(path.join(directory, 'media', key), bytes, { flag: 'wx' });
    checksums[key] = createHash('sha256').update(bytes).digest('hex');
  }
  // Manifest is written LAST: an interrupted backup has no complete manifest.
  await fs.writeFile(path.join(directory, 'library.json'), JSON.stringify({ ...data, checksums }, null, 2), { flag: 'wx' });
  return { songs: data.songs.length, playlists: data.playlists.length, directory };
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  await fs.mkdir('backups', { recursive: true });
  const target = path.resolve(process.argv[2] || `backups/wgob-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const db = await openDatabase();
  try { console.log(await backup(db, createStorage(), target)); } finally { await db.close(); }
}
