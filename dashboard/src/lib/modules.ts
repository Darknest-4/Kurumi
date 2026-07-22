/**
 * Module catalog mirrored from the bot's `src/modules/definitions.ts`.
 * Kept in sync manually so the dashboard can render every module's page,
 * default config fields and permission nodes without importing bot code.
 */
export interface DashModule {
  key: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  permissions: string[];
  defaultConfig?: Record<string, unknown>;
}

export const MODULES: DashModule[] = [
  { key: 'core', name: 'Core', description: 'Essential commands (ping, help, config, module, permission).', defaultEnabled: true, permissions: ['admin', 'owner', 'developer'] },
  { key: 'level', name: 'Leveling', description: 'Message & voice XP, levels and rank cards.', defaultEnabled: true, permissions: ['level.rank', 'level.admin'], defaultConfig: { base: 100, multiplier: 55, exponent: 1.5, 'message.min': 15, 'message.max': 25, 'message.cooldown': 60, 'voice.perMinute': 10 } },
  { key: 'economy', name: 'Economy', description: 'work, daily, pay and gambling — all in XP.', defaultEnabled: true, permissions: ['economy.work', 'economy.daily', 'economy.gamble', 'economy.pay', 'economy.adminpay'], defaultConfig: { 'work.min': 50, 'work.max': 150, 'daily.min': 500, 'daily.max': 1000, 'pay.taxPct': 0, 'gamble.min': 10, 'gamble.max': 100000, 'gamble.winChance': 0.48, 'gamble.payoutMultiplier': 2 } },
  { key: 'profile', name: 'Profile', description: 'Anime-style member profile cards.', defaultEnabled: true, permissions: ['profile.view', 'profile.edit'] },
  { key: 'leaderboard', name: 'Leaderboard', description: 'XP / level leaderboards.', defaultEnabled: true, permissions: ['leaderboard.view'], defaultConfig: { pageSize: 10 } },
  { key: 'shop', name: 'Shop', description: 'Spend XP on titles, colors, banners, boosts, eggs, tickets, lootboxes.', defaultEnabled: true, permissions: ['shop.view', 'shop.buy', 'shop.admin'] },
  { key: 'pets', name: 'Pets', description: 'Anime creatures that grant passive stats.', defaultEnabled: true, permissions: ['pets.view', 'pets.equip'] },
  { key: 'gacha', name: 'Gacha', description: 'Summon anime characters with rarities and passives.', defaultEnabled: true, permissions: ['gacha.roll', 'gacha.view'], defaultConfig: { 'roll.cost': 500, 'rate.COMMON': 0.6, 'rate.RARE': 0.25, 'rate.EPIC': 0.1, 'rate.LEGENDARY': 0.035, 'rate.MYTHIC': 0.014, 'rate.DIVINE': 0.001 } },
  { key: 'boss', name: 'Boss', description: 'Server bosses to fight cooperatively for XP and drops.', defaultEnabled: true, permissions: ['boss.spawn', 'boss.attack'], defaultConfig: { 'attack.baseDamage': 100, 'attack.cooldown': 10 } },
  { key: 'vault', name: 'Vault Event', description: 'Auto/manual 💰 raffle; XP entry fee, one winner takes the pool.', defaultEnabled: true, permissions: ['vault.start', 'vault.auto', 'vault.join'], defaultConfig: { entryCost: 100, durationSeconds: 60, autoEnabled: true, 'auto.messageThreshold': 200, reactionEmoji: '💰' } },
  { key: 'bomb', name: 'Bomb Event', description: 'Last-survivor game; one player eliminated every tick.', defaultEnabled: true, permissions: ['bomb.start', 'bomb.auto', 'bomb.join'], defaultConfig: { entryCost: 100, tickSeconds: 15, joinWindowSeconds: 30, autoEnabled: false } },
  { key: 'raid', name: 'Raid', description: 'Large-scale multi-phase boss raids with shields & special attacks.', defaultEnabled: true, permissions: ['raid.start', 'raid.attack'], defaultConfig: { baseHp: 1000000, phases: 3, 'attack.baseDamage': 250, 'attack.cooldown': 5, 'special.cooldown': 60, 'special.multiplier': 4, 'shield.factor': 0.2 } },
  { key: 'clan', name: 'Clan', description: 'Clans with XP, levels, vault, shop, daily, war and quests.', defaultEnabled: true, permissions: ['clan.create', 'clan.join', 'clan.manage', 'clan.war'], defaultConfig: { createCost: 5000, maxMembers: 30 } },
  { key: 'quiz', name: 'Anime Quiz', description: 'Guess character/opening/voice/anime/manga/logo/studio for XP.', defaultEnabled: true, permissions: ['quiz.play', 'quiz.admin'], defaultConfig: { rewardXp: 200, answerSeconds: 20 } },
  { key: 'moderation', name: 'Moderation', description: 'warn, mute, kick, ban, tempban, timeout, automod.', defaultEnabled: true, permissions: ['moderation.warn', 'moderation.mute', 'moderation.kick', 'moderation.ban', 'moderation.timeout', 'moderation.automod'], defaultConfig: { 'automod.enabled': false, 'automod.maxMentions': 5 } },
  { key: 'reactionroles', name: 'Reaction Roles', description: 'Self-assignable roles via buttons.', defaultEnabled: false, permissions: ['reactionroles.manage'] },
  { key: 'tickets', name: 'Tickets', description: 'Support ticket system.', defaultEnabled: false, permissions: ['tickets.manage', 'tickets.open'] },
  { key: 'giveaway', name: 'Giveaway', description: 'Timed giveaways with optional XP entry.', defaultEnabled: false, permissions: ['giveaway.start', 'giveaway.manage'] },
  { key: 'welcome', name: 'Welcome', description: 'Configurable welcome/leave messages.', defaultEnabled: false, permissions: ['welcome.manage'], defaultConfig: { message: 'Welcome {user} to {server}! 🌸', enabled: false } },
  { key: 'logging', name: 'Logging', description: 'Per-category audit logging to channels.', defaultEnabled: true, permissions: ['logging.manage'] },
  { key: 'developer', name: 'Developer', description: 'Global developer tools: XP ops, spawns, maintenance, blacklist.', defaultEnabled: true, permissions: ['developer'] },
];

export function getModule(key: string): DashModule | undefined {
  return MODULES.find((m) => m.key === key);
}

export const LOG_CATEGORIES = [
  'xp', 'pay', 'vault', 'bomb', 'boss', 'raid', 'clan', 'warn', 'ban', 'kick', 'developer', 'admin',
] as const;
