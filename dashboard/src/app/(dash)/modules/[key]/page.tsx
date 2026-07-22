import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { resolveGuildId } from '@/lib/guild';
import { getModule } from '@/lib/modules';
import { toggleModule, setConfigValue, resetConfigValue } from '../../../actions';

export const dynamic = 'force-dynamic';

export default async function ModulePage({ params }: { params: { key: string } }) {
  const mod = getModule(params.key);
  if (!mod) notFound();

  const guildId = await resolveGuildId();
  if (!guildId) return <div className="card">Select a server first.</div>;

  const [row, configRows] = await Promise.all([
    prisma.guildModule.findUnique({ where: { guildId_module: { guildId, module: mod.key } } }),
    prisma.guildConfig.findMany({ where: { guildId, namespace: mod.key } }),
  ]);
  const enabled = row?.enabled ?? mod.defaultEnabled;
  const overrides = new Map(configRows.map((c) => [c.key, c.value]));

  // Merge default keys with any custom keys stored in the DB.
  const keys = Array.from(
    new Set([...Object.keys(mod.defaultConfig ?? {}), ...configRows.map((c) => c.key)]),
  ).sort();

  return (
    <div className="grid" style={{ gap: 18 }}>
      <Link href="/modules" className="muted">
        ← All modules
      </Link>

      <div className="card">
        <div className="row between">
          <div>
            <h1 style={{ fontSize: 24, margin: 0 }}>
              <span className="gradient-text">{mod.name}</span>
            </h1>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {mod.description}
            </p>
          </div>
          <form action={toggleModule}>
            <input type="hidden" name="guildId" value={guildId} />
            <input type="hidden" name="module" value={mod.key} />
            <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
            <button className={`btn ${enabled ? 'danger' : 'primary'}`} type="submit">
              {enabled ? 'Disable' : 'Enable'}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3>⚙️ Configuration</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Values are stored as JSON. A blank override falls back to the module default.
          Namespace: <code>{mod.key}</code>
        </p>

        {keys.length === 0 && <p className="muted">This module has no tunable config.</p>}

        {keys.map((key) => {
          const hasOverride = overrides.has(key);
          const current = hasOverride ? overrides.get(key) : mod.defaultConfig?.[key];
          return (
            <div key={key} className="kv">
              <form action={setConfigValue} className="row" style={{ flex: 1, gap: 8 }}>
                <input type="hidden" name="guildId" value={guildId} />
                <input type="hidden" name="namespace" value={mod.key} />
                <input type="hidden" name="key" value={key} />
                <code style={{ minWidth: 160 }}>{key}</code>
                <input name="value" defaultValue={JSON.stringify(current)} style={{ flex: 1 }} />
                <button className="btn small primary" type="submit">
                  Save
                </button>
              </form>
              <span className={`pill ${hasOverride ? 'allow' : 'off'}`}>
                {hasOverride ? 'override' : 'default'}
              </span>
              {hasOverride && (
                <form action={resetConfigValue}>
                  <input type="hidden" name="guildId" value={guildId} />
                  <input type="hidden" name="namespace" value={mod.key} />
                  <input type="hidden" name="key" value={key} />
                  <button className="btn small" type="submit">
                    Reset
                  </button>
                </form>
              )}
            </div>
          );
        })}

        <form action={setConfigValue} className="row" style={{ marginTop: 14, gap: 8 }}>
          <input type="hidden" name="guildId" value={guildId} />
          <input type="hidden" name="namespace" value={mod.key} />
          <input name="key" placeholder="new.key" style={{ maxWidth: 200 }} />
          <input name="value" placeholder='value (JSON, e.g. 250 or "text")' style={{ flex: 1 }} />
          <button className="btn small" type="submit">
            Add
          </button>
        </form>
      </div>

      <div className="card">
        <h3>🔐 Permission nodes</h3>
        <div className="row">
          {mod.permissions.map((p) => (
            <span key={p} className="pill mono">
              {p}
            </span>
          ))}
        </div>
        <Link href="/permissions" className="muted" style={{ display: 'inline-block', marginTop: 10 }}>
          Assign these to roles or users →
        </Link>
      </div>
    </div>
  );
}
