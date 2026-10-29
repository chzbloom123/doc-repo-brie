# Verification record

Verified locally on October 28, 2026 (America/Los_Angeles), with Node 24.18.0. The application is running on `http://127.0.0.1:5173/` with its Express API on 3001.

## Automated results

`npm run build` passed. `npm test` passed **15 tests**. The final npm dependency audit reported **zero known vulnerabilities**.

The tests use disposable isolated SQLite databases and local media, and cover:

1. All thirteen source files import as twelve unique songs, with no duplication on a second run.
2. Every imported recording serves HTTP byte ranges; impossible ranges return 416.
3. Public callers cannot read editorial data, exports or the notebook, or write to the library.
4. Login checks password, origin and CSRF; sessions regenerate and cookies are HTTP-only/SameSite Strict.
5. Draft privacy, exact multiline text publication, previous-note recovery records, and stale-save rejection.
6. Real MP3 upload, duplicate detection, invalid-content rejection, and private media before publication.
7. Creating draft collections, publishing/reordering, membership-only removal, and transactional rollback of invalid saves.
8. Archiving hides public audio/catalog entries; restoring recovers the original notes and memberships.
9. Private notebook save, export and stale-save protection.
10. Shuffle cycles contain no repeats, handle library changes, and support one-song/empty collections.
11. Complete backup and restore round-trip, including byte-identical media, titles, notes, revisions, notebook, ordering and persistence after reopening the database. Restore refuses a nonempty library.
12. Logout revokes editorial access.
13. The S3 serving adapter forwards byte ranges and streams a 206 response on the stable app endpoint, using a controlled SDK test double.
14. Missing S3 objects and invalid ranges return 404/416.
15. Storage rejects path traversal and unsupported media keys.

## Browser checks performed

- The listener interface loaded with all twelve songs, real embedded artwork, credits and durations.
- Playback was started by a user gesture; the clock advanced and next-track changed the playing song.
- A real track was seeked near its end. “Just one song” stopped and reset at the end without advancing.
- The same end-of-track check in collection-order mode automatically advanced to the next saved song.
- The writing-room login worked using the generated local credential.
- A multiline note draft was saved and previewed in the public note-card design. Its blank original was restored afterward. No test note remains and no invented note was published.
- A second collection, **After the machinery sleeps**, was created through the UI. Both the move-up button and drag-and-drop reordered tracks. The draft preview showed the saved running order; explicit publication made it available in the public collection switcher.
- The notebook retained unsaved text when switching writing-room sections. Temporary verification text was removed without saving.
- The unnecessary red button and Thorie encounter opened and closed correctly.
- The desktop view and a **390 × 844** phone viewport were inspected. The layout stacks on phones and exposes playback mode and volume above the drawer. Reduced-motion styling disables ongoing animation. Native dialogs trap focus, support Escape, and return focus to the opener; Escape goes through the unsaved-change guard.
- The final phone layout had no horizontal overflow. The refreshed desktop preview reported no browser console errors. Preview captures are in the ignored `test-results/` folder. The editor was signed out after verification, and playback was left paused.

The twelve original song notes remain blank for Brie. There are two published local collections. The first complete local backup is under `backups/` with twelve songs and both collections; backup folders and login files are ignored by Git.

## A five-minute walkthrough for Brie and Chaz

1. Open the station and press **Come on in**. Seek, skip, and choose another song. Heart one, then open **Your keepsakes**.
2. Switch **Tonight’s collection** to **After the machinery sleeps**. The current track keeps playing until you choose a new one. Try the three playback modes above the songs.
3. Open **Writing room**. Find the local credentials in `.local-access.txt` and sign in.
4. Open a song, write two lines, **Save draft & details**, then **Preview draft**. In a separate listener tab, confirm the public note is unchanged. **Publish note** when ready. Use **Published history** to restore an earlier version into the draft.
5. Upload a valid MP3. It is private until you add it to a published collection. Uploading the same file again should open its existing entry.
6. Create a collection, add songs, reorder with arrows or dragging, save draft, preview, then publish. The public switcher refreshes on focus or within a minute.
7. Remove a song from a collection and confirm it remains in the library. Separately archive it in the library, then restore it from **Archived**.
8. Save and export a line from **Mibble’s notebook**. It never appears publicly.
9. Stop and restart `npm run dev`; content and order persist. Run `npm run backup` before major editing sessions.
10. Press the button that says not to. The station takes no responsibility for the resulting lack of urgency.

## Remaining deployment validation

The local application and SQLite adapter were exercised. The S3 adapter has controlled integration coverage, but **no live Railway PostgreSQL, Bucket, Docker deployment, public HTTPS domain, or real mobile hardware has been provisioned/tested**. Before publishing, follow the README, confirm live database migrations, Secure cookies behind Railway's proxy, real Bucket upload/range delivery, persistence after redeploy, and a production backup/restore. Mobile browser playback/background behavior varies by OS and should be checked on Brie and Chaz's actual phones. The source repository is [chzbloom123/doc-repo-brie](https://github.com/chzbloom123/doc-repo-brie); Railway deployment remains a separate step.
