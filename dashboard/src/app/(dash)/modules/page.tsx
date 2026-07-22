import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { resolveGuildId } from '@/lib/guild';
import { MODULES } from '@/lib/modules';
import { toggleModule } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function ModulesPage() {
  const guildId = await resolveGuildId();
  if (!guildId) return <div className="card">Select a server first.</div>;

  const rows = await prisma.guildModule.findMany({ where: { guildId } });
  const overrides = new Map(rows.map((m) => [m.module, m.enabled]));

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>
          <span className="gradient-text">Modules</span>
        </h1>
        <p className="muted" style={{ marginTop: -6 }}>
          Enable or disable any feature. Click a card to configure it.
        </p>
      </div>

      <div className="grid cols-2">
        {MODULES.map((m) => {
          const enabled = overrides.get(m.key) ?? m.defaultEnabled;
          return (
            <div key={m.key} className="card">
              <div className="row between">
                <Link href={`/modules/${m.key}`}>
                  <h3 style={{ margin: 0 }}>{m.name}</h3>
                </Link>
                <form action={toggleModule}>
                  <input type="hidden" name="guildId" value={guildId} />
                  <input type="hidden" name="module" value={m.key} />
                  <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
                  <button className={`pill ${enabled ? 'on' : 'off'}`} type="submit" style={{ cursor: 'pointer' }}>
                    {enabled ? '● ON' : '○ OFF'}
                  </button>
                </form>
              </div>
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
                {m.description}
              </p>
              <Link href={`/modules/${m.key}`} className="muted mono" style={{ fontSize: 12 }}>
                {m.key} →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
