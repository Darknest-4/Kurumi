import type { ModuleManager } from '../core/managers/ModuleManager';
import { MODULE_DEFINITIONS } from './definitions';

/**
 * Register every module definition with the ModuleManager. Command/event/
 * component files are discovered from the filesystem by the loaders — this
 * only wires up module metadata, default config and default enabled state.
 */
export function registerModules(modules: ModuleManager): void {
  for (const def of MODULE_DEFINITIONS) modules.register(def);
}
