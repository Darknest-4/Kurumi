import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  AutocompleteInteraction,
} from 'discord.js';
import type { KurumiClient } from '../KurumiClient';

export type SlashBuilder =
  | SlashCommandBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder;

export interface CommandContext {
  client: KurumiClient;
  interaction: ChatInputCommandInteraction;
  /** Present when the command runs in a guild (guildOnly enforced). */
  guildId: string;
}

/**
 * A slash command. Commands never hardcode gameplay values — they read
 * everything from the ConfigManager at execution time.
 */
export interface Command {
  /** discord.js builder describing the slash command. */
  data: SlashBuilder;
  /** Module this command belongs to; if the module is disabled, it is hidden. */
  module: string;
  /** Permission node required to run (e.g. "economy.work"). */
  permission?: string;
  /** Restrict to guild context. Defaults to true. */
  guildOnly?: boolean;
  /** Default cooldown in seconds if no per-guild config overrides it. */
  cooldownKey?: string;
  /** Whether only developers may run this command. */
  developerOnly?: boolean;
  execute(ctx: CommandContext): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, client: KurumiClient): Promise<void>;
}

/** Identity helper for authoring commands with full type inference. */
export function defineCommand(command: Command): Command {
  return { guildOnly: true, ...command };
}
