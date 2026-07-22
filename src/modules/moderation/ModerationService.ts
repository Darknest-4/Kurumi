import { ModerationAction } from '@prisma/client';
import type { KurumiClient } from '../../core/KurumiClient';
import { prisma } from '../../core/database/prisma';

const LOG_CATEGORY: Partial<Record<ModerationAction, 'warn' | 'ban' | 'kick'>> = {
  WARN: 'warn',
  BAN: 'ban',
  TEMPBAN: 'ban',
  KICK: 'kick',
};

export class ModerationService {
  /** Create a numbered moderation case and log it. */
  static async createCase(
    client: KurumiClient,
    guildId: string,
    params: {
      userId: string;
      moderatorId: string;
      action: ModerationAction;
      reason?: string;
      expiresAt?: Date;
    },
  ): Promise<number> {
    const last = await prisma.moderationCase.findFirst({
      where: { guildId },
      orderBy: { caseNo: 'desc' },
      select: { caseNo: true },
    });
    const caseNo = (last?.caseNo ?? 0) + 1;

    await prisma.moderationCase.create({
      data: {
        guildId,
        caseNo,
        userId: params.userId,
        moderatorId: params.moderatorId,
        action: params.action,
        reason: params.reason,
        expiresAt: params.expiresAt,
      },
    });

    const category = LOG_CATEGORY[params.action] ?? 'admin';
    await client.logs.record(guildId, category, {
      actorId: params.moderatorId,
      targetId: params.userId,
      data: { case: caseNo, action: params.action, reason: params.reason ?? null },
    });
    return caseNo;
  }
}
