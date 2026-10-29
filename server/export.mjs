import { now } from './library.mjs';
export async function exportLibrary(db) {
  return db.transaction(async tx => {
    if (db.kind === 'postgres') await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    return { format: 1, exportedAt: now(), songs: await tx.query('SELECT * FROM songs'), playlists: await tx.query('SELECT * FROM playlists'), memberships: await tx.query('SELECT * FROM playlist_songs'), revisions: await tx.query('SELECT * FROM note_revisions'), notebooks: await tx.query('SELECT * FROM notebooks'), imports: await tx.query('SELECT * FROM imports') };
  });
}
