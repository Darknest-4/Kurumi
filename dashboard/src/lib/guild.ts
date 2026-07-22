import { prisma } from './prisma';
import { getSelectedGuild } from './auth';

export async function getGuilds() {
  return prisma.guild.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
}

/** Resolve the active guild id: cookie selection, else the first known guild. */
export async function resolveGuildId(): Promise<string | null> {
  const selected = getSelectedGuild();
  if (selected) return selected;
  const first = await prisma.guild.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  return first?.id ?? null;
}
