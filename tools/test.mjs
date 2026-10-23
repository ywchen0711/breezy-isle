// node tools/test.mjs: the island is connected, the data is consistent, and bosses are beatable with the right gear
import { genWorld, walkable, S, TL, tileAt, waterAhead, collide } from '../js/world.js';
import { ITEMS, RECIPES, CROPS, FISH, BUGS, BOSSES, HOUSES, DECOR, STORE, buyPrice, maxHp } from '../js/data.js';
import { BossFight, inShape, swingDamage, takenDamage } from '../js/boss.js';

let fails = 0;
const ok = (name, cond, info = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${info ? '  ' + info : ''}`); if (!cond) fails++; };

// 1. the island
const W = genWorld();
const seen = new Uint8Array(S * S), q = [];
const sx = Math.floor(W.spawn.x), sz = Math.floor(W.spawn.z);
seen[sz * S + sx] = 1; q.push(sz * S + sx);
while (q.length) { const i = q.pop(), x = i % S, z = (i / S) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz, j = nz * S + nx; if (!seen[j] && walkable(W, nx, nz)) { seen[j] = 1; q.push(j); } } }
const reach = (p) => { for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (seen[(Math.floor(p.z) + dz) * S + Math.floor(p.x) + dx]) return true; return false; };
const spots = { doors: W.shops.map((s) => s.door), board: [W.board], altar: [W.altar], plots: W.plots.map((p) => ({ x: p.x + p.w / 2, z: p.z + p.d - 1 })), arena: [{ x: W.arena.x, z: W.arena.z }] };
const bad = Object.entries(spots).flatMap(([k, list]) => list.filter((p) => !reach(p)).map((p) => `${k}@${p.x},${p.z}`));
ok('every place on the island can be walked to', !bad.length, bad.join(' ') || `${W.trees.length} trees, ${W.rocks.length} rocks, ${W.flowers.length} flowers, ${W.plots.length} plots`);
const waters = { river: 0, sea: 0, pond: 0 };
for (let z = 0; z < S; z += 2) for (let x = 0; x < S; x += 2) if (seen[z * S + x]) for (const yaw of [0, 1.57, 3.14, 4.71]) { const w = waterAhead(W, x + 0.5, z + 0.5, yaw); if (w) waters[w]++; }
ok('you can fish in the river, the sea and the pond', waters.river > 5 && waters.sea > 5 && waters.pond > 5, JSON.stringify(waters));
ok('every tree and rock has a free side to stand on', [...W.trees, ...W.rocks].every((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => seen[(Math.floor(t.z) + dz) * S + Math.floor(t.x) + dx])));
const [cx, cz] = collide(W, W.shops[0].x, W.shops[0].z, 0.5);
ok('walls push you out', Math.abs(cx - W.shops[0].x) + Math.abs(cz - W.shops[0].z) > 1);

// 2. data
const missing = [];
for (const [res, , need] of RECIPES) { if (!ITEMS[res]) missing.push('recipe→' + res); for (const k of Object.keys(need)) if (!ITEMS[k]) missing.push('needs ' + k); }
for (const id of STORE) if (!ITEMS[id] || !(buyPrice(id) > 0)) missing.push('store ' + id);
for (const h of HOUSES) for (const k of Object.keys(h.cost)) if (!ITEMS[k]) missing.push('house ' + k);
for (const b of Object.values(BOSSES)) { for (const k of Object.keys(b.drops)) if (k !== 'coins' && !ITEMS[k]) missing.push('drop ' + k); if (!DECOR[b.trophy.replace('decor_', '')] && !ITEMS['decor_' + b.trophy]) missing.push('trophy ' + b.trophy); }
ok('recipes, shop, houses and drops only use real items', !missing.length, missing.join(', ') || `${Object.keys(ITEMS).length} items, ${FISH.length} fish, ${BUGS.length} bugs, ${RECIPES.length} recipes`);
ok('every crop is worth growing', Object.entries(CROPS).every(([id, c]) => ITEMS[id].price > c.seed), Object.entries(CROPS).map(([id, c]) => `${id} ${c.seed}→${ITEMS[id].price}`).join(' '));

// 3. boss fights with bot parties: they attack, and step out of warning shapes most of the time
function fight(type, n, gearTier, lv, seed) {
  const G = [{}, { atk: 11, def: 6, hp: 20 }, { atk: 18, def: 10, hp: 40 }, { atk: 27, def: 15, hp: 60 }, { atk: 38, def: 18, hp: 120 }][gearTier];
  const B = new BossFight(type, Array.from({ length: n }, (_, i) => 'p' + i), seed);
  let s = seed; const r = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const ps = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, x: 80 + (i - n / 2) * 2, z: 30, hp: maxHp(lv, G), dead: false, cd: 0, food: 3 }));
  const atk = 4 + (G.atk || 0) + lv * 0.5, def = G.def || 0;
  let t = 0;
  while (!B.over && t < 300) {
    const dt = 0.1; t += dt;
    for (const p of ps) {
      if (p.dead) continue;
      // dodge: notice a shape under you 60% of the time and step out sideways
      const danger = B.tele.find((q) => q.t < 0.9 && inShape(q, p.x, p.z));
      if (danger && r() < 0.6 * dt * 10) { const a = Math.atan2(p.x - B.x, p.z - B.z) + 1.4; p.x += Math.sin(a) * 6 * dt * 3; p.z += Math.cos(a) * 6 * dt * 3; continue; }
      const d = Math.hypot(B.x - p.x, B.z - p.z), reach = B.D.size + 1.6;
      if (d > reach) { p.x += (B.x - p.x) / d * 6 * dt; p.z += (B.z - p.z) / d * 6 * dt; }
      else if ((p.cd -= dt) <= 0) { B.hit(swingDamage(atk, r())); p.cd = 0.55; }
      if (p.hp < maxHp(lv, G) * 0.35 && p.food > 0) { p.food--; p.hp += 60; }
    }
    for (const e of B.step(dt, ps)) {
      if (e.k === 'boom') for (const p of ps) if (!p.dead && inShape(e.shape, p.x, p.z)) { p.hp -= takenDamage(e.dmg, def); if (p.hp <= 0) p.dead = true; }
      if (e.k === 'touch') { const p = ps.find((x) => x.id === e.to); p.hp -= takenDamage(e.dmg, def); if (p.hp <= 0) p.dead = true; }
    }
  }
  return { win: B.over === 'win', t: Math.round(t), alive: ps.filter((p) => !p.dead).length };
}
const tries = (type, n, tier, lv) => { const res = [1, 2, 3, 4, 5, 6].map((sd) => fight(type, n, tier, lv, sd * 7919)); return { wins: res.filter((x) => x.win).length, t: Math.round(res.reduce((a, x) => a + x.t, 0) / res.length) }; };
const cases = [['slime', 1, 0, 1], ['slime', 1, 1, 4], ['slime', 3, 1, 4], ['golem', 2, 1, 6], ['golem', 2, 2, 10], ['golem', 4, 2, 10], ['dragon', 2, 2, 12], ['dragon', 3, 3, 18], ['dragon', 4, 4, 22]];
const out = {};
for (const c of cases) { const k = c.join('/'); out[k] = tries(...c); console.log(`   ${c[0]} · ${c[1]} players · gear tier ${c[2]} · Lv${c[3]}: ${out[k].wins}/6 wins, ~${out[k].t}s`); }
ok('a slime king needs some gear', out['slime/1/0/1'].wins <= 2 && out['slime/1/1/4'].wins >= 4);
ok('the golem wants iron', out['golem/2/1/6'].wins <= 3 && out['golem/2/2/10'].wins >= 4);
ok('the dragon wants gold or better and friends', out['dragon/2/2/12'].wins <= 2 && out['dragon/3/3/18'].wins >= 3 && out['dragon/4/4/22'].wins >= 5);
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
