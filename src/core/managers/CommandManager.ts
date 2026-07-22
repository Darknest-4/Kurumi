import { join } from 'node:path';
import {
  Collection,
  REST,
  Routes,
  MessageFlags,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js';
import type { Command } from '../structures/Command';
import type { KurumiClient } from '../KurumiClient';
import { walk, subdirs, loadDefault } from '../../utils/loaderFs';
import { createLogger } from '../logger/logger';
import { env } from '../../config/env';
import { errorEmbed } from '../../utils/embeds';

const log = createLogger('commands');

/**
 * Loads slash commands from every module, registers them with Discord, and
 * routes interactions through the shared gate chain (blacklist → maintenance
 * → module enabled → guild/dev only → permission → cooldown → execute).
 */
export class CommandManager {
  readonly commands = new Collection<string, Command>();

  constructor(private readonly client: KurumiClient) {}

  /** Discover command files under `modules/<mod>/commands`. */
  load(modulesRoot: string): void {
    for (const moduleDir of subdirs(modulesRoot)) {
      const commandsDir = join(moduleDir, 'commands');
      for (const file of walk(commandsDir)) {
        const command = loadDefault<Command>(file);
        if (!command?.data) continue;
        this.commands.set(command.data.name, command);
      }
    }
    log.info({ count: this.commands.size }, 'commands loaded');
  }

  /** Push command definitions to Discord (guild-scoped in dev, global otherwise). */
  async deploy(): Promise<void> {
    const rest = new REST().setToken(env.DISCORD_TOKEN);
    const body = this.commands.map((c) => c.data.toJSON());
    if (env.DEV_GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DEV_GUILD_ID), {
        body,
      });
      log.info({ guild: env.DEV_GUILD_ID, count: body.length }, 'guild commands deployed');
    } else {
      await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
      log.info({ count: body.length }, 'global commands deployed');
    }
  }

  async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command?.autocomplete) return;
    try {
      await command.autocomplete(interaction, this.client);
    } catch (err) {
      log.error({ err, command: interaction.commandName }, 'autocomplete failed');
    }
  }

  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    try {
      // 1. Blacklist & maintenance.
      if (await this.client.permissions.isDeveloper(interaction.user.id)) {
        // developers bypass blacklist & maintenance
      } else {
        if (await this.client.isBlacklisted(interaction.user.id)) {
          return void this.reject(interaction, 'You are blacklisted from using this bot.');
        }
        if (await this.client.isMaintenance()) {
          return void this.reject(
            interaction,
            '🛠️ Kurumi is under maintenance. Please try again later.',
          );
        }
      }

      // 2. Guild-only.
      if (command.guildOnly !== false && !interaction.inGuild()) {
        return void this.reject(interaction, 'This command can only be used in a server.');
      }
      const guildId = interaction.guildId!;

      // 3. Developer-only.
      if (command.developerOnly && !(await this.client.permissions.isDeveloper(interaction.user.id))) {
        return void this.reject(interaction, 'This command is developer-only.');
      }

      // 4. Module enabled.
      if (!(await this.client.modules.isEnabled(guildId, command.module))) {
        return void this.reject(interaction, `The **${command.module}** module is disabled here.`);
      }

      // 5. Permission node.
      if (command.permission && interaction.inCachedGuild()) {
        const ok = await this.client.permissions.can(interaction.member, command.permission);
        if (!ok) {
          return void this.reject(
            interaction,
            `You lack the \`${command.permission}\` permission.`,
          );
        }
      }

      // 6. Command-level cooldown (duration resolved from config, DB-driven).
      if (command.cooldownKey) {
        const remaining = await this.client.cooldowns.remaining(
          guildId,
          interaction.user.id,
          command.cooldownKey,
        );
        if (remaining > 0) {
          return void this.reject(
            interaction,
            `⏳ On cooldown — try again in **${Math.ceil(remaining / 1000)}s**.`,
          );
        }
      }

      await command.execute({ client: this.client, interaction, guildId });

      if (command.cooldownKey) {
        const seconds = await this.client.config.getNumber(
          guildId,
          'cooldown',
          command.cooldownKey,
          0,
        );
        await this.client.cooldowns.set(guildId, interaction.user.id, command.cooldownKey, seconds);
      }
    } catch (err) {
      log.error({ err, command: interaction.commandName }, 'command execution failed');
      await this.reject(interaction, 'An unexpected error occurred while running this command.');
    }
  }

  private async reject(interaction: ChatInputCommandInteraction, message: string): Promise<void> {
    const payload = { embeds: [errorEmbed(message)] };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
      }
    } catch {
      /* interaction may have expired */
    }
  }
}
