// Low-poly models: chibi islanders, tools, houses, yard decor, crops, bosses and the town's buildings.
// Drawn like Sage Canyon: soft four-step cel shading and a dark brown outline round every model.
import * as THREE from 'three';
import { CROPS } from './data.js';

export const GRAD = (() => { const d = new Uint8Array([70, 150, 210, 255]); const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const mats = new Map();
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  const { flat, metalness, roughness, ...rest } = o;
  if (!mats.has(k)) mats.set(k, new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...rest }));
  return mats.get(k);
}
export const OUTLINE = new THREE.MeshBasicMaterial({ color: '#2e1e12', side: THREE.BackSide });
// a dark rim round a model: each part again, a little bigger, drawn inside out
export function outline(g, w = 0.045) {
  const add = [];
  g.traverse((o) => {
    if (!o.isMesh || o.userData.noOutline || o.userData.isOutline || o.material === OUTLINE || o.material.transparent) return;
    const m = new THREE.Mesh(o.geometry, OUTLINE); m.userData.noOutline = m.userData.isOutline = true;
    const s = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere);
    m.scale.setScalar(1 + w / Math.max(0.05, s.radius)); add.push([o, m]);
  });
  for (const [o, m] of add) o.add(m);
  return g;
}
const geos = new Map();
const geo = (k, make) => { if (!geos.has(k)) { const g = make(); g.userData.shared = true; geos.set(k, g); } return geos.get(k); };
const box = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const sph = (r, a = 12, b = 10) => geo(`s${r},${a}`, () => new THREE.SphereGeometry(r, a, b));
const cyl = (t, b, h, n = 10) => geo(`c${t},${b},${h},${n}`, () => new THREE.CylinderGeometry(t, b, h, n));
const cone = (r, h, n = 8) => geo(`k${r},${h},${n}`, () => new THREE.ConeGeometry(r, h, n));
const cap = (r, l) => geo(`p${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10));
function put(parent, g, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; }

// ------------------------------------------------------------------ people
// look: { skin, hair, style, shirt, pants }
function makePerson0(look, { apron = null, hat = null } = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = mat(look.skin), shirt = mat(look.shirt), pants = mat(look.pants || '#3a4a6a'), hair = mat(look.hair), dark = mat('#1a1420');
  const limb = (x, y, len, r, m) => { const p = new THREE.Group(); p.position.set(x, y, 0); body.add(p); put(p, cap(r, len), m, 0, -len / 2 - r * 0.3, 0); return p; };
  const legL = limb(-0.17, 0.62, 0.32, 0.12, pants), legR = limb(0.17, 0.62, 0.32, 0.12, pants);
  put(body, cap(0.3, 0.34), shirt, 0, 0.92, 0);
  if (apron) put(body, box(0.42, 0.42, 0.06), mat(apron), 0, 0.88, 0.29);
  const armL = limb(-0.4, 1.12, 0.3, 0.09, shirt), armR = limb(0.4, 1.12, 0.3, 0.09, shirt);
  put(armL, sph(0.1, 8, 6), skin, 0, -0.5, 0); put(armR, sph(0.1, 8, 6), skin, 0, -0.5, 0);
  const hand = new THREE.Group(); hand.position.set(0, -0.52, 0.06); armR.add(hand);
  const head = new THREE.Group(); head.position.set(0, 1.62, 0); body.add(head);
  put(head, sph(0.46, 16, 12), skin);
  for (const s of [-1, 1]) { const e = put(head, sph(0.065, 8, 6), dark, s * 0.16, 0.02, 0.42); e.scale.set(0.8, 1.3, 0.6); put(head, sph(0.06, 8, 6), mat('#ff9ab0'), s * 0.27, -0.1, 0.38).scale.z = 0.3; }
  const mouth = put(head, geo('mouth', () => new THREE.TorusGeometry(0.07, 0.016, 5, 10, Math.PI)), dark, 0, -0.12, 0.43); mouth.rotation.z = Math.PI;
  // hair
  const st = look.style || 'short';
  if (st !== 'cap') { const top = put(head, sph(0.49, 16, 10), hair, 0, 0.08, -0.03); top.scale.set(1, 0.85, 1); const cut = put(head, box(0.9, 0.35, 0.3), hair, 0, 0.2, 0.3); cut.rotation.x = -0.25; }
  if (st === 'long') { put(head, box(0.86, 0.75, 0.3), hair, 0, -0.25, -0.28); for (const s of [-1, 1]) put(head, box(0.18, 0.6, 0.5), hair, s * 0.42, -0.2, -0.05); }
  if (st === 'pony') { const p = put(head, cap(0.12, 0.45), hair, 0, -0.05, -0.55); p.rotation.x = 0.6; }
  if (st === 'spiky') for (let i = 0; i < 5; i++) { const c = put(head, cone(0.13, 0.35, 6), hair, -0.3 + i * 0.15, 0.45, 0.05 - Math.abs(i - 2) * 0.05); c.rotation.z = (i - 2) * -0.25; }
  if (st === 'bun') put(head, sph(0.2, 10, 8), hair, 0, 0.5, -0.2);
  if (st === 'cap' || hat) { const cm = mat(hat || look.shirt); const c = put(head, sph(0.5, 16, 8), cm, 0, 0.12, 0); c.scale.set(1, 0.6, 1); put(head, cyl(0.32, 0.32, 0.04, 16), cm, 0, 0.1, 0.42).scale.set(1, 1, 0.8); put(head, sph(0.47, 16, 10), hair, 0, -0.05, -0.08).scale.set(1, 0.7, 0.9); }
  root.userData = { body, head, legL, legR, armL, armR, hand, phase: 0, tool: null };
  return root;
}
export function animPerson(g, dt, speed, act = '', actT = 0) {
  const u = g.userData;
  u.phase += dt * (5 + speed * 10);
  const s = Math.min(1, speed), sw = Math.sin(u.phase) * 0.7 * s;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.7;
  let ar = sw * 0.7, az = 0;
  if (act === 'swing') ar = -2.2 + Math.min(1, actT * 5) * 2.6;               // chop, mine, net, sword
  else if (act === 'cast') ar = actT < 0.25 ? -2.6 : -1.1;                      // fishing
  else if (act === 'water') { ar = -1.1; az = 0.4; }
  else if (act === 'wave') { ar = -2.8; az = Math.sin(u.phase * 1.5) * 0.4; }
  u.armR.rotation.x = ar; u.armR.rotation.z = az;
  u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.06 * s;
  u.body.rotation.x = act === 'roll' ? -0.6 : 0;
}
// tools held in the right hand
function makeTool0(id) {
  const g = new THREE.Group(), wood = mat('#9a6a3a'), metal = mat('#c8ccd8', { metalness: 0.5, roughness: 0.35 });
  if (!id || id === 'hand') return g;
  const handle = (len) => { const h = put(g, cyl(0.03, 0.03, len, 6), wood, 0, 0, len / 2 - 0.1); h.rotation.x = Math.PI / 2; return h; };
  if (id === 'axe') { handle(0.7); put(g, box(0.06, 0.22, 0.2), metal, 0, 0.08, 0.5); }
  else if (id === 'pick') { handle(0.7); const p = put(g, box(0.05, 0.06, 0.55), metal, 0, 0, 0.55); p.rotation.x = Math.PI / 2; }
  else if (id === 'rod') { const r = put(g, cyl(0.015, 0.03, 1.6, 6), mat('#c8a060'), 0, 0.3, 0.7); r.rotation.x = 1.2; }
  else if (id === 'net') { handle(0.9); const ring = put(g, geo('ring', () => new THREE.TorusGeometry(0.2, 0.02, 5, 14)), mat('#f4f4f4'), 0, 0, 0.95); ring.rotation.y = Math.PI / 2; put(g, sph(0.18, 8, 6), mat('#e8f4ff', { transparent: true, opacity: 0.5 }), 0, -0.08, 0.95); }
  else if (id === 'can') { put(g, cyl(0.12, 0.14, 0.22, 10), mat('#5ab0e8'), 0, -0.05, 0.12); const sp = put(g, cyl(0.02, 0.03, 0.25, 6), mat('#5ab0e8'), 0, 0, 0.3); sp.rotation.x = 1.1; }
  else if (id === 'seed') put(g, box(0.18, 0.22, 0.08), mat('#d8b878'), 0, 0, 0.08);
  else if (id === 'sword') { put(g, box(0.05, 0.05, 0.22), mat('#6a4a2a'), 0, 0, 0); put(g, box(0.18, 0.04, 0.04), mat('#d8b040'), 0, 0, 0.12); put(g, box(0.04, 0.06, 0.8), metal, 0, 0, 0.55); }
  g.rotation.x = -0.4;
  return g;
}
export function holdTool(person, id) { const u = person.userData; if (u.tool === id) return; u.tool = id; u.hand.clear(); u.hand.add(makeTool(id)); }

// ------------------------------------------------------------------ houses (by stage) and the yard
function makeHouse0(stage, roof, wall) {
  const g = new THREE.Group(), R = mat(roof), Wm = mat(wall), wood = mat('#8a5a3a'), win = mat('#bfe4ff', { emissive: '#3a6a8a', emissiveIntensity: 0.25 }), door = mat('#6a3a1a');
  if (stage === 0) {   // a tent
    const t = put(g, geo('tent', () => new THREE.ConeGeometry(1.9, 2.2, 4)), R, 0, 1.1, 0); t.rotation.y = Math.PI / 4;
    put(g, box(0.8, 1.1, 0.05), mat('#3a2a2a'), 0, 0.55, 1.3);
    return g;
  }
  const W = [0, 4.2, 5, 6, 6.6][stage], D = [0, 3.4, 4, 4.4, 5][stage], H = [0, 2.4, 2.8, 3.4, 3.6][stage];
  put(g, box(W, H, D), stage === 1 ? wood : Wm, 0, H / 2, 0);
  if (stage === 1) for (let y = 0.3; y < H; y += 0.45) put(g, box(W + 0.06, 0.08, D + 0.06), mat('#6a4428'), 0, y, 0);
  // roof
  if (stage < 4) {
    const rf = put(g, geo(`roof${stage}`, () => { const s = new THREE.Shape(); s.moveTo(-W / 2 - 0.4, 0); s.lineTo(0, 1.6 + stage * 0.2); s.lineTo(W / 2 + 0.4, 0); s.lineTo(-W / 2 - 0.4, 0); return new THREE.ExtrudeGeometry(s, { depth: D + 0.6, bevelEnabled: false }); }), R, 0, H, -D / 2 - 0.3);
    rf.castShadow = true;
  } else {
    for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) { put(g, cyl(0.7, 0.7, H + 1.6, 10), Wm, x, (H + 1.6) / 2, z); put(g, cone(0.85, 1.4, 10), R, x, H + 2.3, z); }
    for (let i = -2; i <= 2; i++) put(g, box(0.5, 0.5, 0.5), Wm, i * 1.2, H + 0.25, D / 2);
    put(g, box(0.05, 1.2, 0.05), mat('#3a3a3a'), 0, H + 1.6, 0); const flag = put(g, box(0.7, 0.4, 0.04), R, 0.35, H + 2, 0); flag.userData.flag = true;
  }
  put(g, box(0.9, 1.5, 0.08), door, 0, 0.75, D / 2 + 0.03);
  for (const s of [-1, 1]) put(g, box(0.8, 0.7, 0.08), win, s * (W / 2 - 0.9), H * 0.55, D / 2 + 0.03);
  if (stage >= 2) put(g, box(0.6, 1.2, 0.6), mat('#8a8a8a'), W / 2 - 0.8, H + 0.8, -0.4);   // chimney
  if (stage >= 3) for (const s of [-1, 1]) put(g, box(0.8, 0.7, 0.08), win, s * (W / 2 - 0.9), H * 0.55, -D / 2 - 0.03);
  return g;
}
function makeDecor0(id) {
  const g = new THREE.Group(), wood = mat('#9a6a3a');
  if (id === 'fence') { for (const x of [-0.6, 0, 0.6]) put(g, box(0.12, 0.8, 0.12), wood, x, 0.4, 0); for (const y of [0.3, 0.6]) put(g, box(1.4, 0.08, 0.06), wood, 0, y, 0); }
  else if (id === 'flowers') { put(g, box(1.2, 0.25, 0.8), mat('#7a4a2a'), 0, 0.12, 0); for (let i = 0; i < 6; i++) put(g, sph(0.13, 6, 5), mat(['#ff5a7a', '#ffd23a', '#ffffff', '#c86aff', '#ff8a3a', '#5aa8ff'][i]), -0.4 + (i % 3) * 0.4, 0.4, i < 3 ? -0.15 : 0.15); }
  else if (id === 'lamp') { put(g, cyl(0.05, 0.07, 1.8, 6), mat('#2a2a3a'), 0, 0.9, 0); put(g, box(0.32, 0.4, 0.32), mat('#ffe8a0', { emissive: '#ffc84a', emissiveIntensity: 0.9 }), 0, 1.9, 0).userData.glow = true; }
  else if (id === 'bench') { put(g, box(1.4, 0.08, 0.45), wood, 0, 0.45, 0); put(g, box(1.4, 0.4, 0.06), wood, 0, 0.7, -0.2); for (const x of [-0.6, 0.6]) put(g, box(0.08, 0.45, 0.4), mat('#3a3a3a'), x, 0.22, 0); }
  else if (id === 'mailbox') { put(g, cyl(0.04, 0.04, 0.9, 6), wood, 0, 0.45, 0); put(g, box(0.3, 0.28, 0.45), mat('#e8584a'), 0, 1, 0); }
  else if (id === 'scarecrow') { put(g, cyl(0.05, 0.05, 1.6, 6), wood, 0, 0.8, 0); put(g, box(1.1, 0.06, 0.06), wood, 0, 1.2, 0); put(g, box(0.45, 0.6, 0.25), mat('#6a8ac8'), 0, 1.1, 0); put(g, sph(0.25, 10, 8), mat('#ff9a3a'), 0, 1.65, 0); put(g, cone(0.35, 0.3, 10), mat('#d8b860'), 0, 1.9, 0); }
  else if (id === 'well') { put(g, cyl(0.6, 0.6, 0.7, 14), mat('#9a9aa8', { flat: true }), 0, 0.35, 0); put(g, cyl(0.45, 0.45, 0.72, 14), mat('#3a7ac8'), 0, 0.36, 0); for (const x of [-0.5, 0.5]) put(g, box(0.08, 1.2, 0.08), wood, x, 1.1, 0); put(g, cone(0.85, 0.5, 4), mat('#c84a3a'), 0, 1.9, 0).rotation.y = Math.PI / 4; }
  else if (id === 'tree') { put(g, cyl(0.1, 0.14, 0.9, 6), wood, 0, 0.45, 0); put(g, sph(0.55, 10, 8), mat('#5ab84a', { flat: true }), 0, 1.15, 0); }
  else if (id === 'umbrella') { put(g, cyl(0.4, 0.4, 0.06, 12), mat('#f4f0e8'), 0, 0.7, 0); put(g, cyl(0.03, 0.03, 1.9, 6), mat('#cccccc'), 0, 0.95, 0); put(g, cone(1, 0.4, 8), mat('#ff5a7a'), 0, 2, 0); }
  else if (id === 'campfire') { for (let i = 0; i < 6; i++) { const s = put(g, sph(0.13, 6, 5), mat('#8a8a8a'), Math.cos(i) * 0.4, 0.1, Math.sin(i) * 0.4); s.scale.y = 0.7; } put(g, cone(0.25, 0.6, 6), mat('#ff8a2a', { emissive: '#ff5a1a', emissiveIntensity: 1 }), 0, 0.35, 0).userData.flame = true; }
  else if (id === 'swing') { for (const x of [-0.8, 0.8]) put(g, box(0.1, 2, 0.1), wood, x, 1, 0); put(g, box(1.8, 0.1, 0.1), wood, 0, 2, 0); put(g, box(0.6, 0.06, 0.3), mat('#ff5a7a'), 0, 0.5, 0); for (const x of [-0.25, 0.25]) put(g, cyl(0.01, 0.01, 1.5, 4), mat('#eeeeee'), x, 1.25, 0); }
  else if (id === 'windmill') { put(g, cyl(0.3, 0.5, 2.4, 8), mat('#f4f0e8'), 0, 1.2, 0); put(g, cone(0.45, 0.5, 8), mat('#c84a3a'), 0, 2.6, 0); const bl = new THREE.Group(); bl.position.set(0, 2.1, 0.45); g.add(bl); for (let i = 0; i < 4; i++) { const b = put(bl, box(0.18, 1.1, 0.04), mat('#d8c8a8'), 0, 0.55, 0); b.parent.remove(b); const p = new THREE.Group(); p.rotation.z = i * Math.PI / 2; p.add(b); bl.add(p); } bl.userData.spin = true; }
  else if (id.startsWith('trophy')) { put(g, box(0.6, 0.5, 0.6), mat('#8a6a4a'), 0, 0.25, 0); put(g, cyl(0.2, 0.08, 0.5, 10), mat('#ffd23a', { metalness: 0.7, roughness: 0.25 }), 0, 0.8, 0); put(g, sph(0.25, 10, 8), mat(id.endsWith('slime') ? '#5ad84a' : id.endsWith('golem') ? '#8a8a7a' : '#e84a2a', { emissive: '#222', emissiveIntensity: 0.4 }), 0, 1.2, 0); }
  return g;
}
// a crop by growth (0 sprout … 3 ripe)
export function makeCrop(id, stage, wet) {
  const g = new THREE.Group(), leaf = mat('#4aa83a');
  put(g, box(1, 0.08, 1), mat(wet ? '#5a3a22' : '#8a5a34'), 0, 0.04, 0);
  if (stage < 0) return g;          // empty soil
  if (stage === 0) put(g, cone(0.08, 0.2, 5), leaf, 0, 0.18, 0);
  else {
    const k = stage === 1 ? 0.5 : stage === 2 ? 0.8 : 1;
    for (let i = 0; i < 3; i++) { const l = put(g, cone(0.12 * k, 0.5 * k, 5), leaf, Math.cos(i * 2.1) * 0.12, 0.3 * k, Math.sin(i * 2.1) * 0.12); l.rotation.z = Math.cos(i * 2.1) * 0.4; l.rotation.x = Math.sin(i * 2.1) * 0.4; }
    if (stage === 3) { const c = CROPS[id], cm = mat(c.color); if (id === 'pumpkin') put(g, sph(0.32, 10, 8), cm, 0, 0.3, 0.1).scale.y = 0.75; else if (id === 'corn') put(g, cap(0.08, 0.3), cm, 0, 0.75, 0); else put(g, sph(0.13, 8, 6), cm, 0, 0.55, 0); }
  }
  return g;
}

// ------------------------------------------------------------------ bosses
function makeBoss0(type) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const eyes = (y, z, s, col = '#1a1420') => { for (const k of [-1, 1]) { put(body, sph(0.22 * s, 10, 8), mat('#ffffff'), k * 0.5 * s, y, z); put(body, sph(0.12 * s, 8, 6), mat(col), k * 0.5 * s, y, z + 0.15 * s); } };
  if (type === 'slime') {
    const b = put(body, sph(2.2, 20, 14), mat('#5ad84a', { transparent: true, opacity: 0.88, roughness: 0.2 }), 0, 1.6, 0); b.scale.y = 0.75;
    eyes(2, 1.9, 1.6); put(body, cone(0.9, 0.9, 5), mat('#ffd23a', { metalness: 0.6, roughness: 0.3 }), 0, 3.4, 0);
    for (let i = 0; i < 5; i++) put(body, cone(0.18, 0.4, 4), mat('#ff5a7a'), Math.cos(i * 1.256) * 0.55, 3.75, Math.sin(i * 1.256) * 0.55);
  } else if (type === 'golem') {
    const stone = mat('#8a8a7a', { flat: true }), moss = mat('#5a9a3a', { flat: true });
    put(body, box(2.6, 2.6, 1.8), stone, 0, 2.6, 0); put(body, box(1.6, 1.3, 1.4), stone, 0, 4.4, 0.1); put(body, box(1.7, 0.3, 1.5), moss, 0, 5.1, 0.1);
    for (const s of [-1, 1]) { put(body, box(0.9, 2.4, 0.9), stone, s * 1.8, 2.4, 0); put(body, box(0.9, 1.4, 0.9), stone, s * 0.7, 0.7, 0); }
    for (const k of [-1, 1]) put(body, box(0.3, 0.2, 0.1), mat('#7affc8', { emissive: '#3affa8', emissiveIntensity: 1.5 }), k * 0.4, 4.5, 0.82);
    put(body, sph(0.35, 10, 8), mat('#7affc8', { emissive: '#3affa8', emissiveIntensity: 1.2 }), 0, 2.8, 0.92);
  } else {
    const red = mat('#c83a2a', { flat: true }), belly = mat('#ffb84a', { flat: true }), dark = mat('#3a1a1a');
    put(body, sph(2, 14, 10), red, 0, 2.4, 0).scale.set(1, 0.9, 1.4);
    put(body, sph(1.6, 12, 8), belly, 0, 2, 0.9).scale.set(0.9, 0.8, 0.5);
    const neck = put(body, cap(0.7, 1.6), red, 0, 4, 2); neck.rotation.x = 0.7;
    put(body, sph(1.1, 12, 10), red, 0, 5, 3).scale.set(1, 0.85, 1.3);
    for (const k of [-1, 1]) { put(body, cone(0.25, 0.9, 6), dark, k * 0.5, 6, 2.6).rotation.x = -0.6; put(body, sph(0.16, 8, 6), mat('#ffd23a', { emissive: '#ffa21a', emissiveIntensity: 1.5 }), k * 0.45, 5.3, 4); }
    for (const k of [-1, 1]) { const w = put(body, geo('wing', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(3.2, 1.6); s.lineTo(3.6, -0.6); s.lineTo(1.8, -0.2); s.lineTo(0, -0.6); return new THREE.ShapeGeometry(s); }), mat('#8a2a1a', { side: THREE.DoubleSide }), k * 1.2, 3.6, -0.2); w.rotation.y = k > 0 ? 0 : Math.PI; w.rotation.z = 0.3; w.userData.wing = k; }
    const tail = put(body, cone(0.6, 3.6, 8), red, 0, 1.6, -3.4); tail.rotation.x = -1.4;
    for (const [x, z] of [[-1.2, 1], [1.2, 1], [-1.2, -1.2], [1.2, -1.2]]) put(body, cap(0.4, 0.8), red, x, 0.8, z);
  }
  g.userData = { body, type };
  return g;
}

// ------------------------------------------------------------------ the town
function makeShop0(s) {
  const g = new THREE.Group(), wall = mat('#f4e8d0'), roof = mat(s.color);
  put(g, box(s.w, 3, s.d), wall, 0, 1.5, 0);
  const rf = put(g, box(s.w + 0.8, 0.5, s.d + 0.8), roof, 0, 3.25, 0); rf.rotation.z = 0;
  put(g, cone(Math.max(s.w, s.d) * 0.62, 1.8, 4), roof, 0, 4.3, 0).rotation.y = Math.PI / 4;
  put(g, box(1.4, 2, 0.1), mat('#7a4a2a'), 0, 1, s.d / 2 + 0.05);
  for (const k of [-1, 1]) put(g, box(1.2, 1, 0.1), mat('#bfe4ff', { emissive: '#3a6a8a', emissiveIntensity: 0.3 }), k * (s.w / 2 - 1.2), 1.7, s.d / 2 + 0.05);
  // awning stripes
  for (let i = 0; i < 6; i++) put(g, box(s.w / 6, 0.12, 0.9), mat(i % 2 ? '#ffffff' : s.color), -s.w / 2 + s.w / 12 + i * s.w / 6, 2.55, s.d / 2 + 0.45).rotation.x = 0.35;
  return g;
}
function makeFountain0() {
  const g = new THREE.Group();
  put(g, cyl(2, 2.1, 0.6, 20), mat('#c8c8d0', { flat: true }), 0, 0.3, 0);
  put(g, cyl(1.75, 1.75, 0.62, 20), mat('#5ab8f0', { transparent: true, opacity: 0.85 }), 0, 0.32, 0);
  put(g, cyl(0.25, 0.35, 1.6, 10), mat('#c8c8d0'), 0, 0.9, 0); put(g, cyl(0.8, 0.5, 0.25, 14), mat('#c8c8d0'), 0, 1.7, 0);
  const jet = put(g, cone(0.3, 0.9, 10), mat('#bfe8ff', { transparent: true, opacity: 0.7, emissive: '#5ab0e8', emissiveIntensity: 0.4 }), 0, 2.2, 0); jet.userData.jet = true;
  return g;
}
function makeBoard0() {
  const g = new THREE.Group(), wood = mat('#8a5a3a');
  for (const x of [-0.85, 0.85]) put(g, box(0.15, 2, 0.15), wood, x, 1, 0);
  put(g, box(2, 1.2, 0.12), mat('#c89a5a'), 0, 1.4, 0);
  for (let i = 0; i < 3; i++) put(g, box(0.45, 0.55, 0.02), mat(['#fff8e0', '#ffe0e8', '#e0f0ff'][i]), -0.6 + i * 0.6, 1.4, 0.07).rotation.z = (i - 1) * 0.1;
  return g;
}
function makeAltar0() {
  const g = new THREE.Group();
  put(g, cyl(1.2, 1.4, 0.5, 8), mat('#6a6a7a', { flat: true }), 0, 0.25, 0);
  put(g, box(0.9, 1, 0.9), mat('#8a8a9a', { flat: true }), 0, 1, 0);
  const orb = put(g, sph(0.4, 14, 10), mat('#c86aff', { emissive: '#8a3aff', emissiveIntensity: 1.4 }), 0, 1.9, 0); orb.userData.orb = true;
  return g;
}

// every model gets its outline
export const makePerson = (...a) => outline(makePerson0(...a), 0.035);
export const makeTool = (...a) => outline(makeTool0(...a), 0.035);
export const makeHouse = (...a) => outline(makeHouse0(...a), 0.07);
export const makeDecor = (...a) => outline(makeDecor0(...a), 0.035);
export const makeBoss = (...a) => outline(makeBoss0(...a), 0.07);
export const makeShop = (...a) => outline(makeShop0(...a), 0.07);
export const makeFountain = (...a) => outline(makeFountain0(...a), 0.035);
export const makeBoard = (...a) => outline(makeBoard0(...a), 0.035);
export const makeAltar = (...a) => outline(makeAltar0(...a), 0.035);
