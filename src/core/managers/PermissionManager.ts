import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { PermissionEffect, PermissionTargetType } from '@prisma/client';
import { prisma } from '../database/prisma';
import { redis } from '../database/redis';
import { env } from '../../config/env';
import { createLogger } from '../logger/logger';

const log = createLogger('permissions');
const DEV_CACHE_KEY = 'dev:ids';
const DEV_CACHE_TTL = 60;

/**
 * Node-based permission system. Nodes (e.g. "economy.work") are assigned to
 * roles or users per guild and stored in the DB. Wildcards are supported
 * ("economy.*", "*"). DENY always overrides ALLOW.
 *
 * Resolution order:
 *   1. Bootstrap owners & registered developers → allow everything.
 *   2. Explicit DENY assignment matching the node → deny.
 *   3. Explicit ALLOW assignment matching the node → allow.
 *   4. Default policy based on the node class (owner/developer/admin/gameplay).
 */
export class PermissionManager {
  /** True if the user is a bootstrap owner or a DB-registered developer. */
  async isDeveloper(userId: string): Promise<boolean> {
    if (env.BOOTSTRAP_OWNER_IDS.includes(userId)) return true;
    const ids = await this.developerIds();
    return ids.has(userId);
  }

  private async developerIds(): Promise<Set<string>> {
    try {
      const cached = await redis.get(DEV_CACHE_KEY);
      if (cached) return new Set(JSON.parse(cached) as string[]);
    } catch {
      /* ignore */
    }
    const devs = await prisma.developer.findMany({ select: { userId: true } });
    const ids = devs.map((d) => d.userId);
    try {
      await redis.set(DEV_CACHE_KEY, JSON.stringify(ids), 'EX', DEV_CACHE_TTL);
    } catch {
      /* ignore */
    }
    return new Set(ids);
  }

  async invalidateDevelopers(): Promise<void> {
    await redis.del(DEV_CACHE_KEY).catch(() => undefined);
  }

  /** Core check. Returns whether `member` is allowed to use `node`. */
  async can(member: GuildMember, node: string): Promise<boolean> {
    // 1. Developers/owners bypass everything.
    if (await this.isDeveloper(member.id)) return true;
    if (member.guild.ownerId === member.id) return true;

    const roleIds = member.roles.cache.map((r) => r.id);
    const targetIds = [member.id, ...roleIds];

    const assignments = await prisma.permissionAssignment.findMany({
      where: { guildId: member.guild.id, targetId: { in: targetIds } },
    });

    let allowed: boolean | null = null;
    for (const a of assignments) {
      if (!nodeMatches(a.node, node)) continue;
      if (a.effect === PermissionEffect.DENY) return false; // DENY wins outright
      if (a.effect === PermissionEffect.ALLOW) allowed = true;
    }
    if (allowed === true) return true;

    // 4. Fall back to the default policy for this node class.
    return this.defaultPolicy(member, node);
  }

  /** Sensible defaults so a fresh guild works without any assignments. */
  private defaultPolicy(member: GuildMember, node: string): boolean {
    if (node === 'owner') return false; // only guild owner (handled above)
    if (node === 'developer' || node.startsWith('developer.')) return false;
    if (node === 'admin' || node.startsWith('admin.') || isAdminNode(node)) {
      return (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild)
      );
    }
    // Gameplay nodes are open to everyone by default; guilds can DENY them.
    return true;
  }

  async assign(
    guildId: string,
    node: string,
    targetType: PermissionTargetType,
    targetId: string,
    effect: PermissionEffect = PermissionEffect.ALLOW,
  ): Promise<void> {
    await prisma.permissionAssignment.upsert({
      where: { guildId_node_targetType_targetId: { guildId, node, targetType, targetId } },
      create: { guildId, node, targetType, targetId, effect },
      update: { effect },
    });
    log.debug({ guildId, node, targetId, effect }, 'permission assigned');
  }

  async unassign(
    guildId: string,
    node: string,
    targetType: PermissionTargetType,
    targetId: string,
  ): Promise<void> {
    await prisma.permissionAssignment
      .delete({
        where: { guildId_node_targetType_targetId: { guildId, node, targetType, targetId } },
      })
      .catch(() => undefined);
  }
}

/** These nodes require elevated Discord permissions by default. */
const ADMIN_NODE_PREFIXES = [
  'boss.spawn',
  'vault.start',
  'bomb.start',
  'raid.start',
  'config',
  'module',
  'permission',
  'moderation',
];

function isAdminNode(node: string): boolean {
  return ADMIN_NODE_PREFIXES.some((p) => node === p || node.startsWith(`${p}.`));
}

/**
 * Does an assignment node cover a requested node?
 * Supports exact match and trailing wildcards: "*", "economy.*".
 */
function nodeMatches(assigned: string, requested: string): boolean {
  if (assigned === '*') return true;
  if (assigned === requested) return true;
  if (assigned.endsWith('.*')) {
    const prefix = assigned.slice(0, -2);
    return requested === prefix || requested.startsWith(`${prefix}.`);
  }
  return false;
}
