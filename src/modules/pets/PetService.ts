import { Rarity, type PetSpecies } from '@prisma/client';
import { prisma } from '../../core/database/prisma';
import { EntityRepository } from '../../repositories/EntityRepository';

const entities = new EntityRepository();

/** Rarity → relative hatch weight (higher rarity is rarer). */
const HATCH_WEIGHT: Record<Rarity, number> = {
  COMMON: 50,
  RARE: 25,
  EPIC: 15,
  LEGENDARY: 7,
  MYTHIC: 2.5,
  DIVINE: 0.5,
};

export class PetService {
  /** Hatch a weighted-random enabled pet species for a member. */
  static async hatchRandom(
    guildId: string,
    userId: string,
    username?: string,
  ): Promise<PetSpecies | null> {
    const species = await prisma.petSpecies.findMany({ where: { enabled: true } });
    if (species.length === 0) return null;

    const total = species.reduce((a, s) => a + (HATCH_WEIGHT[s.rarity] ?? 1), 0);
    let roll = Math.random() * total;
    let picked = species[0];
    for (const s of species) {
      roll -= HATCH_WEIGHT[s.rarity] ?? 1;
      if (roll <= 0) {
        picked = s;
        break;
      }
    }

    const member = await entities.ensureMember(guildId, userId, username);
    await prisma.userPet.create({ data: { memberId: member.id, speciesId: picked.id } });
    return picked;
  }
}
