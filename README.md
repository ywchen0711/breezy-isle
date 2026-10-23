# Breezy Isle 微風島

An online island life game: farm, fish, catch bugs, chop and mine, build and decorate a home, craft gear, give gifts to friends, and team up in parties of up to four against three bosses.

一起在島上種田、釣魚、捕蟲、蓋房子、做裝備、送禮給朋友、組隊打魔王。

Play: https://ywchen0711.github.io/breezy-isle/

- **The island:** one fixed island shared by everyone. It has a town plaza with three shops, a forest and a pond, a flower meadow, a quarry past the river, twelve home plots, and a boss cave up north.
- **Time:** the island clock runs at one real minute per hour, with different fish and bugs by day and by night.
- **Crops:** they grow in real time, even while you are away; watering doubles the speed for three minutes.
- **Collecting:** there are 20 fish and 15 bugs to collect in the encyclopedia.
- **Crafting:** 37 workshop recipes (weapons, armour, better tools, food, decor).
- **Homes:** five house stages, plus yard decor and boss trophies.
- **Multiplayer:** Supabase Realtime (broadcast and presence), with no game server. Friends and gifts use the stable id from the site's cloud save. The party leader's browser runs the boss fight (`js/boss.js`).
- **Tests:** `node tools/test.mjs` checks that the island is walkable, that the data is consistent, and that boss balance matches gear tiers (bot parties).
