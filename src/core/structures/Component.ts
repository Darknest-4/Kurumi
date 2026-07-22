import type {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  AnySelectMenuInteraction,
} from 'discord.js';
import type { KurumiClient } from '../KurumiClient';

export type ComponentKind = 'button' | 'modal' | 'selectmenu';

export type ComponentInteraction =
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction
  | AnySelectMenuInteraction;

/**
 * A message-component / modal handler. Matching is done by a stable
 * customId prefix so dynamic ids can carry payload after a separator,
 * e.g. `vault:join:<eventId>`.
 */
export interface Component<T extends ComponentInteraction = ComponentInteraction> {
  kind: ComponentKind;
  /** customId prefix this handler owns (before the first ':'). */
  id: string;
  module?: string;
  permission?: string;
  execute(interaction: T, client: KurumiClient, args: string[]): Promise<void>;
}

export function defineComponent<T extends ComponentInteraction>(
  component: Component<T>,
): Component<T> {
  return component;
}

/** Build a namespaced customId: `id:arg1:arg2`. */
export function buildCustomId(id: string, ...args: (string | number)[]): string {
  return [id, ...args].join(':');
}

/** Parse a customId into its handler id and payload args. */
export function parseCustomId(customId: string): { id: string; args: string[] } {
  const [id, ...args] = customId.split(':');
  return { id, args };
}
