CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT '',
  audio_key TEXT NOT NULL,
  artwork_key TEXT,
  duration REAL NOT NULL,
  bytes BIGINT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  note_draft TEXT NOT NULL DEFAULT '',
  note_published TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS playlist_songs (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL REFERENCES songs(id),
  position INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, song_id)
);
CREATE TABLE IF NOT EXISTS note_revisions (
  id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL REFERENCES songs(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS revision_song ON note_revisions(song_id, created_at);
CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS imports (
  name TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL
);
