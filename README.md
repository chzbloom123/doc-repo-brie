# WGOB · Dark O’Clock Radio

A small radio station from Goblin’s Reach. Mibble hosts, Thorie supervises, and Brie writes the notes. This is a separate application from V1; nothing from the original site is edited or deployed.

Source repository: [chzbloom123/doc-repo-brie](https://github.com/chzbloom123/doc-repo-brie).

## Open it locally

Requires **Node.js 24 LTS or newer** and npm. From this folder:

```sh
npm ci
npm run setup
npm run dev
```

Open **http://127.0.0.1:5173/**. The writing room is **http://127.0.0.1:5173/#studio**.

`setup` generates a random local password, stores its scrypt hash in `.env`, creates a local SQLite database, and imports `starter-songs/`. Your local login is in **`.local-access.txt`**. Both files are excluded from Git and Docker. Keep them private. Re-running setup keeps the existing credentials and content.

A fresh GitHub clone contains no music or private editorial data. Setup creates an empty `starter-songs/` folder if needed and starts an empty station. Upload MP3s through the writing room, supply your authorized files in that folder and run `npm run import`, or restore a complete private backup. Original creative briefs, world/character notes, and inspiration images also stay outside the repository; the finished application artwork is included.

The frontend runs on 5173 and proxies `/api` to the server on 3001. Both bind to loopback in development. Stop both with Ctrl+C. `npm run build` builds the frontend; `npm start` serves that build and the API together on http://localhost:3001. Production uses Railway's supplied `PORT` and binds to `0.0.0.0`.

## What you can do

- Listen without signing in: switch collections, choose tracks, pause, seek, skip, adjust volume, play in order, shuffle, or stop after one song. Player settings also appear above the drawer on phones. The browser/phone's own media controls work where supported.
- Heart a song to keep it on this browser. Favorites, volume, order mode and selected collection stay in local storage. Playback never starts automatically on a fresh visit.
- Sign into the writing room. **Upload MP3** accepts one real MP3 up to 30 MB and shows progress. Songs remain unlisted until placed in a published collection. Duplicate audio is recognized by its SHA-256 hash, even with a different filename.
- Open a song to edit its title, credit, comma-separated tags, and Mibble's note. Embedded JPEG, PNG or WebP album art is imported automatically (up to 5 MB). Custom artwork replacement is not part of this first release.
- **Save draft & details** saves the title/credit/tags immediately and saves a private note draft. **Preview draft** uses the same note presentation as listeners. **Publish note** explicitly publishes the exact text, including whitespace and line breaks. Empty notes are valid. Twenty published revisions are retained; restore one into the draft before republishing.
- Create collections, add existing songs, drag to reorder or use the up/down buttons. Preview and listen before publishing. Collections can be draft, published, or archived. Saving a currently published collection updates its order immediately; choose **Unpublish & save draft** to withdraw it while experimenting. This first release does not keep parallel draft/published playlist versions.
- Removing a song from a collection only removes that membership. Archiving a song hides it everywhere while keeping its audio, metadata, drafts, history and memberships. Restore it from the library's **Archived** shelf. Restoring a song makes it public again if it belongs to a published collection. Archived collections can be opened and saved as draft or published again.
- Mibble's notebook is always private. It has explicit save and text export. Switching writing-room tabs keeps unsaved notebook text; navigation/reload warns before leaving unsaved work. Nothing in the app generates or rewrites Brie's prose.
- There is an unnecessary red button. Thorie may have opinions about it.

### Importing and naming

```sh
npm run import
npm run import -- /absolute/path/to/mp3-folder
```

The thirteen supplied files contain **twelve unique recordings**: both `Leave it in the dark (mashup)` files have the same hash. Their shared recording appears once. Original files are untouched. Internal media keys are UUIDs; file names and titles never form storage paths. Embedded titles and credits are used as supplied and remain editable, including take suffixes that may be artistically meaningful. No Mibble notes were invented for imported songs.

The first successful import creates “The lamplight collection.” Later imports add new files to the library and never reset existing playlists, archive status or edited titles. A `starter-v1` marker prevents repeated playlist creation. Add later imports to collections in the editor.

### While someone is listening

The catalog refreshes every minute and on window focus. Changing the selected collection only changes the drawer; click a song or **Come on in** to change playback. An already playing audio element is preserved during catalog refreshes. Next-track selection uses the latest published running order. If the playing track was removed, next starts at the first remaining track. If its collection was withdrawn, playback finishes the current song and next asks the listener to pick another collection. A later seek to an archived track may fail once a new request is needed; new media requests always enforce current visibility.

Shuffle keeps a bag of unplayed tracks and avoids repeating until the cycle completes. A new cycle avoids immediately repeating the last song. Selecting a song manually starts a new cycle from that song. A one-song collection can repeat in collection/shuffle modes; “Just one song” stops after it. Previous restarts the track after three seconds; otherwise it returns through recent listening history or the preceding collection entry. Entering the writing room pauses the public player so editorial previews do not overlap it.

## Where things live

| Piece | Location |
| --- | --- |
| React listening room | `src/App.jsx`, `src/components.jsx`, `src/styles.css` |
| Native HTML audio and shuffle | `src/usePlayer.js`, `src/playback.mjs` |
| Private writing room | `src/Studio.jsx` |
| Express routes, validation and authorization | `server/app.mjs` |
| Database adapter and migrations | `server/db.mjs`, `server/migrations/001_initial.sql` |
| Password hashing and database sessions | `server/auth.mjs` |
| MP3 validation, catalog, idempotent importer | `server/library.mjs` |
| Local/private S3 media adapter | `server/storage.mjs` |
| Local persistent state | `data/radio.sqlite` and `data/media/` |
| Published character scene and favicon | `public/` |
| Art provenance and prompt | `docs/art-direction.md` |
| Tests and walkthrough | `tests/radio.test.mjs`, `docs/verification.md` |

Local development uses Node's built-in SQLite engine with WAL and foreign keys. Production uses PostgreSQL through `pg`. Both run the same versioned SQL migrations, applied transactionally at startup or through `npm run migrate`. SQLite requests are serialized around transactions; PostgreSQL editing operations lock rows. Version numbers reject conflicting edits instead of overwriting another tab's work.

## Railway deployment, when you are ready

The source repository is [chzbloom123/doc-repo-brie](https://github.com/chzbloom123/doc-repo-brie). No Railway service has been deployed yet; local iteration can continue independently of GitHub.

The intended production shape is **one Railway web service serving the frontend and API**, plus **PostgreSQL** and a **private Railway Bucket**. Keeping the frontend and backend on one origin simplifies secure cookies, CSRF, audio delivery, and maintenance. There is no requirement for separate frontend/backend deployments.

1. Use the existing GitHub repository for the source, lockfile, Dockerfile, migrations, generated public art and docs. `.gitignore` excludes credentials, private creative references, original inspiration assets, starter MP3s, runtime data and backups. Check the staged file list before each push. Never commit `.env`, `.local-access.txt` or `data/`.
2. Create a Railway project and add PostgreSQL and a Bucket. Create a service from the repository. `railway.json` selects the Dockerfile and `/api/health` check. Use a **single web replica** initially: the login/upload rate limit counters are intentionally process-local. Multiple replicas would require shared rate-limit storage.
3. Configure the variables below on the web service, using Railway references for the database and Bucket credentials. The Bucket's real S3 name may differ from its display name. Copy the values actually shown in Railway. Its endpoint uses **virtual-hosted URLs**, so `forcePathStyle` is false. Do not make the Bucket public.
4. Generate a fresh production session secret and editor password hash. Do not reuse the local password. `node scripts/password.mjs` reads a password of at least 16 characters from stdin and outputs a scrypt hash; keep the password out of shell arguments/history. A password manager or a protected script can supply stdin. Store the hash in `EDITOR_PASSWORD_HASH`, and the secret in Railway's variables. Keep only the password in your password manager.
5. Set a generated Railway HTTPS domain (or custom domain) as `PUBLIC_URL`, with no trailing slash, and set `TRUST_PROXY=1`. Deploy. Startup refuses production if HTTPS, PostgreSQL, S3 storage or credentials are missing. The Docker image contains no starter songs and no writable media state.
6. To bring the **entire local library and writing** across, make a complete backup locally, then restore it to the fresh production database and Bucket using the backup workflow below. Run the restore from a trusted machine with temporary production variables and a reachable PostgreSQL URL. Railway private networking URLs are only reachable inside the Railway project; from your machine use its TCP proxy URL. This is a one-time transfer and needs no audio files in Git. Alternatively upload new songs through the deployed writing room, or run the idempotent importer with production credentials if you want only the original music and no local edits.
7. Enable Railway PostgreSQL backups and verify a restore. Back up Bucket media separately. Check uploads, playback seeking, login, note publishing, and a restart on the live service before sharing the public URL.

### Environment variables

| Name | Purpose |
| --- | --- |
| `NODE_ENV` | `production` in Docker/Railway; omitted locally |
| `PORT` | Railway injects this; local default 3001 |
| `PUBLIC_URL` | Exact browser origin; HTTPS in production |
| `SESSION_SECRET` | Random secret, at least 32 characters; recommend 48 random bytes as hex |
| `EDITOR_USERNAME` | Single editor name, default `brie` |
| `EDITOR_PASSWORD_HASH` | `scrypt:salt:hash`, generated by the password script |
| `TRUST_PROXY` | `1` behind Railway's trusted proxy; `0` locally |
| `DATABASE_URL` | PostgreSQL connection string; omitted for local SQLite |
| `DATA_DIR` | Local SQLite/media directory, default `./data` |
| `S3_ENDPOINT` | Railway Bucket S3 endpoint |
| `S3_REGION` | Bucket region value supplied by Railway, default `auto` |
| `S3_BUCKET` | Actual Bucket name |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Server-only Bucket credentials |

S3 audio is streamed through the authenticated visibility-checking media endpoint, including HTTP byte ranges. This keeps long listening sessions and later seeks from running into expired presigned URLs, and avoids browser CORS setup. It adds web-service egress: the station is designed for a small audience, not a high-traffic CDN. No full media file is buffered by the serving path. Local files use Express `sendFile` with range support.

### Security and boundaries

Every write and editor read requires a server-side session. Cookies are HTTP-only, SameSite Strict, and Secure in production. Login regenerates the session ID. Mutation routes validate both origin and a per-session CSRF token, including login. Login attempts and uploads are rate limited. Zod validates field lengths and allowed states; Multer bounds uploads, and file signatures plus MPEG metadata validate MP3 content. The public catalog excludes private drafts, notebook data, raw storage keys and unpublished media. React renders notes as plain text. Uploaded media is never in the public static folder.

Passwords are hashed with scrypt (N=32768, r=8, p=1, random salt); only a hash is configured on the server. Sessions expire after 12 hours of inactivity and are stored in the database, surviving restarts. Logout destroys the session. There is one configured editor, no password-recovery email flow, and no public account creation. Changing `SESSION_SECRET` invalidates all sessions; change it when rotating credentials or responding to a compromise. A second editor account is future work, not an implied multiuser system.

An upload saves durable media before inserting metadata. Failed inserts trigger media cleanup. A process crash in that small window can leave an unreferenced media object; it cannot create a broken public song. Compare Bucket keys to `songs.audio_key` and `songs.artwork_key` during maintenance before deleting any unreferenced object. No normal UI permanently deletes songs or collections. “Archive” is reversible.

## Back up and restore

**Metadata export** in the writing room downloads titles, credits, notes, revisions, collections, ordering and the notebook. It excludes credentials and sessions. It does **not** include audio and is not a complete backup on its own.

**Complete portable backup:**

```sh
npm run backup
# or supply a new, non-existing destination directory
npm run backup -- backups/my-station-backup
```

This takes a transactional metadata snapshot, copies every referenced audio/artwork object from local storage or S3, and writes `library.json` last with SHA-256 checksums. An interrupted folder without `library.json` is incomplete. The folder contains unpublished drafts and music: keep it private, encrypted where appropriate, and outside the service/container. Keep at least one independent copy. Pause editing during backups for the clearest recovery point.

**Restore into a fresh destination only:**

1. Stop writes. Retain the current database and media as a rollback copy; do not delete them.
2. Point `DATABASE_URL` and S3 variables at a fresh empty database/Bucket, or point `DATA_DIR` at a new local folder. Migrations create an empty schema automatically. Do not run `setup` or import first, because they populate it.
3. Run `npm run restore -- /absolute/path/to/backup-folder`.
4. The tool verifies the manifest and all hashes before writing; it refuses a nonempty library. Media is uploaded first, then metadata inserted in one transaction. A failed restore rolls back inserted metadata and cleans up new media. Restore only into an empty Bucket/media directory; it is not a merge tool. Passwords and sessions are intentionally not part of the backup.
5. Start the app, check the full catalog and private notebook, test several tracks and seek positions, and only then switch the production connection variables to the restored state.

For PostgreSQL-native backups, use Railway's backup facility or `pg_dump` / `pg_restore` with the database service. They cover database records, **not Bucket objects**. The portable backup handles both. Keep the schema version with the backup, and restore with the corresponding code revision before applying newer migrations. Budget space for the original data plus every retained backup copy.

The starter audio occupies roughly 75 MB, plus small embedded artwork. Most tracks are 3–5 minutes and 4–8 MB. One complete pass through the twelve-song collection transfers roughly the stored audio size per listener, subject to buffering/seeking. Check Railway's current service, database, Bucket and egress prices before deployment; there is no hard-coded cost promise here.

## Troubleshooting and verification

```sh
npm test
npm run build
npm audit
```

Tests use isolated temporary databases/media, not your library. The integration suite needs loopback networking and the supplied `starter-songs/` fixtures; these are intentionally not in the deployment image. See `docs/verification.md` for the test scope and browser walkthrough.

- **No sound:** press Play once (browser autoplay rules), check app/device volume, then try another track. There is no background autoplay on page load.
- **Port in use:** stop the previous `npm run dev` first. Changing the backend port also requires updating Vite's proxy; keep `PUBLIC_URL` aligned with the frontend origin.
- **Login fails:** use the password in `.local-access.txt` for local development. Check username, origin, cookies and `TRUST_PROXY`/HTTPS in production. After too many failures, wait 15 minutes. Never display server secrets in the UI.
- **“This item changed in another tab”:** your unsaved text remains in the form. Copy it first, then close/reopen to get the latest version and reconcile. Don't blindly overwrite another revision.
- **Upload fails:** confirm a valid MP3 of at most 30 MB. Existing library entries are safe; retry. If a retry reports a duplicate, the prior upload succeeded. On Railway, verify all Bucket values and permissions together.
- **Missing production songs after deploy:** audio belongs in the Bucket and metadata in PostgreSQL. It is never imported on startup and is intentionally absent from the Docker image. Import/restore once.
- **Database migration errors:** retain the previous backup and logs, fix the migration, and redeploy. Do not delete the database as a reset strategy.
- **Fonts/art missing:** run `npm ci` and `npm run build`. Fonts and the radio scene are self-hosted, with no Google Fonts request or external image dependency.

## Sources and authorship

Brie controls Mibble's voice and Goblin's Reach canon. Character references are user supplied. The new station scene was generated using the built-in image tool with identity-preserving references; its prompt and provenance are in `docs/art-direction.md`. Interface flourishes are exploratory station decoration, not declared novel canon. MP3 titles/credits/artwork come from the supplied files and remain editable. The owner is responsible for publishing only music and visual material they are authorized to share. Font packages include their licenses.

Deployment guidance was checked against [Railway Bucket documentation](https://docs.railway.com/storage-buckets), [Railway's Bucket guide](https://docs.railway.com/guides/storage-buckets-guide), and [Express session documentation](https://expressjs.com/en/resources/middleware/session/). The live PostgreSQL/Bucket deployment still needs validation when you choose to provision it.
