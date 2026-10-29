import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';
import { DatabaseSessionStore, requireEditor, csrfProtection, verifyPassword } from './auth.mjs';
import { addAudio, catalog, editorSong, now } from './library.mjs';
import { exportLibrary } from './export.mjs';

const songInput = z.object({ title: z.string().trim().min(1).max(200), artist: z.string().max(200), tags: z.string().max(300), draft: z.string().max(12000), version: z.number().int().positive() }).strict();
const playlistInput = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(1000), status: z.enum(['draft','published','archived']), songIds: z.array(z.string().uuid()).max(1000).refine(a => new Set(a).size === a.length, 'A song can appear only once in a playlist.'), version: z.number().int().positive().optional() }).strict();
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const assertVersion = (row, version) => { if (!row) fail(404, 'This item no longer exists.'); if (row.version !== version) fail(409, 'This item changed in another tab. Your unsaved text is still here; copy it before reloading.'); };
async function getSong(db, id) { return (await db.query('SELECT * FROM songs WHERE id = ?', [id]))[0]; }

export function createApp({ db, storage, config = process.env, staticDir = path.resolve('dist') }) {
  const app = express();
  const production = config.NODE_ENV === 'production';
  if (!config.SESSION_SECRET || config.SESSION_SECRET.length < 32 || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(config.EDITOR_PASSWORD_HASH || '')) throw new Error('Run npm run setup or configure SESSION_SECRET and a valid EDITOR_PASSWORD_HASH.');
  if (production && (!config.PUBLIC_URL?.startsWith('https://') || db.kind !== 'postgres' || storage.kind !== 's3')) throw new Error('Production requires HTTPS PUBLIC_URL, PostgreSQL DATABASE_URL and private S3 storage.');
  app.disable('x-powered-by');
  if (config.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: production ? { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'https:'], mediaSrc: ["'self'", 'https:'], connectSrc: ["'self'"], fontSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: [],
  } } : false, strictTransportSecurity: production ? undefined : false }));
  app.use(express.json({ limit: '100kb' }));
  const sessionStore = new DatabaseSessionStore(db);
  app.locals.sessionStore = sessionStore;
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(session({ name: 'wgob.sid', store: sessionStore, secret: config.SESSION_SECRET, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', secure: production, maxAge: 12 * 60 * 60 * 1000 },
  }));
  const allowedOrigins = new Set([config.PUBLIC_URL]);
  if (!production) for (const host of ['localhost','127.0.0.1']) for (const port of [5173,3001]) allowedOrigins.add(`http://${host}:${port}`);
  app.use('/api', (req, res, next) => {
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && !allowedOrigins.has(req.get('Origin'))) return res.status(403).json({ error: 'Request origin is not allowed.' });
    next();
  });
  app.get('/api/health', async (req, res) => { await db.query('SELECT 1'); res.json({ ok: true }); });
  app.get('/api/catalog', async (req, res) => res.json(await catalog(db)));
  app.get('/api/session', (req, res) => {
    if (!req.session.csrf) req.session.csrf = randomBytes(32).toString('hex');
    res.json({ authenticated: !!req.session.editor, username: req.session.editor || null, csrf: req.session.csrf });
  });
  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, skipSuccessfulRequests: true, message: { error: 'Too many sign-in attempts. Please wait 15 minutes.' } });
  app.post('/api/login', loginLimit, csrfProtection, async (req, res, next) => {
    const credentials = z.object({ username: z.string().max(100), password: z.string().min(1).max(500) }).parse(req.body);
    const valid = await verifyPassword(credentials.password, config.EDITOR_PASSWORD_HASH);
    if (credentials.username !== (config.EDITOR_USERNAME || 'brie') || !valid) return res.status(401).json({ error: 'The name or password was not recognized.' });
    req.session.regenerate(error => {
      if (error) return next(error);
      req.session.editor = credentials.username; req.session.csrf = randomBytes(32).toString('hex');
      req.session.save(error => error ? next(error) : res.json({ authenticated: true, username: credentials.username, csrf: req.session.csrf }));
    });
  });
  app.post('/api/logout', requireEditor, csrfProtection, (req, res, next) => req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('wgob.sid', { httpOnly: true, sameSite: 'strict', secure: production }); res.json({ ok: true });
  }));
  app.get('/api/media/:id/:kind', async (req, res) => {
    if (!['audio','artwork'].includes(req.params.kind)) return res.sendStatus(404);
    const song = await getSong(db, req.params.id);
    if (!song) return res.sendStatus(404);
    if (!req.session.editor) {
      const published = await db.query("SELECT p.id FROM playlists p JOIN playlist_songs ps ON p.id = ps.playlist_id WHERE ps.song_id = ? AND p.status = 'published'", [song.id]);
      if (song.archived || !published.length) return res.sendStatus(404);
    }
    const key = req.params.kind === 'audio' ? song.audio_key : song.artwork_key;
    if (!key) return res.sendStatus(404);
    await storage.serve(key, req, res);
  });
  app.use('/api/editor', requireEditor, (req, res, next) => ['GET','HEAD'].includes(req.method) ? next() : csrfProtection(req, res, next));
  app.get('/api/editor/catalog', async (req, res) => res.json(await catalog(db, true)));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 1, fields: 1 } });
  const uploadLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Upload limit reached. Please try again later.' } });
  app.post('/api/editor/songs', uploadLimit, upload.single('audio'), async (req, res) => {
    if (!req.file) fail(400, 'Choose an MP3 to upload.');
    const title = z.string().trim().max(200).optional().parse(req.body.title);
    const result = await addAudio(db, storage, req.file.buffer, req.file.originalname, title);
    res.status(result.duplicate ? 200 : 201).json(result);
  });
  app.put('/api/editor/songs/:id', async (req, res) => {
    const input = songInput.parse(req.body);
    await db.transaction(async tx => {
      const row = await lockedSong(tx, db, req.params.id); assertVersion(row, input.version);
      await tx.query('UPDATE songs SET title = ?, artist = ?, tags = ?, note_draft = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?', [input.title, input.artist, input.tags, input.draft, now(), row.id, input.version]);
    });
    res.json(editorSong(await getSong(db, req.params.id)));
  });
  app.post('/api/editor/songs/:id/publish', async (req, res) => {
    const { version } = z.object({ version: z.number().int().positive() }).strict().parse(req.body);
    await db.transaction(async tx => {
      const row = await lockedSong(tx, db, req.params.id); assertVersion(row, version);
      const revisions = await tx.query('SELECT id FROM note_revisions WHERE song_id = ?', [row.id]);
      if (!revisions.length) await tx.query('INSERT INTO note_revisions (id, song_id, content, created_at) VALUES (?, ?, ?, ?)', [randomUUID(), row.id, row.note_published, now()]);
      await tx.query('INSERT INTO note_revisions (id, song_id, content, created_at) VALUES (?, ?, ?, ?)', [randomUUID(), row.id, row.note_draft, now()]);
      await tx.query('UPDATE songs SET note_published = note_draft, version = version + 1, updated_at = ? WHERE id = ?', [now(), row.id]);
      const history = await tx.query('SELECT id FROM note_revisions WHERE song_id = ? ORDER BY created_at DESC', [row.id]);
      for (const old of history.slice(20)) await tx.query('DELETE FROM note_revisions WHERE id = ?', [old.id]);
    });
    res.json(editorSong(await getSong(db, req.params.id)));
  });
  app.get('/api/editor/songs/:id/revisions', async (req, res) => res.json(await db.query('SELECT id, content, created_at FROM note_revisions WHERE song_id = ? ORDER BY created_at DESC', [req.params.id])));
  app.post('/api/editor/songs/:id/archive', async (req, res) => {
    const { archived, version } = z.object({ archived: z.boolean(), version: z.number().int().positive() }).strict().parse(req.body);
    await db.transaction(async tx => {
      const row = await lockedSong(tx, db, req.params.id); assertVersion(row, version);
      await tx.query('UPDATE songs SET archived = ?, version = version + 1, updated_at = ? WHERE id = ?', [archived ? 1 : 0, now(), row.id]);
    });
    res.json(editorSong(await getSong(db, req.params.id)));
  });
  const savePlaylist = async (req, res) => {
    const input = playlistInput.parse(req.body), id = req.params.id || randomUUID();
    await db.transaction(async tx => {
      const date = now();
      if (req.params.id) {
        const row = (await tx.query(`SELECT * FROM playlists WHERE id = ?${db.kind === 'postgres' ? ' FOR UPDATE' : ''}`, [id]))[0];
        assertVersion(row, input.version);
      }
      for (const songId of input.songIds) if (!(await getSong(tx, songId))) fail(400, 'One of the selected songs no longer exists.');
      if (req.params.id) await tx.query('UPDATE playlists SET name = ?, description = ?, status = ?, version = version + 1, updated_at = ? WHERE id = ?', [input.name, input.description, input.status, date, id]);
      else await tx.query('INSERT INTO playlists (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, input.name, input.description, input.status, date, date]);
      await tx.query('DELETE FROM playlist_songs WHERE playlist_id = ?', [id]);
      for (let i = 0; i < input.songIds.length; i++) await tx.query('INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)', [id, input.songIds[i], i]);
    });
    res.status(req.params.id ? 200 : 201).json((await catalog(db, true)).playlists.find(p => p.id === id));
  };
  app.post('/api/editor/playlists', savePlaylist);
  app.put('/api/editor/playlists/:id', savePlaylist);
  app.get('/api/editor/notebook', async (req, res) => {
    const row = (await db.query('SELECT * FROM notebooks WHERE id = ?', ['brie']))[0];
    res.json(row || { content: '', version: 0 });
  });
  app.put('/api/editor/notebook', async (req, res) => {
    const input = z.object({ content: z.string().max(100000), version: z.number().int().nonnegative() }).strict().parse(req.body);
    await db.transaction(async tx => {
      // Initialize before locking, so simultaneous first saves are also serialized by the unique key.
      await tx.query('INSERT INTO notebooks (id, content, version, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING', ['brie', '', 0, now()]);
      const row = (await tx.query(`SELECT * FROM notebooks WHERE id = ?${db.kind === 'postgres' ? ' FOR UPDATE' : ''}`, ['brie']))[0];
      assertVersion(row, input.version);
      await tx.query('UPDATE notebooks SET content = ?, version = version + 1, updated_at = ? WHERE id = ?', [input.content, now(), 'brie']);
    });
    res.json((await db.query('SELECT * FROM notebooks WHERE id = ?', ['brie']))[0]);
  });
  app.get('/api/editor/export', async (req, res) => {
    const data = await exportLibrary(db);
    res.set('Content-Disposition', 'attachment; filename="wgob-writing-and-library.json"').json(data);
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'That station endpoint does not exist.' }));
  app.use(express.static(staticDir));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' · ') });
    if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'That file is too large. MP3 uploads can be up to 30 MB.' : 'Upload failed. Choose one MP3 and try again.' });
    if (!error.status || error.status >= 500) console.error(error);
    res.status(error.status || 500).json({ error: error.status && error.status < 500 ? error.message : 'The station could not save that change. Your previous work is safe. Please try again.' });
  });
  return app;
}

async function lockedSong(tx, db, id) {
  return (await tx.query(`SELECT * FROM songs WHERE id = ?${db.kind === 'postgres' ? ' FOR UPDATE' : ''}`, [id]))[0];
}
