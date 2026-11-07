import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrencyStore } from '../../stores/currency-store';
import { UserRole } from '../../types';
import { Menu, X, Coins, UserCheck } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, switchRole } = useAuthStore();
  const { displayCurrency, toggleCurrency, ngnPerUsd } = useCurrencyStore();

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex">
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="m-3 h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Utility Header (Currency Switcher + RBAC Role Selector) */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-xs text-slate-600 hidden sm:block">
              <span className="font-semibold text-slate-900">Evidence-First Platform</span> · No
              blanket &ldquo;verified&rdquo; badges · WGS84 Geodesic Math
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* NGN <-> USD Currency Switcher */}
            <button
              type="button"
              onClick={toggleCurrency}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold transition"
              title={`1 USD = ₦${ngnPerUsd.toLocaleString()}`}
            >
              <Coins className="h-3.5 w-3.5 text-emerald-700" />
              Currency: {displayCurrency === 'NGN' ? '₦ NGN (Naira)' : '$ USD (Dollar)'}
              <span className="text-[10px] font-normal text-emerald-700 underline ml-1">
                Switch to {displayCurrency === 'NGN' ? '$ USD' : '₦ NGN'}
              </span>
            </button>

            {/* Quick RBAC Role Switcher for Testing All 6 Roles */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
              <UserCheck className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-slate-500 hidden sm:inline">Active Role:</span>
              <select
                value={user?.role || 'admin'}
                onChange={(e) => switchRole(e.target.value as UserRole)}
                className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="admin">Admin (Review &amp; Audit)</option>
                <option value="owner">Owner (Plot Submitter)</option>
                <option value="agent">Agent (LASRERA Checked)</option>
                <option value="inspector">Inspector (Field Capture)</option>
                <option value="buyer_renter">Buyer / Renter</option>
                <option value="visitor">Visitor (Public View)</option>
              </select>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
