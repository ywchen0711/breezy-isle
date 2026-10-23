// The island: the same for every player (a fixed seed), built on a grid of 1-stud tiles.
// Town plaza in the middle with the shops; forests west, north-east and south-east, ponds and a lake, a flower meadow
// north-west, the quarry east past the river, twenty-four homes to the south, the boss cave up north, sea all round.
export const S = 320;
export const TL = { SEA: 0, SAND: 1, GRASS: 2, PATH: 3, PLAZA: 4, RIVER: 5, POND: 6, CLIFF: 7, DIRT: 8, BRIDGE: 9, ARENA: 10, LOT: 11 };
const WATER = new Set([TL.SEA, TL.RIVER, TL.POND]);
export const isWater = (t) => WATER.has(t);

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const C = 160;
const shoreR = (a) => 128 + 10 * Math.sin(3 * a) + 7 * Math.sin(5 * a + 1) + 4 * Math.sin(9 * a + 2) + 2 * Math.sin(17 * a + 4);
const distSeg = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
const distLine = (px, pz, pts) => { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return d; };

// the town sits in the middle; everything else is laid out round it
export const PLAZA = { x0: C - 14, x1: C + 14, z0: C - 16, z1: C + 8 };
export const ARENA = { x: C, z: 44, r: 12 };
export const PONDS = [{ x: 60, z: 172, r: 10 }, { x: 250, z: 72, r: 12 }, { x: 118, z: 252, r: 7 }];
export const POND = PONDS[0];
export const RIVER = [[224, 18], [214, 70], [232, 116], [222, 168], [244, 216], [302, 258]];
const ROWS = 6, COLS = [C - 25, C - 13, C + 2, C + 14], ROW0 = PLAZA.z1 + 5;
export const PATHS = [
  [[C, PLAZA.z1], [C, ROW0 + ROWS * 15 + 6]], [[C, PLAZA.z0], [C, ARENA.z + ARENA.r + 1]],
  [[PLAZA.x0, C - 4], [104, C - 10], [62, C - 22]], [[PLAZA.x1, C - 4], [224, C - 8], [270, C - 16]],
  [[104, C - 10], [100, 86]], [[62, C - 22], [56, 220], [100, 262]], [[224, C - 8], [252, 92]],
  ...Array.from({ length: ROWS - 1 }, (_, i) => [[COLS[0], ROW0 + i * 15 + 13.5], [COLS[3] + 11, ROW0 + i * 15 + 13.5]]),
];

export function genWorld() {
  const r = rng(20261023);
  const tile = new Uint8Array(S * S), solid = new Uint8Array(S * S);
  const at = (x, z) => tile[z * S + x];
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - C, dz = z + 0.5 - C, d = Math.hypot(dx, dz), R = shoreR(Math.atan2(dz, dx));
    let t = d > R ? TL.SEA : d > R - 7 ? TL.SAND : TL.GRASS;
    if (t !== TL.SEA) {
      for (const p of PONDS) if (Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z) < p.r) t = TL.POND;
      const rv = distLine(x + 0.5, z + 0.5, RIVER); if (rv < 3.4) t = TL.RIVER;
      if (x >= 252 && x <= 286 && z >= 120 && z <= 170 && t === TL.GRASS) t = TL.DIRT;
      for (const p of PATHS) if (distLine(x + 0.5, z + 0.5, p) < 1.6 && t !== TL.POND && t !== TL.SEA) t = t === TL.RIVER ? TL.BRIDGE : TL.PATH;
      if (x >= PLAZA.x0 && x < PLAZA.x1 && z >= PLAZA.z0 && z < PLAZA.z1) t = TL.PLAZA;
      const da = Math.hypot(x + 0.5 - ARENA.x, z + 0.5 - ARENA.z);
      if (da < ARENA.r) t = TL.ARENA; else if (da < ARENA.r + 3 && !(Math.abs(x + 0.5 - ARENA.x) < 2.2 && z > ARENA.z)) t = TL.CLIFF;
    }
    tile[z * S + x] = t;
  }
  // the homes: twenty-four plots, two columns either side of the south road, six rows
  const plots = [];
  for (let row = 0; row < ROWS; row++) for (const x of COLS) {
    const z = ROW0 + row * 15, w = 11, d = 12;
    for (let zz = z; zz < z + d; zz++) for (let xx = x; xx < x + w; xx++) tile[zz * S + xx] = TL.LOT;
    plots.push({ i: plots.length, x, z, w, d, house: { x: x + 3.4, z: z + 3.2 }, farm: { x: x + 1.1, z: z + 6.6, cols: 4, rows: 4, gap: 1.15 },
      yard: { x: x + 6.6, z: z + 6.8, cols: 3, rows: 3, gap: 1.6 }, sign: { x: x + w - 1.2, z: z + 1.2 } });
  }
  // shops: the general store and furniture shop on the plaza's north side, the workshop by the east road
  const shops = [
    { id: 'store', x: C - 9, z: PLAZA.z0 - 3, w: 7, d: 5, color: 0xe8584a }, { id: 'decor', x: C + 9, z: PLAZA.z0 - 3, w: 7, d: 5, color: 0x3aa8d8 },
    { id: 'workshop', x: PLAZA.x1 + 5, z: C - 10, w: 8, d: 6, color: 0x8a6a4a },
  ];
  for (const s of shops) { s.door = { x: s.x, z: s.z + s.d / 2 + 1.2 }; s.npc = { x: s.x + 1.6, z: s.z + s.d / 2 + 1.4 }; }
  const board = { x: C - 8, z: PLAZA.z1 - 2 }, altar = { x: ARENA.x, z: ARENA.z + 6 }, fountain = { x: C, z: C - 4 };
  const block = (x0, z0, x1, z1) => { for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) if (x >= 0 && z >= 0 && x < S && z < S) solid[z * S + x] = 1; };
  for (const s of shops) block(s.x - s.w / 2, s.z - s.d / 2, s.x + s.w / 2, s.z + s.d / 2);
  block(fountain.x - 2, fountain.z - 2, fountain.x + 2, fountain.z + 2);
  block(board.x - 1, board.z - 0.3, board.x + 1, board.z + 0.3);
  // trees, rocks and flowers: forests west and north-east, a flower meadow north-west, the quarry east past the river
  const trees = [], rocks = [], flowers = [];
  const free = (x, z, pad = 1) => { for (let dz = -pad; dz <= pad; dz++) for (let dx = -pad; dx <= pad; dx++) { const t = at(x + dx, z + dz); if (t !== TL.GRASS && t !== TL.DIRT && t !== TL.SAND || solid[(z + dz) * S + x + dx]) return false; } return true; };
  const FRUITS = ['apple', 'orange', 'peach', 'cherry'];
  for (let z = 2; z < S - 2; z++) for (let x = 2; x < S - 2; x++) {
    const t = at(x, z); if (t !== TL.GRASS && t !== TL.DIRT) continue;
    const forest = (x < 122 && z > 108 && z < 236) || (x > 176 && x < 206 && z > 30 && z < 112) || (x > 196 && x < 280 && z > 196 && z < 250);
    const meadow = x > 66 && x < 146 && z > 54 && z < 104, quarry = t === TL.DIRT, nearTown = Math.abs(x - C) < 34 && z > PLAZA.z0 - 12 && z < ROW0 + ROWS * 15 + 4;
    const v = r();
    if (quarry) { if (v < 0.08 && free(x, z)) { const o = r(); rocks.push({ id: rocks.length, x: x + 0.5, z: z + 0.5, ore: o < 0.08 ? 'gold' : o < 0.3 ? 'iron' : 'stone' }); solid[z * S + x] = 1; } continue; }
    const pT = forest ? 0.12 : meadow ? 0.01 : nearTown ? 0.0015 : 0.008;
    if (v < pT && free(x, z)) { const fruit = (meadow || !forest) && r() < 0.45 ? FRUITS[Math.floor(r() * 4)] : forest && r() < 0.12 ? FRUITS[Math.floor(r() * 4)] : null; trees.push({ id: trees.length, x: x + 0.5, z: z + 0.5, fruit, s: 0.85 + r() * 0.45 }); solid[z * S + x] = 1; continue; }
    if (v < pT + (forest ? 0.004 : 0.0025) && free(x, z)) { rocks.push({ id: rocks.length, x: x + 0.5, z: z + 0.5, ore: r() < 0.1 ? 'iron' : 'stone' }); solid[z * S + x] = 1; continue; }
    if (v > 1 - (meadow ? 0.12 : nearTown ? 0.008 : 0.022)) flowers.push({ x: x + 0.5 + (r() - 0.5) * 0.6, z: z + 0.5 + (r() - 0.5) * 0.6, c: Math.floor(r() * 5) });
  }
  return { tile, solid, plots, shops, board, altar, fountain, trees, rocks, flowers, spawn: { x: C, z: PLAZA.z1 - 4 }, arena: ARENA, plaza: PLAZA, ponds: PONDS };
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
