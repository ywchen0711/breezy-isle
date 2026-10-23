// The save (kept in localStorage and mirrored to the game site's cloud save), and the game's words.
import { ITEMS, CROPS, HOUSES, LOOKS, expFor } from './data.js';

export const SAVE_KEY = 'bi_save_v1', GAME = 'breezy-isle';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36));
export function freshSave() {
  return {
    id: uid(), name: '', lang: /^zh/i.test(navigator.language || '') ? 'zh' : 'en', sound: true, room: 'public', lastCode: '',
    look: { skin: LOOKS.skin[1], hair: LOOKS.hair[0], style: 'short', shirt: '#3aa8d8', pants: '#3a4a6a' },
    lv: 1, exp: 0, coins: 300, inv: { seed_carrot: 6, seed_tomato: 3, soup: 2 }, tools: { axe: 1, pick: 1, rod: 1, net: 1, can: 1 },
    gear: { w: null, a: null, x: null }, house: { stage: 0, roof: '#e8584a', wall: '#f4f0e8', decor: Array(9).fill(null) },
    farm: Array(16).fill(null), dex: { fish: {}, bug: {} }, friends: {}, nodes: {}, daily: { day: '', prog: {}, got: [] }, seed: 'carrot', trophies: {}, started: Date.now(),
  };
}
export let save = load();
function load() {
  const d = freshSave();
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && typeof s === 'object') return { ...d, ...s, look: { ...d.look, ...s.look }, tools: { ...d.tools, ...s.tools }, gear: { ...d.gear, ...s.gear }, house: { ...d.house, ...s.house }, dex: { ...d.dex, ...s.dex }, daily: { ...d.daily, ...s.daily } }; } catch (e) { /* bad save */ }
  return d;
}
export function reloadSave() { save = load(); return save; }
let cloud = null;
export async function startCloud(canSwitchId = () => true) {
  try {
    cloud = await import('/save.js');
    const newer = await cloud.pull(GAME, SAVE_KEY);
    const playing = !canSwitchId();
    if (newer && !playing) reloadSave();
    const u = await cloud.ensure();
    if (u && u.id && save.id !== u.id && canSwitchId()) { save.id = u.id; persist(); }   // the same id on every device (only before you join the isle)
    return newer;
  } catch (e) { cloud = null; return false; }
}
export const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } if (cloud) cloud.touch(GAME, SAVE_KEY); };

// inventory
export const have = (id) => save.inv[id] || 0;
export function give(id, n = 1) { if (!ITEMS[id] || n <= 0) return; save.inv[id] = have(id) + n; }
export function take(id, n = 1) { if (have(id) < n) return false; save.inv[id] -= n; if (!save.inv[id]) delete save.inv[id]; return true; }
export const canPay = (cost) => Object.entries(cost).every(([k, n]) => have(k) >= n);
export function pay(cost) { if (!canPay(cost)) return false; for (const [k, n] of Object.entries(cost)) take(k, n); return true; }

// gear totals
export function gearStats() {
  const s = { atk: 4 + Math.floor(save.lv * 0.5), def: 0, hp: 0, luck: 0 };
  for (const id of Object.values(save.gear)) { const it = id && ITEMS[id]; if (it) for (const k of ['atk', 'def', 'hp', 'luck']) s[k] += it[k] || 0; }
  return s;
}

// crops grow on real time (also while you are away); watering doubles the speed for three minutes
export function cropNow(c, now = Date.now()) {
  if (!c) return null;
  const dt = Math.max(0, (now - c.last) / 1000), wet = Math.max(0, Math.min(dt, (c.wet - c.last) / 1000));
  c.g += dt + wet; c.last = now;
  const k = c.g / CROPS[c.c].grow;
  c.stage = k >= 1 ? 3 : k >= 0.66 ? 2 : k >= 0.33 ? 1 : 0;
  return c;
}
export const farmSize = () => HOUSES[save.house.stage].farm;

// life level
export function addExp(n) {
  save.exp += n; const ups = [];
  while (save.exp >= expFor(save.lv)) { save.exp -= expFor(save.lv); save.lv++; ups.push(save.lv); }
  return ups;
}

// daily tasks (the same three for everyone each day, by the date)
const TASKS = [['fish', 3], ['bug', 3], ['harvest', 4], ['wood', 10], ['stone', 8], ['gift', 1], ['craft', 1], ['sell', 6], ['fruit', 4], ['fish', 6], ['bug', 5], ['harvest', 8]];
export const today = () => new Date().toISOString().slice(0, 10);
export function dailyTasks() {
  const d = today(); let h = 0; for (const c of d) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out = [], used = new Set();
  for (let i = 0; out.length < 3 && i < 40; i++) { const t = TASKS[(h + i * 7) % TASKS.length]; if (!used.has(t[0])) { used.add(t[0]); out.push({ k: t[0], n: t[1] }); } }
  if (save.daily.day !== d) save.daily = { day: d, prog: {}, got: [] };
  return out;
}
export function track(k, n = 1) { dailyTasks(); save.daily.prog[k] = (save.daily.prog[k] || 0) + n; }

// ------------------------------------------------------------------ words
export const tx = (pair) => (pair ? pair[save.lang === 'zh' ? 0 : 1] : '');
export const nm = (id) => (ITEMS[id] ? tx(ITEMS[id].n) : id);
const STR = {
  zh: {
    title: '微風島', sub: '和朋友一起在島上種田、釣魚、捕蟲、蓋房子、做裝備、組隊打王！', name: '你的暱稱', nameTip: '別人會看到這個名字，不要用真實的全名喔',
    look: '外觀', skin: '膚色', hair: '髮色', style: '髮型', shirt: '上衣', pants: '褲子', styles: { short: '短髮', long: '長髮', pony: '馬尾', spiky: '刺刺頭', bun: '包包頭', cap: '帽子' },
    with: '和誰一起玩', public: '🌍 公開島嶼', private: '🔒 私人島嶼', solo: '🙂 自己玩', newRoom: '建立新島', join: '加入', code: '代碼',
    publicTip: '和所有在公開島嶼的玩家一起玩', privateTip: (c) => `把代碼 ${c} 告訴朋友，輸入同一個代碼就能一起玩`, soloTip: '不連線，只有你自己',
    enter: '出發去島上', connecting: '連線中…', online: (n) => `🟢 島上有 ${n} 人`, offline: '連不上線，先自己玩',
    hand: '手', axe: '斧頭', pick: '十字鎬', rod: '釣竿', net: '捕蟲網', can: '澆水壺', seed: '種子',
    a: { talk: '說話', store: '逛雜貨店', decor: '逛家具店', workshop: '進工坊', board: '看公告板', altar: '挑戰魔王', chop: '砍樹', shake: '搖樹', mine: '敲石頭', fiber: '拔草', cast: '釣魚', reel: '拉竿！', swing: '揮網', plant: '種下', water: '澆水', harvest: '收成', house: '我的家', attack: '攻擊' },
    noSeeds: '沒有這種種子了', needWater: '這裡不能釣魚', tired: '這裡暫時沒東西了，等一下再來', got: (s) => `得到 ${s}`, newDex: '📖 新紀錄！', escaped: '跑掉了…', tooEarly: '還沒上鉤…', bugFled: '蟲蟲飛走了…', missed: '沒撈到…',
    lvup: (n) => `🎉 升到 Lv${n}！`, coins: '金幣', buy: '買', sell: '賣', sellAll: '全部賣', craft: '製作', need: '需要', owned: '有', equip: '裝備', unequip: '卸下', eat: '吃', place: '擺放', remove: '收起',
    bag: '背包', char: '角色', dex: '圖鑑', social: '朋友', daily: '每日任務', home: '我的家', chat: '說話', settings: '設定', all: '全部', none: '空空的',
    store: '雜貨店', decorShop: '木匠家具店', workshop: '工坊', board: '公告板', fish: '魚', bug: '昆蟲', where: { river: '河流', sea: '海', pond: '池塘', flowers: '花叢', trees: '樹上', grass: '草地', water: '水邊', rocks: '石頭' },
    when: { day: '白天', night: '晚上', any: '整天' }, rare: ['', '常見', '普通', '稀有', '非常稀有', '傳說'],
    upgrade: '升級房子', upgraded: (n) => `🏠 房子升級成 ${n}！`, roof: '屋頂顏色', wall: '牆壁顏色', yard: '院子（點格子擺放家具）', farmSize: (n) => `田地 ${n} 格`, houseNow: '現在', maxHouse: '已經是最大的房子了',
    tasks: (d) => `每日任務（${d}）`, claim: '領獎', claimed: '✔ 已領', taskNames: { fish: '釣魚', bug: '捕蟲', harvest: '收成作物', wood: '收集木材', stone: '收集石頭', gift: '送禮給朋友', craft: '在工坊做東西', sell: '在雜貨店賣東西', fruit: '搖樹拿水果' },
    onIsle: '在島上的人', friends: '我的朋友', party: '隊伍', invite: '邀請組隊', addFriend: '加好友', gift: '送禮', leave: '離開隊伍', isFriend: '好友', noOne: '島上還沒有其他人', noFriends: '還沒有朋友，去島上認識大家吧！',
    friendAsk: (n) => `${n} 想加你好友`, partyAsk: (n) => `${n} 邀請你組隊打魔王`, yes: '好', no: '不要', friendOk: (n) => `🤝 和 ${n} 成為朋友了！`, giftFrom: (n, s) => `🎁 ${n} 送你 ${s}！`, giftSent: (n) => `🎁 送給 ${n} 了！`, giftPick: (n) => `要送什麼給 ${n}？`,
    partyFull: '隊伍滿了（最多 4 人）', joined: (n) => `${n} 加入隊伍`, partyLeft: (n) => `${n} 離開隊伍`, notNear: '要走近一點',
    boss: '魔王祭壇', fightStart: '開始挑戰', fighting: '有人正在挑戰魔王…', onlyLeader: '只有隊長可以開始', bossWin: (n) => `🏆 打倒了 ${n}！`, bossLose: '全隊倒下了…回去準備一下再來！', down: '你倒下了…等隊友打完', partyIn: (n) => `參戰：${n} 人（在祭壇附近的隊友）`,
    pcKeys: 'WASD 移動 · 拖曳畫面或 Z / X 轉視角 · 滾輪縮放 · Shift 跑步 · E 動作 · 1–7 換工具 · F 攻擊 · 空白鍵 翻滾 · Q 吃東西', touchKeys: '左邊搖桿移動 · 右半邊拖曳轉視角 · 右下按鈕動作', lang: 'English', sound: '音效',
    shopTabs: ['買', '賣'], tool: '工具', toolUp: (n) => `🔧 得到 ${n}！`, trophy: (n) => `🏆 得到 ${n}，可以擺在院子裡！`,
    help: '島上生活小指南', helpBody: [
      '🌱 種田：在下面工具列選 🌱 種子，走到自己家的田地按 E 種下；🚿 澆水會長得快一倍。作物就算你離開遊戲也會繼續長大。',
      '🎣 釣魚：拿釣竿面對河、海或池塘按 E，等浮標動了（「！」）趕快再按 E。不同地方、白天晚上有不同的魚。',
      '🥅 捕蟲：拿捕蟲網慢慢靠近蟲蟲（不要跑！）按 E 揮網。花叢、樹、草地、水邊都有不同的蟲。',
      '🪓⛏️ 砍樹、敲石頭拿木材和礦石；空手在樹旁按 E 可以搖下水果，在草地按 E 拔草得到纖維。',
      '🔨 在工坊用材料做武器、防具、更好的工具和料理；在木匠家具店升級房子、買家具，打開 🏠 擺在院子裡。',
      '👥 走到別人旁邊，在 👥 朋友裡可以加好友、送禮、邀請組隊。組好隊到北邊的魔王祭壇挑戰魔王：F 攻擊、空白鍵翻滾躲開地上的紅圈、Q 吃料理回血。',
    ],
  },
  en: {
    title: 'Breezy Isle', sub: 'Farm, fish, catch bugs, build a home, craft gear and team up against bosses with friends!', name: 'Your nickname', nameTip: 'Others will see this name. Don’t use your real full name',
    look: 'Look', skin: 'Skin', hair: 'Hair colour', style: 'Hairstyle', shirt: 'Shirt', pants: 'Trousers', styles: { short: 'Short', long: 'Long', pony: 'Ponytail', spiky: 'Spiky', bun: 'Bun', cap: 'Cap' },
    with: 'Play with', public: '🌍 Public isle', private: '🔒 Private isle', solo: '🙂 Solo', newRoom: 'New isle', join: 'Join', code: 'Code',
    publicTip: 'Play with everyone on the public isle', privateTip: (c) => `Tell your friends the code ${c}; everyone with the same code plays together`, soloTip: 'Offline, just you',
    enter: 'Sail to the isle', connecting: 'Connecting…', online: (n) => `🟢 ${n} on the isle`, offline: 'Couldn’t connect, playing solo for now',
    hand: 'Hand', axe: 'Axe', pick: 'Pickaxe', rod: 'Rod', net: 'Net', can: 'Can', seed: 'Seeds',
    a: { talk: 'Talk', store: 'General store', decor: 'Furniture shop', workshop: 'Workshop', board: 'Notice board', altar: 'Challenge a boss', chop: 'Chop', shake: 'Shake tree', mine: 'Mine', fiber: 'Pull weeds', cast: 'Cast', reel: 'Reel in!', swing: 'Swing net', plant: 'Plant', water: 'Water', harvest: 'Harvest', house: 'My home', attack: 'Attack' },
    noSeeds: 'No seeds of that kind', needWater: 'Can’t fish here', tired: 'Nothing here for now, come back later', got: (s) => `Got ${s}`, newDex: '📖 New!', escaped: 'It got away…', tooEarly: 'Nothing on the hook yet…', bugFled: 'It flew away…', missed: 'Missed…',
    lvup: (n) => `🎉 Level ${n}!`, coins: 'Coins', buy: 'Buy', sell: 'Sell', sellAll: 'Sell all', craft: 'Craft', need: 'Needs', owned: 'Have', equip: 'Equip', unequip: 'Unequip', eat: 'Eat', place: 'Place', remove: 'Put away',
    bag: 'Bag', char: 'Character', dex: 'Encyclopedia', social: 'Friends', daily: 'Daily tasks', home: 'My home', chat: 'Chat', settings: 'Settings', all: 'All', none: 'Empty',
    store: 'General Store', decorShop: 'Carpenter & Furniture', workshop: 'Workshop', board: 'Notice Board', fish: 'Fish', bug: 'Bugs', where: { river: 'River', sea: 'Sea', pond: 'Pond', flowers: 'Flowers', trees: 'Trees', grass: 'Grass', water: 'Waterside', rocks: 'Rocks' },
    when: { day: 'Day', night: 'Night', any: 'All day' }, rare: ['', 'Common', 'Uncommon', 'Rare', 'Very rare', 'Legendary'],
    upgrade: 'Upgrade house', upgraded: (n) => `🏠 Your home is now a ${n}!`, roof: 'Roof colour', wall: 'Wall colour', yard: 'Yard (tap a square to place decor)', farmSize: (n) => `${n} farm squares`, houseNow: 'Now', maxHouse: 'This is the biggest home',
    tasks: (d) => `Daily tasks (${d})`, claim: 'Claim', claimed: '✔ Claimed', taskNames: { fish: 'Catch fish', bug: 'Catch bugs', harvest: 'Harvest crops', wood: 'Collect wood', stone: 'Collect stone', gift: 'Give a friend a gift', craft: 'Craft at the workshop', sell: 'Sell at the store', fruit: 'Shake fruit from trees' },
    onIsle: 'On the isle', friends: 'My friends', party: 'Party', invite: 'Invite to party', addFriend: 'Add friend', gift: 'Gift', leave: 'Leave party', isFriend: 'Friend', noOne: 'Nobody else is here yet', noFriends: 'No friends yet; go and meet people on the isle!',
    friendAsk: (n) => `${n} wants to be friends`, partyAsk: (n) => `${n} invites you to a boss party`, yes: 'Yes', no: 'No', friendOk: (n) => `🤝 You and ${n} are friends!`, giftFrom: (n, s) => `🎁 ${n} gave you ${s}!`, giftSent: (n) => `🎁 Sent to ${n}!`, giftPick: (n) => `What will you give ${n}?`,
    partyFull: 'The party is full (4 max)', joined: (n) => `${n} joined the party`, partyLeft: (n) => `${n} left the party`, notNear: 'Get a bit closer',
    boss: 'Boss Altar', fightStart: 'Start the fight', fighting: 'Someone is fighting the boss…', onlyLeader: 'Only the party leader can start', bossWin: (n) => `🏆 You beat the ${n}!`, bossLose: 'The whole party fell… gear up and try again!', down: 'You’re down… wait for your party', partyIn: (n) => `Fighting: ${n} (party members near the altar)`,
    pcKeys: 'WASD move · drag or Z / X to turn the camera · wheel to zoom · Shift run · E action · 1–7 tools · F attack · Space roll · Q eat', touchKeys: 'Left stick to move · drag the right half to turn the camera · buttons bottom right', lang: '中文', sound: 'Sound',
    shopTabs: ['Buy', 'Sell'], tool: 'Tool', toolUp: (n) => `🔧 Got the ${n}!`, trophy: (n) => `🏆 You got the ${n}; put it in your yard!`,
    help: 'Island life guide', helpBody: [
      '🌱 Farming: pick 🌱 seeds on the toolbar, walk onto your own farm and press E to plant; 🚿 watering makes them grow twice as fast. Crops keep growing even while you are away.',
      '🎣 Fishing: face a river, the sea or the pond with your rod and press E; when the float bobs (“!”), press E again quickly. Different places and times have different fish.',
      '🥅 Bugs: walk up to a bug slowly (don’t run!) with your net and press E to swing. Flowers, trees, grass and water all have different bugs.',
      '🪓⛏️ Chop trees and mine rocks for wood and ore; with an empty hand, press E by a tree to shake fruit down, or on grass to pull weeds for fiber.',
      '🔨 The workshop turns materials into weapons, armour, better tools and food; the carpenter upgrades your home and sells furniture you can place from 🏠.',
      '👥 Walk up to someone and open 👥 to add a friend, give a gift or invite them to a party. Then take on a boss at the altar up north: F attacks, Space rolls out of the red rings, Q eats food to heal.',
    ],
  },
};
export const tr = () => STR[save.lang] || STR.en;
export { expFor };
