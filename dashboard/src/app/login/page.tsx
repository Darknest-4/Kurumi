import { redirect } from 'next/navigation';
import { isAuthed } from '@/lib/auth';
import { doLogin } from '../actions';

export const dynamic = 'force-dynamic';

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  if (isAuthed()) redirect('/');
  return (
    <div className="login-wrap">
      <form action={doLogin} className="card login-card">
        <div className="brand" style={{ justifyContent: 'center' }}>
          <span className="logo">🌸</span>
          <span className="gradient-text">Kurumi</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Sign in to manage your servers.
        </p>
        <input
          type="password"
          name="password"
          placeholder="Dashboard password"
          autoFocus
          required
          style={{ marginTop: 12 }}
        />
        <button className="btn primary" style={{ width: '100%', marginTop: 12 }} type="submit">
          Sign in
        </button>
        {searchParams.error && <div className="error">Incorrect password.</div>}
      </form>
    </div>
  );
}
