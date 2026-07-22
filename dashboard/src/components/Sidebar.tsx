'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Overview', icon: '🏠' },
  { href: '/modules', label: 'Modules', icon: '🧩' },
  { href: '/config', label: 'Config', icon: '⚙️' },
  { href: '/permissions', label: 'Permissions', icon: '🔐' },
  { href: '/logs', label: 'Logs', icon: '📜' },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="logo">🌸</span>
        <span className="gradient-text">Kurumi</span>
      </div>
      <div className="nav-section">Manage</div>
      <nav className="nav">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-item ${isActive(l.href) ? 'active' : ''}`}>
            <span>{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
