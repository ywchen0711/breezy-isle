// Playing together over Supabase Realtime (the same project the game site's saves use), no game server:
//   bi:<room>  broadcast  's' where I am and what I hold · 'h' my house, farm and yard · 'p' player events (chat, gifts,
//              friends, parties, hits on a boss) · 'b' the boss fight (sent by the party leader who runs it)
//              presence   who is here: { n, lv, since }
// A player's id is stable (their cloud-save account when there is one), so friends stay friends between visits.
const SB_URL = 'https://usoavddhglpbdpwwxium.supabase.co';
const SB_KEY = 'sb_publishable_HbbsnjG0GTwzfRgKyx1Aqg__JUOb24B';   // publishable: safe in the browser
const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

const me = { id: '', n: 'Islander', lv: 1, since: Date.now() };
export const net = {
  room: null, status: 'off',            // off | solo | connecting | on | error
  roster: [],                           // everyone here, oldest first: [{ id, n, lv, since }]
  peers: new Map(),                     // id -> { s: latest state, t: when, h: house }
  onPeer: null, onBoss: null, onRoster: null, onStatus: null, onHouse: null,
};
export const myId = () => me.id;
export function setId(id) { me.id = id; }
let sb = null, lib = null, ch = null, joins = 0, pres = [], rosterSig = '';
const status = (s) => { net.status = s; if (net.onStatus) net.onStatus(s); };
async function client() {
  if (!lib) lib = import(SB_LIB);
  const { createClient } = await lib;
  if (!sb) sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 40 } } });
  return sb;
}
// who is here: presence, plus anyone we are hearing from (presence can lag a few seconds)
function merge() {
  const now = Date.now(), m = new Map();
  for (const r of pres) m.set(r.id, { id: r.id, n: r.n, lv: r.lv, since: r.since || 0 });
  for (const [id, p] of net.peers) {
    if (now - p.t > 8000) { if (!pres.some((r) => r.id === id)) net.peers.delete(id); continue; }
    const r = m.get(id) || { id, since: p.s.since || 0 }; r.n = p.s.n || r.n; r.lv = p.s.lv || r.lv; m.set(id, r);
  }
  m.set(me.id, { id: me.id, n: me.n, lv: me.lv, since: me.since });
  net.roster = [...m.values()].sort((a, b) => (a.since || 0) - (b.since || 0) || (a.id < b.id ? -1 : 1));
  const sig = JSON.stringify(net.roster.map((r) => [r.id, r.n, r.lv]));
  if (sig !== rosterSig) { rosterSig = sig; if (net.onRoster) net.onRoster(net.roster); }
}
setInterval(() => { if (net.status === 'on') merge(); }, 2000);
export function setMe(o) {
  Object.assign(me, o);
  if (ch && net.status === 'on') { ch.track({ n: me.n, lv: me.lv, since: me.since }).catch(() => {}); merge(); }
  else { net.roster = [{ id: me.id, n: me.n, lv: me.lv, since: me.since }]; if (net.onRoster) net.onRoster(net.roster); }
}
export async function connect(room) {
  leave();
  const ticket = ++joins;
  me.since = Date.now();
  if (!room) { status('solo'); setMe({}); return; }
  net.room = room; status('connecting');
  let c;
  try { c = await client(); } catch (e) { lib = null; if (ticket === joins) status('error'); return; }
  if (ticket !== joins) return;
  const mine = c.channel(`bi:${room}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
  ch = mine;
  mine.on('presence', { event: 'sync' }, () => {
    if (ch !== mine) return;
    pres = Object.entries(mine.presenceState()).map(([id, metas]) => ({ id, ...(metas[metas.length - 1] || {}) }));
    merge();
  }).on('presence', { event: 'leave' }, ({ key }) => {
    if (ch !== mine) return;
    net.peers.delete(key); pres = pres.filter((r) => r.id !== key); merge();
  }).on('broadcast', { event: 's' }, ({ payload: p }) => {
    if (ch !== mine || !p || p.id === me.id) return;
    const old = net.peers.get(p.id);
    net.peers.set(p.id, { ...(old || {}), s: p, t: Date.now() });
    if (!old) { merge(); sendHouseSoon(); }      // someone new: show them my house too
  }).on('broadcast', { event: 'h' }, ({ payload: p }) => {
    if (ch !== mine || !p || p.id === me.id) return;
    const old = net.peers.get(p.id) || { s: { id: p.id, x: 0, z: 0 }, t: 0 };
    old.h = p.h; net.peers.set(p.id, old);
    if (net.onHouse) net.onHouse(p.id, p.h);
  }).on('broadcast', { event: 'p' }, ({ payload: p }) => {
    if (ch !== mine || !p || (p.to && p.to !== me.id)) return;
    if (net.onPeer) net.onPeer(p);
  }).on('broadcast', { event: 'b' }, ({ payload: p }) => {
    if (ch !== mine || !p) return;
    if (net.onBoss) net.onBoss(p);
  }).subscribe((s) => {
    if (ch !== mine) return;
    if (s === 'SUBSCRIBED') { status('on'); mine.track({ n: me.n, lv: me.lv, since: me.since }).catch(() => {}); lastS = 0; sendHouseSoon(); }
    else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') status('error');
  });
}
export function leave() {
  joins++;
  if (sb && ch) sb.removeChannel(ch);
  ch = null; pres = []; rosterSig = ''; net.room = null; net.peers.clear(); net.roster = []; status('off');
}
const send = (event, payload) => { if (ch && net.status === 'on') ch.send({ type: 'broadcast', event, payload }).catch(() => {}); };
// my state: ~10 a second while moving, every 1.5 s when still
let lastS = 0, lastKey = '';
export function sendState(s, now = performance.now()) {
  const key = `${s.x.toFixed(1)},${s.z.toFixed(1)},${s.tool},${s.act || ''},${s.hp},${s.emo || ''}`;
  if (now - lastS < (key === lastKey ? 1500 : 100)) return;
  lastS = now; lastKey = key;
  send('s', { id: me.id, n: me.n, lv: me.lv, since: me.since, ...s });
}
// my house: on change, when someone new arrives, and every 20 s
let houseFn = null, houseT = null;
export function setHouseSource(fn) { houseFn = fn; }
export function sendHouseSoon(ms = 400) { clearTimeout(houseT); houseT = setTimeout(() => { if (houseFn) send('h', { id: me.id, h: houseFn() }); }, ms); }
setInterval(() => sendHouseSoon(0), 20000);
// an event for others (to: one player, or everyone); it also reaches me when it is for everyone
export function peerEvent(p) { const m = { ...p, from: me.id, fn: me.n }; send('p', m); if (!p.to && net.onPeer) net.onPeer(m); }
let lastB = 0;
export function sendBoss(b, now = performance.now(), force = false) { if (!force && now - lastB < 120) return; lastB = now; send('b', { from: me.id, ...b }); }
export function newCode() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
export const cleanName = (s) => String(s || '').replace(/https?:\/\/\S+|www\.\S+/gi, '').replace(/[<>{}]/g, '').trim().slice(0, 12);
