export class ShuffleBag {
  constructor(random = Math.random) { this.random = random; this.bag = []; this.played = new Set(); }
  reset(current) { this.bag = []; this.played = new Set(current ? [current] : []); }
  next(ids, current) {
    if (!ids.length) return null;
    if (ids.length === 1) return ids[0];
    const available = new Set(ids);
    this.bag = this.bag.filter(id => available.has(id) && !this.played.has(id));
    for (const id of ids) if (!this.played.has(id) && !this.bag.includes(id)) this.bag.push(id);
    if (!this.bag.length) { this.played = new Set([current]); this.bag = ids.filter(id => id !== current); }
    const i = Math.floor(this.random() * this.bag.length);
    const [next] = this.bag.splice(i, 1); this.played.add(next); return next;
  }
}
export const formatTime = seconds => `${Math.floor((Number(seconds) || 0) / 60)}:${String(Math.floor((Number(seconds) || 0) % 60)).padStart(2, '0')}`;
