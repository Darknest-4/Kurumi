import 'dotenv/config';
import { PrismaClient, Rarity, QuizType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds guild-agnostic CONTENT catalogs (pets, gacha characters, bosses,
 * badges, titles, achievements, quiz). These are DB rows, not hardcoded game
 * logic — edit or extend them freely. Per-guild config/modules are resolved
 * lazily at runtime from the module registry, so nothing guild-specific is
 * seeded here.
 */
async function main(): Promise<void> {
  // ── Pets ────────────────────────────────────────────────────
  const pets = [
    { key: 'kurama', name: 'Kurama', emoji: '🦊', rarity: Rarity.LEGENDARY, stats: { xpBonusPct: 15 }, passive: '+15% message XP' },
    { key: 'pochita', name: 'Pochita', emoji: '🐶', rarity: Rarity.EPIC, stats: { xpBonusPct: 10 }, passive: '+10% XP' },
    { key: 'happy', name: 'Happy', emoji: '🐱', rarity: Rarity.RARE, stats: { luck: 5 }, passive: '+5% gamble luck' },
    { key: 'kirara', name: 'Kirara', emoji: '🐈', rarity: Rarity.RARE, stats: { xpBonusPct: 7 }, passive: '+7% XP' },
    { key: 'slime', name: 'Slime', emoji: '🟦', rarity: Rarity.COMMON, stats: { xpBonusPct: 3 }, passive: '+3% XP' },
    { key: 'dragon', name: 'Dragon', emoji: '🐉', rarity: Rarity.MYTHIC, stats: { xpBonusPct: 20 }, passive: '+20% XP' },
    { key: 'chopper', name: 'Chopper', emoji: '🦌', rarity: Rarity.EPIC, stats: { xpBonusPct: 10, luck: 3 }, passive: '+10% XP, +3% luck' },
  ];
  for (const p of pets) {
    await prisma.petSpecies.upsert({ where: { key: p.key }, create: p, update: p });
  }

  // ── Gacha characters ────────────────────────────────────────
  const chars = [
    { key: 'kurumi', name: 'Kurumi Tokisaki', anime: 'Date A Live', emoji: '⏱️', rarity: Rarity.DIVINE, passive: '+25% XP from all sources' },
    { key: 'rimuru', name: 'Rimuru', anime: 'Tensura', emoji: '🔵', rarity: Rarity.MYTHIC, passive: '+18% XP' },
    { key: 'gojo', name: 'Gojo Satoru', anime: 'Jujutsu Kaisen', emoji: '👁️', rarity: Rarity.LEGENDARY, passive: '+15% boss damage' },
    { key: 'mikasa', name: 'Mikasa', anime: 'Attack on Titan', emoji: '🗡️', rarity: Rarity.EPIC, passive: '+10% raid damage' },
    { key: 'nezuko', name: 'Nezuko', anime: 'Demon Slayer', emoji: '🎋', rarity: Rarity.EPIC, passive: '+8% daily XP' },
    { key: 'luffy', name: 'Luffy', anime: 'One Piece', emoji: '🍖', rarity: Rarity.RARE, passive: '+6% XP' },
    { key: 'zerotwo', name: 'Zero Two', anime: 'Darling in the Franxx', emoji: '🍯', rarity: Rarity.RARE, passive: '+5% gamble luck' },
    { key: 'saitama', name: 'Saitama', anime: 'One Punch Man', emoji: '👊', rarity: Rarity.COMMON, passive: '+3% boss damage' },
  ];
  for (const c of chars) {
    await prisma.gachaCharacter.upsert({ where: { key: c.key }, create: c, update: c });
  }

  // ── Bosses ──────────────────────────────────────────────────
  const bosses = [
    { key: 'madara', name: 'Madara Uchiha', anime: 'Naruto', emoji: '🌑', baseHp: 50000n, attack: 300 },
    { key: 'aizen', name: 'Sōsuke Aizen', anime: 'Bleach', emoji: '🦋', baseHp: 45000n, attack: 280 },
    { key: 'sukuna', name: 'Ryomen Sukuna', anime: 'Jujutsu Kaisen', emoji: '👺', baseHp: 60000n, attack: 350 },
    { key: 'kaido', name: 'Kaido', anime: 'One Piece', emoji: '🐲', baseHp: 70000n, attack: 320 },
    { key: 'meruem', name: 'Meruem', anime: 'Hunter x Hunter', emoji: '🐜', baseHp: 65000n, attack: 340 },
    { key: 'frieza', name: 'Frieza', anime: 'Dragon Ball', emoji: '👽', baseHp: 55000n, attack: 310 },
    { key: 'muzan', name: 'Muzan Kibutsuji', anime: 'Demon Slayer', emoji: '🩸', baseHp: 62000n, attack: 330 },
    { key: 'shadowmonarch', name: 'Shadow Monarch', anime: 'Solo Leveling', emoji: '👑', baseHp: 80000n, attack: 400 },
  ];
  for (const b of bosses) {
    const drops = {
      xp: Number(b.baseHp) / 10,
      badgeKeys: [`slayer_${b.key}`],
      titleKeys: [`conqueror_${b.key}`],
      lootboxKeys: ['boss_lootbox'],
      rates: { badge: 1, title: 0.5, pet: 0.1, lootbox: 0.75 },
    };
    await prisma.boss.upsert({
      where: { key: b.key },
      create: { ...b, drops },
      update: { ...b, drops },
    });
  }

  // ── Badges & titles for boss drops ──────────────────────────
  for (const b of bosses) {
    await prisma.badge.upsert({
      where: { key: `slayer_${b.key}` },
      create: { key: `slayer_${b.key}`, name: `${b.name} Slayer`, emoji: b.emoji, rarity: Rarity.EPIC },
      update: {},
    });
    await prisma.title.upsert({
      where: { key: `conqueror_${b.key}` },
      create: { key: `conqueror_${b.key}`, text: `Conqueror of ${b.name}` },
      update: {},
    });
  }

  // ── Achievements ────────────────────────────────────────────
  const achievements = [
    { key: 'first_steps', name: 'First Steps', description: 'Reach level 5', emoji: '🐣', condition: { type: 'level', threshold: 5 }, rewardXp: 500n },
    { key: 'chatterbox', name: 'Chatterbox', description: 'Send 1,000 messages', emoji: '💬', condition: { type: 'messages', threshold: 1000 }, rewardXp: 2000n },
    { key: 'boss_hunter', name: 'Boss Hunter', description: 'Defeat 10 bosses', emoji: '⚔️', condition: { type: 'bossKills', threshold: 10 }, rewardXp: 5000n },
    { key: 'high_roller', name: 'High Roller', description: 'Win a gamble of 10k+', emoji: '🎰', condition: { type: 'gambleWin', threshold: 10000 }, rewardXp: 1000n },
  ];
  for (const a of achievements) {
    await prisma.achievement.upsert({ where: { key: a.key }, create: a, update: a });
  }

  // ── Quiz questions (sample) ─────────────────────────────────
  const quiz = [
    { type: QuizType.CHARACTER, prompt: 'Orange jumpsuit, dreams of becoming Hokage?', answer: 'Naruto', aliases: ['naruto uzumaki'] },
    { type: QuizType.ANIME, prompt: 'Titans threaten humanity behind three walls.', answer: 'Attack on Titan', aliases: ['shingeki no kyojin', 'aot'] },
    { type: QuizType.STUDIO, prompt: 'Studio behind Demon Slayer & Fate/Zero?', answer: 'Ufotable', aliases: [] },
  ];
  for (const q of quiz) {
    await prisma.quizQuestion.create({ data: q }).catch(() => undefined);
  }

  // ── Global state row ────────────────────────────────────────
  await prisma.globalState.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  // ── Bootstrap developers from env ───────────────────────────
  const owners = (process.env.BOOTSTRAP_OWNER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const id of owners) {
    await prisma.user.upsert({ where: { id }, create: { id }, update: {} });
    await prisma.developer.upsert({
      where: { userId: id },
      create: { userId: id, permissions: [] },
      update: {},
    });
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed complete.');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
