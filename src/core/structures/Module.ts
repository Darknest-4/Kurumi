import type { KurumiClient } from '../KurumiClient';

/**
 * A feature module. Modules are the unit of on/off control: every command,
 * event and component declares the module it belongs to, and a guild can
 * disable any module independently.
 *
 * Adding a new feature = adding a new module folder. No existing code needs
 * to change — the loaders discover it automatically.
 */
export interface ModuleDefinition {
  /** Stable key used in the DB (`guild_modules.module`) and config namespaces. */
  key: string;
  name: string;
  description: string;
  /** Whether the module is enabled by default when a guild is first seen. */
  defaultEnabled: boolean;
  /** Permission nodes this module introduces (for docs / dashboard listing). */
  permissions: string[];
  /** Default config values (namespace = module key) applied on first setup. */
  defaultConfig?: Record<string, unknown>;
  /** Optional lifecycle hook fired once after the client is ready. */
  onReady?(client: KurumiClient): Promise<void> | void;
}

export function defineModule(module: ModuleDefinition): ModuleDefinition {
  return module;
}
