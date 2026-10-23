// Breezy Isle: everything you can own, grow, catch, craft, build and fight.
// Names are [中文, English]. Prices are what the shop pays you; buying costs more (see buyPrice).

const I = {};
const add = (kind, list) => { for (const [id, zh, en, icon, price, extra] of list) I[id] = { id, kind, n: [zh, en], icon, price, ...(extra || {}) }; };

add('mat', [
  ['wood', '木材', 'Wood', '🪵', 4], ['stone', '石頭', 'Stone', '🪨', 4], ['iron', '鐵礦', 'Iron Ore', '🔩', 18], ['gold', '金礦', 'Gold Ore', '🟨', 50],
  ['fiber', '雜草纖維', 'Fiber', '🌾', 2], ['crystal', '水晶', 'Crystal', '💎', 150], ['gel', '史萊姆凝膠', 'Slime Gel', '🟢', 40],
  ['core', '巨像核心', 'Golem Core', '🗿', 120], ['scale', '龍鱗', 'Dragon Scale', '🐉', 300],
]);
// crops: grow seconds (real time; watering doubles the speed for 3 minutes), seed price at the store
export const CROPS = {
  carrot: { grow: 180, seed: 10, color: 0xff8a2a }, tomato: { grow: 300, seed: 16, color: 0xe8322c }, corn: { grow: 480, seed: 24, color: 0xf2d23a },
  strawberry: { grow: 360, seed: 30, color: 0xff3a5a }, eggplant: { grow: 420, seed: 26, color: 0x7a3aa8 }, pumpkin: { grow: 720, seed: 50, color: 0xff9a1a },
};
add('crop', [
  ['carrot', '紅蘿蔔', 'Carrot', '🥕', 22], ['tomato', '番茄', 'Tomato', '🍅', 34], ['corn', '玉米', 'Corn', '🌽', 52],
  ['strawberry', '草莓', 'Strawberry', '🍓', 64], ['eggplant', '茄子', 'Eggplant', '🍆', 56], ['pumpkin', '南瓜', 'Pumpkin', '🎃', 120],
  ['apple', '蘋果', 'Apple', '🍎', 12], ['orange', '橘子', 'Orange', '🍊', 12], ['peach', '桃子', 'Peach', '🍑', 14], ['cherry', '櫻桃', 'Cherries', '🍒', 14],
]);
for (const id of Object.keys(CROPS)) I['seed_' + id] = { id: 'seed_' + id, kind: 'seed', crop: id, n: [I[id].n[0] + '種子', I[id].n[1] + ' Seeds'], icon: '🌱', price: Math.round(CROPS[id].seed / 2) };

// fish: where (river / sea / pond), when (day / night / any), how rare (1 common … 5 legendary)
export const FISH = [
  ['crucian', '鯽魚', 'Crucian Carp', '🐟', 'river', 'any', 1, 20], ['carp', '鯉魚', 'Carp', '🐟', 'pond', 'any', 1, 24], ['goldfish', '金魚', 'Goldfish', '🐠', 'pond', 'day', 3, 120],
  ['trout', '鱒魚', 'Trout', '🐟', 'river', 'day', 2, 60], ['catfish', '鯰魚', 'Catfish', '🐟', 'pond', 'night', 2, 90], ['eel', '鰻魚', 'Eel', '🐍', 'river', 'night', 3, 160],
  ['salmon', '鮭魚', 'Salmon', '🐟', 'river', 'any', 2, 70], ['koi', '錦鯉', 'Koi', '🎏', 'pond', 'any', 4, 400],
  ['sardine', '沙丁魚', 'Sardine', '🐟', 'sea', 'any', 1, 18], ['mackerel', '鯖魚', 'Mackerel', '🐟', 'sea', 'any', 1, 26], ['clownfish', '小丑魚', 'Clownfish', '🐠', 'sea', 'day', 2, 80],
  ['puffer', '河豚', 'Pufferfish', '🐡', 'sea', 'any', 3, 180], ['crab', '螃蟹', 'Crab', '🦀', 'sea', 'any', 2, 60], ['shrimp', '蝦子', 'Shrimp', '🦐', 'sea', 'night', 2, 70],
  ['squid', '魷魚', 'Squid', '🦑', 'sea', 'night', 3, 150], ['octopus', '章魚', 'Octopus', '🐙', 'sea', 'any', 3, 200], ['tuna', '鮪魚', 'Tuna', '🐟', 'sea', 'day', 4, 500],
  ['shark', '鯊魚', 'Shark', '🦈', 'sea', 'any', 5, 1500], ['whale', '小鯨魚', 'Baby Whale', '🐳', 'sea', 'night', 5, 2000], ['coelacanth', '腔棘魚', 'Coelacanth', '🐟', 'pond', 'night', 5, 2500],
].map(([id, zh, en, icon, where, when, rare, price]) => ({ id, n: [zh, en], icon, where, when, rare, price }));
for (const f of FISH) I[f.id] = { id: f.id, kind: 'fish', n: f.n, icon: f.icon, price: f.price, rare: f.rare };

// bugs: where (flowers / trees / grass / water / rocks), when, rarity
export const BUGS = [
  ['whitefly', '紋白蝶', 'Cabbage White', '🦋', 'flowers', 'day', 1, 16], ['swallowtail', '鳳蝶', 'Swallowtail', '🦋', 'flowers', 'day', 3, 140], ['emperor', '大紫蛺蝶', 'Purple Emperor', '🦋', 'flowers', 'day', 5, 1200],
  ['bee', '蜜蜂', 'Honeybee', '🐝', 'flowers', 'day', 1, 20], ['ladybug', '瓢蟲', 'Ladybug', '🐞', 'flowers', 'day', 2, 50], ['caterpillar', '毛毛蟲', 'Caterpillar', '🐛', 'grass', 'any', 1, 14],
  ['ant', '螞蟻', 'Ant', '🐜', 'grass', 'any', 1, 10], ['cricket', '蟋蟀', 'Cricket', '🦗', 'grass', 'night', 2, 60], ['mantis', '螳螂', 'Mantis', '🦗', 'flowers', 'day', 3, 220],
  ['snail', '蝸牛', 'Snail', '🐌', 'rocks', 'any', 1, 18], ['beetle', '獨角仙', 'Rhino Beetle', '🪲', 'trees', 'night', 4, 600], ['stag', '鍬形蟲', 'Stag Beetle', '🪲', 'trees', 'any', 3, 300],
  ['firefly', '螢火蟲', 'Firefly', '✨', 'water', 'night', 2, 120], ['spider', '蜘蛛', 'Spider', '🕷️', 'trees', 'night', 2, 70], ['dragonfly', '蜻蜓', 'Dragonfly', '🪽', 'water', 'day', 2, 90],
].map(([id, zh, en, icon, where, when, rare, price]) => ({ id, n: [zh, en], icon, where, when, rare, price }));
for (const b of BUGS) I[b.id] = { id: b.id, kind: 'bug', n: b.n, icon: b.icon, price: b.price, rare: b.rare };

// gear: w weapon, a armour, x accessory
add('gear', [
  ['sword_wood', '木劍', 'Wooden Sword', '🗡️', 20, { slot: 'w', atk: 6 }], ['sword_stone', '石劍', 'Stone Sword', '🗡️', 60, { slot: 'w', atk: 11 }],
  ['sword_iron', '鐵劍', 'Iron Sword', '⚔️', 200, { slot: 'w', atk: 18 }], ['sword_gold', '黃金劍', 'Golden Sword', '⚔️', 600, { slot: 'w', atk: 27 }],
  ['sword_crystal', '水晶刃', 'Crystal Blade', '🔷', 1500, { slot: 'w', atk: 38 }], ['sword_dragon', '龍牙劍', 'Dragonfang', '🔥', 4000, { slot: 'w', atk: 55 }],
  ['armor_wood', '木甲', 'Wooden Armour', '🦺', 20, { slot: 'a', def: 3, hp: 10 }], ['armor_stone', '石甲', 'Stone Armour', '🦺', 60, { slot: 'a', def: 6, hp: 20 }],
  ['armor_iron', '鐵甲', 'Iron Armour', '🛡️', 200, { slot: 'a', def: 10, hp: 40 }], ['armor_gold', '黃金甲', 'Golden Armour', '🛡️', 600, { slot: 'a', def: 15, hp: 60 }],
  ['armor_slime', '凝膠斗篷', 'Gel Cloak', '🧥', 900, { slot: 'a', def: 13, hp: 120 }], ['armor_dragon', '龍鱗甲', 'Dragonscale Armour', '🐲', 4000, { slot: 'a', def: 26, hp: 150 }],
  ['ring_power', '力量戒指', 'Ring of Power', '💍', 300, { slot: 'x', atk: 6 }], ['amulet_life', '生命項鍊', 'Life Amulet', '📿', 300, { slot: 'x', hp: 50 }],
  ['clover', '幸運草', 'Lucky Clover', '🍀', 300, { slot: 'x', luck: 1 }], ['core_charm', '巨像護符', 'Golem Charm', '🧿', 1200, { slot: 'x', def: 8, hp: 60 }],
]);
// food: eaten in a fight to heal (or for a speed boost)
add('food', [
  ['soup', '蔬菜湯', 'Veggie Soup', '🍲', 60, { heal: 45 }], ['grilled', '烤魚', 'Grilled Fish', '🍢', 40, { heal: 35 }],
  ['pie', '南瓜派', 'Pumpkin Pie', '🥧', 200, { heal: 110 }], ['smoothie', '水果冰沙', 'Fruit Smoothie', '🥤', 50, { heal: 20, speed: 8 }],
  ['salad', '沙拉', 'Salad', '🥗', 80, { heal: 60 }], ['jam', '草莓果醬', 'Strawberry Jam', '🍯', 150, { heal: 80 }],
]);
// yard decorations (bought at the furniture shop or crafted)
export const DECOR = {
  fence: { icon: '🚧', cost: 40, n: ['木柵欄', 'Fence'] }, flowers: { icon: '🌷', cost: 60, n: ['花圃', 'Flower Bed'] }, lamp: { icon: '🏮', cost: 120, n: ['路燈', 'Lamp'] },
  bench: { icon: '🪑', cost: 150, n: ['長椅', 'Bench'] }, mailbox: { icon: '📮', cost: 100, n: ['信箱', 'Mailbox'] }, scarecrow: { icon: '🎃', cost: 180, n: ['稻草人', 'Scarecrow'] },
  well: { icon: '⛲', cost: 400, n: ['水井', 'Well'] }, tree: { icon: '🌳', cost: 90, n: ['小樹', 'Little Tree'] }, umbrella: { icon: '⛱️', cost: 220, n: ['陽傘桌', 'Parasol Table'] },
  campfire: { icon: '🔥', cost: 160, n: ['營火', 'Campfire'] }, swing: { icon: '🎠', cost: 600, n: ['鞦韆', 'Swing'] }, windmill: { icon: '🌀', cost: 900, n: ['小風車', 'Windmill'] },
  trophy_slime: { icon: '🏆', cost: 0, n: ['史萊姆王獎盃', 'Slime King Trophy'], trophy: true }, trophy_golem: { icon: '🏆', cost: 0, n: ['巨像獎盃', 'Golem Trophy'], trophy: true },
  trophy_dragon: { icon: '🏆', cost: 0, n: ['巨龍獎盃', 'Dragon Trophy'], trophy: true },
};
for (const [id, d] of Object.entries(DECOR)) I['decor_' + id] = { id: 'decor_' + id, kind: 'decor', decor: id, n: d.n, icon: d.icon, price: Math.round(d.cost / 3) };

// tools: everyone starts with tier 1; better ones are crafted
export const TOOLS = {
  axe: { icon: '🪓', n: ['斧頭', 'Axe'], tiers: [['木斧', 'Axe'], ['鐵斧', 'Iron Axe'], ['黃金斧', 'Golden Axe']] },
  pick: { icon: '⛏️', n: ['十字鎬', 'Pickaxe'], tiers: [['石鎬', 'Pickaxe'], ['鐵鎬', 'Iron Pickaxe'], ['黃金鎬', 'Golden Pickaxe']] },
  rod: { icon: '🎣', n: ['釣竿', 'Fishing Rod'], tiers: [['竹釣竿', 'Bamboo Rod'], ['好釣竿', 'Good Rod'], ['黃金釣竿', 'Golden Rod']] },
  net: { icon: '🥅', n: ['捕蟲網', 'Bug Net'], tiers: [['捕蟲網', 'Bug Net'], ['大捕蟲網', 'Big Net'], ['黃金捕蟲網', 'Golden Net']] },
  can: { icon: '🚿', n: ['澆水壺', 'Watering Can'], tiers: [['澆水壺', 'Watering Can'], ['大澆水壺', 'Big Can'], ['黃金澆水壺', 'Golden Can']] },
};
export const HOTBAR = ['hand', 'axe', 'pick', 'rod', 'net', 'can', 'seed'];

// workshop recipes: [result, count, { item: n }, needed tier/flag]
export const RECIPES = [
  ['sword_wood', 1, { wood: 10 }], ['armor_wood', 1, { wood: 12, fiber: 6 }],
  ['sword_stone', 1, { wood: 5, stone: 15 }], ['armor_stone', 1, { stone: 20, fiber: 10 }],
  ['sword_iron', 1, { wood: 5, iron: 12 }], ['armor_iron', 1, { iron: 16, fiber: 10 }],
  ['sword_gold', 1, { iron: 6, gold: 10 }], ['armor_gold', 1, { gold: 14, iron: 6 }],
  ['armor_slime', 1, { gel: 8, fiber: 20, iron: 6 }], ['sword_crystal', 1, { crystal: 4, gold: 6, core: 2 }],
  ['core_charm', 1, { core: 3, stone: 30 }], ['sword_dragon', 1, { scale: 4, crystal: 4, gold: 10 }], ['armor_dragon', 1, { scale: 5, gold: 12, gel: 6 }],
  ['ring_power', 1, { gold: 4, crystal: 1 }], ['amulet_life', 1, { gold: 3, gel: 3 }], ['clover', 1, { fiber: 30, strawberry: 3 }],
  ['tool_axe2', 1, { iron: 8, wood: 10 }], ['tool_pick2', 1, { iron: 10, wood: 6 }], ['tool_rod2', 1, { iron: 6, fiber: 15 }], ['tool_net2', 1, { iron: 5, fiber: 20 }], ['tool_can2', 1, { iron: 8 }],
  ['tool_axe3', 1, { gold: 8, wood: 20 }], ['tool_pick3', 1, { gold: 10, iron: 10 }], ['tool_rod3', 1, { gold: 8, crystal: 1 }], ['tool_net3', 1, { gold: 8, crystal: 1 }], ['tool_can3', 1, { gold: 8 }],
  ['soup', 1, { carrot: 1, tomato: 1 }], ['grilled', 1, { wood: 1, crucian: 1 }], ['grilled', 1, { wood: 1, sardine: 1 }], ['salad', 1, { tomato: 1, corn: 1, eggplant: 1 }],
  ['pie', 1, { pumpkin: 1, apple: 1 }], ['smoothie', 1, { orange: 1, peach: 1 }], ['jam', 1, { strawberry: 3, cherry: 1 }],
  ['decor_fence', 2, { wood: 6 }], ['decor_bench', 1, { wood: 15 }], ['decor_well', 1, { stone: 40, wood: 10 }], ['decor_campfire', 1, { wood: 10, stone: 6 }],
];
for (const t of Object.keys(TOOLS)) for (const k of [2, 3]) I[`tool_${t}${k}`] = { id: `tool_${t}${k}`, kind: 'tool', tool: t, tier: k, n: TOOLS[t].tiers[k - 1], icon: TOOLS[t].icon, price: k === 2 ? 100 : 400 };

// houses: each stage costs materials and coins; a bigger house has a bigger farm and yard
export const HOUSES = [
  { n: ['帳篷', 'Tent'], cost: {}, coins: 0, farm: 4 },
  { n: ['小木屋', 'Log Cabin'], cost: { wood: 30, stone: 10 }, coins: 500, farm: 6 },
  { n: ['石頭屋', 'Stone Cottage'], cost: { wood: 40, stone: 40, iron: 10 }, coins: 2000, farm: 9 },
  { n: ['大宅院', 'Manor'], cost: { wood: 60, iron: 30, gold: 10 }, coins: 6000, farm: 12 },
  { n: ['城堡', 'Castle'], cost: { stone: 120, gold: 30, crystal: 5 }, coins: 20000, farm: 16 },
];
export const COLORS = ['#e8584a', '#ff9a3a', '#f2d23a', '#6cc04a', '#3aa8d8', '#5a6ae8', '#a85ad8', '#f4f0e8', '#8a5a3a', '#3a3a48'];
export const LOOKS = {
  skin: ['#ffe0c8', '#f2c9a0', '#d8a070', '#a86a40', '#6a4028'],
  hair: ['#2a1a10', '#6a3a1a', '#c88a3a', '#f2d26a', '#e8584a', '#5a6ae8', '#ff8ac8', '#f4f4f4'],
  style: ['short', 'long', 'pony', 'spiky', 'bun', 'cap'],
};

// bosses: hp and attack per player in the party (more players → more hp)
export const BOSSES = {
  slime: { n: ['史萊姆王', 'Slime King'], icon: '🟢', hp: 1100, atk: 24, speed: 3.4, size: 2.6, rec: ['建議：石製以上裝備', 'Suggested: stone gear or better'], drops: { gel: [3, 6], coins: [200, 400], iron: [2, 5] }, trophy: 'trophy_slime', lv: 1 },
  golem: { n: ['森林巨像', 'Forest Golem'], icon: '🗿', hp: 3800, atk: 44, speed: 3.8, size: 3.2, rec: ['建議：鐵製以上裝備', 'Suggested: iron gear or better'], drops: { core: [2, 4], crystal: [1, 3], coins: [600, 1000], gold: [2, 5] }, trophy: 'trophy_golem', lv: 8 },
  dragon: { n: ['熔岩巨龍', 'Lava Dragon'], icon: '🐉', hp: 7000, atk: 40, speed: 4.4, size: 4.2, rec: ['建議：黃金或水晶裝備', 'Suggested: golden or crystal gear'], drops: { scale: [2, 5], crystal: [2, 4], coins: [2000, 3500] }, trophy: 'trophy_dragon', lv: 16 },
};

export const ITEMS = I;
export const buyPrice = (id) => Math.max(1, Math.round((I[id].kind === 'seed' ? CROPS[I[id].crop].seed : I[id].price * 2.5)));
export const STORE = ['seed_carrot', 'seed_tomato', 'seed_corn', 'seed_strawberry', 'seed_eggplant', 'seed_pumpkin', 'soup', 'grilled'];
export const KINDS = { mat: ['材料', 'Materials'], crop: ['作物', 'Produce'], seed: ['種子', 'Seeds'], fish: ['魚', 'Fish'], bug: ['昆蟲', 'Bugs'], gear: ['裝備', 'Gear'], food: ['料理', 'Food'], decor: ['家具', 'Decor'], tool: ['工具', 'Tools'] };
export const SAYS = [['你好！', 'Hi!'], ['一起玩吧！', 'Let’s play!'], ['送你的！', 'For you!'], ['謝謝！', 'Thanks!'], ['來組隊打王！', 'Boss party?'], ['跟我來！', 'Follow me!'], ['好厲害！', 'Awesome!'], ['掰掰！', 'Bye!']];
export const EMOTES = ['👋', '😄', '❤️', '🎉', '😮', '😴'];
// life level: exp needed for the next level
export const expFor = (lv) => 40 + lv * 25;
export const maxHp = (lv, gear) => 100 + (lv - 1) * 12 + (gear.hp || 0);
