import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { parseBuffer } from 'music-metadata';
import { fileTypeFromBuffer } from 'file-type';
export const now = () => new Date().toISOString();
export const publicSong = s => ({ id: s.id, title: s.title, artist: s.artist, tags: s.tags, duration: s.duration, note: s.note_published, artwork: s.artwork_key ? `/api/media/${s.id}/artwork` : null, audio: `/api/media/${s.id}/audio` });
export const editorSong = s => ({ ...publicSong(s), archived: !!s.archived, draft: s.note_draft, published: s.note_published, version: s.version, updatedAt: s.updated_at, sourceName: s.source_name });
export async function inspectMp3(buffer) {
  const type = await fileTypeFromBuffer(buffer).catch(() => null);
  if (type?.mime !== 'audio/mpeg') throw Object.assign(new Error('Please choose a real MP3 audio file.'), { status: 400 });
  const metadata = await parseBuffer(buffer, { mimeType: 'audio/mpeg' }, { duration: true }).catch(() => null);
  if (!metadata?.format?.duration || !Number.isFinite(metadata.format.duration) || metadata.format.duration < 1 || !/MPEG/.test(metadata.format.container || '')) throw Object.assign(new Error('This MP3 could not be read. Please export it again and retry.'), { status: 400 });
  return metadata;
}
export async function addAudio(db, storage, buffer, originalName, title) {
  const metadata = await inspectMp3(buffer);
  const fingerprint = createHash('sha256').update(buffer).digest('hex');
  const existing = (await db.query('SELECT * FROM songs WHERE fingerprint = ?', [fingerprint]))[0];
  if (existing) return { song: editorSong(existing), duplicate: true };
  const id = randomUUID();
  const audioKey = `${id}.mp3`;
  let artworkKey = null;
  const written = [];
  try {
    await storage.put(audioKey, buffer, 'audio/mpeg'); written.push(audioKey);
    const picture = metadata.common.picture?.[0];
    if (picture && picture.data.length <= 5 * 1024 * 1024) {
      const type = await fileTypeFromBuffer(picture.data).catch(() => null);
      if (['image/png', 'image/jpeg', 'image/webp'].includes(type?.mime)) {
        artworkKey = `${id}.${type.ext}`;
        await storage.put(artworkKey, picture.data, type.mime); written.push(artworkKey);
      }
    }
    const displayTitle = (title || metadata.common.title || path.basename(originalName, path.extname(originalName))).trim().slice(0, 200) || 'Untitled';
    const date = now();
    await db.query('INSERT INTO songs (id, fingerprint, title, artist, source_name, audio_key, artwork_key, duration, bytes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, fingerprint, displayTitle, (metadata.common.artist || '').slice(0, 200), path.basename(originalName).slice(0, 255), audioKey, artworkKey, metadata.format.duration, buffer.length, date, date]);
    return { song: editorSong((await db.query('SELECT * FROM songs WHERE id = ?', [id]))[0]), duplicate: false };
  } catch (error) {
    for (const key of written) await storage.remove(key).catch(() => console.error('Unreferenced media needs cleanup:', key));
    // A concurrent import may have inserted the same fingerprint first.
    const raced = (await db.query('SELECT * FROM songs WHERE fingerprint = ?', [fingerprint]))[0];
    if (raced) return { song: editorSong(raced), duplicate: true };
    throw error;
  }
}
export async function catalog(db, editor = false) {
  const songs = await db.query(editor ? 'SELECT * FROM songs ORDER BY created_at, title' : "SELECT DISTINCT s.* FROM songs s JOIN playlist_songs ps ON s.id = ps.song_id JOIN playlists p ON ps.playlist_id = p.id WHERE s.archived = 0 AND p.status = 'published' ORDER BY s.created_at, s.title");
  const playlists = await db.query(editor ? 'SELECT * FROM playlists ORDER BY created_at' : "SELECT * FROM playlists WHERE status = 'published' ORDER BY created_at");
  const members = await db.query('SELECT * FROM playlist_songs ORDER BY position');
  const visible = new Set(songs.map(s => s.id));
  return { songs: songs.map(editor ? editorSong : publicSong), playlists: playlists.map(p => ({ id: p.id, name: p.name, description: p.description, ...(editor ? { status: p.status, version: p.version } : {}), songIds: members.filter(m => m.playlist_id === p.id && visible.has(m.song_id)).map(m => m.song_id) })) };
}
export async function importStarter(db, storage, folder) {
  const files = (await fs.readdir(folder)).filter(f => f.toLowerCase().endsWith('.mp3')).sort();
  let imported = 0, duplicates = 0; const ids = [];
  for (const name of files) {
    const result = await addAudio(db, storage, await fs.readFile(path.join(folder, name)), name);
    result.duplicate ? duplicates++ : imported++;
    if (!ids.includes(result.song.id)) ids.push(result.song.id);
  }
  // A marker prevents a later re-import from undoing Brie's edits or archive choices.
  await db.transaction(async tx => {
    if ((await tx.query('SELECT name FROM imports WHERE name = ?', ['starter-v1'])).length) return;
    if (ids.length) {
      const date = now(), id = randomUUID();
      await tx.query('INSERT INTO playlists (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, 'The lamplight collection', 'The first songs in the drawer. A little company for wherever the evening finds you.', 'published', date, date]);
      for (let i = 0; i < ids.length; i++) await tx.query('INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)', [id, ids[i], i]);
      await tx.query('INSERT INTO imports (name, completed_at) VALUES (?, ?)', ['starter-v1', date]);
    }
  });
  return { files: files.length, imported, duplicates, uniqueSongs: ids.length };
}
