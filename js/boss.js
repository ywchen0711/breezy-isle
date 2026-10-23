// A boss fight, run by the party leader's browser (no DOM: tests run it in node).
// The boss picks a target, walks, and winds up attacks shown on the ground as warning shapes; when a shape
// goes off, every player checks whether they are standing in it (main.js). Players send their hits to the leader.
import { BOSSES } from './data.js?v=4';
import { ARENA } from './world.js?v=4';

let nextTele = 1;
export class BossFight {
  constructor(type, members, seed = Date.now()) {
    const D = BOSSES[type];
    this.type = type; this.D = D; this.members = [...members];
    const n = Math.max(1, members.length);
    this.max = Math.round(D.hp * (0.6 + 0.4 * n)); this.hp = this.max;
    this.x = ARENA.x; this.z = ARENA.z - 4; this.yaw = 0;
    this.tele = []; this.cd = 3; this.t = 0; this.n = 0; this.tgt = null; this.over = null; this.act = '';
    let s = seed >>> 0 || 1; this.r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  }
  get enraged() { return this.hp < this.max * (this.type === 'dragon' ? 0.4 : 0.5); }
  // players: [{ id, x, z, dead }] — returns events: { k: 'boom', shape, dmg } | { k: 'touch', to, dmg }
  step(dt, players) {
    const out = [];
    if (this.over) return out;
    this.t += dt;
    const live = players.filter((p) => this.members.includes(p.id) && !p.dead && Math.hypot(p.x - ARENA.x, p.z - ARENA.z) < ARENA.r + 2);
    if (!live.length) { if (this.t > 3) this.over = 'lose'; return out; }
    if (!this.tgt || !live.some((p) => p.id === this.tgt) || this.r() < dt * 0.15) this.tgt = live[Math.floor(this.r() * live.length)].id;
    const T = live.find((p) => p.id === this.tgt);
    // walk toward the target (the dragon mostly holds the middle)
    const busy = this.tele.some((q) => q.self);
    const want = this.type === 'dragon' ? 7 : this.D.size + 1.2, d = Math.hypot(T.x - this.x, T.z - this.z);
    if (!busy && d > want) {
      const sp = this.D.speed * (this.enraged ? 1.25 : 1) * dt;
      this.x += (T.x - this.x) / d * Math.min(sp, d - want); this.z += (T.z - this.z) / d * Math.min(sp, d - want);
      const k = Math.hypot(this.x - ARENA.x, this.z - ARENA.z), lim = ARENA.r - this.D.size * 0.6;
      if (k > lim) { this.x = ARENA.x + (this.x - ARENA.x) / k * lim; this.z = ARENA.z + (this.z - ARENA.z) / k * lim; }
    }
    if (!busy) { const wy = Math.atan2(T.x - this.x, T.z - this.z); this.yaw += Math.atan2(Math.sin(wy - this.yaw), Math.cos(wy - this.yaw)) * Math.min(1, dt * 5); }
    // wind up a new attack
    this.cd -= dt;
    if (this.cd <= 0 && this.t > 2) { this.attack(live, T); this.n++; this.cd = ({ slime: 2.8, golem: 2.6, dragon: 2.4 }[this.type]) * (this.enraged ? 0.72 : 1); }
    // shapes that go off
    for (const q of this.tele) q.t -= dt;
    for (const q of this.tele.filter((x) => x.t <= 0)) {
      out.push({ k: 'boom', shape: q, dmg: Math.round(this.D.atk * q.m) });
      if (q.move) { this.x = q.move[0]; this.z = q.move[1]; }
    }
    this.tele = this.tele.filter((q) => q.t > 0);
    // bumping into the boss hurts a little
    this.touchT = (this.touchT || 0) - dt;
    if (this.touchT <= 0) { this.touchT = 1; for (const p of live) if (Math.hypot(p.x - this.x, p.z - this.z) < this.D.size * 0.75) out.push({ k: 'touch', to: p.id, dmg: Math.round(this.D.atk * 0.35) }); }
    return out;
  }
  shape(q) { q.id = nextTele++; q.t0 = q.t; this.tele.push(q); return q; }
  attack(live, T) {
    const r = this.r, rand = () => live[Math.floor(r() * live.length)], s = this.D.size;
    if (this.type === 'slime') {
      if (this.n % 4 === 3) { this.act = 'ring'; this.shape({ k: 'ring', x: this.x, z: this.z, r: s + 4.5, r2: s + 0.8, t: 1.3, m: 0.8, self: true }); }
      else { this.act = 'slam'; this.shape({ k: 'circle', x: T.x, z: T.z, r: 3.2, t: 1.25, m: 1, self: true, move: [T.x, T.z] }); }
      if (this.enraged) for (let i = 0; i < 2; i++) { const p = rand(); this.shape({ k: 'circle', x: p.x + (r() - 0.5) * 3, z: p.z + (r() - 0.5) * 3, r: 2.2, t: 1.6, m: 0.6 }); }
    } else if (this.type === 'golem') {
      const pick = this.n % 3;
      if (pick === 0) { this.act = 'pound'; this.shape({ k: 'circle', x: this.x, z: this.z, r: s + 2.6, t: 1.4, m: 1, self: true }); }
      else if (pick === 1) { this.act = 'rock'; for (let i = 0; i < (this.enraged ? 3 : 1 + Math.min(2, live.length - 1)); i++) { const p = rand(); this.shape({ k: 'circle', x: p.x, z: p.z, r: 2.6, t: 1.5, m: 0.9 }); } }
      else {
        this.act = 'charge'; const yaw = Math.atan2(T.x - this.x, T.z - this.z), len = 13;
        let ex = this.x + Math.sin(yaw) * len, ez = this.z + Math.cos(yaw) * len; const k = Math.hypot(ex - ARENA.x, ez - ARENA.z), lim = ARENA.r - s * 0.6;
        if (k > lim) { ex = ARENA.x + (ex - ARENA.x) / k * lim; ez = ARENA.z + (ez - ARENA.z) / k * lim; }
        this.shape({ k: 'line', x: this.x, z: this.z, x2: ex, z2: ez, w: 3.2, t: 1.2, m: 1.3, self: true, move: [ex, ez] });
      }
    } else {
      const pick = this.n % 3;
      if (pick === 0) { this.act = 'breath'; this.shape({ k: 'cone', x: this.x, z: this.z, yaw: Math.atan2(T.x - this.x, T.z - this.z), r: 12, a: 0.65, t: 1.3, m: 1.2, self: true }); }
      else if (pick === 1) { this.act = 'meteor'; const n = this.enraged ? 7 : 4 + Math.min(2, live.length - 1); for (let i = 0; i < n; i++) { const p = rand(); this.shape({ k: 'circle', x: p.x + (r() - 0.5) * 6, z: p.z + (r() - 0.5) * 6, r: 2.6, t: 1.7 + r() * 0.5, m: 0.9 }); } }
      else { this.act = 'tail'; this.shape({ k: 'circle', x: this.x, z: this.z, r: s + 3, t: 1.0, m: 1, self: true }); }
    }
  }
  hit(dmg) { if (this.over) return; this.hp = Math.max(0, this.hp - Math.max(0, Math.min(500, dmg))); if (this.hp <= 0) this.over = 'win'; }
  snap() { return { type: this.type, hp: this.hp, max: this.max, x: +this.x.toFixed(2), z: +this.z.toFixed(2), yaw: +this.yaw.toFixed(2), act: this.act, tele: this.tele.map((q) => ({ ...q, t: +q.t.toFixed(2) })), over: this.over, members: this.members }; }
}
// is (x, z) inside an attack shape?
export function inShape(q, x, z) {
  if (q.k === 'circle') return Math.hypot(x - q.x, z - q.z) < q.r;
  if (q.k === 'ring') { const d = Math.hypot(x - q.x, z - q.z); return d < q.r && d > q.r2; }
  if (q.k === 'cone') { const d = Math.hypot(x - q.x, z - q.z); if (d > q.r || d < 0.5) return d <= 0.5; const a = Math.atan2(x - q.x, z - q.z) - q.yaw; return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < q.a; }
  if (q.k === 'line') { const dx = q.x2 - q.x, dz = q.z2 - q.z, L = Math.hypot(dx, dz) || 1, t = Math.max(0, Math.min(1, ((x - q.x) * dx + (z - q.z) * dz) / (L * L))); return Math.hypot(x - q.x - t * dx, z - q.z - t * dz) < q.w / 2; }
  return false;
}
// what a hit from a player does: weapon attack ± 10%
export const swingDamage = (atk, r = Math.random()) => Math.round(atk * (0.9 + r * 0.2));
export const takenDamage = (dmg, def) => Math.max(1, Math.round(dmg - def * 0.6));
