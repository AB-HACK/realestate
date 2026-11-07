import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass,
  Building2,
  LayoutDashboard,
  PlusCircle,
  Lock,
  ShieldAlert,
  Link2,
  Settings,
  LogOut,
  ClipboardCheck,
  UserCheck,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useDataStore } from '../../stores/data-store';

interface SidebarProps {
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const { user, logout } = useAuthStore();
  const { plots, suspiciousReports, auditVerification } = useDataStore();

  const openFlags =
    plots.reduce(
      (sum, p) => sum + p.spatial_flags.filter((f) => f.status === 'open').length,
      0
    ) + suspiciousReports.filter((r) => r.status === 'open').length;

  const navItems = [
    {
      name: 'Evidence Overview',
      to: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Land & Plot Registry',
      to: '/plots',
      icon: Compass,
    },
    {
      name: 'Capture Plot Evidence',
      to: '/plots/new',
      icon: PlusCircle,
    },
    {
      name: 'Built Houses & Units',
      to: '/buildings',
      icon: Building2,
    },
    {
      name: 'Record New Building',
      to: '/buildings/new',
      icon: PlusCircle,
    },
    {
      name: 'Field Inspections (D1)',
      to: '/inspections',
      icon: ClipboardCheck,
    },
    {
      name: 'Agent Registry (D2)',
      to: '/agents',
      icon: UserCheck,
    },
    {
      name: 'Vault & Payment Trail',
      to: '/documents',
      icon: Lock,
    },
    {
      name: 'Admin Trust Queues (D5)',
      to: '/admin/review',
      icon: ShieldAlert,
      badge: openFlags > 0 ? String(openFlags) : undefined,
    },
    {
      name: 'Tamper-Evident Audit Log',
      to: '/admin/audit',
      icon: Link2,
      badge: !auditVerification.valid ? '!' : undefined,
      badgeAlert: !auditVerification.valid,
    },
    {
      name: 'NDPA & Currency Settings',
      to: '/settings',
      icon: Settings,
    },
  ];

  return (
    <div className="flex flex-col w-64 bg-slate-950 text-slate-200 border-r border-slate-800 min-h-screen shrink-0">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-3">
        <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
          <Compass className="h-5 w-5" />
        </div>
        <div>
          <span className="font-bold text-base text-white tracking-tight block">
            AecrenEvidence
          </span>
          <span className="text-[11px] text-emerald-400 font-medium block">
            Phases 1, 2 &amp; 3 Evidence Platform
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              end={item.to === '/plots' || item.to === '/buildings'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`
              }
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </span>
              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.badgeAlert
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Active User Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/60 space-y-3">
        <div className="flex items-center gap-2.5">
          <img
            src={
              user?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
            }
            alt={user?.name}
            className="h-8 w-8 rounded-full object-cover border border-emerald-500"
          />
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-emerald-400 uppercase font-semibold">
              Role: {user?.role}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/70 text-slate-200 hover:text-white text-xs font-medium transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
};
