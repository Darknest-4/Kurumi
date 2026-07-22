import { Events, type Guild } from 'discord.js';
import { defineEvent } from '../core/structures/Event';
import { EntityRepository } from '../repositories/EntityRepository';
import { createLogger } from '../core/logger/logger';

const log = createLogger('guild');
const entities = new EntityRepository();

/** Ensure a guild row exists when Kurumi joins. Module/config defaults are
 *  resolved lazily from the registry, so no per-guild seeding is required. */
export default defineEvent({
  name: Events.GuildCreate,
  async execute(_client, guild: Guild) {
    await entities.ensureGuild(guild.id, guild.name);
    log.info({ guild: guild.id, name: guild.name }, 'joined guild');
  },
});
