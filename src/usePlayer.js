import { useEffect, useRef, useState } from 'react';
import { ShuffleBag } from './playback.mjs';
const saved = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
export const remember = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing may disable storage. */ } };
export { saved };
export function usePlayer(catalog) {
  const audio = useRef(null);
  if (!audio.current) { audio.current = new Audio(); audio.current.preload = 'metadata'; }
  const [current, setCurrent] = useState(null), [playing, setPlaying] = useState(false), [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0), [duration, setDuration] = useState(0), [error, setError] = useState('');
  const [volume, setVolume] = useState(() => Math.max(0, Math.min(1, Number(saved('wgob-volume', 0.7)))));
  const [mode, setMode] = useState(() => { const v = saved('wgob-mode', 'order'); return ['order','shuffle','single'].includes(v) ? v : 'order'; });
  const state = useRef({}); const shuffle = useRef(new ShuffleBag()); const history = useRef([]); const queue = useRef(null);
  const request = useRef(0);
  const play = async (song, playlistId, { manual = true } = {}) => {
    if (!song) return;
    const a = audio.current;
    if (manual && (queue.current !== playlistId || mode === 'shuffle')) shuffle.current.reset(song.id);
    queue.current = playlistId;
    if (state.current.current?.id !== song.id || a.src !== new URL(song.audio, location.href).href) {
      if (state.current.current) history.current.push(state.current.current);
      if (history.current.length > 200) history.current.shift();
      a.src = song.audio; setCurrent(song); setPosition(0); setDuration(song.duration); a.load();
    }
    const ticket = ++request.current;
    setError(''); setLoading(true);
    try { await a.play(); } catch (e) {
      if (ticket === request.current && e.name !== 'AbortError') { setError(e.name === 'NotAllowedError' ? 'Press play to let the music in.' : 'This song could not play. Try again, or choose another from the drawer.'); setPlaying(false); }
    } finally { if (ticket === request.current) setLoading(false); }
  };
  const next = () => {
    const { current: track, catalog: latest, mode: order } = state.current;
    const playlist = latest.playlists.find(p => p.id === queue.current);
    const ids = playlist?.songIds || [];
    if (!ids.length) { audio.current.pause(); setError('This collection is no longer available. Choose another collection.'); return; }
    const id = order === 'shuffle' ? shuffle.current.next(ids, track?.id) : ids[(ids.indexOf(track?.id) + 1) % ids.length];
    play(latest.songs.find(s => s.id === id), playlist.id, { manual: false });
  };
  const previous = () => {
    if (audio.current.currentTime > 3) { audio.current.currentTime = 0; return; }
    const last = history.current.pop();
    const latest = state.current.catalog;
    const p = latest.playlists.find(p => p.id === queue.current);
    const song = last && latest.songs.find(s => s.id === last.id);
    if (song) { const a = audio.current; a.src = song.audio; setCurrent(song); a.play().catch(() => setError('Press play to resume.')); }
    else if (p?.songIds.length) {
      const i = p.songIds.indexOf(state.current.current?.id);
      play(latest.songs.find(s => s.id === p.songIds[(i - 1 + p.songIds.length) % p.songIds.length]), p.id, { manual: false });
    }
  };
  const toggle = () => { if (audio.current.paused) { if (current) play(current, queue.current, { manual: false }); } else { request.current++; audio.current.pause(); setLoading(false); } };
  const seek = value => { if (Number.isFinite(audio.current.duration)) audio.current.currentTime = Math.min(audio.current.duration, Math.max(0, value)); };
  state.current = { current, catalog, mode, next };
  useEffect(() => {
    const a = audio.current;
    const handlers = {
      play: () => setPlaying(true), pause: () => setPlaying(false),
      timeupdate: () => setPosition(a.currentTime), durationchange: () => setDuration(Number.isFinite(a.duration) ? a.duration : 0),
      waiting: () => setLoading(true), playing: () => setLoading(false), canplay: () => setLoading(false),
      error: () => { setError('The audio could not be loaded. Please retry or choose another song.'); setLoading(false); setPlaying(false); },
      ended: () => { if (state.current.mode === 'single') { setPlaying(false); a.currentTime = 0; } else state.current.next(); },
    };
    for (const [event, fn] of Object.entries(handlers)) a.addEventListener(event, fn);
    return () => { for (const [event, fn] of Object.entries(handlers)) a.removeEventListener(event, fn); a.pause(); };
  }, []);
  useEffect(() => { audio.current.volume = volume; remember('wgob-volume', volume); }, [volume]);
  useEffect(() => { remember('wgob-mode', mode); shuffle.current.reset(current?.id); }, [mode]);
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.artist || 'WGOB · Dark O’Clock Radio', album: 'Goblin’s Reach', artwork: [{ src: new URL(current.artwork || '/radio-room.webp', location.href).href }] });
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    for (const [action, fn] of Object.entries({ play: toggle, pause: toggle, nexttrack: next, previoustrack: previous, seekto: details => seek(details.seekTime), seekbackward: details => seek(audio.current.currentTime - (details.seekOffset || 10)), seekforward: details => seek(audio.current.currentTime + (details.seekOffset || 10)) })) {
      try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* Unsupported browser media action. */ }
    }
  }, [current, playing, catalog, mode]);
  const pause = () => { request.current++; audio.current.pause(); setLoading(false); };
  return { current, playing, loading, position, duration, volume, setVolume, mode, setMode, play, pause, toggle, next, previous, seek, error, setError, playlistId: queue.current };
}
