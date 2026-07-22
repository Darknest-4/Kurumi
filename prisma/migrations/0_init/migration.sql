-- CreateEnum
CREATE TYPE "PermissionTargetType" AS ENUM ('ROLE', 'USER');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE');

-- CreateEnum
CREATE TYPE "ShopItemType" AS ENUM ('TITLE', 'COLOR', 'BANNER', 'AVATAR_FRAME', 'XP_BOOST', 'PET_EGG', 'VAULT_TICKET', 'BOMB_SHIELD', 'LOOTBOX', 'BADGE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EventState" AS ENUM ('PENDING', 'ACTIVE', 'RESOLVING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClanRole" AS ENUM ('LEADER', 'OFFICER', 'MEMBER');

-- CreateEnum
CREATE TYPE "QuizType" AS ENUM ('CHARACTER', 'OPENING', 'VOICE', 'ANIME', 'MANGA', 'LOGO', 'STUDIO');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('WARN', 'MUTE', 'KICK', 'BAN', 'TEMPBAN', 'TIMEOUT', 'UNBAN', 'UNMUTE');

-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "premium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_modules" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,

    CONSTRAINT "guild_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_assignments" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "node" TEXT NOT NULL,
    "targetType" "PermissionTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" BIGINT NOT NULL DEFAULT 0,
    "totalXp" BIGINT NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "messages" BIGINT NOT NULL DEFAULT 0,
    "voiceSecs" BIGINT NOT NULL DEFAULT 0,
    "activeTitleId" TEXT,
    "activeBadgeId" TEXT,
    "activePetId" TEXT,
    "activeWaifuId" TEXT,
    "bannerUrl" TEXT,
    "color" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooldowns" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooldowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_boosts" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xp_boosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_species" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "imageUrl" TEXT,
    "rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
    "stats" JSONB NOT NULL,
    "passive" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pet_species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_pets" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "nickname" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" BIGINT NOT NULL DEFAULT 0,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gacha_characters" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "anime" TEXT,
    "emoji" TEXT,
    "imageUrl" TEXT,
    "rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
    "passive" TEXT,
    "effects" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "gacha_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_characters" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "level" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bosses" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "anime" TEXT,
    "emoji" TEXT,
    "imageUrl" TEXT,
    "baseHp" BIGINT NOT NULL DEFAULT 10000,
    "attack" INTEGER NOT NULL DEFAULT 100,
    "drops" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bosses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "imageUrl" TEXT,
    "rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "titles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_titles" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT,
    "condition" JSONB NOT NULL,
    "rewardXp" BIGINT NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" BIGINT NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_items" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ShopItemType" NOT NULL,
    "price" BIGINT NOT NULL,
    "payload" JSONB,
    "stock" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemType" "ShopItemType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_events" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "entryCost" BIGINT NOT NULL,
    "prizePool" BIGINT NOT NULL DEFAULT 0,
    "state" "EventState" NOT NULL DEFAULT 'PENDING',
    "winnerId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "vault_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_participants" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bomb_events" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "entryCost" BIGINT NOT NULL,
    "prizePool" BIGINT NOT NULL DEFAULT 0,
    "tickSeconds" INTEGER NOT NULL DEFAULT 15,
    "state" "EventState" NOT NULL DEFAULT 'PENDING',
    "survivorId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "bomb_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bomb_participants" (
    "id" TEXT NOT NULL,
    "bombId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eliminatedAt" TIMESTAMP(3),
    "placement" INTEGER,

    CONSTRAINT "bomb_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boss_instances" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "maxHp" BIGINT NOT NULL,
    "currentHp" BIGINT NOT NULL,
    "state" "EventState" NOT NULL DEFAULT 'ACTIVE',
    "spawnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defeatedAt" TIMESTAMP(3),

    CONSTRAINT "boss_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boss_contributions" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "damage" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "boss_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raid_instances" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "bossKey" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "maxHp" BIGINT NOT NULL,
    "currentHp" BIGINT NOT NULL,
    "phase" INTEGER NOT NULL DEFAULT 1,
    "shield" BIGINT NOT NULL DEFAULT 0,
    "state" "EventState" NOT NULL DEFAULT 'ACTIVE',
    "spawnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "raid_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raid_participants" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "damage" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "raid_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clans" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "emoji" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" BIGINT NOT NULL DEFAULT 0,
    "vault" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_members" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" "ClanRole" NOT NULL DEFAULT 'MEMBER',
    "contributed" BIGINT NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clan_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_quests" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "progress" BIGINT NOT NULL DEFAULT 0,
    "target" BIGINT NOT NULL,
    "rewardXp" BIGINT NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "clan_quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "type" "QuizType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "answer" TEXT NOT NULL,
    "aliases" TEXT[],
    "rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_cases" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "caseNo" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_channels" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "log_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_entries" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "actorId" TEXT,
    "targetId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" TEXT[],
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "developers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giveaways" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "prize" TEXT NOT NULL,
    "winners" INTEGER NOT NULL DEFAULT 1,
    "entryCost" BIGINT NOT NULL DEFAULT 0,
    "state" "EventState" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giveaways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giveaway_entries" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giveaway_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "maintenance" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceNote" TEXT,
    "announcement" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guild_configs_guildId_namespace_idx" ON "guild_configs"("guildId", "namespace");

-- CreateIndex
CREATE UNIQUE INDEX "guild_configs_guildId_namespace_key_key" ON "guild_configs"("guildId", "namespace", "key");

-- CreateIndex
CREATE INDEX "guild_modules_guildId_idx" ON "guild_modules"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_modules_guildId_module_key" ON "guild_modules"("guildId", "module");

-- CreateIndex
CREATE INDEX "permission_assignments_guildId_targetId_idx" ON "permission_assignments"("guildId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "permission_assignments_guildId_node_targetType_targetId_key" ON "permission_assignments"("guildId", "node", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "members_guildId_xp_idx" ON "members"("guildId", "xp");

-- CreateIndex
CREATE INDEX "members_guildId_level_idx" ON "members"("guildId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "members_guildId_userId_key" ON "members"("guildId", "userId");

-- CreateIndex
CREATE INDEX "cooldowns_expiresAt_idx" ON "cooldowns"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "cooldowns_memberId_key_key" ON "cooldowns"("memberId", "key");

-- CreateIndex
CREATE INDEX "xp_boosts_memberId_expiresAt_idx" ON "xp_boosts"("memberId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "pet_species_key_key" ON "pet_species"("key");

-- CreateIndex
CREATE INDEX "user_pets_memberId_idx" ON "user_pets"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "gacha_characters_key_key" ON "gacha_characters"("key");

-- CreateIndex
CREATE INDEX "user_characters_memberId_idx" ON "user_characters"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "user_characters_memberId_characterId_key" ON "user_characters"("memberId", "characterId");

-- CreateIndex
CREATE UNIQUE INDEX "bosses_key_key" ON "bosses"("key");

-- CreateIndex
CREATE UNIQUE INDEX "badges_key_key" ON "badges"("key");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_memberId_badgeId_key" ON "user_badges"("memberId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "titles_key_key" ON "titles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "user_titles_memberId_titleId_key" ON "user_titles"("memberId", "titleId");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_memberId_achievementId_key" ON "user_achievements"("memberId", "achievementId");

-- CreateIndex
CREATE INDEX "shop_items_guildId_enabled_idx" ON "shop_items"("guildId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "shop_items_guildId_key_key" ON "shop_items"("guildId", "key");

-- CreateIndex
CREATE INDEX "inventory_items_memberId_idx" ON "inventory_items"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_memberId_itemKey_key" ON "inventory_items"("memberId", "itemKey");

-- CreateIndex
CREATE INDEX "vault_events_guildId_state_idx" ON "vault_events"("guildId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "vault_participants_vaultId_userId_key" ON "vault_participants"("vaultId", "userId");

-- CreateIndex
CREATE INDEX "bomb_events_guildId_state_idx" ON "bomb_events"("guildId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "bomb_participants_bombId_userId_key" ON "bomb_participants"("bombId", "userId");

-- CreateIndex
CREATE INDEX "boss_instances_guildId_state_idx" ON "boss_instances"("guildId", "state");

-- CreateIndex
CREATE INDEX "boss_contributions_instanceId_damage_idx" ON "boss_contributions"("instanceId", "damage");

-- CreateIndex
CREATE UNIQUE INDEX "boss_contributions_instanceId_userId_key" ON "boss_contributions"("instanceId", "userId");

-- CreateIndex
CREATE INDEX "raid_instances_guildId_state_idx" ON "raid_instances"("guildId", "state");

-- CreateIndex
CREATE INDEX "raid_participants_raidId_damage_idx" ON "raid_participants"("raidId", "damage");

-- CreateIndex
CREATE UNIQUE INDEX "raid_participants_raidId_userId_key" ON "raid_participants"("raidId", "userId");

-- CreateIndex
CREATE INDEX "clans_guildId_xp_idx" ON "clans"("guildId", "xp");

-- CreateIndex
CREATE UNIQUE INDEX "clans_guildId_tag_key" ON "clans"("guildId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "clan_members_memberId_key" ON "clan_members"("memberId");

-- CreateIndex
CREATE INDEX "clan_members_clanId_idx" ON "clan_members"("clanId");

-- CreateIndex
CREATE INDEX "clan_quests_clanId_idx" ON "clan_quests"("clanId");

-- CreateIndex
CREATE INDEX "quiz_questions_type_enabled_idx" ON "quiz_questions"("type", "enabled");

-- CreateIndex
CREATE INDEX "moderation_cases_guildId_userId_idx" ON "moderation_cases"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "moderation_cases_guildId_caseNo_key" ON "moderation_cases"("guildId", "caseNo");

-- CreateIndex
CREATE UNIQUE INDEX "log_channels_guildId_category_key" ON "log_channels"("guildId", "category");

-- CreateIndex
CREATE INDEX "log_entries_guildId_category_createdAt_idx" ON "log_entries"("guildId", "category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "developers_userId_key" ON "developers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "blacklists_userId_key" ON "blacklists"("userId");

-- CreateIndex
CREATE INDEX "giveaways_guildId_state_idx" ON "giveaways"("guildId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "giveaway_entries_giveawayId_userId_key" ON "giveaway_entries"("giveawayId", "userId");

-- AddForeignKey
ALTER TABLE "guild_configs" ADD CONSTRAINT "guild_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_modules" ADD CONSTRAINT "guild_modules_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_assignments" ADD CONSTRAINT "permission_assignments_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooldowns" ADD CONSTRAINT "cooldowns_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_boosts" ADD CONSTRAINT "xp_boosts_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_pets" ADD CONSTRAINT "user_pets_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_pets" ADD CONSTRAINT "user_pets_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "pet_species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_characters" ADD CONSTRAINT "user_characters_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_characters" ADD CONSTRAINT "user_characters_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "gacha_characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_events" ADD CONSTRAINT "vault_events_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_participants" ADD CONSTRAINT "vault_participants_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vault_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bomb_events" ADD CONSTRAINT "bomb_events_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bomb_participants" ADD CONSTRAINT "bomb_participants_bombId_fkey" FOREIGN KEY ("bombId") REFERENCES "bomb_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boss_instances" ADD CONSTRAINT "boss_instances_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boss_instances" ADD CONSTRAINT "boss_instances_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "bosses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boss_contributions" ADD CONSTRAINT "boss_contributions_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "boss_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_instances" ADD CONSTRAINT "raid_instances_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_participants" ADD CONSTRAINT "raid_participants_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "raid_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clans" ADD CONSTRAINT "clans_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_quests" ADD CONSTRAINT "clan_quests_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_channels" ADD CONSTRAINT "log_channels_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developers" ADD CONSTRAINT "developers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklists" ADD CONSTRAINT "blacklists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giveaways" ADD CONSTRAINT "giveaways_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

