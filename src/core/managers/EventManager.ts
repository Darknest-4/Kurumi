import { join } from 'node:path';
import type { KurumiClient } from '../KurumiClient';
import type { Event } from '../structures/Event';
import { walk, subdirs, loadDefault } from '../../utils/loaderFs';
import { createLogger } from '../logger/logger';

const log = createLogger('events');

/**
 * Loads event handlers from `modules/<mod>/events` and from a shared
 * `events` root, and binds them to the client.
 */
export class EventManager {
  private readonly events: Event[] = [];

  constructor(private readonly client: KurumiClient) {}

  load(modulesRoot: string, sharedEventsRoot?: string): void {
    const files: string[] = [];
    for (const moduleDir of subdirs(modulesRoot)) {
      files.push(...walk(join(moduleDir, 'events')));
    }
    if (sharedEventsRoot) files.push(...walk(sharedEventsRoot));

    for (const file of files) {
      const event = loadDefault<Event>(file);
      if (!event?.name || typeof event.execute !== 'function') continue;
      this.events.push(event);
    }
    this.bind();
    log.info({ count: this.events.length }, 'events loaded');
  }

  private bind(): void {
    for (const event of this.events) {
      const handler = (...args: unknown[]) =>
        Promise.resolve(
          event.execute(this.client, ...(args as never)),
        ).catch((err) => log.error({ err, event: event.name }, 'event handler failed'));

      if (event.once) this.client.once(event.name, handler);
      else this.client.on(event.name, handler);
    }
  }
}
