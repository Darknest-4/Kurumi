import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

/**
 * Runtime file extension: `.ts` when running under tsx (dev), `.js` when
 * running compiled output (prod). Used so the same loaders work in both.
 */
export const RUNTIME_EXT = extname(__filename) || '.js';

const IGNORED_SUFFIXES = ['.d.ts', '.map'];

/** Recursively collect files under `dir` matching the runtime extension. */
export function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (extname(full) === RUNTIME_EXT && !IGNORED_SUFFIXES.some((s) => full.endsWith(s))) {
      out.push(full);
    }
  }
  return out;
}

/** List immediate sub-directory paths of `dir`. */
export function subdirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((e) => join(dir, e))
    .filter((p) => statSync(p).isDirectory());
}

/** Require a module and return its default export (typed by the caller). */
export function loadDefault<T>(filePath: string): T | undefined {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(filePath);
  return (mod?.default ?? mod) as T | undefined;
}

export function fileName(filePath: string): string {
  return basename(filePath, extname(filePath));
}
