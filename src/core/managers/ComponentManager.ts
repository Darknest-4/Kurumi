import { join } from 'node:path';
import { MessageFlags, type Interaction } from 'discord.js';
import type { KurumiClient } from '../KurumiClient';
import type { Component, ComponentInteraction } from '../structures/Component';
import { parseCustomId } from '../structures/Component';
import { walk, subdirs, loadDefault } from '../../utils/loaderFs';
import { createLogger } from '../logger/logger';
import { errorEmbed } from '../../utils/embeds';

const log = createLogger('components');

/**
 * Loads buttons/modals/select-menus from `modules/<mod>/components` and routes
 * incoming component interactions by their customId prefix.
 */
export class ComponentManager {
  private readonly handlers = new Map<string, Component>();

  constructor(private readonly client: KurumiClient) {}

  load(modulesRoot: string): void {
    for (const moduleDir of subdirs(modulesRoot)) {
      for (const file of walk(join(moduleDir, 'components'))) {
        const component = loadDefault<Component>(file);
        if (!component?.id || typeof component.execute !== 'function') continue;
        this.handlers.set(`${component.kind}:${component.id}`, component);
      }
    }
    log.info({ count: this.handlers.size }, 'components loaded');
  }

  async handle(interaction: Interaction): Promise<void> {
    let kind: string | null = null;
    if (interaction.isButton()) kind = 'button';
    else if (interaction.isAnySelectMenu()) kind = 'selectmenu';
    else if (interaction.isModalSubmit()) kind = 'modal';
    if (!kind) return;

    const { id, args } = parseCustomId((interaction as ComponentInteraction).customId);
    const handler = this.handlers.get(`${kind}:${id}`);
    if (!handler) return;

    try {
      if (handler.module && interaction.inGuild()) {
        const enabled = await this.client.modules.isEnabled(interaction.guildId, handler.module);
        if (!enabled) return;
      }
      if (handler.permission && interaction.inCachedGuild()) {
        const ok = await this.client.permissions.can(interaction.member, handler.permission);
        if (!ok) {
          await (interaction as ComponentInteraction).reply({
            embeds: [errorEmbed(`You lack the \`${handler.permission}\` permission.`)],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }
      await handler.execute(interaction as ComponentInteraction, this.client, args);
    } catch (err) {
      log.error({ err, id }, 'component handler failed');
    }
  }
}
