import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { openDatabase } from '../server/db.mjs';
import { createStorage } from '../server/storage.mjs';
import { createApp } from '../server/app.mjs';
import { hashPassword } from '../server/auth.mjs';
import { importStarter } from '../server/library.mjs';
import { backup } from '../scripts/backup.mjs';
import { restore } from '../scripts/restore.mjs';
import { ShuffleBag } from '../src/playback.mjs';

let db, storage, app, directory, editor, csrf, songs, collection, uploadId;
const origin = 'http://localhost:5173';
const write = (method, url, body) => editor[method](url).set('Origin', origin).set('X-CSRF-Token', csrf).send(body);
before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wgob-tests-'));
  db = await openDatabase({ url: '', directory }); storage = createStorage({ directory, bucket: '' });
  app = createApp({ db, storage, config: { SESSION_SECRET: 'test-only-session-secret-with-more-than-32-characters', EDITOR_USERNAME: 'brie', EDITOR_PASSWORD_HASH: await hashPassword('test-only-long-password'), PUBLIC_URL: origin } });
  editor = request.agent(app);
});
after(async () => { app.locals.sessionStore.close(); await db.close(); await fs.rm(directory, { recursive: true, force: true }); });

test('imports the thirteen supplied files as twelve unique songs, idempotently', async () => {
  const first = await importStarter(db, storage, path.resolve('starter-songs'));
  assert.equal(first.files, 13); assert.equal(first.imported, 12); assert.equal(first.duplicates, 1);
  const second = await importStarter(db, storage, path.resolve('starter-songs'));
  assert.equal(second.imported, 0); assert.equal(second.duplicates, 13);
  const response = await request(app).get('/api/catalog').expect(200);
  songs = response.body.songs; collection = response.body.playlists[0];
  assert.equal(songs.length, 12); assert.equal(response.body.playlists.length, 1);
  for (const song of songs) { assert.ok(song.duration > 1); assert.equal(song.note, ''); assert.ok(!('draft' in song)); assert.ok(!('audio_key' in song)); }
});
test('all starter MP3s support byte ranges for seeking', async () => {
  for (const song of songs) {
    const r = await request(app).get(song.audio).set('Range', 'bytes=0-1023').expect(206);
    assert.match(r.headers['content-range'], /^bytes 0-1023\//); assert.equal(r.headers['content-length'], '1024');
  }
  await request(app).get(songs[0].audio).set('Range', 'bytes=999999999-').expect(416);
});
test('public callers cannot read editor data or modify songs', async () => {
  await request(app).get('/api/editor/catalog').expect(401);
  await request(app).get('/api/editor/export').expect(401);
  await request(app).get('/api/editor/notebook').expect(401);
  await request(app).post('/api/editor/songs').set('Origin', origin).expect(401);
  await request(app).put(`/api/editor/songs/${songs[0].id}`).set('Origin', origin).send({ title: 'bad' }).expect(401);
});
test('login requires a valid origin, CSRF token, and password', async () => {
  csrf = (await editor.get('/api/session')).body.csrf;
  await editor.post('/api/login').set('Origin', 'https://evil.test').set('X-CSRF-Token', csrf).send({ username: 'brie', password: 'test-only-long-password' }).expect(403);
  await editor.post('/api/login').set('Origin', origin).send({ username: 'brie', password: 'test-only-long-password' }).expect(403);
  await write('post', '/api/login', { username: 'brie', password: 'wrong' }).expect(401);
  const r = await write('post', '/api/login', { username: 'brie', password: 'test-only-long-password' }).expect(200);
  assert.notEqual(r.body.csrf, csrf); csrf = r.body.csrf;
  assert.match(r.headers['set-cookie'][0], /HttpOnly/); assert.match(r.headers['set-cookie'][0], /SameSite=Strict/);
  await editor.get('/api/editor/catalog').expect(200);
});
test('draft notes stay private, publish preserves exact text, stale saves cannot overwrite', async () => {
  const song = (await editor.get('/api/editor/catalog')).body.songs[0];
  const draft = 'A test thought.\n\n  An intentional indent.\n<not HTML> & a last line. ';
  const body = { title: 'Edited test title', artist: 'Test credit', tags: 'test', draft, version: song.version };
  await editor.put(`/api/editor/songs/${song.id}`).set('Origin', origin).send(body).expect(403);
  const r = await write('put', `/api/editor/songs/${song.id}`, body).expect(200);
  assert.equal(r.body.draft, draft); assert.equal(r.body.published, '');
  const pub = (await request(app).get('/api/catalog')).body.songs.find(s => s.id === song.id);
  assert.equal(pub.note, ''); assert.equal(pub.title, body.title); assert.ok(!JSON.stringify(pub).includes('test thought'));
  await write('put', `/api/editor/songs/${song.id}`, { ...body, draft: 'stale' }).expect(409);
  const published = await write('post', `/api/editor/songs/${song.id}/publish`, { version: r.body.version }).expect(200);
  assert.equal(published.body.published, draft);
  const publicAfter = (await request(app).get('/api/catalog')).body.songs.find(s => s.id === song.id);
  assert.equal(publicAfter.note, draft);
  const revisions = (await editor.get(`/api/editor/songs/${song.id}/revisions`)).body;
  assert.equal(revisions.length, 2); assert.ok(revisions.some(r => r.content === ''));
});
test('real audio uploads stay private and invalid/duplicate uploads leave the library intact', async () => {
  const mp3 = await fs.readFile(path.resolve('starter-songs', 'Before They Name the Road.mp3'));
  const count = Number((await db.query('SELECT COUNT(*) AS n FROM songs'))[0].n);
  const dup = await editor.post('/api/editor/songs').set('Origin', origin).set('X-CSRF-Token', csrf).attach('audio', mp3, { filename: 'a different name.mp3', contentType: 'audio/mpeg' }).expect(200);
  assert.equal(dup.body.duplicate, true);
  await editor.post('/api/editor/songs').set('Origin', origin).set('X-CSRF-Token', csrf).attach('audio', Buffer.from('not an MP3'), { filename: 'fake.mp3', contentType: 'audio/mpeg' }).expect(400);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM songs'))[0].n), count);
  const unique = Buffer.concat([mp3, Buffer.alloc(32)]);
  const upload = await editor.post('/api/editor/songs').set('Origin', origin).set('X-CSRF-Token', csrf).attach('audio', unique, { filename: 'new test upload.mp3', contentType: 'audio/mpeg' }).expect(201);
  uploadId = upload.body.song.id;
  await request(app).get(`/api/media/${uploadId}/audio`).expect(404);
  await editor.get(`/api/media/${uploadId}/audio`).set('Range', 'bytes=0-99').expect(206);
  assert.ok(!(await request(app).get('/api/catalog')).body.songs.some(s => s.id === uploadId));
});
test('draft collections preview privately, publish in order, remove membership without deleting audio', async () => {
  const draft = { name: 'A test collection', description: 'Private until published', status: 'draft', songIds: [songs[1].id, uploadId, songs[0].id] };
  const created = (await write('post', '/api/editor/playlists', draft).expect(201)).body;
  assert.ok(!(await request(app).get('/api/catalog')).body.playlists.some(p => p.id === created.id));
  const reordered = [uploadId, songs[0].id, songs[1].id];
  const pub = (await write('put', `/api/editor/playlists/${created.id}`, { ...draft, songIds: reordered, status: 'published', version: created.version }).expect(200)).body;
  assert.deepEqual((await request(app).get('/api/catalog')).body.playlists.find(p => p.id === pub.id).songIds, reordered);
  await request(app).get(`/api/media/${uploadId}/audio`).set('Range', 'bytes=0-99').expect(206);
  await write('put', `/api/editor/playlists/${created.id}`, { ...draft, songIds: [songs[0].id], version: pub.version }).expect(200);
  await request(app).get(`/api/media/${uploadId}/audio`).expect(404);
  assert.ok((await editor.get('/api/editor/catalog')).body.songs.some(s => s.id === uploadId));
  // Invalid save rolls back the entire collection, including its previous running order.
  const current = (await editor.get('/api/editor/catalog')).body.playlists.find(p => p.id === pub.id);
  await write('put', `/api/editor/playlists/${pub.id}`, { ...draft, version: current.version, songIds: ['00000000-0000-4000-8000-000000000000'] }).expect(400);
  assert.deepEqual((await editor.get('/api/editor/catalog')).body.playlists.find(p => p.id === pub.id).songIds, [songs[0].id]);
});
test('archive hides audio and catalog entries; restore recovers notes and memberships', async () => {
  const original = (await editor.get('/api/editor/catalog')).body.songs.find(s => s.id === songs[0].id);
  const archived = (await write('post', `/api/editor/songs/${original.id}/archive`, { version: original.version, archived: true }).expect(200)).body;
  assert.ok(!(await request(app).get('/api/catalog')).body.songs.some(s => s.id === original.id));
  await request(app).get(original.audio).expect(404);
  assert.ok((await editor.get('/api/editor/catalog')).body.playlists.find(p => p.id === collection.id).songIds.includes(original.id));
  const restored = (await write('post', `/api/editor/songs/${original.id}/archive`, { version: archived.version, archived: false }).expect(200)).body;
  assert.equal(restored.published, original.published); assert.equal(restored.draft, original.draft);
  await request(app).get(original.audio).set('Range', 'bytes=0-99').expect(206);
});
test('notebook is private, exportable, and protected against stale saves', async () => {
  const first = await write('put', '/api/editor/notebook', { content: 'Secret notebook\nA second line.', version: 0 }).expect(200);
  await write('put', '/api/editor/notebook', { content: 'stale', version: 0 }).expect(409);
  const output = (await editor.get('/api/editor/export').expect(200)).body;
  assert.equal(output.notebooks[0].content, first.body.content);
  assert.ok(!('sessions' in output)); assert.ok(!JSON.stringify((await request(app).get('/api/catalog')).body).includes('Secret notebook'));
});
test('shuffle completes every cycle before repeating, handles removal and one-track lists', () => {
  const bag = new ShuffleBag(() => 0.4); const ids = ['a','b','c','d']; bag.reset('a');
  const picks = ['a']; let current = 'a';
  for (let i = 0; i < 3; i++) { current = bag.next(ids, current); picks.push(current); }
  assert.equal(new Set(picks).size, 4); assert.notEqual(bag.next(ids, current), current);
  assert.equal(bag.next(['x'], 'x'), 'x'); assert.equal(bag.next([], 'x'), null);
  assert.ok(['a','b'].includes(bag.next(['a','b'], 'a')));
});
test('backup/restore preserves media, notes, history, notebook, order; rejects restoring over live data', async () => {
  const backupDir = path.join(directory, 'backup');
  await backup(db, storage, backupDir);
  const restoreDir = path.join(directory, 'restored');
  const second = await openDatabase({ url: '', directory: restoreDir });
  const secondStorage = createStorage({ directory: restoreDir, bucket: '' });
  try {
    const result = await restore(second, secondStorage, backupDir); assert.equal(result.songs, 13);
    for (const table of ['songs','playlists','playlist_songs','note_revisions','notebooks']) assert.deepEqual(await second.query(`SELECT * FROM ${table} ORDER BY 1`), await db.query(`SELECT * FROM ${table} ORDER BY 1`));
    const song = (await second.query('SELECT * FROM songs LIMIT 1'))[0];
    assert.deepEqual(await secondStorage.read(song.audio_key), await storage.read(song.audio_key));
    await assert.rejects(() => restore(second, secondStorage, backupDir), /fresh, empty/);
  } finally { await second.close(); }
  const reopened = await openDatabase({ url: '', directory: restoreDir });
  assert.equal(Number((await reopened.query('SELECT COUNT(*) AS n FROM songs'))[0].n), 13); await reopened.close();
});
test('logout invalidates the editorial session', async () => {
  await write('post', '/api/logout', {}).expect(200);
  await editor.get('/api/editor/catalog').expect(401);
});
