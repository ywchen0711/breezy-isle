// The island: the same for every player (a fixed seed), built on a grid of 1-stud tiles.
// Town plaza in the middle with the shops; forest and pond to the west, flower meadow north-west, quarry east past
// the river, homes to the south, the boss cave up north, sea all round.
export const S = 160;
export const TL = { SEA: 0, SAND: 1, GRASS: 2, PATH: 3, PLAZA: 4, RIVER: 5, POND: 6, CLIFF: 7, DIRT: 8, BRIDGE: 9, ARENA: 10, LOT: 11 };
const WATER = new Set([TL.SEA, TL.RIVER, TL.POND]);
export const isWater = (t) => WATER.has(t);

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const C = 80;
const shoreR = (a) => 64 + 5 * Math.sin(3 * a) + 3.5 * Math.sin(5 * a + 1) + 2 * Math.sin(9 * a + 2);
const distSeg = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
const distLine = (px, pz, pts) => { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return d; };

export const RIVER = [[112, 10], [108, 34], [116, 56], [112, 84], [122, 108], [150, 128]];
export const PATHS = [
  [[80, 88], [80, 133]], [[80, 68], [80, 37]], [[67, 78], [44, 76], [30, 72]], [[93, 78], [112, 76], [134, 72]],
  [[55, 106.5], [105, 106.5]], [[55, 121.5], [105, 121.5]], [[52, 76], [50, 44]],
];
export const PLAZA = { x0: 66, x1: 94, z0: 66, z1: 90 };
export const ARENA = { x: 80, z: 22, r: 12 };
export const POND = { x: 30, z: 84, r: 7.5 };

export function genWorld() {
  const r = rng(20261022);
  const tile = new Uint8Array(S * S), solid = new Uint8Array(S * S);
  const at = (x, z) => tile[z * S + x];
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - C, dz = z + 0.5 - C, d = Math.hypot(dx, dz), R = shoreR(Math.atan2(dz, dx));
    let t = d > R ? TL.SEA : d > R - 5 ? TL.SAND : TL.GRASS;
    if (t !== TL.SEA) {
      if (Math.hypot(x + 0.5 - POND.x, z + 0.5 - POND.z) < POND.r) t = TL.POND;
      const rv = distLine(x + 0.5, z + 0.5, RIVER); if (rv < 3.2) t = TL.RIVER;
      if (x >= 126 && x <= 142 && z >= 60 && z <= 84 && t === TL.GRASS) t = TL.DIRT;
      for (const p of PATHS) if (distLine(x + 0.5, z + 0.5, p) < 1.6 && t !== TL.POND) t = t === TL.RIVER ? TL.BRIDGE : TL.PATH;
      if (x >= PLAZA.x0 && x < PLAZA.x1 && z >= PLAZA.z0 && z < PLAZA.z1) t = TL.PLAZA;
      const da = Math.hypot(x + 0.5 - ARENA.x, z + 0.5 - ARENA.z);
      if (da < ARENA.r) t = TL.ARENA; else if (da < ARENA.r + 3 && !(Math.abs(x + 0.5 - ARENA.x) < 2.2 && z > ARENA.z)) t = TL.CLIFF;
    }
    tile[z * S + x] = t;
  }
  // the homes: a neighbourhood of twelve plots, two columns either side of the south road, three rows
  const plots = [];
  for (let row = 0; row < 3; row++) for (const x of [55, 67, 82, 94]) {
    const z = 93 + row * 15, w = 11, d = 12;
    for (let zz = z; zz < z + d; zz++) for (let xx = x; xx < x + w; xx++) tile[zz * S + xx] = TL.LOT;
    plots.push({ i: plots.length, x, z, w, d, house: { x: x + 3.4, z: z + 3.2 }, farm: { x: x + 1.1, z: z + 6.6, cols: 4, rows: 4, gap: 1.15 },
      yard: { x: x + 6.6, z: z + 6.8, cols: 3, rows: 3, gap: 1.6 }, sign: { x: x + w - 1.2, z: z + 1.2 } });
  }
  // shops: the general store and furniture shop on the plaza's north side, the workshop by the east road
  const shops = [
    { id: 'store', x: 71, z: 63, w: 7, d: 5, color: 0xe8584a }, { id: 'decor', x: 89, z: 63, w: 7, d: 5, color: 0x3aa8d8 },
    { id: 'workshop', x: 99, z: 70, w: 8, d: 6, color: 0x8a6a4a },
  ];
  for (const s of shops) { s.door = { x: s.x, z: s.z + s.d / 2 + 1.2 }; s.npc = { x: s.x + 1.6, z: s.z + s.d / 2 + 1.4 }; }
  const board = { x: 72, z: 86 }, altar = { x: ARENA.x, z: ARENA.z + 6 }, fountain = { x: 80, z: 78 };
  const block = (x0, z0, x1, z1) => { for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) if (x >= 0 && z >= 0 && x < S && z < S) solid[z * S + x] = 1; };
  for (const s of shops) block(s.x - s.w / 2, s.z - s.d / 2, s.x + s.w / 2, s.z + s.d / 2);
  block(fountain.x - 2, fountain.z - 2, fountain.x + 2, fountain.z + 2);
  block(board.x - 1, board.z - 0.3, board.x + 1, board.z + 0.3);
  // trees, rocks and flowers: dense forest in the west, a meadow north-west, the quarry east
  const trees = [], rocks = [], flowers = [];
  const free = (x, z, pad = 1) => { for (let dz = -pad; dz <= pad; dz++) for (let dx = -pad; dx <= pad; dx++) { const t = at(x + dx, z + dz); if (t !== TL.GRASS && t !== TL.DIRT && t !== TL.SAND || solid[(z + dz) * S + x + dx]) return false; } return true; };
  const FRUITS = ['apple', 'orange', 'peach', 'cherry'];
  for (let z = 2; z < S - 2; z++) for (let x = 2; x < S - 2; x++) {
    const t = at(x, z); if (t !== TL.GRASS && t !== TL.DIRT) continue;
    const forest = x < 60 && z > 50 && z < 108, meadow = x > 34 && x < 70 && z > 30 && z < 60, quarry = t === TL.DIRT, nearTown = x > 60 && x < 100 && z > 56 && z < 96;
    const v = r();
    if (quarry) { if (v < 0.09 && free(x, z)) { const o = r(); rocks.push({ id: rocks.length, x: x + 0.5, z: z + 0.5, ore: o < 0.08 ? 'gold' : o < 0.3 ? 'iron' : 'stone' }); solid[z * S + x] = 1; } continue; }
    const pT = forest ? 0.13 : meadow ? 0.012 : nearTown ? 0.002 : 0.009;
    if (v < pT && free(x, z)) { const fruit = (meadow || !forest) && r() < 0.45 ? FRUITS[Math.floor(r() * 4)] : forest && r() < 0.12 ? FRUITS[Math.floor(r() * 4)] : null; trees.push({ id: trees.length, x: x + 0.5, z: z + 0.5, fruit, s: 0.85 + r() * 0.4 }); solid[z * S + x] = 1; continue; }
    if (v < pT + (forest ? 0.004 : 0.003) && free(x, z)) { rocks.push({ id: rocks.length, x: x + 0.5, z: z + 0.5, ore: r() < 0.1 ? 'iron' : 'stone' }); solid[z * S + x] = 1; continue; }
    if (v > 1 - (meadow ? 0.12 : nearTown ? 0.01 : 0.025)) flowers.push({ x: x + 0.5 + (r() - 0.5) * 0.6, z: z + 0.5 + (r() - 0.5) * 0.6, c: Math.floor(r() * 5) });
  }
  return { tile, solid, plots, shops, board, altar, fountain, trees, rocks, flowers, spawn: { x: 80, z: 84 }, arena: ARENA };
}

export const tileAt = (W, x, z) => { const ix = Math.floor(x), iz = Math.floor(z); if (ix < 0 || iz < 0 || ix >= S || iz >= S) return TL.SEA; return W.tile[iz * S + ix]; };
export const walkable = (W, ix, iz) => { if (ix < 0 || iz < 0 || ix >= S || iz >= S) return false; const t = W.tile[iz * S + ix]; return !isWater(t) && t !== TL.CLIFF && !W.solid[iz * S + ix]; };
// push a circle out of blocked tiles and the given rectangles [{x0,z0,x1,z1}]
export function collide(W, x, z, rad, rects = []) {
  for (let pass = 0; pass < 2; pass++) {
    for (let iz = Math.floor(z - rad); iz <= Math.floor(z + rad); iz++) for (let ix = Math.floor(x - rad); ix <= Math.floor(x + rad); ix++) {
      if (walkable(W, ix, iz)) continue;
      [x, z] = pushOut(x, z, rad, ix, iz, ix + 1, iz + 1);
    }
    for (const q of rects) [x, z] = pushOut(x, z, rad, q.x0, q.z0, q.x1, q.z1);
  }
  return [x, z];
}
function pushOut(x, z, rad, x0, z0, x1, z1) {
  const nx = Math.max(x0, Math.min(x, x1)), nz = Math.max(z0, Math.min(z, z1)), dx = x - nx, dz = z - nz, d = Math.hypot(dx, dz);
  if (d >= rad) return [x, z];
  if (d < 1e-6) { const l = x - x0, r = x1 - x, t = z - z0, b = z1 - z, m = Math.min(l, r, t, b); return m === l ? [x0 - rad, z] : m === r ? [x1 + rad, z] : m === t ? [x, z0 - rad] : [x, z1 + rad]; }
  return [nx + dx / d * rad, nz + dz / d * rad];
}
// what water is in front of you (for fishing): 'river' | 'sea' | 'pond' | null
export function waterAhead(W, x, z, yaw, reach = 2.6) {
  for (let s = 1; s <= reach; s += 0.4) { const t = tileAt(W, x + Math.sin(yaw) * s, z + Math.cos(yaw) * s); if (t === TL.RIVER) return 'river'; if (t === TL.SEA) return 'sea'; if (t === TL.POND) return 'pond'; }
  return null;
}
// the shared clock: one real minute is one hour on the island
export const islandHour = (now = Date.now()) => (now / 60000) % 24;
export const isNight = (h = islandHour()) => h >= 19 || h < 5;
