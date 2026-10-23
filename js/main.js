// Breezy Isle: the client. Draws the island, moves you, runs farming / fishing / bugs / gathering / building,
// talks to the other players (net.js), runs boss fights (boss.js) and all the windows.
import * as THREE from 'three';
import { ITEMS, CROPS, FISH, BUGS, TOOLS, HOTBAR, RECIPES, HOUSES, COLORS, LOOKS, BOSSES, DECOR, STORE, KINDS, SAYS, EMOTES, buyPrice, expFor, maxHp } from './data.js';
import { genWorld, S, TL, tileAt, collide, waterAhead, islandHour, isNight, ARENA } from './world.js';
import { makePerson, animPerson, holdTool, makeHouse, makeDecor, makeCrop, makeBoss, makeShop, makeFountain, makeBoard, makeAltar, mat } from './models.js';
import { BossFight, inShape, swingDamage, takenDamage } from './boss.js';
import { net, myId, setId, setMe, connect, leave, sendState, setHouseSource, sendHouseSoon, peerEvent, sendBoss, newCode, cleanCode, cleanName } from './net.js';
import { sfx } from './audio.js';
import { save, persist, startCloud, have, give, take, canPay, pay, gearStats, cropNow, farmSize, addExp, dailyTasks, track, today, tx, nm, tr } from './state.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || params.has('touch');
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rnd = Math.random;
const qLang = (location.search.match(/[?&]lang=(zh|en)(?![a-z])/) || [])[1]; if (qLang) { save.lang = qLang; }
if (cleanCode(params.get('room')).length === 4) { save.room = save.lastCode = cleanCode(params.get('room')); }

// ------------------------------------------------------------------ renderer and the island
const renderer = new THREE.WebGLRenderer({ canvas: $('cv'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 400);
const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6a8a4a, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 }); scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog(0x9ad8ff, 60, 140);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const W = genWorld();
const TCOL = { [TL.SEA]: '#3a8ad8', [TL.SAND]: '#f2e2a8', [TL.GRASS]: '#7ac85a', [TL.PATH]: '#e8d0a0', [TL.PLAZA]: '#d8d0c8', [TL.RIVER]: '#4aa8e8', [TL.POND]: '#4ab8d8',
  [TL.CLIFF]: '#8a7a6a', [TL.DIRT]: '#b8946a', [TL.BRIDGE]: '#b0804a', [TL.ARENA]: '#8a7a8a', [TL.LOT]: '#8ed06a' };
function buildIsland() {
  // the ground, painted pixel by pixel: soft noise on grass and sand, plank lines on bridges, foam along the shore
  const g = new THREE.Group(), px = 4, N = S * px, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const x = cv.getContext('2d'), img = x.createImageData(N, N), D = img.data;
  const rgb = {}; for (const [k, c] of Object.entries(TCOL)) { const v = new THREE.Color(c); rgb[k] = [v.r * 255, v.g * 255, v.b * 255]; }
  const wet = (t) => t === TL.SEA || t === TL.RIVER || t === TL.POND;
  const at = (a, b) => (a < 0 || b < 0 || a >= S || b >= S ? TL.SEA : W.tile[b * S + a]);
  for (let py = 0; py < N; py++) for (let pxx = 0; pxx < N; pxx++) {
    const tx = pxx >> 2, tz = py >> 2, t = W.tile[tz * S + tx], c = rgb[t];
    let h = ((pxx * 73856093) ^ (py * 19349663) ^ (tx * 83492791)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    let k = 1 + (((h & 255) / 255) - 0.5) * (t === TL.GRASS || t === TL.LOT ? 0.12 : t === TL.SAND || t === TL.DIRT ? 0.08 : 0.04);
    if (t === TL.PLAZA && ((tx + tz) & 1)) k *= 0.95;
    if (t === TL.BRIDGE && (py & 3) === 0) k *= 0.7;
    let r = c[0] * k, gg = c[1] * k, b = c[2] * k;
    if (wet(t)) {   // foam where water meets land
      const fx = (pxx & 3) / 4, fz = (py & 3) / 4;
      const edge = (!wet(at(tx - 1, tz)) && fx < 0.3) || (!wet(at(tx + 1, tz)) && fx > 0.7) || (!wet(at(tx, tz - 1)) && fz < 0.3) || (!wet(at(tx, tz + 1)) && fz > 0.7);
      if (edge) { r = r * 0.4 + 153; gg = gg * 0.4 + 153; b = b * 0.4 + 153; }
      else if ((h & 1023) < 6) { r += 60; gg += 60; b += 50; }
    }
    const o = (py * N + pxx) * 4; D[o] = Math.min(255, r); D[o + 1] = Math.min(255, gg); D[o + 2] = Math.min(255, b); D[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(S / 2, 0, S / 2); ground.receiveShadow = true; g.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: 0x3a8ad8, roughness: 0.3, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(S / 2, -0.03, S / 2); g.add(sea);
  // cliffs round the boss cave
  const cl = []; for (let z = 0; z < S; z++) for (let xx = 0; xx < S; xx++) if (W.tile[z * S + xx] === TL.CLIFF) cl.push([xx, z]);
  const cm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.6, 1), mat('#8a7a6a', { flat: true }), cl.length), m4 = new THREE.Matrix4();
  cl.forEach(([a, b], i) => { m4.makeScale(1, 0.8 + (((a * 7 + b * 3) % 5) / 10), 1).setPosition(a + 0.5, 0.7, b + 0.5); cm.setMatrixAt(i, m4); }); cm.castShadow = true; g.add(cm);
  return g;
}
scene.add(buildIsland());

// trees, rocks and flowers (instanced); fruit and tiredness are per player
const NODE = { trees: null, crowns: null, fruits: null, rocks: [], flowers: null };
const FRUITC = { apple: 0xe8322c, orange: 0xff9a2a, peach: 0xffa8a0, cherry: 0xc8102a };
{
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 7), mat('#8a5a34'), W.trees.length);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }), W.trees.length);
  const fr = W.trees.filter((t) => t.fruit);
  const fruit = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), fr.length * 3);
  W.trees.forEach((t, i) => {
    m4.compose(v.set(t.x, 0.8 * t.s, t.z), q, one.clone().multiplyScalar(t.s)); trunk.setMatrixAt(i, m4);
    m4.compose(v.set(t.x, 2.3 * t.s, t.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.id), new THREE.Vector3(t.s, t.s * 1.05, t.s)); crown.setMatrixAt(i, m4);
    crown.setColorAt(i, col.set(t.fruit ? 0x5ab84a : [0x4aa83a, 0x3a983a, 0x5ab04a][t.id % 3]));
  });
  q.identity();
  fr.forEach((t, k) => { t.fk = k; for (let j = 0; j < 3; j++) { fruit.setColorAt(k * 3 + j, col.set(FRUITC[t.fruit])); } });
  trunk.castShadow = crown.castShadow = true; scene.add(trunk, crown, fruit);
  NODE.trees = trunk; NODE.crowns = crown; NODE.fruits = fruit; NODE.fruitTrees = fr;
  const ores = { stone: 0x9a9aa0, iron: 0xb08a6a, gold: 0xe8c84a };
  const rk = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.62, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), W.rocks.length);
  W.rocks.forEach((r, i) => { m4.compose(v.set(r.x, 0.4, r.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(1, 0.75, 1)); rk.setMatrixAt(i, m4); rk.setColorAt(i, col.set(ores[r.ore])); });
  rk.castShadow = true; scene.add(rk); NODE.rocks = rk;
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), W.flowers.length);
  const FC = [0xff5a7a, 0xffd23a, 0xffffff, 0xc86aff, 0x5aa8ff];
  q.identity(); W.flowers.forEach((f, i) => { m4.compose(v.set(f.x, 0.2, f.z), q, one); fl.setMatrixAt(i, m4); fl.setColorAt(i, col.set(FC[f.c])); });
  scene.add(fl); NODE.flowers = fl;
}
function paintFruit(now = Date.now()) {
  const m4 = new THREE.Matrix4();
  for (const t of NODE.fruitTrees) {
    const ready = !(save.nodes['f' + t.id] > now);
    for (let j = 0; j < 3; j++) {
      const a = j * 2.1 + t.id;
      if (ready) m4.makeTranslation(t.x + Math.cos(a) * 0.85 * t.s, 2.1 * t.s + (j % 2) * 0.4, t.z + Math.sin(a) * 0.85 * t.s); else m4.makeScale(0, 0, 0);
      NODE.fruits.setMatrixAt(t.fk * 3 + j, m4);
    }
  }
  NODE.fruits.instanceMatrix.needsUpdate = true;
}
paintFruit();

// the town
function textSprite(text, { scale = 1, bg = 'rgba(30,40,60,.72)', color = '#fff', font = 40 } = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = `900 ${font}px "Nunito", "Noto Sans TC", sans-serif`;
  const w = Math.ceil(x.measureText(text).width + 28), h = Math.ceil(font * 1.45);
  c.width = w; c.height = h; x.font = `900 ${font}px "Nunito", "Noto Sans TC", sans-serif`;
  if (bg) { x.fillStyle = bg; x.beginPath(); x.roundRect ? x.roundRect(0, 0, w, h, h / 2) : x.rect(0, 0, w, h); x.fill(); }
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); s.scale.set(w / 80 * scale, h / 80 * scale, 1); s.renderOrder = 5;
  return s;
}
const dropSprite = (s) => { if (!s) return; if (s.parent) s.parent.remove(s); s.material.map.dispose(); s.material.dispose(); };
const SHOPNAME = { store: () => '🛒 ' + tr().store, decor: () => '🪑 ' + tr().decorShop, workshop: () => '🔨 ' + tr().workshop };
const townSigns = [];
for (const s of W.shops) {
  const g = makeShop(s); g.position.set(s.x, 0, s.z); scene.add(g);
  const npc = makePerson({ skin: LOOKS.skin[[0, 2, 3][W.shops.indexOf(s)]], hair: ['#6a3a1a', '#f4f4f4', '#2a1a10'][W.shops.indexOf(s)], style: ['bun', 'short', 'cap'][W.shops.indexOf(s)], shirt: '#ffffff', pants: '#5a4a3a' }, { apron: '#' + new THREE.Color(s.color).getHexString() });
  npc.position.set(s.npc.x, 0, s.npc.z); npc.rotation.y = -0.3; scene.add(npc); s.npcMesh = npc;
  const sign = textSprite(SHOPNAME[s.id](), { scale: 1.1, bg: 'rgba(60,40,20,.85)' }); sign.position.set(s.x, 5.6, s.z + s.d / 2); scene.add(sign); townSigns.push([sign, s]);
}
{ const f = makeFountain(); f.position.set(W.fountain.x, 0, W.fountain.z); scene.add(f); W.fountainMesh = f; }
{ const b = makeBoard(); b.position.set(W.board.x, 0, W.board.z); scene.add(b); }
{ const a = makeAltar(); a.position.set(W.altar.x, 0, W.altar.z); scene.add(a); W.altarMesh = a; }
for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; if (Math.sin(a) > 0.92) continue; const p = makeDecor('lamp'); p.position.set(ARENA.x + Math.cos(a) * (ARENA.r - 0.6), 0, ARENA.z + Math.sin(a) * (ARENA.r - 0.6)); scene.add(p); }
for (const [x, z] of [[67, 67], [93, 67], [67, 89], [93, 89], [80, 92], [80, 100], [80, 115], [80, 128]]) { const p = makeDecor('lamp'); p.position.set(x, 0, z); scene.add(p); }
// the plaza: flower beds, benches round the fountain, little trees along the edges
for (const [id, x, z, r] of [['flowers', 69, 69, 0], ['flowers', 91, 69, 0], ['flowers', 69, 88, 0], ['flowers', 91, 88, 0], ['bench', 75, 78, Math.PI / 2], ['bench', 85, 78, -Math.PI / 2], ['bench', 80, 83, Math.PI],
  ['tree', 67.5, 74, 0], ['tree', 67.5, 82, 0], ['tree', 92.5, 82, 0], ['umbrella', 88, 86, 0], ['campfire', 84, 72, 0]]) { const m = makeDecor(id); m.position.set(x, 0, z); m.rotation.y = r; scene.add(m); }
const lampMat = mat('#ffe8a0', { emissive: '#ffc84a', emissiveIntensity: 0.9 });

// ------------------------------------------------------------------ me and the others
const me = { x: W.spawn.x, z: W.spawn.z, yaw: Math.PI, speed: 0, tool: 'hand', act: '', actT: 0, hp: 100, down: false, roll: 0, rollCd: 0, inv: 0, atkCd: 0, avatar: null, label: null, bubble: null, bubbleT: 0, emo: '' };
let started = false;
function myAvatar(force) {
  if (me.avatar && !force) return;
  if (me.avatar) scene.remove(me.avatar);
  me.avatar = makePerson(save.look); scene.add(me.avatar); holdTool(me.avatar, toolMesh(me.tool));
  me.avatar.userData.tool = null; holdTool(me.avatar, toolMesh(me.tool));
  dropSprite(me.label); me.label = textSprite(`${save.name || '?'}  Lv${save.lv}`, { scale: 0.42 }); me.label.position.y = 2.65; me.avatar.add(me.label); me.labelSig = save.name + save.lv;
}
const toolMesh = (t) => (t === 'hand' ? (fightOn() && save.gear.w ? 'sword' : 'hand') : t);
const peers = new Map();   // id -> { avatar, label, x, z, yaw, look, ... }
function peerFor(id, s) {
  let p = peers.get(id);
  const lookSig = JSON.stringify(s.look || {});
  if (p && p.lookSig !== lookSig) { dropPeer(p); peers.delete(id); p = null; }
  if (!p) { const av = makePerson(s.look && s.look.skin ? s.look : save.look); scene.add(av); p = { id, avatar: av, lookSig, x: s.x, z: s.z, yaw: s.yaw || 0, label: null, labelSig: '', bubble: null, bubbleT: 0 }; av.position.set(s.x, 0, s.z); peers.set(id, p); }
  const sig = (s.n || '?') + s.lv;
  if (p.labelSig !== sig) { dropSprite(p.label); p.label = textSprite(`${s.n || '?'}  Lv${s.lv || 1}`, { scale: 0.42, bg: save.friends[id] ? 'rgba(200,90,140,.8)' : 'rgba(30,40,60,.72)' }); p.label.position.y = 2.65; p.avatar.add(p.label); p.labelSig = sig; }
  return p;
}
function dropPeer(p) { scene.remove(p.avatar); dropSprite(p.label); dropSprite(p.bubble); }
function bubbleOn(who, text) { if (!who.avatar) return; dropSprite(who.bubble); who.bubble = textSprite(text, { scale: 0.55, bg: 'rgba(255,255,255,.95)', color: '#2a3048' }); who.bubble.position.y = 3.3; who.avatar.add(who.bubble); who.bubbleT = 4; }

// ------------------------------------------------------------------ homes: each player's house, farm and yard on a plot
const owners = () => (net.roster.length ? net.roster.map((r) => r.id) : [myId()]);
// each player has a favourite plot (from their id); the earlier arrival keeps it, a clash takes the next free one,
// so a house doesn't move when somebody else leaves
let plotMap = new Map(), plotSig = '';
function plotOf(id) {
  const ids = owners(), sig = ids.join('|');
  if (sig !== plotSig) {
    plotSig = sig; plotMap = new Map(); const used = new Set(), N = W.plots.length;
    for (const pid of ids) { let h = 0; for (const c of pid) h = (h * 31 + c.charCodeAt(0)) >>> 0; let k = h % N; for (let i = 0; i < N && used.has(k); i++) k = (k + 1) % N; if (used.size < N) { used.add(k); plotMap.set(pid, W.plots[k]); } }
  }
  return plotMap.get(id) || null;
}
const myPlot = () => plotOf(myId()) || W.plots[0];
const HOUSE_SIZE = [[2.8, 2.8], [4.2, 3.4], [5, 4], [6, 4.4], [8, 6.4]];
function farmCell(plot, k) { const f = plot.farm; return { x: f.x + (k % f.cols) * f.gap + 0.5, z: f.z + Math.floor(k / f.cols) * f.gap + 0.5 }; }
function yardCell(plot, k) { const y = plot.yard; return { x: y.x + (k % y.cols) * y.gap + 0.6, z: y.z + Math.floor(k / y.cols) * y.gap + 0.6 }; }
function houseData() {
  const now = Date.now();
  return { n: save.name, stage: save.house.stage, roof: save.house.roof, wall: save.house.wall, decor: save.house.decor,
    farm: save.farm.slice(0, farmSize()).map((c) => (c ? [c.c, cropNow(c, now).stage, c.wet > now ? 1 : 0] : null)) };
}
setHouseSource(houseData);
const homes = new Map();   // plot index -> { sig, group }
let houseRects = [];
function updateHomes() {
  const shown = new Set(), rects = [];
  for (const id of owners()) {
    const plot = plotOf(id); if (!plot) continue;
    const h = id === myId() ? houseData() : (net.peers.get(id) || {}).h;
    if (!h) continue;
    shown.add(plot.i);
    const sig = JSON.stringify(h);
    let rec = homes.get(plot.i);
    if (!rec || rec.sig !== sig) {
      if (rec) scene.remove(rec.group);
      const g = new THREE.Group();
      const house = makeHouse(h.stage, h.roof, h.wall); house.position.set(plot.house.x, 0, plot.house.z); g.add(house);
      (h.farm || []).forEach((c, k) => { const p = farmCell(plot, k), m = c ? makeCrop(c[0], c[1], c[2]) : makeCrop(null, -1, 0); m.position.set(p.x, 0, p.z); g.add(m); });
      (h.decor || []).forEach((d, k) => { if (!d || !DECOR[d]) return; const p = yardCell(plot, k), m = makeDecor(d); m.position.set(p.x, 0, p.z); m.rotation.y = ((k * 37) % 4) * 0.2 - 0.3; g.add(m); });
      const sign = textSprite(`🏠 ${h.n || '?'}`, { scale: 0.55, bg: 'rgba(90,60,30,.85)' }); sign.position.set(plot.sign.x, 1.6, plot.sign.z); g.add(sign);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), mat('#8a5a34')); post.position.set(plot.sign.x, 0.6, plot.sign.z); g.add(post);
      scene.add(g); rec = { sig, group: g }; homes.set(plot.i, rec);
    }
    const [hw, hd] = HOUSE_SIZE[h.stage] || HOUSE_SIZE[0];
    rects.push({ x0: plot.house.x - hw / 2, z0: plot.house.z - hd / 2, x1: plot.house.x + hw / 2, z1: plot.house.z + hd / 2 });
  }
  for (const [i, rec] of homes) if (!shown.has(i)) { scene.remove(rec.group); homes.delete(i); }
  houseRects = rects;
}
net.onHouse = () => { homeT = 0; };
let homeT = 0;

// ------------------------------------------------------------------ input
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  keys.add(e.code);
  if (!started) return;
  if (e.code === 'Escape') { closeWin(); return; }
  if (winOpen()) return;
  if (e.code === 'KeyE') { e.preventDefault(); doAction(); }
  if (e.code === 'KeyF') attack();
  if (e.code === 'Space') { e.preventDefault(); roll(); }
  if (e.code === 'KeyQ') eatBest();
  if (/^Digit[1-7]$/.test(e.code)) pickTool(HOTBAR[+e.code.slice(5) - 1]);
  if (e.code === 'KeyB') openBag();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('wheel', (e) => { if (started && !winOpen()) camZoom = Math.max(0.6, Math.min(1.7, camZoom * (e.deltaY > 0 ? 1.08 : 0.93))); }, { passive: true });
let camZoom = 1;
const stick = { id: null, ox: 0, oy: 0, mx: 0, mz: 0 };
$('cv').addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (!isTouch || e.clientX > innerWidth * 0.5 || stick.id !== null) return;
  stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY;
  const st = $('stick'); st.style.left = (e.clientX - 60) + 'px'; st.style.top = (e.clientY - 60) + 'px'; st.classList.add('on');
});
addEventListener('pointermove', (e) => {
  if (e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const d = Math.hypot(dx, dy), m = 55;
  if (d > m) { dx *= m / d; dy *= m / d; }
  stick.mx = dx / m; stick.mz = dy / m; $('knob').style.transform = `translate(${dx}px, ${dy}px)`;
});
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.mx = stick.mz = 0; $('stick').classList.remove('on'); $('knob').style.transform = ''; } });
const tapBtn = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.unlock(); fn(); });
tapBtn('bAct', () => doAction()); tapBtn('bAtk', () => attack()); tapBtn('bRoll', () => roll()); tapBtn('bEat', () => eatBest());
function inputVec() {
  let mx = 0, mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  mx += stick.mx; mz += stick.mz;
  const d = Math.hypot(mx, mz); if (d > 1) { mx /= d; mz /= d; }
  return { mx, mz, run: keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(stick.mx, stick.mz) > 0.92 };
}

// ------------------------------------------------------------------ actions (E)
function pickTool(t) {
  if (t === 'seed' && me.tool === 'seed') { openSeeds(); return; }
  me.tool = t; cancelFishing(); sfx.play('click'); drawHotbar();
  if (me.avatar) holdTool(me.avatar, toolMesh(t));
}
const near = (p, d) => Math.hypot(p.x - me.x, p.z - me.z) < d;
const front = (k = 0.9) => ({ x: me.x + Math.sin(me.yaw) * k, z: me.z + Math.cos(me.yaw) * k });
function nearest(list, p, maxD) { let best = null, bd = maxD; for (const o of list) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd) { bd = d; best = o; } } return best; }
function myFarmCellAt(p) {
  const plot = myPlot(), n = farmSize();
  let best = -1, bd = 0.9;
  for (let k = 0; k < n; k++) { const c = farmCell(plot, k), d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = k; } }
  return best;
}
function findAction() {
  const a = tr().a;
  if (fishing) return { k: 'reel', label: fishing.phase === 'bite' ? a.reel : '…' };
  if (me.down) return null;
  for (const s of W.shops) if (near(s.door, 2.4) || near(s.npc, 2)) return { k: s.id, label: a[s.id] };
  if (near(W.board, 2.4)) return { k: 'board', label: a.board };
  if (near(W.altar, 2.6)) return { k: 'altar', label: a.altar };
  const plot = myPlot();
  if (near(plot.sign, 2) || near({ x: plot.house.x, z: plot.house.z + 2 }, 2.2)) return { k: 'house', label: a.house };
  const f = front(0.7);
  const cell = myFarmCellAt(f) >= 0 ? myFarmCellAt(f) : myFarmCellAt(me);
  if (cell >= 0) {
    const c = cropNow(save.farm[cell]);
    if (c && c.stage === 3) return { k: 'harvest', cell, label: a.harvest };
    if (!c && me.tool === 'seed') return { k: 'plant', cell, label: a.plant + ' ' + nm(save.seed) };
    if (c && me.tool === 'can') return { k: 'water', cell, label: a.water };
  }
  if (me.tool === 'rod') return waterAhead(W, me.x, me.z, me.yaw, 3) ? { k: 'cast', label: a.cast } : null;
  if (me.tool === 'net') return { k: 'swing', label: a.swing };
  if (me.tool === 'axe') { const t = nearest(W.trees, front(1.1), 1.4); if (t) return { k: 'chop', t, label: a.chop }; }
  if (me.tool === 'pick') { const r = nearest(W.rocks, front(1.1), 1.4); if (r) return { k: 'mine', r, label: a.mine }; }
  if (me.tool === 'hand') {
    const t = nearest(NODE.fruitTrees, front(1.1), 1.6); if (t) return { k: 'shake', t, label: a.shake };
    const tt = tileAt(W, f.x, f.z); if (tt === TL.GRASS || tt === TL.LOT) return { k: 'fiber', label: a.fiber };
  }
  return null;
}
function nodeUse(key, max, restMs) {
  const now = Date.now(), n = save.nodes[key] || { u: 0, at: 0 };
  if (n.at && now > n.at) { n.u = 0; n.at = 0; }
  if (n.u >= max) return false;
  n.u++; if (n.u >= max) n.at = now + restMs;
  save.nodes[key] = n; return true;
}
let actBusy = 0;
function doAction() {
  if (!started || winOpen() || me.roll > 0) return;
  const A = findAction(); if (!A) return;
  const t = tr();
  if (A.k === 'reel') { reel(); return; }
  if (['store', 'decor', 'workshop'].includes(A.k)) { openShop(A.k); return; }
  if (A.k === 'board') { openDaily(); return; }
  if (A.k === 'altar') { openAltar(); return; }
  if (A.k === 'house') { openHome(); return; }
  if (actBusy > 0) return;
  actBusy = 0.45;
  if (A.k === 'plant') {
    if (!take('seed_' + save.seed)) { msg(t.noSeeds); openSeeds(); return; }
    const now = Date.now(); save.farm[A.cell] = { c: save.seed, g: 0, last: now, wet: 0, stage: 0 };
    sfx.play('plant'); setAct('water'); changed(); sendHouseSoon();
  } else if (A.k === 'water') {
    const now = Date.now(), tier = save.tools.can, plot = myPlot(), c0 = farmCell(plot, A.cell);
    for (let k = 0; k < farmSize(); k++) { const c = save.farm[k], p = farmCell(plot, k); if (c && Math.hypot(p.x - c0.x, p.z - c0.z) < [0, 0.5, 1.7, 2.8][tier]) { cropNow(c, now); c.wet = now + 180000; } }
    sfx.play('water'); setAct('water'); pop('💧', '#5ab0ff'); changed(); sendHouseSoon();
  } else if (A.k === 'harvest') {
    const c = save.farm[A.cell], n = 1 + (rnd() < 0.3 ? 1 : 0);
    give(c.c, n); save.farm[A.cell] = null; track('harvest', n); gainExp(4 + Math.round(CROPS[c.c].grow / 120));
    sfx.play('pick'); pop(`${ITEMS[c.c].icon} ×${n}`, '#ffd23a'); changed(); sendHouseSoon();
  } else if (A.k === 'cast') castRod();
  else if (A.k === 'swing') swingNet();
  else if (A.k === 'chop') {
    setAct('swing'); sfx.play('chop');
    if (!nodeUse('t' + A.t.id, 3, 240000)) { msg(t.tired); return; }
    const n = save.tools.axe; give('wood', n); track('wood', n); gainExp(2); pop(`🪵 ×${n}`, '#e8c08a'); changed();
    if (rnd() < 0.12) { give('fiber', 1); pop('🌾', '#c8e08a'); }
  } else if (A.k === 'mine') {
    setAct('swing'); sfx.play('mine');
    if (!nodeUse('r' + A.r.id, 3, 300000)) { msg(t.tired); return; }
    const tier = save.tools.pick, got = { stone: 1 };
    if (A.r.ore === 'iron' && rnd() < 0.45 + tier * 0.1) got.iron = 1;
    if (A.r.ore === 'gold') { if (rnd() < 0.3 + tier * 0.1) got.gold = 1; else got.iron = 1; }
    if (rnd() < 0.015 * tier) got.crystal = 1;
    for (const [k, n] of Object.entries(got)) { give(k, n); if (k === 'stone') track('stone', n); }
    gainExp(3); pop(Object.entries(got).map(([k, n]) => `${ITEMS[k].icon}×${n}`).join(' '), '#d8d8e8'); changed();
  } else if (A.k === 'shake') {
    setAct('swing');
    const now = Date.now();
    if (save.nodes['f' + A.t.id] > now) { msg(t.tired); return; }
    const n = 2 + (rnd() < 0.4 ? 1 : 0); give(A.t.fruit, n); track('fruit', n); save.nodes['f' + A.t.id] = now + 360000; paintFruit(now); gainExp(2);
    sfx.play('pick'); pop(`${ITEMS[A.t.fruit].icon} ×${n}`, '#ff8a8a'); changed();
    if (rnd() < 0.15) spawnBug('trees', A.t);
  } else if (A.k === 'fiber') {
    setAct('swing'); actBusy = 0.7;
    if (rnd() < 0.7) { give('fiber', 1); pop('🌾', '#c8e08a'); changed(); } else if (rnd() < 0.3) spawnBug('grass', { x: front().x, z: front().z });
  }
}
function setAct(a) { me.act = a; me.actT = 0; }
let saveT = 0;
const changed = () => { saveT = 0.8; drawHud(true); };
function gainExp(n) { for (const lv of addExp(n)) { banner(tr().lvup(lv)); sfx.play('levelup'); setMe({ lv: save.lv }); } }

// ------------------------------------------------------------------ fishing
let fishing = null;
function castRod() {
  const where = waterAhead(W, me.x, me.z, me.yaw, 3); if (!where) { msg(tr().needWater); return; }
  let d = 1.2; while (d < 3 && !['river', 'sea', 'pond'].includes(tileKind(me.x + Math.sin(me.yaw) * d, me.z + Math.cos(me.yaw) * d))) d += 0.3;
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat('#ff4a4a')); bob.position.set(me.x + Math.sin(me.yaw) * (d + 0.4), 0.05, me.z + Math.cos(me.yaw) * (d + 0.4)); scene.add(bob);
  const tier = save.tools.rod;
  fishing = { phase: 'wait', t: 2 + rnd() * 5 * (1 - 0.15 * (tier - 1)), where, bob, x0: me.x, z0: me.z };
  setAct('cast'); sfx.play('splash');
}
const tileKind = (x, z) => ({ [TL.RIVER]: 'river', [TL.SEA]: 'sea', [TL.POND]: 'pond' }[tileAt(W, x, z)] || '');
function cancelFishing() { if (fishing) { scene.remove(fishing.bob); fishing.bob.geometry.dispose(); fishing = null; me.act = ''; } }
function updateFishing(dt, now) {
  if (!fishing) return;
  if (Math.hypot(me.x - fishing.x0, me.z - fishing.z0) > 0.3) { cancelFishing(); return; }
  fishing.t -= dt;
  fishing.bob.position.y = fishing.phase === 'bite' ? -0.12 + Math.sin(now / 60) * 0.06 : 0.05 + Math.sin(now / 400) * 0.03;
  if (fishing.phase === 'wait' && fishing.t <= 0) { fishing.phase = 'bite'; fishing.t = 0.85 + 0.2 * save.tools.rod; sfx.play('bite'); pop('❗', '#ff4a4a'); }
  else if (fishing.phase === 'bite' && fishing.t <= 0) { msg(tr().escaped); cancelFishing(); }
}
function reel() {
  if (!fishing) return;
  if (fishing.phase !== 'bite') { msg(tr().tooEarly); cancelFishing(); return; }
  const f = rollCatch(FISH.filter((x) => x.where === fishing.where), save.tools.rod);
  cancelFishing();
  if (!f) return;
  caught('fish', f); track('fish');
}
function rollCatch(list, tier) {
  const night = isNight(), luck = gearStats().luck;
  const ok = list.filter((x) => x.when === 'any' || (x.when === 'night') === night);
  const w = ok.map((x) => [0, 50, 26, 12, 5, 1.6][x.rare] * (x.rare >= 3 ? 1 + 0.45 * (tier - 1) + 0.4 * luck : 1));
  let t = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ok.length; i++) { t -= w[i]; if (t <= 0) return ok[i]; }
  return ok[0];
}
function caught(kind, f) {
  give(f.id, 1);
  const fresh = !save.dex[kind][f.id]; save.dex[kind][f.id] = (save.dex[kind][f.id] || 0) + 1;
  gainExp(3 + f.rare * 4 + (fresh ? 10 : 0));
  sfx.play('catch'); changed();
  showCatch(f, fresh);
}

// ------------------------------------------------------------------ bugs (each player sees their own)
const bugs = [];
let bugT = 0;
const bugSprites = {};
function bugSprite(icon) { const s = textSprite(icon, { bg: null, font: 60, scale: 0.55 }); return s; }
function spawnBug(where, at) {
  const night = isNight();
  const list = BUGS.filter((b) => b.where === where && (b.when === 'any' || (b.when === 'night') === night));
  if (!list.length) return;
  const tier = save.tools.net, luck = gearStats().luck;
  const w = list.map((x) => [0, 50, 26, 12, 5, 1.6][x.rare] * (x.rare >= 3 ? 1 + 0.4 * (tier - 1) + 0.4 * luck : 1));
  let t = rnd() * w.reduce((a, b) => a + b, 0), sp = list[0];
  for (let i = 0; i < list.length; i++) { t -= w[i]; if (t <= 0) { sp = list[i]; break; } }
  const y = { flowers: 0.7, trees: 1.3, grass: 0.15, water: 0.9, rocks: 0.75 }[where];
  const hx = at.x + (where === 'trees' ? 0.35 : 0), hz = at.z + (where === 'trees' ? 0.35 : 0);
  const m = bugSprite(sp.icon); m.position.set(hx, y, hz); scene.add(m);
  bugs.push({ sp, where, x: hx, z: hz, y, hx, hz, t: rnd() * 10, life: 0, flee: 0, mesh: m });
}
function updateBugs(dt) {
  bugT -= dt;
  if (bugT <= 0 && bugs.length < 9 && started) {
    bugT = 1.4;
    const v = rnd(), R = 24;
    const pickNear = (list) => { const c = list.filter((o) => Math.abs(o.x - me.x) < R && Math.abs(o.z - me.z) < R && Math.hypot(o.x - me.x, o.z - me.z) > 6); return c.length ? c[Math.floor(rnd() * c.length)] : null; };
    if (v < 0.42) { const f = pickNear(W.flowers); if (f) spawnBug('flowers', f); }
    else if (v < 0.62) { const t = pickNear(W.trees); if (t) spawnBug('trees', t); }
    else if (v < 0.75) { const r = pickNear(W.rocks); if (r) spawnBug('rocks', { x: r.x, z: r.z }); }
    else {
      for (let k = 0; k < 8; k++) {
        const x = me.x + (rnd() - 0.5) * 2 * R, z = me.z + (rnd() - 0.5) * 2 * R, t = tileAt(W, x, z);
        if (Math.hypot(x - me.x, z - me.z) < 6) continue;
        if (t === TL.GRASS && v < 0.9) { spawnBug('grass', { x, z }); break; }
        if (t === TL.GRASS && ['river', 'pond'].some((w) => [0, 1.57, 3.14, 4.71].some((a) => tileKind(x + Math.sin(a) * 1.5, z + Math.cos(a) * 1.5) === w))) { spawnBug('water', { x, z }); break; }
      }
    }
  }
  for (let i = bugs.length - 1; i >= 0; i--) {
    const b = bugs[i]; b.t += dt; b.life += dt;
    const d = Math.hypot(b.x - me.x, b.z - me.z);
    if (!b.flee && d < 4.2 && me.speed > 1.25 && b.where !== 'trees' && b.where !== 'rocks') b.flee = 0.01;
    if (!b.flee && d < 1.1 && rnd() < dt * 0.4) b.flee = 0.01;
    if (b.flee) { b.flee += dt; const a = Math.atan2(b.x - me.x, b.z - me.z); b.x += Math.sin(a) * 7 * dt; b.z += Math.cos(a) * 7 * dt; b.y += 3 * dt; if (b.flee > 1.6) { scene.remove(b.mesh); bugs.splice(i, 1); continue; } }
    else if (b.where === 'flowers' || b.where === 'water') { b.x = b.hx + Math.sin(b.t * 0.9) * 0.9; b.z = b.hz + Math.cos(b.t * 0.7) * 0.7; b.y = (b.where === 'water' ? 0.9 : 0.7) + Math.sin(b.t * 4) * 0.15; }
    else if (b.where === 'grass') { b.x = b.hx + Math.sin(b.t * 0.4) * 0.6; b.y = 0.15 + Math.abs(Math.sin(b.t * 3)) * 0.2; }
    b.mesh.position.set(b.x, b.y, b.z);
    if (d > 38 || b.life > 100) { scene.remove(b.mesh); bugs.splice(i, 1); }
  }
}
function swingNet() {
  setAct('swing'); sfx.play('swing');
  const reach = [0, 2.2, 2.8, 3.4][save.tools.net];
  let best = null, bd = reach;
  for (const b of bugs) { if (b.flee) continue; const d = Math.hypot(b.x - me.x, b.z - me.z), a = Math.atan2(b.x - me.x, b.z - me.z) - me.yaw; if (d < bd && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 1.3) { bd = d; best = b; } }
  if (!best) { if (bugs.some((b) => Math.hypot(b.x - me.x, b.z - me.z) < reach + 2)) msg(tr().missed, 900); return; }
  scene.remove(best.mesh); bugs.splice(bugs.indexOf(best), 1);
  caught('bug', best.sp); track('bug');
}

// ------------------------------------------------------------------ parties, friends, gifts, chat
let party = null;           // { pid: leader id, members: [ids] }
const isLeader = () => !party || party.pid === myId();
const nameOf = (id) => (id === myId() ? save.name : ((net.roster.find((r) => r.id === id) || {}).n || (save.friends[id] || {}).n || '?'));
function invite(id) {
  const t = tr();
  if (!party) party = { pid: myId(), members: [myId()] };
  if (party.pid !== myId()) { msg(t.onlyLeader); return; }
  if (party.members.length >= 4) { msg(t.partyFull); return; }
  peerEvent({ k: 'pinv', to: id, pid: party.pid }); sfx.play('click'); msg('✉️ ' + nameOf(id));
}
const broadcastParty = () => peerEvent({ k: 'party', pid: party.pid, members: party.members });
function leaveParty() {
  if (!party) return;
  if (party.pid === myId()) peerEvent({ k: 'party', pid: party.pid, members: [] }); else peerEvent({ k: 'pleave', to: party.pid });
  party = null; renderWin();
}
const pendingGifts = new Map();
function sendGift(to, id, n) {
  if (have(id) < n) return;
  const gid = Math.random().toString(36).slice(2, 9);
  pendingGifts.set(gid, { id, n, to }); peerEvent({ k: 'gift', to, item: id, n, gid });
  setTimeout(() => pendingGifts.delete(gid), 8000);
}
net.onPeer = (p) => {
  const t = tr(), from = p.from;
  if (p.k === 'say' || p.k === 'emo') { const text = p.k === 'say' ? tx(SAYS[p.i] || SAYS[0]) : p.e; if (from === myId()) bubbleOn(me, text); else { const q = peers.get(from); if (q) bubbleOn(q, text); } return; }
  if (from === myId()) { if (p.k === 'party') onParty(p); return; }
  if (p.k === 'gift' && ITEMS[p.item] && p.n > 0 && p.n <= 999) {
    give(p.item, p.n); changed(); sfx.play('gift'); toast(t.giftFrom(p.fn || '?', `${ITEMS[p.item].icon} ${nm(p.item)} ×${p.n}`));
    peerEvent({ k: 'gack', to: from, gid: p.gid });
  } else if (p.k === 'gack') {
    const g = pendingGifts.get(p.gid); if (!g) return; pendingGifts.delete(p.gid);
    if (take(g.id, g.n)) { track('gift'); gainExp(5); changed(); msg(t.giftSent(nameOf(g.to))); sfx.play('gift'); }
  } else if (p.k === 'freq') {
    if (save.friends[from]) { peerEvent({ k: 'fok', to: from }); return; }
    ask(t.friendAsk(p.fn || '?'), () => { save.friends[from] = { n: p.fn }; changed(); peerEvent({ k: 'fok', to: from }); toast(t.friendOk(p.fn || '?')); relabel(from); });
  } else if (p.k === 'fok') { save.friends[from] = { n: p.fn }; changed(); toast(t.friendOk(p.fn || '?')); sfx.play('gift'); relabel(from); }
  else if (p.k === 'pinv') ask(t.partyAsk(p.fn || '?'), () => { if (party && party.pid !== p.pid) leaveParty(); peerEvent({ k: 'pjoin', to: p.pid }); });
  else if (p.k === 'pjoin') {
    if (!party || party.pid !== myId()) return;
    if (party.members.length >= 4) { peerEvent({ k: 'party', pid: party.pid, members: party.members }); return; }
    if (!party.members.includes(from)) party.members.push(from);
    broadcastParty(); toast(t.joined(p.fn || '?'));
  } else if (p.k === 'pleave') { if (party && party.pid === myId()) { party.members = party.members.filter((x) => x !== from); broadcastParty(); toast(t.partyLeft(p.fn || '?')); } }
  else if (p.k === 'party') onParty(p);
  else if (p.k === 'bhit' && fight) { fight.hit(+p.d || 0); }
};
function onParty(p) {
  if (p.members.includes(myId()) && p.members.length > 1) party = { pid: p.pid, members: p.members };
  else if (party && party.pid === p.pid) party = p.pid === myId() && p.members.length ? { pid: p.pid, members: p.members } : null;
  if (party && party.members.length <= 1 && party.pid === myId() && !p.members.length) party = null;
  renderWin();
}
const relabel = (id) => { const q = peers.get(id); if (q) q.labelSig = ''; };
net.onRoster = () => {
  if (party && party.pid === myId()) { const ids = new Set(net.roster.map((r) => r.id)); const before = party.members.length; party.members = party.members.filter((x) => ids.has(x)); if (party.members.length !== before) broadcastParty(); }
  else if (party && !net.roster.some((r) => r.id === party.pid)) party = null;
  homeT = 0; renderWin(); drawHud(true);
};
net.onStatus = (s) => {
  if (s === 'on') retries = 0;
  if (s === 'error' && started && wantRoom) { if (++retries <= 3) setTimeout(() => { if (started && wantRoom) connect(wantRoom); }, 1500 * retries); else { msg(tr().offline, 3000); wantRoom = null; connect(null); } }
  drawHud(true);
};
let retries = 0, wantRoom = null;

// ------------------------------------------------------------------ boss fights
let fight = null, fightQ = [], fightSendT = 0, fightEndT = 0;
let bv = null;                   // what everyone sees: { s: snapshot, t: when, mesh, tele: Map }
const fightOn = () => !!(bv && bv.s && !bv.s.over && bv.s.members.includes(myId()));
function startFight(type) {
  const t = tr();
  if (bv && bv.s && !bv.s.over && performance.now() - bv.t < 3000) { msg(t.fighting); return; }
  if (!isLeader()) { msg(t.onlyLeader); return; }
  const inRange = (id) => { if (id === myId()) return true; const p = net.peers.get(id); return p && p.s && Math.hypot(p.s.x - ARENA.x, p.s.z - ARENA.z) < ARENA.r + 9; };
  const members = party ? party.members.filter(inRange) : [myId()];
  fight = new BossFight(type, members, Date.now() & 0x7fffffff); fightQ = []; fightEndT = 0;
  closeWin(); me.hp = maxHp(save.lv, gearStats()); me.down = false;
  holdTool(me.avatar, toolMesh(me.tool));
}
function fightPlayers() {
  const out = [{ id: myId(), x: me.x, z: me.z, dead: me.down }];
  for (const [id, p] of net.peers) if (p.s) out.push({ id, x: p.s.x, z: p.s.z, dead: !!p.s.down });
  return out;
}
function updateFight(dt, now) {
  if (!fight) return;
  for (const e of fight.step(dt, fightPlayers())) { applyBossEvent(e); fightQ.push(e); }
  fightSendT -= dt;
  if (fightSendT <= 0 || fight.over) {
    fightSendT = 0.12;
    const s = fight.snap(); sendBoss({ ...s, ev: fightQ }, now, true); fightQ = [];
    onBossSnap({ from: myId(), ...s, ev: [] });
  }
  if (fight.over) { fightEndT += dt; if (fightEndT > 1.5) fight = null; }
}
net.onBoss = (p) => { if (p.from === myId()) return; for (const e of p.ev || []) if ((p.members || []).includes(myId())) applyBossEvent(e); onBossSnap(p); };
function applyBossEvent(e) {
  if (me.down || !bv && !fight) return;
  if (e.k === 'boom' && inShape(e.shape, me.x, me.z)) hurt(e.dmg);
  else if (e.k === 'touch' && e.to === myId()) hurt(e.dmg);
}
function hurt(dmg) {
  if (me.inv > 0 || me.down) return;
  const n = takenDamage(dmg, gearStats().def);
  me.hp -= n; me.inv = 0.6; sfx.play('hit'); flash(); pop('-' + n, '#ff5a5a');
  if (me.hp <= 0) { me.hp = 0; me.down = true; msg(tr().down, 3000); }
}
function onBossSnap(s) {
  const now = performance.now(), mine = (s.members || []).includes(myId());
  if (!bv || bv.s.type !== s.type || (bv.done && !s.over)) { clearBossView(); bv = { s, t: now, mesh: makeBoss(s.type), tele: new Map(), x: s.x, z: s.z, yaw: s.yaw, done: false }; scene.add(bv.mesh); bv.mesh.position.set(s.x, 0, s.z); if (mine) { me.hp = maxHp(save.lv, gearStats()); me.down = false; holdTool(me.avatar, toolMesh(me.tool)); } }
  bv.s = s; bv.t = now;
  if (s.over && !bv.done) {
    bv.done = true; const t = tr(), D = BOSSES[s.type];
    if (mine) {
      if (s.over === 'win') {
        const got = [];
        for (const [k, [a, b]] of Object.entries(D.drops)) { const n = a + Math.floor(rnd() * (b - a + 1)); if (k === 'coins') save.coins += n; else give(k, n); got.push(`${k === 'coins' ? '💰' : ITEMS[k].icon}×${n}`); }
        if (!save.trophies[s.type]) { save.trophies[s.type] = 1; give('decor_' + D.trophy, 1); toast(t.trophy(tx(DECOR[D.trophy].n))); }
        gainExp({ slime: 120, golem: 350, dragon: 900 }[s.type]);
        banner(t.bossWin(tx(D.n))); sfx.play('win'); toast(got.join('  ')); changed();
      } else { msg(t.bossLose, 4000); sfx.play('over'); }
    }
    me.down = false; me.hp = maxHp(save.lv, gearStats());
    setTimeout(() => { if (bv && bv.done) clearBossView(); holdTool(me.avatar, toolMesh(me.tool)); }, 3500);
  }
}
function clearBossView() { if (!bv) return; scene.remove(bv.mesh); for (const m of bv.tele.values()) { scene.remove(m); m.geometry.dispose(); } bv = null; }
const teleMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
const teleFill = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
function teleMesh(q) {
  let g;
  // shapes are drawn in the XY plane and laid flat (local +X → world +X, local +Y → world −Z), so a direction
  // (sin yaw, cos yaw) on the ground is the angle yaw − π/2 in the shape's plane
  if (q.k === 'circle') g = new THREE.CircleGeometry(q.r, 36);
  else if (q.k === 'ring') g = new THREE.RingGeometry(q.r2, q.r, 40);
  else if (q.k === 'cone') g = new THREE.CircleGeometry(q.r, 24, q.yaw - Math.PI / 2 - q.a, q.a * 2);
  else { const L = Math.hypot(q.x2 - q.x, q.z2 - q.z); g = new THREE.PlaneGeometry(q.w, L); g.translate(0, L / 2, 0); }
  const m = new THREE.Mesh(g, teleMat); m.rotation.x = -Math.PI / 2; m.position.set(q.x, 0.06, q.z);
  if (q.k === 'line') m.rotation.z = Math.atan2(-(q.x2 - q.x), -(q.z2 - q.z));
  const fill = new THREE.Mesh(g, teleFill); fill.position.z = 0.01; m.add(fill); m.userData.fill = fill;
  return m;
}
function updateBossView(dt, now) {
  if (!bv) return;
  if (!bv.done && now - bv.t > 3500) { if (bv.s.members.includes(myId())) msg(tr().bossLose, 3000); clearBossView(); me.down = false; return; }
  const s = bv.s, k = Math.min(1, dt * 10);
  bv.x += (s.x - bv.x) * k; bv.z += (s.z - bv.z) * k; bv.yaw += Math.atan2(Math.sin(s.yaw - bv.yaw), Math.cos(s.yaw - bv.yaw)) * k;
  const m = bv.mesh, b = m.userData.body; m.position.set(bv.x, 0, bv.z); m.rotation.y = bv.yaw;
  const tt = now / 1000;
  if (s.type === 'slime') { const sq = 1 + Math.sin(tt * 6) * 0.06; b.scale.set(1 / sq, sq, 1 / sq); b.position.y = Math.abs(Math.sin(tt * 3)) * 0.4; }
  else if (s.type === 'golem') b.position.y = Math.abs(Math.sin(tt * 4)) * 0.15;
  else b.traverse((o) => { if (o.userData.wing) o.rotation.x = Math.sin(tt * 4) * 0.4; });
  if (s.over === 'win') { m.scale.multiplyScalar(0.97); m.position.y -= dt; }
  const live = new Set();
  for (const q of s.tele || []) {
    live.add(q.id);
    let tm = bv.tele.get(q.id); if (!tm) { tm = teleMesh(q); scene.add(tm); bv.tele.set(q.id, tm); }
    const p = Math.max(0, Math.min(1, 1 - q.t / q.t0)); tm.userData.fill.scale.setScalar(Math.max(0.02, p));
  }
  for (const [id, tm] of bv.tele) if (!live.has(id)) { scene.remove(tm); tm.geometry.dispose(); bv.tele.delete(id); }
}
function attack() {
  if (!started || me.down || me.atkCd > 0 || me.roll > 0) return;
  if (!bv || bv.done || !bv.s.members.includes(myId())) { setAct('swing'); me.atkCd = 0.4; return; }
  me.atkCd = 0.5; setAct('swing'); sfx.play('swing');
  const D = BOSSES[bv.s.type], d = Math.hypot(bv.x - me.x, bv.z - me.z);
  if (d > D.size + 1.9) return;
  me.yaw = Math.atan2(bv.x - me.x, bv.z - me.z);
  const dmg = swingDamage(gearStats().atk);
  if (fight) fight.hit(dmg); else peerEvent({ k: 'bhit', to: bv.s.from, d: dmg });
  pop(String(dmg), '#ffd23a'); sfx.play('chop');
}
function roll() { if (!started || me.down || me.rollCd > 0) return; me.roll = 0.32; me.rollCd = 0.9; me.inv = Math.max(me.inv, 0.45); sfx.play('swing'); }
function eatBest() {
  const foods = Object.keys(save.inv).filter((id) => ITEMS[id] && ITEMS[id].kind === 'food').sort((a, b) => ITEMS[b].heal - ITEMS[a].heal);
  const mh = maxHp(save.lv, gearStats());
  if (!foods.length || me.hp >= mh || me.down) return;
  const f = foods.find((id) => ITEMS[id].heal <= mh - me.hp + 15) || foods[foods.length - 1];
  take(f); me.hp = Math.min(mh, me.hp + ITEMS[f].heal); if (ITEMS[f].speed) me.boost = 8;
  pop(`${ITEMS[f].icon} +${ITEMS[f].heal}`, '#7aff8a'); sfx.play('item'); changed();
}

// ------------------------------------------------------------------ the loop
let last = performance.now(), hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (started) update(dt, now);
  renderer.render(scene, camera);
}
function update(dt, now) {
  const inp = winOpen() ? { mx: 0, mz: 0, run: false } : inputVec(), moving = Math.hypot(inp.mx, inp.mz) > 0.12;
  me.inv = Math.max(0, me.inv - dt); me.rollCd = Math.max(0, me.rollCd - dt); me.atkCd = Math.max(0, me.atkCd - dt); actBusy = Math.max(0, actBusy - dt); me.boost = Math.max(0, (me.boost || 0) - dt);
  me.speed = 0;
  if (me.roll > 0) {
    me.roll -= dt;
    [me.x, me.z] = collide(W, me.x + Math.sin(me.yaw) * 13 * dt, me.z + Math.cos(me.yaw) * 13 * dt, 0.4, houseRects); me.speed = 2;
  } else if (moving && !me.down) {
    const sp = (inp.run ? 7.4 : 4.6) * (me.boost > 0 ? 1.25 : 1);
    [me.x, me.z] = collide(W, me.x + inp.mx * sp * dt, me.z + inp.mz * sp * dt, 0.4, houseRects);
    const want = Math.atan2(inp.mx, inp.mz); me.yaw += Math.atan2(Math.sin(want - me.yaw), Math.cos(want - me.yaw)) * Math.min(1, dt * 14);
    me.speed = (inp.run ? 1.6 : 1) * Math.hypot(inp.mx, inp.mz);
  }
  if (!fightOn()) { const mh = maxHp(save.lv, gearStats()); me.hp = Math.min(mh, me.hp + mh * 0.2 * dt); }
  me.actT += dt; if (me.act && me.actT > (me.act === 'cast' ? 99 : 0.45)) me.act = fishing ? 'cast' : '';
  updateFishing(dt, now); updateBugs(dt); updateFight(dt, now); updateBossView(dt, now);
  // the save, a little after changes
  if (saveT > 0 && (saveT -= dt) <= 0) persist();
  // me
  myAvatar(); if (me.labelSig !== save.name + save.lv) myAvatar(true);
  me.avatar.position.set(me.x, 0, me.z); me.avatar.rotation.y = me.yaw;
  animPerson(me.avatar, dt, me.speed, me.roll > 0 ? 'roll' : me.act || (me.emoT > 0 ? 'wave' : ''), me.actT);
  me.avatar.rotation.z = me.down ? 1.4 : 0; me.avatar.position.y = me.down ? 0.3 : 0;
  me.avatar.visible = !(me.inv > 0 && me.roll <= 0 && fightOn() && Math.sin(now / 50) > 0.3);
  if (me.bubble && (me.bubbleT -= dt) <= 0) { dropSprite(me.bubble); me.bubble = null; }
  me.emoT = Math.max(0, (me.emoT || 0) - dt);
  sendState({ x: +me.x.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(2), sp: +me.speed.toFixed(2), tool: toolMesh(me.tool), act: me.act, hp: Math.round(me.hp), mhp: maxHp(save.lv, gearStats()), down: me.down ? 1 : 0, look: save.look }, now);
  // the others
  const seen = new Set(), tNow = Date.now();
  for (const [id, pp] of net.peers) {
    const s = pp.s; if (!s || tNow - pp.t > 10000 || s.x === undefined) continue;
    seen.add(id);
    const q = peerFor(id, s), k = Math.min(1, dt * 10);
    q.x += (s.x - q.x) * k; q.z += (s.z - q.z) * k; if (Math.hypot(s.x - q.x, s.z - q.z) > 12) { q.x = s.x; q.z = s.z; }
    q.yaw += Math.atan2(Math.sin((s.yaw || 0) - q.yaw), Math.cos((s.yaw || 0) - q.yaw)) * k;
    q.avatar.position.set(q.x, s.down ? 0.3 : 0, q.z); q.avatar.rotation.y = q.yaw; q.avatar.rotation.z = s.down ? 1.4 : 0;
    holdTool(q.avatar, s.tool || 'hand');
    if (s.act !== q.lastAct) { q.lastAct = s.act; q.actT = 0; } q.actT = (q.actT || 0) + dt;
    animPerson(q.avatar, dt, s.sp || 0, s.act || '', q.actT);
    if (q.bubble && (q.bubbleT -= dt) <= 0) { dropSprite(q.bubble); q.bubble = null; }
  }
  for (const [id, q] of peers) if (!seen.has(id)) { dropPeer(q); peers.delete(id); }
  // homes
  if ((homeT -= dt) <= 0) { homeT = 1; updateHomes(); }
  // day and night
  daylight(now);
  if (W.fountainMesh) W.fountainMesh.traverse((o) => { if (o.userData.jet) o.scale.y = 1 + Math.sin(now / 200) * 0.15; });
  if (W.altarMesh) W.altarMesh.traverse((o) => { if (o.userData.orb) o.position.y = 1.9 + Math.sin(now / 400) * 0.12; });
  // camera
  const ch = 13 * camZoom, cb = 10 * camZoom;
  camera.position.set(me.x, ch, me.z + cb); camera.lookAt(me.x, 0.8, me.z);
  sun.position.set(me.x - 18, 30, me.z + 10); sun.target.position.set(me.x, 0, me.z);
  if ((hudT -= dt) <= 0) { hudT = 0.12; drawHud(); drawMini(); }
}
let lastSky = -1;
function daylight() {
  const h = islandHour(), d = h < 5 || h > 20 ? 0 : h < 7 ? (h - 5) / 2 : h > 18 ? (20 - h) / 2 : 1;
  const key = Math.round(h * 20); if (key === lastSky) return; lastSky = key;
  const day = new THREE.Color(0x9ad8ff), dusk = new THREE.Color(0xffb88a), night = new THREE.Color(0x1a2450);
  const sky = night.clone().lerp(d < 1 && d > 0 ? dusk : day, d);
  if (d >= 1) sky.copy(day);
  scene.background = sky; scene.fog.color.copy(sky);
  sun.intensity = 0.25 + 1.5 * d; hemi.intensity = 0.45 + 0.75 * d;
  sun.color.set(d < 1 ? 0xffc89a : 0xfff2d8);
  lampMat.emissiveIntensity = d < 0.6 ? 1.6 : 0.3;
}

// ------------------------------------------------------------------ HUD
function drawHud(force) {
  if (!started) return;
  const t = tr(), gs = gearStats(), mh = maxHp(save.lv, gs);
  $('meName').textContent = save.name || '?'; $('meLv').textContent = 'Lv' + save.lv;
  $('hpBar').style.width = (me.hp / mh * 100) + '%'; $('hpTxt').textContent = `${Math.ceil(me.hp)}/${mh}`;
  $('expBar').style.width = (save.exp / expFor(save.lv) * 100) + '%';
  $('coins').textContent = '💰 ' + save.coins.toLocaleString();
  const h = islandHour(); $('clock').textContent = `${isNight(h) ? '🌙' : '☀️'} ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  $('netSt').textContent = net.status === 'on' ? t.online(net.roster.length) : net.status === 'connecting' ? t.connecting : net.status === 'solo' ? t.solo : t.offline;
  const A = !winOpen() && findAction();
  $('hint').hidden = !A; if (A) $('hint').textContent = (isTouch ? '' : 'E · ') + A.label;
  $('bAct').textContent = A ? A.label : '✋';
  const inFight = bv && bv.s && !bv.done;
  $('bossbar').hidden = !inFight;
  if (inFight) { const D = BOSSES[bv.s.type]; $('bossName').textContent = `${D.icon} ${tx(D.n)}`; $('bossHp').style.width = (bv.s.hp / bv.s.max * 100) + '%'; }
  $('bAtk').hidden = !fightOn(); $('bRoll').hidden = !fightOn(); $('bEat').hidden = !fightOn();
  document.body.classList.toggle('fight', fightOn());
  // party frame
  if (party && party.members.length > 1) {
    $('party').hidden = false;
    $('party').innerHTML = party.members.map((id) => { const s = id === myId() ? { hp: me.hp, mhp: mh, down: me.down } : ((net.peers.get(id) || {}).s || {}); const k = s.mhp ? Math.max(0, s.hp / s.mhp) : 1; return `<div class="pm ${s.down ? 'down' : ''}"><b>${id === party.pid ? '👑 ' : ''}${esc(nameOf(id))}</b><i><em style="width:${k * 100}%"></em></i></div>`; }).join('');
  } else $('party').hidden = true;
  if (force || !drawHud.hb) drawHotbar();
}
function drawHotbar() {
  const t = tr();
  $('hotbar').innerHTML = HOTBAR.map((k, i) => {
    const icon = k === 'hand' ? '✋' : k === 'seed' ? (ITEMS['seed_' + save.seed] ? ITEMS[save.seed].icon : '🌱') : TOOLS[k].icon;
    const tier = TOOLS[k] && save.tools[k] > 1 ? `<sup>${'★'.repeat(save.tools[k] - 1)}</sup>` : '';
    const n = k === 'seed' ? `<em>${have('seed_' + save.seed)}</em>` : '';
    return `<button data-t="${k}" class="${me.tool === k ? 'sel' : ''}" title="${esc(t[k])}">${icon}${tier}${n}<small>${i + 1}</small></button>`;
  }).join('');
  $('hotbar').querySelectorAll('button').forEach((b) => b.onclick = () => pickTool(b.dataset.t));
  drawHud.hb = true;
}
let miniBase = null;
function drawMini() {
  const c = $('mini'), x = c.getContext('2d'), k = c.width / S;
  if (!miniBase) { miniBase = document.createElement('canvas'); miniBase.width = miniBase.height = S; const m = miniBase.getContext('2d'); for (let z = 0; z < S; z++) for (let xx = 0; xx < S; xx++) { m.fillStyle = TCOL[W.tile[z * S + xx]]; m.fillRect(xx, z, 1, 1); } m.fillStyle = '#2a6a2a'; for (const t of W.trees) m.fillRect(t.x - 1, t.z - 1, 2, 2); m.fillStyle = '#c84a3a'; for (const s of W.shops) m.fillRect(s.x - 3, s.z - 2, 6, 4); }
  x.clearRect(0, 0, c.width, c.height); x.drawImage(miniBase, 0, 0, c.width, c.height);
  const p = myPlot(); x.strokeStyle = '#ffd23a'; x.lineWidth = 2; x.strokeRect(p.x * k, p.z * k, p.w * k, p.d * k);
  for (const [id, q] of peers) { x.fillStyle = save.friends[id] ? '#ff7ab0' : party && party.members.includes(id) ? '#7affc8' : '#ffe07a'; x.beginPath(); x.arc(q.x * k, q.z * k, 3, 0, 7); x.fill(); }
  x.save(); x.translate(me.x * k, me.z * k); x.rotate(-me.yaw + Math.PI); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.beginPath(); x.moveTo(0, -6); x.lineTo(4.5, 5); x.lineTo(-4.5, 5); x.closePath(); x.fill(); x.stroke(); x.restore();
}
function msg(text, ms = 1800) { const el = $('msg'); el.textContent = text; el.classList.add('on'); clearTimeout(msg._t); msg._t = setTimeout(() => el.classList.remove('on'), ms); }
function banner(text) { const el = $('banner'); el.textContent = text; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function pop(text, color) { const el = document.createElement('div'); el.className = 'pop'; el.textContent = text; el.style.color = color; $('pops').appendChild(el); setTimeout(() => el.remove(), 1300); }
function flash() { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
function toast(text, buttons) {
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `<span></span>`; el.firstChild.textContent = text;
  if (buttons) { const row = document.createElement('div'); row.className = 'row'; for (const [label, fn, cls] of buttons) { const b = document.createElement('button'); b.textContent = label; b.className = cls || ''; b.onclick = () => { fn(); el.remove(); }; row.appendChild(b); } el.appendChild(row); }
  $('toasts').appendChild(el); setTimeout(() => el.classList.add('on'), 20);
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 400); }, buttons ? 20000 : 4500);
}
function ask(text, yes) { const t = tr(); sfx.play('gift'); toast(text, [[t.yes, () => { sfx.play('click'); yes(); }, 'yes'], [t.no, () => {}]]); }
function showCatch(f, fresh) {
  const t = tr(); const el = $('catch');
  el.innerHTML = `<span class="ic">${f.icon}</span><b>${esc(tx(f.n))}</b><small>${t.rare[f.rare]} · 💰${f.price}</small>${fresh ? `<em>${t.newDex}</em>` : ''}`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}

// ------------------------------------------------------------------ windows
let winRender = null;
const winOpen = () => !$('win').hidden;
function openWin(title, render) { winRender = () => { $('winTitle').textContent = title(); $('winBody').innerHTML = ''; render($('winBody')); }; $('win').hidden = false; winRender(); keys.clear(); }
function renderWin() { if (winOpen() && winRender) { const sc = $('winBody').scrollTop; winRender(); $('winBody').scrollTop = sc; } }
function closeWin() { $('win').hidden = true; winRender = null; }
$('winClose').onclick = () => { sfx.play('click'); closeWin(); };
$('win').addEventListener('pointerdown', (e) => { if (e.target.id === 'win') closeWin(); });
const html = (el, s) => { el.insertAdjacentHTML('beforeend', s); return el; };
const on = (root, sel, fn) => root.querySelectorAll(sel).forEach((b) => b.onclick = (e) => { sfx.play('click'); fn(b, e); });
const itemCard = (id, extra = '') => `<span class="ic">${ITEMS[id].icon}</span><b>${esc(nm(id))}</b>${extra}`;
const costList = (cost) => Object.entries(cost).map(([k, n]) => `<span class="${have(k) >= n ? 'okc' : 'noc'}">${ITEMS[k].icon}${have(k)}/${n}</span>`).join(' ');

function openBag(filter = 'all') {
  const t = tr();
  openWin(() => `🎒 ${t.bag}`, (el) => {
    const ids = Object.keys(save.inv).filter((id) => ITEMS[id] && save.inv[id] > 0 && (filter === 'all' || ITEMS[id].kind === filter));
    html(el, `<div class="tabs">${['all', ...Object.keys(KINDS)].map((k) => `<button data-k="${k}" class="${k === filter ? 'sel' : ''}">${k === 'all' ? t.all : tx(KINDS[k])}</button>`).join('')}</div>`);
    html(el, `<div class="grid">${ids.length ? ids.map((id) => { const it = ITEMS[id]; const act = it.kind === 'gear' ? `<button data-eq="${id}">${t.equip}</button>` : it.kind === 'food' ? `<button data-eat="${id}">${t.eat}</button>` : ''; return `<div class="cell">${itemCard(id, `<em>×${save.inv[id]}</em>`)}${act}</div>`; }).join('') : `<p class="dim">${t.none}</p>`}</div>`);
    on(el, '[data-k]', (b) => openBag(b.dataset.k));
    on(el, '[data-eq]', (b) => { equip(b.dataset.eq); openBag(filter); });
    on(el, '[data-eat]', (b) => { const id = b.dataset.eat; const mh = maxHp(save.lv, gearStats()); if (take(id)) { me.hp = Math.min(mh, me.hp + ITEMS[id].heal); sfx.play('item'); changed(); } openBag(filter); });
  });
}
function equip(id) { const it = ITEMS[id]; if (!it || !take(id)) return; const old = save.gear[it.slot]; if (old) give(old); save.gear[it.slot] = id; changed(); holdTool(me.avatar, toolMesh(me.tool)); }
function openChar() {
  const t = tr();
  openWin(() => `👕 ${t.char}`, (el) => {
    const gs = gearStats();
    html(el, `<div class="stats"><span>Lv <b>${save.lv}</b></span><span>❤ <b>${maxHp(save.lv, gs)}</b></span><span>⚔️ <b>${gs.atk}</b></span><span>🛡️ <b>${gs.def}</b></span>${gs.luck ? `<span>🍀 <b>${gs.luck}</b></span>` : ''}</div>`);
    html(el, `<div class="gear">${['w', 'a', 'x'].map((s) => { const id = save.gear[s]; return `<div class="slot">${id ? itemCard(id, `<small>${['atk', 'def', 'hp', 'luck'].filter((k) => ITEMS[id][k]).map((k) => `${{ atk: '⚔️', def: '🛡️', hp: '❤', luck: '🍀' }[k]}+${ITEMS[id][k]}`).join(' ')}</small>`) + `<button data-un="${s}">${t.unequip}</button>` : `<span class="ic dim">${{ w: '🗡️', a: '🦺', x: '💍' }[s]}</span><b class="dim">—</b>`}</div>`; }).join('')}</div>`);
    html(el, `<h3>${t.tool}</h3><div class="tools">${Object.entries(TOOLS).map(([k, T]) => `<span>${T.icon} ${esc(tx(T.tiers[save.tools[k] - 1]))}</span>`).join('')}</div>`);
    html(el, `<h3>${t.look}</h3>`); lookEditor(el, () => { myAvatar(true); changed(); });
    on(el, '[data-un]', (b) => { const id = save.gear[b.dataset.un]; if (id) { give(id); save.gear[b.dataset.un] = null; changed(); holdTool(me.avatar, toolMesh(me.tool)); } openChar(); });
  });
}
function lookEditor(el, after) {
  const t = tr(), L = save.look;
  const row = (key, list, label) => `<div class="lrow"><span>${label}</span>${list.map((c) => `<button class="sw ${L[key] === c ? 'sel' : ''}" data-l="${key}" data-v="${c}" style="background:${c}"></button>`).join('')}</div>`;
  html(el, row('skin', LOOKS.skin, t.skin) + row('hair', LOOKS.hair, t.hair) + `<div class="lrow"><span>${t.style}</span>${LOOKS.style.map((s) => `<button class="st ${L.style === s ? 'sel' : ''}" data-l="style" data-v="${s}">${t.styles[s]}</button>`).join('')}</div>` + row('shirt', COLORS, t.shirt) + row('pants', COLORS, t.pants));
  on(el, '[data-l]', (b) => { save.look[b.dataset.l] = b.dataset.v; after(); if (winRender) renderWin(); else renderTitle(); });
}
function openDex(kind = 'fish') {
  const t = tr();
  openWin(() => `📖 ${t.dex}`, (el) => {
    const list = kind === 'fish' ? FISH : BUGS, got = save.dex[kind];
    html(el, `<div class="tabs"><button data-k="fish" class="${kind === 'fish' ? 'sel' : ''}">🐟 ${t.fish} ${Object.keys(save.dex.fish).length}/${FISH.length}</button><button data-k="bug" class="${kind === 'bug' ? 'sel' : ''}">🦋 ${t.bug} ${Object.keys(save.dex.bug).length}/${BUGS.length}</button></div>`);
    html(el, `<div class="grid dex">${list.map((f) => got[f.id] ? `<div class="cell"><span class="ic">${f.icon}</span><b>${esc(tx(f.n))}</b><small>${t.where[f.where]} · ${t.when[f.when]} · ${'★'.repeat(f.rare)}</small><em>×${got[f.id]}</em></div>` : `<div class="cell un"><span class="ic">❔</span><b>？？？</b><small>${t.where[f.where]} · ${t.when[f.when]}</small></div>`).join('')}</div>`);
    on(el, '[data-k]', (b) => openDex(b.dataset.k));
  });
}
function openSeeds() {
  const t = tr();
  openWin(() => `🌱 ${t.seed}`, (el) => {
    html(el, `<div class="grid">${Object.keys(CROPS).map((c) => `<div class="cell ${save.seed === c ? 'selc' : ''}">${itemCard('seed_' + c, `<em>×${have('seed_' + c)}</em><small>⏱ ${Math.round(CROPS[c].grow / 60)} min → ${ITEMS[c].icon}</small>`)}<button data-s="${c}">✔</button></div>`).join('')}</div>`);
    on(el, '[data-s]', (b) => { save.seed = b.dataset.s; me.tool = 'seed'; holdTool(me.avatar, 'seed'); changed(); closeWin(); });
  });
}
function openShop(id, tab = 0) {
  const t = tr();
  if (id === 'workshop') return openWorkshop();
  if (id === 'decor') return openDecorShop();
  openWin(() => `🛒 ${t.store}  ·  💰 ${save.coins.toLocaleString()}`, (el) => {
    html(el, `<div class="tabs">${t.shopTabs.map((x, i) => `<button data-tab="${i}" class="${i === tab ? 'sel' : ''}">${x}</button>`).join('')}</div>`);
    if (tab === 0) {
      html(el, `<div class="grid">${STORE.map((sid) => `<div class="cell">${itemCard(sid, `<small>${sid.startsWith('seed_') ? `⏱ ${Math.round(CROPS[ITEMS[sid].crop].grow / 60)} min` : ITEMS[sid].heal ? `❤ +${ITEMS[sid].heal}` : ''}</small><em>×${have(sid)}</em>`)}<button data-buy="${sid}" ${save.coins < buyPrice(sid) ? 'disabled' : ''}>💰${buyPrice(sid)}</button></div>`).join('')}</div>`);
    } else {
      const ids = Object.keys(save.inv).filter((x) => ITEMS[x] && save.inv[x] > 0 && ITEMS[x].kind !== 'tool');
      html(el, `<div class="grid">${ids.length ? ids.map((sid) => `<div class="cell">${itemCard(sid, `<em>×${save.inv[sid]}</em>`)}<div class="row"><button data-sell="${sid}">💰${ITEMS[sid].price}</button><button data-sellall="${sid}">${t.sellAll}</button></div></div>`).join('') : `<p class="dim">${t.none}</p>`}</div>`);
    }
    on(el, '[data-tab]', (b) => openShop('store', +b.dataset.tab));
    on(el, '[data-buy]', (b) => { const sid = b.dataset.buy, p = buyPrice(sid); if (save.coins >= p) { save.coins -= p; give(sid); sfx.play('buy'); changed(); } openShop('store', 0); });
    const sell = (sid, n) => { n = Math.min(n, have(sid)); if (n <= 0) return; take(sid, n); save.coins += ITEMS[sid].price * n; track('sell', n); sfx.play('buy'); changed(); };
    on(el, '[data-sell]', (b) => { sell(b.dataset.sell, 1); openShop('store', 1); });
    on(el, '[data-sellall]', (b) => { sell(b.dataset.sellall, 9999); openShop('store', 1); });
  });
}
function openWorkshop() {
  const t = tr();
  openWin(() => `🔨 ${t.workshop}`, (el) => {
    html(el, `<div class="list">${RECIPES.map(([res, n, cost], i) => {
      const it = ITEMS[res], isTool = it.kind === 'tool', ownedTool = isTool && save.tools[it.tool] >= it.tier, lockTool = isTool && save.tools[it.tool] < it.tier - 1;
      const stat = ['atk', 'def', 'hp', 'heal', 'luck'].filter((k) => it[k]).map((k) => `${{ atk: '⚔️', def: '🛡️', hp: '❤', heal: '❤+', luck: '🍀' }[k]}${it[k]}`).join(' ');
      return `<div class="rec ${ownedTool ? 'done' : ''}">${itemCard(res, `${n > 1 ? `<em>×${n}</em>` : ''}<small>${stat}</small>`)}<div class="cost">${costList(cost)}</div><button data-r="${i}" ${!canPay(cost) || ownedTool || lockTool ? 'disabled' : ''}>${ownedTool ? '✔' : t.craft}</button></div>`;
    }).join('')}</div>`);
    on(el, '[data-r]', (b) => {
      const [res, n, cost] = RECIPES[+b.dataset.r], it = ITEMS[res];
      if (!pay(cost)) return;
      if (it.kind === 'tool') { save.tools[it.tool] = it.tier; toast(t.toolUp(nm(res))); drawHotbar(); } else give(res, n);
      track('craft'); gainExp(6); sfx.play('buy'); changed(); openWorkshop();
    });
  });
}
function openDecorShop() {
  const t = tr();
  openWin(() => `🪑 ${t.decorShop}  ·  💰 ${save.coins.toLocaleString()}`, (el) => {
    const st = save.house.stage, next = HOUSES[st + 1];
    html(el, `<div class="house"><b>${t.houseNow}：${esc(tx(HOUSES[st].n))} · ${t.farmSize(HOUSES[st].farm)}</b>${next ? `<div>→ <b>${esc(tx(next.n))}</b> · ${t.farmSize(next.farm)}</div><div class="cost">${costList(next.cost)} <span class="${save.coins >= next.coins ? 'okc' : 'noc'}">💰${next.coins.toLocaleString()}</span></div><button id="hUp" ${canPay(next.cost) && save.coins >= next.coins ? '' : 'disabled'}>${t.upgrade}</button>` : `<div class="dim">${t.maxHouse}</div>`}</div>`);
    html(el, `<div class="grid">${Object.entries(DECOR).filter(([, d]) => !d.trophy).map(([k, d]) => `<div class="cell"><span class="ic">${d.icon}</span><b>${esc(tx(d.n))}</b><em>×${have('decor_' + k)}</em><button data-d="${k}" ${save.coins < d.cost ? 'disabled' : ''}>💰${d.cost}</button></div>`).join('')}</div>`);
    if ($('hUp')) $('hUp').onclick = () => { if (!pay(next.cost) || save.coins < next.coins) return; save.coins -= next.coins; save.house.stage++; sfx.play('levelup'); banner(t.upgraded(tx(HOUSES[save.house.stage].n))); gainExp(30); changed(); sendHouseSoon(); homeT = 0; openDecorShop(); };
    on(el, '[data-d]', (b) => { const d = DECOR[b.dataset.d]; if (save.coins < d.cost) return; save.coins -= d.cost; give('decor_' + b.dataset.d); sfx.play('buy'); changed(); openDecorShop(); });
  });
}
function openHome(sel = null) {
  const t = tr();
  openWin(() => `🏠 ${tx(HOUSES[save.house.stage].n)}`, (el) => {
    const pal = (key) => `<div class="lrow"><span>${t[key]}</span>${COLORS.map((c) => `<button class="sw ${save.house[key] === c ? 'sel' : ''}" data-c="${key}" data-v="${c}" style="background:${c}"></button>`).join('')}</div>`;
    html(el, pal('roof') + pal('wall'));
    const decs = Object.keys(save.inv).filter((id) => ITEMS[id] && ITEMS[id].kind === 'decor' && save.inv[id] > 0);
    html(el, `<h3>${t.yard}</h3><div class="pick">${decs.map((id) => `<button data-p="${id}" class="${sel === id ? 'sel' : ''}">${ITEMS[id].icon}<em>${save.inv[id]}</em></button>`).join('') || `<span class="dim">${t.none}</span>`}</div>`);
    html(el, `<div class="yard">${save.house.decor.map((d, k) => `<button data-y="${k}">${d && DECOR[d] ? DECOR[d].icon : '·'}</button>`).join('')}</div>`);
    on(el, '[data-c]', (b) => { save.house[b.dataset.c] = b.dataset.v; changed(); sendHouseSoon(); homeT = 0; openHome(sel); });
    on(el, '[data-p]', (b) => openHome(b.dataset.p === sel ? null : b.dataset.p));
    on(el, '[data-y]', (b) => {
      const k = +b.dataset.y, cur = save.house.decor[k];
      if (cur) { give('decor_' + cur); save.house.decor[k] = null; }
      if (sel && take(sel)) save.house.decor[k] = ITEMS[sel].decor;
      changed(); sendHouseSoon(); homeT = 0; openHome(have(sel) ? sel : null);
    });
  });
}
function openDaily() {
  const t = tr(), tasks = dailyTasks();
  openWin(() => `📋 ${t.tasks(today())}`, (el) => {
    html(el, `<div class="list">${tasks.map((q, i) => { const p = Math.min(q.n, save.daily.prog[q.k] || 0), got = save.daily.got.includes(i); return `<div class="rec"><span class="ic">${['🎣', '🥅', '🌾', '🪵', '🪨', '🎁', '🔨', '💰', '🍎'][['fish', 'bug', 'harvest', 'wood', 'stone', 'gift', 'craft', 'sell', 'fruit'].indexOf(q.k)]}</span><b>${t.taskNames[q.k]} ${p}/${q.n}</b><small>💰150 · EXP 40</small><button data-q="${i}" ${p < q.n || got ? 'disabled' : ''}>${got ? t.claimed : t.claim}</button></div>`; }).join('')}</div>`);
    on(el, '[data-q]', (b) => { const i = +b.dataset.q; if (save.daily.got.includes(i)) return; save.daily.got.push(i); save.coins += 150; gainExp(40); sfx.play('win'); changed(); openDaily(); });
  });
}
function openAltar() {
  const t = tr();
  openWin(() => `🔥 ${t.boss}`, (el) => {
    const busy = bv && bv.s && !bv.done && performance.now() - bv.t < 3000;
    const n = party ? party.members.length : 1;
    html(el, `<p class="dim">${busy ? t.fighting : t.partyIn(n)}</p><div class="list">${Object.entries(BOSSES).map(([k, B]) => `<div class="rec"><span class="ic">${B.icon}</span><b>${esc(tx(B.n))}${save.trophies[k] ? ' 🏆' : ''}</b><small>${esc(tx(B.rec))}</small><button data-b="${k}" ${busy || !isLeader() ? 'disabled' : ''}>${t.fightStart}</button></div>`).join('')}</div>${!isLeader() ? `<p class="dim">${t.onlyLeader}</p>` : ''}`);
    on(el, '[data-b]', (b) => startFight(b.dataset.b));
  });
}
function openSocial(giftTo = null) {
  const t = tr();
  if (giftTo) return openWin(() => `🎁 ${t.giftPick(nameOf(giftTo))}`, (el) => {
    const ids = Object.keys(save.inv).filter((id) => ITEMS[id] && save.inv[id] > 0 && ITEMS[id].kind !== 'tool');
    html(el, `<div class="grid">${ids.map((id) => `<div class="cell">${itemCard(id, `<em>×${save.inv[id]}</em>`)}<div class="row"><button data-g="${id}" data-n="1">1</button>${save.inv[id] >= 5 ? `<button data-g="${id}" data-n="5">5</button>` : ''}</div></div>`).join('') || `<p class="dim">${t.none}</p>`}</div>`);
    on(el, '[data-g]', (b) => { sendGift(giftTo, b.dataset.g, +b.dataset.n); closeWin(); });
  });
  openWin(() => `👥 ${t.social}`, (el) => {
    const others = net.roster.filter((r) => r.id !== myId());
    const near6 = (id) => { const q = peers.get(id); return q && Math.hypot(q.x - me.x, q.z - me.z) < 8; };
    if (party && party.members.length > 1) html(el, `<h3>⚔️ ${t.party}</h3><div class="list">${party.members.map((id) => `<div class="rec small"><b>${id === party.pid ? '👑 ' : ''}${esc(nameOf(id))}</b></div>`).join('')}</div><button id="pLeave" class="ghost">${t.leave}</button>`);
    html(el, `<h3>🏝️ ${t.onIsle} (${others.length})</h3><div class="list">${others.length ? others.map((r) => `<div class="rec small"><b>${esc(r.n || '?')} <small>Lv${r.lv || 1}</small>${save.friends[r.id] ? ` <span class="tag">💕 ${t.isFriend}</span>` : ''}</b><div class="row">${save.friends[r.id] ? '' : `<button data-f="${r.id}">${t.addFriend}</button>`}<button data-gift="${r.id}">🎁 ${t.gift}</button>${party && party.members.includes(r.id) ? '' : `<button data-inv="${r.id}">⚔️ ${t.invite}</button>`}</div></div>`).join('') : `<p class="dim">${t.noOne}</p>`}</div>`);
    const fr = Object.entries(save.friends);
    html(el, `<h3>💕 ${t.friends}</h3><div class="list">${fr.length ? fr.map(([id, f]) => `<div class="rec small"><b>${net.roster.some((r) => r.id === id) ? '🟢' : '⚪'} ${esc(f.n || '?')}</b></div>`).join('') : `<p class="dim">${t.noFriends}</p>`}</div>`);
    html(el, `<h3>💬 ${t.chat}</h3><div class="pick">${SAYS.map((s, i) => `<button data-say="${i}">${esc(tx(s))}</button>`).join('')}${EMOTES.map((e) => `<button data-emo="${e}">${e}</button>`).join('')}</div>`);
    on(el, '[data-f]', (b) => { peerEvent({ k: 'freq', to: b.dataset.f }); msg('✉️ ' + nameOf(b.dataset.f)); });
    on(el, '[data-gift]', (b) => { if (!near6(b.dataset.gift)) { msg(t.notNear); return; } openSocial(b.dataset.gift); });
    on(el, '[data-inv]', (b) => invite(b.dataset.inv));
    on(el, '[data-say]', (b) => { peerEvent({ k: 'say', i: +b.dataset.say }); closeWin(); });
    on(el, '[data-emo]', (b) => { peerEvent({ k: 'emo', e: b.dataset.emo }); me.emoT = 1.5; closeWin(); });
    if ($('pLeave')) $('pLeave').onclick = () => leaveParty();
  });
}
function openSettings() {
  const t = tr();
  openWin(() => `⚙️ ${t.settings}`, (el) => {
    html(el, `<div class="list"><div class="rec small"><b>🌐</b><button id="sLang">${t.lang}</button></div><div class="rec small"><b>🔊 ${t.sound}</b><button id="sSnd">${save.sound ? 'ON' : 'OFF'}</button></div></div>`);
    html(el, `<h3>❓ ${t.help}</h3>${t.helpBody.map((p) => `<p>${p}</p>`).join('')}<p class="dim">${isTouch ? t.touchKeys : t.pcKeys}</p>`);
    $('sLang').onclick = () => { save.lang = save.lang === 'zh' ? 'en' : 'zh'; changed(); for (const [s, sh] of townSigns) { const n = textSprite(SHOPNAME[sh.id](), { scale: 1.1, bg: 'rgba(60,40,20,.85)' }); n.position.copy(s.position); scene.add(n); dropSprite(s); townSigns[townSigns.findIndex((x) => x[0] === s)] = [n, sh]; } openSettings(); drawHotbar(); };
    $('sSnd').onclick = () => { save.sound = !save.sound; sfx.on = save.sound; changed(); openSettings(); };
  });
}
for (const [id, fn] of [['bBag', () => openBag()], ['bChar', openChar], ['bHome', () => openHome()], ['bDex', () => openDex()], ['bSocial', () => openSocial()], ['bDaily', openDaily], ['bSet', openSettings]]) $(id).onclick = () => { sfx.unlock(); sfx.play('click'); if (winOpen()) closeWin(); else fn(); };

// ------------------------------------------------------------------ title
let prev = null;
function preview() {
  const c = $('tPrev'); if (!c) return;
  if (!prev) { const r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true }); r.outputColorSpace = THREE.SRGBColorSpace; const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x8aa86a, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 1); d.position.set(2, 3, 4); sc.add(d); const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 30); cam.position.set(0, 1.5, 6.2); cam.lookAt(0, 1.15, 0); prev = { r, sc, cam, m: null }; }
  if (prev.m) prev.sc.remove(prev.m);
  prev.m = makePerson(save.look); prev.sc.add(prev.m); holdTool(prev.m, 'net');
  prev.r.setSize(c.clientWidth || 180, c.clientHeight || 220, false);
}
function spinPreview(now) { if (!$('title').hidden && prev && prev.m) { prev.m.rotation.y = Math.sin(now / 1200) * 0.7; animPerson(prev.m, 0.016, 0, 'wave', 0); prev.r.render(prev.sc, prev.cam); } requestAnimationFrame(spinPreview); }
function renderTitle() {
  const t = tr();
  $('tTitle').textContent = t.title; $('tSub').textContent = t.sub; $('tNameL').textContent = t.name; $('tNameTip').textContent = t.nameTip; $('tWith').textContent = t.with; $('tLook').textContent = t.look;
  if (document.activeElement !== $('tName')) $('tName').value = save.name;
  $('tLooks').innerHTML = ''; lookEditor($('tLooks'), () => { preview(); persist(); });
  const mode = save.room === 'public' || save.room === 'solo' ? save.room : 'private';
  $('tRooms').innerHTML = [['public', t.public], ['private', t.private], ['solo', t.solo]].map(([m, l]) => `<button data-m="${m}" class="${m === mode ? 'sel' : ''}">${l}</button>`).join('');
  on($('tRooms'), '[data-m]', (b) => { const m = b.dataset.m; save.room = m === 'private' ? (save.lastCode = save.lastCode || newCode()) : m; persist(); renderTitle(); });
  $('tPriv').hidden = mode !== 'private'; $('tCodeNow').textContent = mode === 'private' ? save.room : '';
  $('tNew').textContent = t.newRoom; $('tJoin').textContent = t.join; $('tCode').placeholder = t.code;
  $('tRoomTip').textContent = mode === 'public' ? t.publicTip : mode === 'solo' ? t.soloTip : t.privateTip(save.room);
  $('tPlay').textContent = '⛵ ' + t.enter; $('tKeys').textContent = isTouch ? t.touchKeys : t.pcKeys;
  $('tLang').textContent = save.lang === 'zh' ? 'English' : '中文';
  preview();
}
$('tName').addEventListener('input', () => { save.name = cleanName($('tName').value); persist(); });
$('tNew').onclick = () => { save.room = save.lastCode = newCode(); persist(); renderTitle(); };
$('tJoin').onclick = () => { const c = cleanCode($('tCode').value); if (c.length !== 4) { $('tCode').classList.add('bad'); setTimeout(() => $('tCode').classList.remove('bad'), 600); return; } save.room = save.lastCode = c; persist(); $('tCode').value = ''; renderTitle(); };
$('tCode').addEventListener('input', () => { const v = cleanCode($('tCode').value); if ($('tCode').value !== v) $('tCode').value = v; });
$('tLang').onclick = () => { save.lang = save.lang === 'zh' ? 'en' : 'zh'; persist(); renderTitle(); };
let joining = false;
$('tPlay').onclick = async () => {
  if (joining || started) return;
  sfx.unlock(); sfx.play('click');
  // give the cloud save a moment, so this visit uses the account's id (the same on every device)
  $('tPlay').disabled = true; await Promise.race([cloudReady, new Promise((r) => setTimeout(r, 3000))]); joining = true; $('tPlay').disabled = false;
  save.name = cleanName($('tName').value) || save.name || (save.lang === 'zh' ? '島民' : 'Islander') + Math.floor(10 + rnd() * 90); persist();
  $('title').hidden = true; $('hud').hidden = false; started = true;
  setId(save.id); setMe({ n: save.name, lv: save.lv });
  const p = myPlot(); me.x = p.x + p.w / 2; me.z = p.z + p.d - 0.8; me.yaw = Math.PI;
  me.hp = maxHp(save.lv, gearStats());
  myAvatar(true); drawHotbar(); drawHud(true);
  wantRoom = save.room === 'solo' ? null : save.room; retries = 0;
  connect(wantRoom);
  sfx.on = save.sound;
};

// ------------------------------------------------------------------ boot
document.body.classList.toggle('touch', isTouch);
setId(save.id);
renderTitle(); requestAnimationFrame(spinPreview);
camera.position.set(80, 40, 120); camera.lookAt(80, 0, 78); daylight();
requestAnimationFrame(frame);
const cloudReady = startCloud(() => !started && !joining).then((newer) => { if (!started && !joining) { setId(save.id); if (newer) renderTitle(); } });
if (params.has('play')) $('tPlay').onclick();
window.BI = { W, me, save: () => save, net, get party() { return party; }, get bv() { return bv; }, get fight() { return fight; }, doAction, pickTool, startFight, invite, sendGift, peers, bugs, openWin, closeWin, attack };
