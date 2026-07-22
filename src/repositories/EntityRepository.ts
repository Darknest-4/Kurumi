import type { Member } from '@prisma/client';
import { prisma } from '../core/database/prisma';

/**
 * Ensures core entities (User, Guild, Member) exist before use. All FK-bearing
 * writes go through here so a member row is always backed by its user & guild.
 */
export class EntityRepository {
  async ensureUser(userId: string, username?: string): Promise<void> {
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, username },
      update: username ? { username } : {},
    });
  }

  async ensureGuild(guildId: string, name?: string): Promise<void> {
    await prisma.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, name },
      update: name ? { name } : {},
    });
  }

  /** Get-or-create a member, ensuring its user & guild rows exist. */
  async ensureMember(guildId: string, userId: string, username?: string): Promise<Member> {
    await this.ensureUser(userId, username);
    await this.ensureGuild(guildId);
    return prisma.member.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId },
      update: {},
    });
  }

  async getMember(guildId: string, userId: string): Promise<Member | null> {
    return prisma.member.findUnique({ where: { guildId_userId: { guildId, userId } } });
  }
}
