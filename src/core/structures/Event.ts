import type { ClientEvents } from 'discord.js';
import type { KurumiClient } from '../KurumiClient';

/**
 * A gateway/client event handler. Events may belong to a module; if that
 * module is disabled for a guild, the handler is expected to no-op for it.
 */
export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  /** Optional module gate; purely informational for the loader. */
  module?: string;
  execute(client: KurumiClient, ...args: ClientEvents[K]): Promise<void> | void;
}

export function defineEvent<K extends keyof ClientEvents>(event: Event<K>): Event<K> {
  return event;
}
