import { Events, type Interaction } from 'discord.js';
import { defineEvent } from '../core/structures/Event';

/** Single entry point for all interactions; routes to the right manager. */
export default defineEvent({
  name: Events.InteractionCreate,
  async execute(client, interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
      await client.commandManager.handle(interaction);
    } else if (interaction.isAutocomplete()) {
      await client.commandManager.handleAutocomplete(interaction);
    } else if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      await client.componentManager.handle(interaction);
    }
  },
});
