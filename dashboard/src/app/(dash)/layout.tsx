import { redirect } from 'next/navigation';
import { isAuthed, getSelectedGuild } from '@/lib/auth';
import { getGuilds } from '@/lib/guild';
import { Sidebar } from '@/components/Sidebar';
import { GuildPicker } from '@/components/GuildPicker';
import { doLogout } from '../actions';

export const dynamic = 'force-dynamic';

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  if (!isAuthed()) redirect('/login');

  const guilds = await getGuilds();
  const selected = getSelectedGuild() ?? guilds[0]?.id ?? null;

  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <div className="topbar">
          <GuildPicker guilds={guilds} selected={selected} />
          <form action={doLogout}>
            <button className="btn small" type="submit">
              Sign out
            </button>
          </form>
        </div>
        {children}
      </main>
    </div>
  );
}
