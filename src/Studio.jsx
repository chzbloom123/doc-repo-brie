import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Upload, Feather, ListMusic, Library, NotebookPen, LogOut, LockKeyhole, Save, Eye, Send, Archive, RotateCcw, Download, X, GripVertical, Check, Search, Clock3 } from 'lucide-react';
import { api, downloadText, uploadAudio } from './api.js';
import { Art, IconButton, Modal, NoteCard } from './components.jsx';
import { formatTime } from './playback.mjs';

function useUnsaved(dirty) {
  useEffect(() => {
    const fn = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    const navigate = e => {
      const link = e.target.closest('a[href], [data-leave-editor]');
      if (dirty && link && !window.confirm('You have unsaved writing. Leave without saving?')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', fn); document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', fn); document.removeEventListener('click', navigate, true); };
  }, [dirty]);
}
export default function Studio({ onPublished }) {
  const [session, setSession] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState({ songs: [], playlists: [] }), [tab, setTab] = useState('songs');
  const [editing, setEditing] = useState(null), [playlist, setPlaylist] = useState(null);
  const [query, setQuery] = useState(''), [showArchived, setShowArchived] = useState(false), [notice, setNotice] = useState('');
  const [upload, setUpload] = useState(null), fileRef = useRef(null);
  useUnsaved(!!upload);
  const [username, setUsername] = useState('brie'), [password, setPassword] = useState('');
  const load = async () => { const data = await api('/editor/catalog'); setCatalog(data); return data; };
  useEffect(() => { api('/session').then(async s => { setSession(s); if (s.authenticated) await load(); }).catch(e => setError(e.message)); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6500); return () => clearTimeout(timer); }, [notice]);
  const login = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { const s = await api('/login', { method: 'POST', body: { username, password } }); setSession(s); setPassword(''); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const signOut = async () => {
    setBusy(true); setError('');
    try { await api('/logout', { method: 'POST' }); setSession(await api('/session')); setCatalog({ songs: [], playlists: [] }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const uploaded = async file => {
    if (!file) return; setError(''); setUpload({ name: file.name, progress: 0 });
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error('MP3 uploads can be up to 30 MB.');
      const result = await uploadAudio(file, progress => setUpload({ name: file.name, progress }));
      await load(); setNotice(result.duplicate ? 'This song is already in your library. No duplicate was added.' : 'Song uploaded. It stays private until you add it to a published collection.'); setEditing(result.song);
    } catch (e) { setError(e.message); } finally { setUpload(null); if (fileRef.current) fileRef.current.value = ''; }
  };
  const afterSave = async message => { await load(); onPublished(); setNotice(message); };
  const exportMetadata = async () => { try { const data = await api('/editor/export'); downloadText('wgob-writing-and-library.json', JSON.stringify(data, null, 2), 'application/json'); setNotice('Writing and library metadata exported. Audio backup instructions are in the README.'); } catch (e) { setError(e.message); } };
  if (!session?.authenticated) return <main id="studio-main" tabIndex={-1} className="studio-login"><div className="login-illustration"><img src="/radio-room.webp" alt="The warm radio workshop"/><div><span className="eyebrow">A SPACE FOR THE WORDS TO FIND YOU</span><h1>The writing room.</h1><p>The lamp’s on. Your drafts are right where you left them.</p></div></div><form className="login-form" onSubmit={login}><Feather size={30} strokeWidth={1}/><h2>Welcome back.</h2><p>A quiet corner for Brie’s songs, notes, and small discoveries.</p><label>Editor name<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required/></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required/></label>{error && <p className="error-message" role="alert">{error}</p>}<button className="button brass" disabled={busy || !session}><LockKeyhole size={15}/>{busy ? 'Opening the door…' : 'Enter the writing room'}</button><small>Private drafts. Your words. Always.</small><a className="text-link" href="#"><ArrowLeft size={14}/> Back to the listening room</a></form></main>;
  const filteredSongs = catalog.songs.filter(s => s.archived === showArchived && `${s.title} ${s.artist}`.toLowerCase().includes(query.toLowerCase()));
  return <main id="studio-main" tabIndex={-1} className="studio-page"><div className="studio-heading"><div><span className="eyebrow"><LockKeyhole size={12}/> PRIVATE · JUST FOR YOU</span><h1>The writing room<span>.</span></h1><p>A song, a sentence, a little room to try things.</p></div><div className="studio-heading-actions"><button className="button ghost" onClick={exportMetadata}><Download size={15}/> Export writing</button><button className="text-link" data-leave-editor onClick={signOut} disabled={busy || !!upload}><LogOut size={15}/> Sign out</button></div></div>
    <div className="studio-tabs" role="tablist" aria-label="Writing room sections">{[['songs', Library, 'Song library'], ['playlists', ListMusic, 'Collections'], ['notebook', NotebookPen, 'Mibble’s notebook']].map(([id, Icon, title]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={17}/>{title}<span>{id === 'songs' ? catalog.songs.filter(s => !s.archived).length : id === 'playlists' ? catalog.playlists.length : 'PRIVATE'}</span></button>)}</div>
    {error && <div className="error-message" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}{notice && <div className="success-message" role="status"><Check size={16}/>{notice}</div>}
    {tab === 'songs' && <section className="studio-panel"><div className="panel-toolbar"><div className="drawer-tabs"><button className={!showArchived ? 'selected' : ''} onClick={() => setShowArchived(false)}>On the shelf</button><button className={showArchived ? 'selected' : ''} onClick={() => setShowArchived(true)}><Archive size={14}/> Archived</button></div><div className="flex-actions"><label className="song-search"><Search size={15}/><input aria-label="Search library" placeholder="Find a song…" value={query} onChange={e => setQuery(e.target.value)}/></label><button className="button brass" onClick={() => fileRef.current.click()} disabled={!!upload}><Upload size={15}/>{upload ? 'Uploading…' : 'Upload MP3'}</button><input ref={fileRef} type="file" accept=".mp3,audio/mpeg" hidden onChange={e => uploaded(e.target.files[0])}/></div></div>
      {upload && <div className="upload-progress" role="status"><span>{upload.name} · {upload.progress === 100 ? 'Checking audio and saving…' : `${upload.progress}%`}</span><progress max="100" value={upload.progress}/></div>}
      <p className="editor-hint">Songs become public when they’re in a published collection. Notes have their own draft and publish controls.</p>
      <div className="editor-song-list">{filteredSongs.map(song => <button key={song.id} className="editor-song-row" onClick={() => setEditing(song)}><Art song={song}/><span className="editor-song-name"><strong>{song.title}</strong><small>{song.artist || song.sourceName}</small></span><span className={`badge ${song.draft !== song.published ? 'amber' : ''}`}>{song.archived ? 'Archived' : song.draft !== song.published ? 'Unpublished note' : song.published ? 'Note published' : 'Room for a note'}</span><time>{formatTime(song.duration)}</time><Feather size={16}/></button>)}</div>{!filteredSongs.length && <div className="empty-state">{showArchived ? 'Nothing archived. Everything is on the shelf.' : 'No songs here yet. Add an MP3 to begin.'}</div>}
    </section>}
    {tab === 'playlists' && <section className="studio-panel"><div className="panel-toolbar"><p>Little collections. In just the right order.</p><button className="button brass" onClick={() => setPlaylist({ name: '', description: '', status: 'draft', songIds: [] })}><Plus size={17}/> New collection</button></div><div className="playlist-cards">{catalog.playlists.map(p => <button className="playlist-card" key={p.id} onClick={() => setPlaylist(p)}><div className={`playlist-cover ${p.status}`}><ListMusic size={35} strokeWidth={1}/><span>{p.songIds.length} SONGS</span></div><div><span className={`badge ${p.status === 'published' ? 'green' : ''}`}>{p.status}</span><h3>{p.name}</h3><p>{p.description || 'A collection finding its shape.'}</p></div><Feather size={16}/></button>)}</div>{!catalog.playlists.length && <p className="empty-state">Make a collection and start tucking songs inside.</p>}</section>}
    <div hidden={tab !== 'notebook'}><Notebook/></div>
    <div className="studio-bottom"><Feather size={17}/><span>Brie’s words belong to Brie. Drafts stay here until you say otherwise.</span></div>
    {editing && <SongEditor initial={editing} onClose={() => setEditing(null)} onSaved={afterSave}/>}
    {playlist && <PlaylistEditor initial={playlist} songs={catalog.songs} onClose={() => setPlaylist(null)} onSaved={afterSave}/>}
  </main>;
}

function SongEditor({ initial, onClose, onSaved }) {
  const [song, setSong] = useState(initial), [form, setForm] = useState({ title: initial.title, artist: initial.artist, tags: initial.tags, draft: initial.draft });
  const [error, setError] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(false), [preview, setPreview] = useState(false), [history, setHistory] = useState(null), [confirmArchive, setConfirmArchive] = useState(false), [confirmLeave, setConfirmLeave] = useState(false);
  const dirty = Object.keys(form).some(key => form[key] !== song[key]);
  useUnsaved(dirty);
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const save = async () => {
    const result = await api(`/editor/songs/${song.id}`, { method: 'PUT', body: { ...form, version: song.version } });
    setSong(result); setForm({ title: result.title, artist: result.artist, tags: result.tags, draft: result.draft }); return result;
  };
  const run = async action => { setBusy(true); setError(''); setStatus(''); try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const saveDraft = () => run(async () => { await save(); setStatus('Draft saved. The published note has not changed.'); await onSaved('Song details and note draft saved.'); });
  const publish = () => run(async () => {
    const current = dirty ? await save() : song;
    const result = await api(`/editor/songs/${song.id}/publish`, { method: 'POST', body: { version: current.version } });
    setSong(result); setStatus('Note published. These exact words are now in the listening room.'); setHistory(null); await onSaved('Mibble’s note published.');
  });
  const archive = () => run(async () => {
    const current = dirty ? await save() : song;
    const result = await api(`/editor/songs/${song.id}/archive`, { method: 'POST', body: { archived: !song.archived, version: current.version } });
    setSong(result); setConfirmArchive(false); setStatus(result.archived ? 'Archived. Audio, notes and collection memberships are safe.' : 'Restored to the library and its collections.'); await onSaved(result.archived ? 'Song archived.' : 'Song restored.');
  });
  return <Modal title="A song & its small thoughts" onClose={() => busy ? null : dirty ? setConfirmLeave(true) : onClose()} wide><div className="song-editor">
    <div className="song-editor-top"><Art song={song}/><div><span className="eyebrow">{song.archived ? 'ARCHIVED · PRIVATE PREVIEW' : 'FROM YOUR SONG LIBRARY'}</span><h3>{form.title || 'Untitled song'}</h3><small>{formatTime(song.duration)} · {song.sourceName}</small></div></div><audio controls preload="metadata" src={song.audio} className="editor-audio"/>
    <div className="form-grid"><label>Song title<input value={form.title} onChange={e => update('title', e.target.value)} maxLength={200} required/></label><label>Artist / credit <span>optional</span><input value={form.artist} onChange={e => update('artist', e.target.value)} maxLength={200}/></label></div><label>Tags <span>optional · separate with commas</span><input value={form.tags} onChange={e => update('tags', e.target.value)} maxLength={300} placeholder="workshop hymn, late-night sparkle…"/></label>
    <div className="note-edit-heading"><label htmlFor="note-draft">Mibble’s note <span>DRAFT</span></label><button className="text-link" onClick={() => setPreview(!preview)}><Eye size={15}/>{preview ? 'Back to writing' : 'Preview draft'}</button></div>
    {preview ? <div className="draft-preview"><span className="badge amber">PRIVATE PREVIEW · NOT PUBLISHED</span><h4>{form.title}</h4><NoteCard song={{ ...song, draft: form.draft }} draft/></div> : <textarea id="note-draft" className="note-textarea" rows={8} value={form.draft} onChange={e => update('draft', e.target.value)} maxLength={12000} placeholder="What did Mibble notice? There’s room to find out. An empty note is welcome, too."/>}
    <p className="editor-hint">Line breaks stay just as you write them. Song details save immediately; the note goes public only when you publish it.</p>
    {error && <p className="error-message" role="alert">{error}</p>}{status && <p className="success-message" role="status"><Check size={15}/>{status}</p>}
    <div className="editor-actions"><button className="button ghost" onClick={saveDraft} disabled={busy || !dirty || !form.title.trim()}><Save size={15}/>{busy ? 'Saving…' : 'Save draft & details'}</button><button className="button brass" onClick={publish} disabled={busy || !form.title.trim()}><Send size={15}/> Publish note</button></div>
    <div className="editor-secondary"><button className="text-link" onClick={() => run(async () => setHistory(await api(`/editor/songs/${song.id}/revisions`)))} disabled={busy}><Clock3 size={14}/> Published history</button><button className="text-link" onClick={() => setConfirmArchive(true)} disabled={busy}>{song.archived ? <RotateCcw size={14}/> : <Archive size={14}/>}{song.archived ? 'Restore song' : 'Archive song'}</button></div>
    {confirmArchive && <div className="inline-confirm"><p>{song.archived ? 'Restore this song? It will reappear in any published collections it belonged to.' : 'Archive this song everywhere? It will disappear from public collections. Audio, notes and memberships remain recoverable.'}</p><button className="button ghost" onClick={() => setConfirmArchive(false)}>Cancel</button><button className="button brass" onClick={archive} disabled={busy}>{song.archived ? 'Restore song' : 'Archive song'}</button></div>}
    {history && <div className="revision-list"><h4>Published history</h4><p>Restore a version into your draft. Publish it when you’re ready.</p>{!history.length && <p>No published revisions yet.</p>}{history.map(r => <div className="revision" key={r.id}><small>{new Date(r.created_at).toLocaleString()}</small><p>{r.content || '(An intentionally empty note)'}</p><button className="text-link" onClick={() => { update('draft', r.content); setPreview(false); setStatus('Earlier wording restored into your draft. Save or publish to keep it.'); }}><RotateCcw size={13}/> Restore to draft</button></div>)}</div>}
    {confirmLeave && <div className="inline-confirm" role="alert"><p>You have unsaved words. Keep writing, or close without saving?</p><button className="button brass" onClick={() => setConfirmLeave(false)}>Keep writing</button><button className="button ghost" onClick={onClose}>Discard unsaved changes</button></div>}
  </div></Modal>;
}

function PlaylistEditor({ initial, songs, onClose, onSaved }) {
  const [saved, setSaved] = useState(initial), [form, setForm] = useState(initial), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [preview, setPreview] = useState(false), [query, setQuery] = useState(''), [confirmLeave, setConfirmLeave] = useState(false);
  const [previewSong, setPreviewSong] = useState(null); const dragId = useRef(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved); useUnsaved(dirty);
  const change = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const selected = form.songIds.map(id => songs.find(s => s.id === id)).filter(Boolean);
  const move = (id, index) => { const next = form.songIds.filter(x => x !== id); next.splice(index, 0, id); change('songIds', next); };
  const submit = async status => {
    setBusy(true); setError(''); setNotice('');
    try {
      const body = { name: form.name, description: form.description, status, songIds: form.songIds, ...(saved.id ? { version: saved.version } : {}) };
      const result = await api(saved.id ? `/editor/playlists/${saved.id}` : '/editor/playlists', { method: saved.id ? 'PUT' : 'POST', body });
      setSaved(result); setForm(result); setNotice(status === 'published' ? 'Collection published. Listeners can tune in now.' : status === 'archived' ? 'Collection archived. Its songs remain in the library.' : 'Draft saved. Only you can see this collection.');
      await onSaved(status === 'published' ? 'Collection published.' : 'Collection saved.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <Modal title={saved.id ? 'Arrange a little company' : 'A new collection'} onClose={() => busy ? null : dirty ? setConfirmLeave(true) : onClose()} wide><div className="playlist-editor"><div className="form-grid"><label>Collection name<input value={form.name} onChange={e => change('name', e.target.value)} maxLength={100} placeholder="Something worth staying up for" required/></label><div className="playlist-status"><span className={`badge ${saved.status === 'published' ? 'green' : ''}`}>{saved.status}</span><small>{saved.status === 'published' ? 'Changes take effect when saved.' : 'Visible only in the writing room.'}</small></div></div><label>A few words about this collection <span>optional</span><textarea rows={2} value={form.description} onChange={e => change('description', e.target.value)} maxLength={1000}/></label>
    <div className="note-edit-heading"><h3>{preview ? 'Listener preview' : 'The running order'} <span className="badge">{selected.length} songs</span></h3><button className="text-link" onClick={() => setPreview(!preview)}><Eye size={15}/>{preview ? 'Arrange songs' : 'Preview collection'}</button></div>
    {preview ? <div className="collection-preview"><span className="badge amber">PRIVATE PREVIEW</span><h2>{form.name || 'Untitled collection'}</h2><p>{form.description}</p>{selected.filter(s => !s.archived).map(s => <button key={s.id} className="preview-track" onClick={() => setPreviewSong(s)}><Art song={s}/><strong>{s.title}</strong><span>{formatTime(s.duration)}</span></button>)}{previewSong && <div className="preview-playing"><h3>{previewSong.title}</h3><audio key={previewSong.id} controls autoPlay src={previewSong.audio}/><NoteCard song={{ ...previewSong, note: previewSong.published }}/></div>}</div> : <>
    <p className="editor-hint">Drag into order, or use the arrow buttons. Removing a song here only changes this collection.</p><ol className="order-list">{selected.map((song, i) => <li key={song.id} draggable onDragStart={e => { dragId.current = song.id; e.dataTransfer.effectAllowed = 'move'; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragId.current) move(dragId.current, i); dragId.current = null; }}><GripVertical size={16} className="drag-grip"/><span className="order-number">{String(i + 1).padStart(2, '0')}</span><Art song={song}/><span className="order-title">{song.title}{song.archived && <small>Archived · hidden from listeners</small>}</span><IconButton label={`Move ${song.title} up`} disabled={i === 0} onClick={() => move(song.id, i - 1)}><ArrowUp size={16}/></IconButton><IconButton label={`Move ${song.title} down`} disabled={i === selected.length - 1} onClick={() => move(song.id, i + 1)}><ArrowDown size={16}/></IconButton><IconButton label={`Remove ${song.title} from collection`} onClick={() => change('songIds', form.songIds.filter(id => id !== song.id))}><X size={16}/></IconButton></li>)}</ol>{!selected.length && <div className="empty-state">Start with one song. See where it leads.</div>}
    <div className="add-songs"><div className="note-edit-heading"><h4>Add from the library</h4><label className="song-search"><Search size={14}/><input aria-label="Search songs to add" placeholder="Find a song…" value={query} onChange={e => setQuery(e.target.value)}/></label></div><div>{songs.filter(s => !s.archived && !form.songIds.includes(s.id) && s.title.toLowerCase().includes(query.toLowerCase())).map(s => <button key={s.id} onClick={() => change('songIds', [...form.songIds, s.id])}><Plus size={14}/>{s.title}</button>)}</div></div></>}
    {error && <p role="alert" className="error-message">{error}</p>}{notice && <p role="status" className="success-message"><Check size={15}/>{notice}</p>}
    <div className="editor-actions"><button className="button ghost" disabled={busy || !form.name.trim()} onClick={() => submit('draft')}><Save size={15}/>{saved.status === 'published' ? 'Unpublish & save draft' : 'Save draft'}</button><button className="button brass" disabled={busy || !form.name.trim()} onClick={() => submit('published')}><Send size={15}/>{saved.status === 'published' ? 'Save published collection' : 'Publish collection'}</button>{saved.id && saved.status !== 'archived' && <button className="text-link" disabled={busy} onClick={() => submit('archived')}><Archive size={15}/> Archive collection</button>}</div>
    {confirmLeave && <div className="inline-confirm" role="alert"><p>This collection has unsaved changes.</p><button className="button brass" onClick={() => setConfirmLeave(false)}>Keep arranging</button><button className="button ghost" onClick={onClose}>Discard unsaved changes</button></div>}
  </div></Modal>;
}

function Notebook() {
  const [record, setRecord] = useState(null), [text, setText] = useState(''), [error, setError] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  useUnsaved(record && text !== record.content);
  useEffect(() => { api('/editor/notebook').then(r => { setRecord(r); setText(r.content); }).catch(e => setError(e.message)); }, []);
  const save = async () => { setBusy(true); setError(''); setStatus(''); try { const r = await api('/editor/notebook', { method: 'PUT', body: { content: text, version: record.version } }); setRecord(r); setStatus('Notebook saved. This never appears in the listening room.'); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  return <section className="notebook-panel"><div className="notebook-heading"><Feather size={28} strokeWidth={1}/><div><h2>Things that aren’t songs. Yet.</h2><p>Bits of Mibble. Half a thought. A particularly important nothing.</p></div><span className="badge"><LockKeyhole size={12}/> ALWAYS PRIVATE</span></div><textarea aria-label="Mibble’s private notebook" value={text} onChange={e => setText(e.target.value)} placeholder="Leave a thought here. It doesn’t need to know what it is yet." maxLength={100000} rows={16} disabled={!record}/>{error && <p className="error-message" role="alert">{error}</p>}{status && <p className="success-message" role="status">{status}</p>}<div className="editor-actions"><button className="button brass" onClick={save} disabled={busy || !record || text === record.content}><Save size={15}/>{busy ? 'Saving…' : 'Save notebook'}</button><button className="button ghost" onClick={() => downloadText('Mibbles-notebook.txt', text)}><Download size={15}/> Export notebook</button><small>{record && text !== record.content ? 'Unsaved thoughts' : 'All tucked away.'}</small></div></section>;
}
