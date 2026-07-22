import { ClanRole } from '@prisma/client';
import type { KurumiClient } from '../../core/KurumiClient';
import { prisma } from '../../core/database/prisma';
import { EntityRepository } from '../../repositories/EntityRepository';

const entities = new EntityRepository();

/** Clan level curve: level = floor(sqrt(xp / step)) + 1. */
function clanLevel(xp: bigint, step = 10_000): number {
  return Math.floor(Math.sqrt(Number(xp) / step)) + 1;
}

export class ClanService {
  static async create(
    client: KurumiClient,
    guildId: string,
    userId: string,
    name: string,
    tag: string,
    username?: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const member = await entities.ensureMember(guildId, userId, username);
    const existing = await prisma.clanMember.findUnique({ where: { memberId: member.id } });
    if (existing) return { ok: false, reason: 'You are already in a clan.' };

    const taken = await prisma.clan.findUnique({ where: { guildId_tag: { guildId, tag } } });
    if (taken) return { ok: false, reason: 'That tag is taken.' };

    const cost = await client.config.getNumber(guildId, 'clan', 'createCost', 5000);
    const paid = await client.xp.spend(guildId, userId, cost);
    if (!paid) return { ok: false, reason: `You need ${cost} XP to found a clan.` };

    const clan = await prisma.clan.create({ data: { guildId, name, tag } });
    await prisma.clanMember.create({
      data: { clanId: clan.id, memberId: member.id, role: ClanRole.LEADER },
    });
    await client.logs.record(guildId, 'clan', { actorId: userId, data: { action: 'create', tag } });
    return { ok: true };
  }

  static async join(
    client: KurumiClient,
    guildId: string,
    userId: string,
    tag: string,
    username?: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const member = await entities.ensureMember(guildId, userId, username);
    const existing = await prisma.clanMember.findUnique({ where: { memberId: member.id } });
    if (existing) return { ok: false, reason: 'You are already in a clan.' };

    const clan = await prisma.clan.findUnique({
      where: { guildId_tag: { guildId, tag } },
      include: { _count: { select: { members: true } } },
    });
    if (!clan) return { ok: false, reason: 'No clan with that tag.' };

    const maxMembers = await client.config.getNumber(guildId, 'clan', 'maxMembers', 30);
    if (clan._count.members >= maxMembers) return { ok: false, reason: 'That clan is full.' };

    await prisma.clanMember.create({ data: { clanId: clan.id, memberId: member.id } });
    return { ok: true };
  }

  static async leave(
    guildId: string,
    userId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const member = await entities.getMember(guildId, userId);
    if (!member) return { ok: false, reason: 'You are not in a clan.' };
    const membership = await prisma.clanMember.findUnique({
      where: { memberId: member.id },
      include: { clan: { include: { _count: { select: { members: true } } } } },
    });
    if (!membership) return { ok: false, reason: 'You are not in a clan.' };

    if (membership.role === ClanRole.LEADER && membership.clan._count.members > 1) {
      return { ok: false, reason: 'Transfer leadership before leaving (or be the last member).' };
    }
    await prisma.clanMember.delete({ where: { id: membership.id } });
    if (membership.clan._count.members <= 1) {
      await prisma.clan.delete({ where: { id: membership.clanId } }).catch(() => undefined);
    }
    return { ok: true };
  }

  static async deposit(
    client: KurumiClient,
    guildId: string,
    userId: string,
    amount: bigint,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (amount <= 0n) return { ok: false, reason: 'Amount must be positive.' };
    const member = await entities.getMember(guildId, userId);
    const membership = member
      ? await prisma.clanMember.findUnique({ where: { memberId: member.id } })
      : null;
    if (!member || !membership) return { ok: false, reason: 'You are not in a clan.' };

    const paid = await client.xp.spend(guildId, userId, amount);
    if (!paid) return { ok: false, reason: 'Insufficient XP.' };

    const clan = await prisma.clan.update({
      where: { id: membership.clanId },
      data: { vault: { increment: amount }, xp: { increment: amount } },
    });
    await prisma.clan.update({ where: { id: clan.id }, data: { level: clanLevel(clan.xp) } });
    await prisma.clanMember.update({
      where: { id: membership.id },
      data: { contributed: { increment: amount } },
    });
    await client.logs.record(guildId, 'clan', {
      actorId: userId,
      data: { action: 'deposit', amount: amount.toString() },
    });
    return { ok: true };
  }
}
