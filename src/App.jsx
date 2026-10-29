import React, { useCallback, useEffect, useState } from 'react';
import { Radio, ArrowUpRight, ArrowDown, Play, Pause, Heart, Search, Clock3, Feather, Moon, Cat, Sparkles, LockKeyhole, ChevronDown, X } from 'lucide-react';
import { api } from './api.js';
import { usePlayer, saved, remember } from './usePlayer.js';
import { formatTime } from './playback.mjs';
import { Art, IconButton, Modal, NoteCard, PlayerBar, StationMark } from './components.jsx';
import Studio from './Studio.jsx';

export default function App() {
  const [catalog, setCatalog] = useState({ songs: [], playlists: [] }), [fetchError, setFetchError] = useState(''), [ready, setReady] = useState(false);
  const [selected, setSelected] = useState(() => saved('wgob-playlist', ''));
  const [favorites, setFavorites] = useState(() => saved('wgob-favorites', []));
  const [search, setSearch] = useState(''), [onlyFavorites, setOnlyFavorites] = useState(false);
  const [page, setPage] = useState(location.hash === '#studio' ? 'studio' : 'radio');
  const [visitedStudio, setVisitedStudio] = useState(location.hash === '#studio');
  const [about, setAbout] = useState(false), [nothing, setNothing] = useState(false), [cat, setCat] = useState(false);
  const [toast, setToast] = useState(''), [lit, setLit] = useState(false);
  const player = usePlayer(catalog);
  useEffect(() => { if (page === 'studio') { player.pause(); setVisitedStudio(true); } }, [page]);
  const refresh = useCallback(async () => { try { setCatalog(await api('/catalog')); setFetchError(''); } catch (e) { setFetchError(e.message); } finally { setReady(true); } }, []);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 60000); const onFocus = () => refresh(); window.addEventListener('focus', onFocus); return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); }; }, [refresh]);
  useEffect(() => { const fn = () => setPage(location.hash === '#studio' ? 'studio' : 'radio'); window.addEventListener('hashchange', fn); return () => window.removeEventListener('hashchange', fn); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (!cat) return; const timer = setTimeout(() => setCat(false), 7000); return () => clearTimeout(timer); }, [cat]);
  const playlist = catalog.playlists.find(p => p.id === selected) || catalog.playlists[0];
  const songs = playlist?.songIds.map(id => catalog.songs.find(s => s.id === id)).filter(Boolean) || [];
  const visible = songs.filter(s => (!onlyFavorites || favorites.includes(s.id)) && `${s.title} ${s.artist} ${s.tags}`.toLowerCase().includes(search.toLowerCase()));
  const active = player.current || songs[0];
  const activePublished = catalog.songs.find(s => s.id === active?.id) || active;
  const love = id => { const next = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id]; setFavorites(next); remember('wgob-favorites', next); };
  const tuneIn = () => { if (songs.length) player.play(songs[0], playlist.id); };
  return <>
    <a className="skip-link" href={page === 'studio' ? '#studio-main' : '#main'} onClick={e => { e.preventDefault(); document.getElementById(page === 'studio' ? 'studio-main' : 'main')?.focus(); }}>Skip to content</a>
    <header className="site-header"><a href="#" className="brand" aria-label="WGOB listening room"><StationMark/></a><nav aria-label="Main navigation"><a href="#" className={page === 'radio' ? 'active' : ''}>Listening room</a><button onClick={() => setAbout(true)}>About the station <ArrowUpRight size={13}/></button><a href="#studio" className={`studio-link ${page === 'studio' ? 'active' : ''}`}><Feather size={15}/> Writing room</a></nav><div className="header-status"><span className={`status-dot ${player.playing ? 'live' : ''}`}/>{player.playing ? 'ON AIR' : 'THE LIGHT IS ON'}</div></header>
    <div hidden={page !== 'studio'}>{visitedStudio && <Studio onPublished={refresh}/>}</div>
    {page !== 'studio' && <main id="main" tabIndex={-1}>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow hero-eyebrow"><span/> A SIGNAL FROM GOBLIN’S REACH</div><h1>Dark O’Clock<br/><em>Radio.</em><span className="title-star">✧</span></h1><p className="hero-tagline">A little light in the underground.</p><p className="hero-description">Songs for the late hours, the small wonders,<br className="desktop-break"/> and the things worth keeping.</p><div className="hero-actions"><button className="button brass" onClick={player.playing ? player.toggle : tuneIn} disabled={!songs.length}>{player.playing ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}{player.playing ? 'Stay a while' : 'Come on in'}</button><a href="#song-drawer" className="text-link">Open the song drawer <ArrowDown size={14}/></a></div><div className="hero-postscript"><span className="tiny-moon">☾</span> Hosted by Mibble. Supervised, loosely, by Thorie.</div></div>
        <div className="hero-scene"><img src="/radio-room.webp" alt="Mibble, a goblin with brass goggles and amber eyes, shares her lamplit radio desk with Thorie, her fluffy tabby cat." fetchPriority="high"/><div className="scene-topline"><span><i/> LIVE FROM THE WORKSHOP</span><span>EST. WHENEVER IT GOT DARK</span></div><button className="cat-hotspot" onClick={() => { setCat(true); setToast('Thorie has accepted your company. The music may continue.'); }} aria-label="Say hello to Thorie"><Cat size={16}/> Thorie is listening</button><div className="photo-caption">There’s room for you here.<span>— WGOB</span></div></div>
      </section>
      <div className="station-strip"><span><Radio size={14}/> INDEPENDENT · UNDERGROUND · A LITTLE UNUSUAL</span><span>NO HURRY. NO ALGORITHM. JUST COMPANY. <span className="strip-star">✧</span></span></div>
      <section className="listening-room" id="song-drawer">
        <div className="room-heading"><div><span className="eyebrow">PULL UP SOMETHING COMFORTABLE</span><h2>The song drawer<span>.</span></h2></div><div className="collection-picker"><label htmlFor="collection">TONIGHT’S COLLECTION</label><div><select id="collection" value={playlist?.id || ''} onChange={e => { setSelected(e.target.value); remember('wgob-playlist', e.target.value); setSearch(''); }} aria-label="Choose a collection">{!catalog.playlists.length && <option value="">No collections yet</option>}{catalog.playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={15}/></div></div></div>
        {fetchError && <div role="alert" className="error-message">{fetchError} <button onClick={refresh}>Try again</button></div>}
        <div className="room-grid"><section className="drawer" aria-label="Songs">
          <div className="drawer-toolbar"><div className="drawer-tabs"><button className={!onlyFavorites ? 'selected' : ''} onClick={() => setOnlyFavorites(false)}>All songs <span>{songs.length}</span></button><button className={onlyFavorites ? 'selected' : ''} onClick={() => setOnlyFavorites(true)}><Heart size={13}/> Your keepsakes</button></div><label className="song-search"><Search size={15}/><input aria-label="Find a song" placeholder="Find a song…" value={search} onChange={e => setSearch(e.target.value)}/></label></div>
          <p className="collection-description">{playlist?.description || 'A drawer waiting for its first songs.'}</p>
          <div className="playback-settings"><label>PLAYBACK <select aria-label="Playback mode" value={player.mode} onChange={e => player.setMode(e.target.value)}><option value="order">In collection order</option><option value="shuffle">Shuffle the drawer</option><option value="single">Just one song</option></select></label><label className="mobile-volume">VOLUME <input aria-label="Listening volume" type="range" min="0" max="1" step="0.01" value={player.volume} onChange={e => player.setVolume(Number(e.target.value))} style={{'--progress':`${player.volume*100}%`}}/></label></div>
          <div className="track-table-heading"><span>NO.</span><span>SONG / LITTLE WONDER</span><Clock3 size={13}/><span/></div>
          {!ready ? <p className="empty-state">Warming up the valves…</p> : !visible.length ? <div className="empty-state"><Radio size={30}/><p>{onlyFavorites ? 'Keep a song by tapping its heart.' : search ? 'Nothing by that name in this drawer.' : 'A little quiet, for now. Check back soon.'}</p></div> : <ol className="track-list">{visible.map((song, i) => {
            const isCurrent = player.current?.id === song.id;
            return <li key={song.id} className={isCurrent ? 'current-track' : ''}><button className="track-select" onClick={() => isCurrent ? player.toggle() : player.play(song, playlist.id)} aria-label={`${isCurrent && player.playing ? 'Pause' : 'Play'} ${song.title}`}><span className="track-number">{isCurrent && player.playing ? <span className="equalizer"><i/><i/><i/></span> : <><span>{String(songs.indexOf(song) + 1).padStart(2, '0')}</span><Play className="row-play" size={14} fill="currentColor"/></>}</span><Art song={song}/><span className="track-info"><strong>{song.title}</strong><small>{song.artist || (song.tags || 'From the workshop collection')}</small></span><time>{formatTime(song.duration)}</time></button><IconButton label={`${favorites.includes(song.id) ? 'Unkeep' : 'Keep'} ${song.title}`} aria-pressed={favorites.includes(song.id)} onClick={() => love(song.id)}><Heart size={16} fill={favorites.includes(song.id) ? 'currentColor' : 'none'}/></IconButton></li>;
          })}</ol>}
          <div className="drawer-footer"><span>{songs.length} songs · {Math.round(songs.reduce((a, s) => a + s.duration, 0) / 60)} minutes of company</span><span>Filed with care <Heart size={11}/></span></div>
        </section><aside className="listening-aside">
          <div className="on-air-panel"><div className="panel-top"><span className={`on-air-light ${player.playing ? 'is-on' : ''}`}><i/>{player.playing ? 'ON AIR' : 'STANDING BY'}</span><span className="eyebrow">WGOB · LATE NIGHT</span></div><div className="reel-display"><div className={`reel ${player.playing ? 'turning' : ''}`}><i/><i/><i/></div><div className="tape-center"><span>GOOD COMPANY</span><div className={player.playing ? 'needle moving' : 'needle'}/><span>NO APPOINTMENT NEEDED</span></div><div className={`reel ${player.playing ? 'turning' : ''}`}><i/><i/><i/></div></div><div className="tuned-label"><span>{player.playing ? 'CURRENTLY DRIFTING THROUGH' : 'ON THE TURNTABLE'}</span><strong>{active?.title || 'A little quiet'}</strong></div></div>
          <NoteCard song={activePublished}/>
          <div className="emergency-panel"><div><span className="eyebrow">IN CASE OF TOO MUCH EVERYTHING</span><strong>Emergency Nothing</strong><p>One small, completely unnecessary button.</p></div><button className="red-button" aria-label="Deploy Emergency Nothing" onClick={() => setNothing(true)}><span>DO NOT<br/>PRESS</span></button></div>
          <p className="aside-note">The machinery can wait a minute.</p>
        </aside></div>
      </section>
      <section className="station-footer"><div><StationMark/><p>A small station. A rather large heart.</p></div><div className="footer-center">From the world of <em>Goblin’s Reach</em><br/><span>Made for Brie & Chaz, and the things they dream up.</span></div><button className={`lantern-button ${lit ? 'lit' : ''}`} onClick={() => { setLit(!lit); if (!lit) setToast('A little light, left on for the next person.'); }} aria-label={lit ? 'Turn off your little light' : 'Leave a little light on'}><span>♧</span>{lit ? 'A little light, left on.' : 'Leave a little light on.'}<Sparkles size={13}/></button></section>
    </main>}
    {player.error && <div className="player-error" role="alert">{player.error}<IconButton label="Dismiss audio error" onClick={() => player.setError('')}><X size={16}/></IconButton></div>}
    {page === 'radio' && <PlayerBar player={player} fallback={songs[0]} onStart={tuneIn} loved={favorites.includes(active?.id)} onLove={love} playlistName={catalog.playlists.find(p => p.id === player.playlistId)?.name || playlist?.name}/>}
    {toast && <div className="toast" role="status"><Sparkles size={16}/>{toast}</div>}
    {cat && <div className="cat-visit" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <span key={i} style={{ '--step': i }}>🐾</span>)}<div><Cat size={26}/><strong>Company accepted.</strong><small>— Thorie, station supervisor</small></div></div>}
    {about && <Modal title="A soft landing with a microphone." onClose={() => setAbout(false)} wide><div className="about-content"><img src="/radio-room.webp" alt="Mibble and Thorie in their radio workshop"/><span className="eyebrow">WELCOME TO WGOB</span><p>When the big machinery quiets down, there’s room for smaller things. A song. A half-finished thought. A cat taking up most of the desk.</p><p>Dark O’Clock Radio is a companion to <em>Goblin’s Reach</em>, the world Brie and Chaz are creating. Mibble hosts. Thorie has his own ideas. Brie writes the words tucked beside the music.</p><p>This is a place to listen, make things, and see what turns up. You don’t have to arrive with a reason.</p><div className="about-signoff">Come as you are. Stay for a song. <Heart size={18}/></div></div></Modal>}
    {nothing && <Modal title="Emergency Nothing" onClose={() => setNothing(false)} wide><div className="nothing-scene"><div className="fireflies">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ '--i': i, left: `${(i * 37) % 100}%`, top: `${(i * 17) % 80}%` }}/>)}</div><Moon size={35} strokeWidth={1}/><span className="eyebrow">THE BUTTON HAS DONE ITS VERY BEST.</span><h3>Nothing needs<br/>to happen here.</h3><p>The songs can keep playing.<br/>Thorie has made room. A very small amount.</p><button className="button ghost" onClick={() => { setNothing(false); setCat(true); setToast('For Brie & Chaz: may there always be one more little thing to make together. ♡'); }}><Cat size={17}/> Sit with Thorie</button><small>There is no timer. That would rather defeat the point.</small></div></Modal>}
  </>;
}
