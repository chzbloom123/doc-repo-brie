import React, { useEffect, useRef, useId } from 'react';
import { X, Radio, Music2, Feather, Disc3, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat2, CircleDot, Heart } from 'lucide-react';
import { formatTime } from './playback.mjs';
export function IconButton({ label, children, ...props }) { return <button type="button" className="icon-button" aria-label={label} title={label} {...props}>{children}</button>; }
export function StationMark() { return <span className="station-mark"><Radio size={27} strokeWidth={1.4}/><span><strong>WGOB</strong><small>GOBLIN’S REACH</small></span></span>; }
export function Art({ song, className = '' }) { return <div className={`song-art ${className}`}>{song?.artwork ? <img src={song.artwork} alt="" loading="lazy"/> : <Disc3 aria-hidden="true" size={27} strokeWidth={1}/>}</div>; }
export function NoteCard({ song, draft = false }) {
  const note = draft ? song?.draft : song?.note;
  return <section className={`note-paper ${note ? '' : 'quiet-note'}`} aria-label={draft ? 'Draft note preview' : 'Mibble’s note'}>
    <div className="paper-label"><Feather size={15}/><span>{draft ? 'A NOTE IN PROGRESS' : 'A NOTE FROM MIBBLE'}</span><span className="paper-star">✧</span></div>
    {note ? <p className="mibble-note">{note}</p> : <><p className="empty-note">A little room<br/>for the music.</p><p className="note-foot">{draft ? 'Your words will appear here.' : 'No note tucked into this song just yet.'}</p></>}
    {note && <span className="note-signature">Mibble <span>♡</span></span>}
  </section>;
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement; ref.current.showModal();
    const body = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = body; previous?.focus?.(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal ${wide ? 'wide' : ''}`} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) { const r = ref.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <div className="modal-heading"><h2 id={titleId}>{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={21}/></IconButton></div>{children}
  </dialog>;
}
export function PlayerBar({ player: p, fallback, onStart, loved, onLove, playlistName }) {
  const song = p.current || fallback;
  return <div className="player-dock" role="region" aria-label="Radio player">
    <div className="dock-track"><Art song={song}/><div><span className="eyebrow">{p.loading ? 'TUNING IN…' : p.playing ? 'NOW PLAYING' : p.current ? 'ON THE TURNTABLE' : 'READY WHEN YOU ARE'}</span><strong>{song?.title || 'The drawer is quiet'}</strong><small>{playlistName || 'WGOB · Dark O’Clock Radio'}</small></div><IconButton label={loved ? 'Remove from favorites' : 'Add to favorites'} disabled={!song} onClick={() => onLove(song.id)} aria-pressed={loved}><Heart size={18} fill={loved ? 'currentColor' : 'none'}/></IconButton></div>
    <div className="dock-center"><div className="transport">
      <IconButton label={p.mode === 'shuffle' ? 'Turn shuffle off' : 'Shuffle songs'} aria-pressed={p.mode === 'shuffle'} onClick={() => p.setMode(p.mode === 'shuffle' ? 'order' : 'shuffle')}><Shuffle size={18}/></IconButton>
      <IconButton label="Previous song" disabled={!p.current} onClick={p.previous}><SkipBack size={21} fill="currentColor"/></IconButton>
      <button className="play-button" aria-label={p.playing ? 'Pause' : 'Play'} disabled={!song} onClick={p.current ? p.toggle : onStart}>{p.playing ? <Pause size={22} fill="currentColor"/> : <Play size={22} fill="currentColor"/>}</button>
      <IconButton label="Next song" disabled={!p.current} onClick={p.next}><SkipForward size={21} fill="currentColor"/></IconButton>
      <IconButton label={p.mode === 'single' ? 'Play through collection' : 'Stop after this song'} aria-pressed={p.mode === 'single'} onClick={() => p.setMode(p.mode === 'single' ? 'order' : 'single')}>{p.mode === 'single' ? <CircleDot size={18}/> : <Repeat2 size={18}/>}</IconButton>
    </div><div className="seek-row"><time>{formatTime(p.position)}</time><input aria-label="Seek in song" type="range" min="0" max={p.duration || song?.duration || 1} step="0.1" value={Math.min(p.position, p.duration || song?.duration || 1)} onChange={e => p.seek(Number(e.target.value))} disabled={!p.current} style={{ '--progress': `${p.duration ? p.position / p.duration * 100 : 0}%` }}/><time>{formatTime(p.duration || song?.duration)}</time></div></div>
    <div className="dock-volume"><IconButton label={p.volume ? 'Mute' : 'Unmute'} onClick={() => p.setVolume(p.volume ? 0 : 0.7)}>{p.volume ? <Volume2 size={19}/> : <VolumeX size={19}/>}</IconButton><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={p.volume} onChange={e => p.setVolume(Number(e.target.value))} style={{ '--progress': `${p.volume * 100}%` }}/><span className="dock-frequency">WGOB<br/><b>DARK O’CLOCK</b></span></div>
  </div>;
}
